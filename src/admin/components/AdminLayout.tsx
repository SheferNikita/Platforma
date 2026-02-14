import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import {
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
  History,
  UserPlus,
  Menu,
  X
} from 'lucide-react';
import { Toaster } from 'sonner';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CURATOR' | 'MENTOR' | 'PSYCHOLOGIST' | 'INTERN' | 'MODERATOR' | 'ADMIN_ASSISTANT' | 'STUDENT';

const navItems: {
  path: string;
  label: string;
  icon: any;
  end?: boolean;
  showBadge?: boolean;
  showDistributionBadge?: boolean;
  roles?: UserRole[];
}[] = [
  { path: '/admin/lessons', label: 'Уроки', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'] },
  { path: '/admin/library', label: 'Библиотека', icon: Library, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
  { path: '/admin/schedule', label: 'Расписание', icon: Calendar, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
  { path: '/admin/contacts', label: 'Контакты', icon: Phone, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/communities', label: 'Общины', icon: Building, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
  { path: '/admin/chats', label: 'Чаты', icon: MessageCircle, roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
  { path: '/admin/mini-groups', label: 'Мини-группы', icon: Users2, roles: ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN'] },
  { path: '/admin/students', label: 'Ученики', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'ADMIN_ASSISTANT'] },
  { path: '/admin/distribution', label: 'Распределение', icon: UserPlus, showDistributionBadge: true, roles: ['SUPER_ADMIN', 'ADMIN', 'CURATOR'] },
  { path: '/admin/moderation', label: 'Обратная связь', icon: MessageCircle, showBadge: true, roles: ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'] },
  { path: '/admin/products', label: 'Продукты', icon: ShoppingBag, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/crm', label: 'CRM', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/payments', label: 'Платежи', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/email', label: 'Email', icon: Mail, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/admins', label: 'Администраторы', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN', 'CURATOR'] },
  { path: '/admin/settings', label: 'Настройки', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/admin/audit', label: 'История изменений', icon: History, roles: ['SUPER_ADMIN'] },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [moderationCount, setModerationCount] = useState(0);
  const [distributionCount, setDistributionCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadCounts();
    const interval = setInterval(loadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadCounts() {
    try {
      const [moderation, distribution] = await Promise.all([
        api.get<{ count: number }>('/public/moderation/count'),
        api.get<{ count: number }>('/public/distribution/unassigned/count')
      ]);
      setModerationCount(moderation.count);
      setDistributionCount(distribution.count);
    } catch (error) {
      console.error('Error loading counts');
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const filteredNavItems = navItems.filter(item => !item.roles || item.roles.includes(user?.role as UserRole));

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#f5f3ed] via-[#ebe8dc] to-[#f0ede3]">
      <Toaster position="top-right" richColors />
      
      {/* Mobile header - visible below md */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#d4c9b0]/30 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-[#3d3527]">Админ-панель</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl hover:bg-[#f5f3ed] transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-[#3d3527]" />
            ) : (
              <Menu className="w-6 h-6 text-[#3d3527]" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`md:hidden fixed top-14 left-0 bottom-0 z-30 w-72 bg-white/95 backdrop-blur-md border-r border-[#d4c9b0]/30 shadow-lg flex flex-col transform transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-4 py-3 border-b border-[#d4c9b0]/30">
          <p className="text-sm text-[#3d3527]/60">{user?.name}</p>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
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
                  {item.showDistributionBadge && distributionCount > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {distributionCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-[#d4c9b0]/30">
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#3d3527] hover:bg-[#f5f3ed] transition-all duration-200 mb-1"
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
        </nav>
      </aside>

      {/* Tablet sidebar (md to xl) - icons only with tooltips */}
      <aside className="hidden md:flex xl:hidden w-16 bg-white/80 backdrop-blur-md border-r border-[#d4c9b0]/30 shadow-lg flex-col flex-shrink-0">
        <div className="p-3 border-b border-[#d4c9b0]/30 flex items-center justify-center">
          <Shield className="w-6 h-6 text-[#a67c52]" />
        </div>
        <nav className="flex-1 py-2 px-1.5 overflow-y-auto">
          <ul className="space-y-0.5">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) =>
                    `relative flex items-center justify-center w-full p-2.5 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white shadow-md'
                        : 'text-[#3d3527] hover:bg-[#f5f3ed]'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.showBadge && moderationCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                      {moderationCount}
                    </span>
                  )}
                  {item.showDistributionBadge && distributionCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                      {distributionCount}
                    </span>
                  )}
                  <span className="absolute left-full ml-2 px-2 py-1 bg-[#3d3527] text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
                    {item.label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-[#d4c9b0]/30 space-y-0.5">
            <NavLink
              to="/"
              title="На платформу"
              className="flex items-center justify-center p-2.5 rounded-xl text-[#3d3527] hover:bg-[#f5f3ed] transition-all duration-200 group relative"
            >
              <BookOpen className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-[#3d3527] text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
                На платформу
              </span>
            </NavLink>
            <button
              onClick={handleLogout}
              title="Выйти"
              className="flex items-center justify-center p-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 w-full group relative"
            >
              <LogOut className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-[#3d3527] text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
                Выйти
              </span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Desktop sidebar (xl+) - full width with labels */}
      <aside className="hidden xl:flex w-64 bg-white/80 backdrop-blur-md border-r border-[#d4c9b0]/30 shadow-lg flex-col flex-shrink-0">
        <div className="p-6 border-b border-[#d4c9b0]/30">
          <h1 className="text-xl font-bold text-[#3d3527]">Админ-панель</h1>
          <p className="text-sm text-[#3d3527]/60 mt-1">{user?.name}</p>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
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
                  {item.showDistributionBadge && distributionCount > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {distributionCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-[#d4c9b0]/30">
            <NavLink
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#3d3527] hover:bg-[#f5f3ed] transition-all duration-200 mb-1"
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
        </nav>
      </aside>
      
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 min-w-0">
        <div className="p-4 md:p-5 lg:p-6 xl:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
