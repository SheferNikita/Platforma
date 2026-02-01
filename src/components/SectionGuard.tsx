import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSettings, VisibilitySettings } from '../lib/settings';
import { useAuth } from '../lib/auth';
import { EyeOff, Home } from 'lucide-react';

interface SectionGuardProps {
  section: keyof VisibilitySettings;
  children: ReactNode;
}

export function SectionGuard({ section, children }: SectionGuardProps) {
  const { isSectionVisible, loading } = useSettings();
  const { user } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--button-lavender)]"></div>
      </div>
    );
  }
  
  const isVisible = isSectionVisible(section, user?.tariff);
  
  if (!isVisible) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <EyeOff className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-[#3d3527] mb-2">
          Раздел временно недоступен
        </h2>
        <p className="text-[#3d3527]/60 mb-6 max-w-md">
          Этот раздел сейчас находится в разработке или недоступен для вашего тарифа. 
          Пожалуйста, попробуйте позже или вернитесь на главную страницу.
        </p>
        <a
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:opacity-90 transition-opacity"
        >
          <Home className="w-4 h-4" />
          На главную
        </a>
      </div>
    );
  }
  
  return <>{children}</>;
}
