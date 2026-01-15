import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CreditCard,
  ShoppingBag,
  Mail,
  Settings,
  LogOut,
  Shield,
  Calendar,
  Library,
  Building,
  Users2,
  Phone,
  ClipboardList,
  MessageCircle,
  History
} from 'lucide-react';
import { Toaster } from 'sonner';

const navItems = [
  { path: '/admin', label: 'Дашборд', icon: LayoutDashboard, end: true },
  { path: '/admin/lessons', label: 'Уроки', icon: BookOpen },
  { path: '/admin/library', label: 'Библиотека', icon: Library },
  { path: '/admin/schedule', label: 'Расписание', icon: Calendar },
  { path: '/admin/contacts', label: 'Контакты', icon: Phone },
  { path: '/admin/communities', label: 'Общины', icon: Building },
  { path: '/admin/mini-groups', label: 'Мини-группы', icon: Users2 },
  { path: '/admin/students', label: 'Ученики', icon: Users },
  { path: '/admin/moderation', label: 'Модерация', icon: MessageCircle, showBadge: true },
  { path: '/admin/products', label: 'Продукты', icon: ShoppingBag },
  { path: '/admin/crm', label: 'CRM', icon: ClipboardList },
  { path: '/admin/payments', label: 'Платежи', icon: CreditCard },
  { path: '/admin/email', label: 'Email', icon: Mail },
  { path: '/admin/admins', label: 'Администраторы', icon: Shield },
  { path: '/admin/audit', label: 'История изменений', icon: History, superAdminOnly: true },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moderationCount, setModerationCount] = useState(0);

  useEffect(() => {
    loadModerationCount();
    const interval = setInterval(loadModerationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadModerationCount() {
    try {
      const data = await api.get<{ count: number }>('/public/moderation/count');
      setModerationCount(data.count);
    } catch (error) {
      console.error('Error loading moderation count');
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#f5f3ed] via-[#ebe8dc] to-[#f0ede3]">
      <Toaster position="top-right" richColors />
      
      <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-[#d4c9b0]/30 shadow-lg flex flex-col">
        <div className="p-6 border-b border-[#d4c9b0]/30">
          <h1 className="text-xl font-bold text-[#3d3527]">Админ-панель</h1>
          <p className="text-sm text-[#3d3527]/60 mt-1">{user?.name}</p>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems
              .filter(item => !item.superAdminOnly || user?.role === 'SUPER_ADMIN')
              .map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white shadow-md'
                        : 'text-[#3d3527] hover:bg-[#f5f3ed]'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.showBadge && moderationCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {moderationCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-[#d4c9b0]/30">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#3d3527] hover:bg-[#f5f3ed] transition-all duration-200 mb-2"
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium">На платформу</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
