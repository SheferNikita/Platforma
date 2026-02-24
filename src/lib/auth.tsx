import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';
import { safeStorage } from './safeStorage';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CURATOR' | 'MENTOR' | 'PSYCHOLOGIST' | 'INTERN' | 'MODERATOR' | 'STUDENT';
  surveyCompleted?: boolean;
  tariff?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      setUser(user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { user, token } = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
    safeStorage.setItem('auth_token', token);
    setUser(user);
  }

  async function logout() {
    await api.post('/auth/logout');
    safeStorage.removeItem('auth_token');
    setUser(null);
  }

  const isAdmin = user?.role !== 'STUDENT' && user !== null;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
