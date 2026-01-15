import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { BookOpen, MessageSquare, Library, Calendar, Users, Building, User, AlertCircle, Users2, Heart, LogIn } from 'lucide-react';
import { SobrietyCounter } from './SobrietyCounter';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../lib/auth';

export function Navigation() {
  const { user, loading } = useAuth();
  const navItems = [
    { path: '/', label: 'Уроки', icon: BookOpen },
    { path: '/chats', label: 'Чаты', icon: MessageSquare },
    { path: '/library', label: 'Библиотека', icon: Library },
    { path: '/schedule', label: 'Расписание', icon: Calendar },
    { path: '/mini-group', label: 'Мини-группа', icon: Users2 },
    { path: '/contacts', label: 'Контакты', icon: Users },
    { path: '/communities', label: 'Общины', icon: Building },
  ];

  const mobileNavItems = [
    { path: '/', label: 'Уроки', icon: BookOpen },
    { path: '/chats', label: 'Чаты', icon: MessageSquare },
    { path: '/library', label: 'Библиотека', icon: Library },
    { path: '/mini-group', label: 'Группа', icon: Users2 },
    { path: '/communities', label: 'Общины', icon: Building },
    { path: '/sos', label: 'SOS', icon: AlertCircle },
  ];

  return (
    <>
      {/* Desktop Navigation - Fixed Top */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md shadow-[0_4px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] border-b-2 border-[#b5cad9]/30">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
        }}></div>
        
        <div className="max-w-[1800px] mx-auto px-3 lg:px-6">
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-0.5 lg:gap-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-4 py-3.5 lg:py-4 transition-all duration-300 border-b-3 relative overflow-hidden group whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-b from-[#e8eaf5]/60 to-[#f0f1f9]/40 border-[var(--button-lavender-dark)] text-[var(--button-lavender-dark)] shadow-[inset_0_2px_12px_rgba(122,132,171,0.12)]'
                        : 'bg-transparent border-transparent hover:bg-white/40 opacity-60 hover:opacity-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {!isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      )}
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'drop-shadow-sm' : ''}`} />
                      <span className="relative z-10 tracking-wide text-xs lg:text-sm">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
            <div className="py-2 flex items-center gap-2 lg:gap-3 flex-shrink-0">
              {user && <NotificationBell />}
              <NavLink
                to="/sos"
                className="px-3 lg:px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-[0_8px_20px_rgba(239,68,68,0.45)] transition-all duration-300 text-xs lg:text-sm font-medium transform hover:scale-105 active:scale-95 flex items-center gap-1.5 lg:gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                <span>SOS</span>
              </NavLink>
              {!loading && !user ? (
                <Link
                  to="/register"
                  className="px-4 lg:px-5 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(166,124,82,0.35)] transition-all duration-300 text-xs lg:text-sm font-medium transform hover:scale-105 active:scale-95 flex items-center gap-1.5 lg:gap-2"
                >
                  <Heart className="w-4 h-4" />
                  <span>Начать трезвую жизнь</span>
                </Link>
              ) : (
                <>
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `w-9 h-9 lg:w-10 lg:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] border-[var(--button-lavender-dark)] text-white shadow-lg'
                          : 'bg-white/60 border-[var(--sky-light)]/50 hover:border-[var(--button-lavender)]/60 hover:bg-[var(--button-lavender)]/10'
                      }`
                    }
                  >
                    <User className="w-4 h-4 lg:w-5 lg:h-5" />
                  </NavLink>
                  <div className="hidden lg:block">
                    <SobrietyCounter />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - Fixed Bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Меню навигации */}
        <div className="bg-gradient-to-t from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md shadow-[0_-4px_24px_var(--ethereal-shadow),0_-2px_8px_var(--book-shadow)] border-t-2 border-[#b5cad9]/30">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
          }}></div>
          
          <div className="grid grid-cols-6 relative z-10">
            {mobileNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all duration-300 border-t-3 relative overflow-hidden group ${
                    isActive
                      ? 'bg-gradient-to-t from-[#e8eaf5]/60 to-[#f0f1f9]/40 border-[var(--button-lavender-dark)] text-[var(--button-lavender-dark)] shadow-[inset_0_-2px_12px_rgba(122,132,171,0.12)]'
                      : item.path === '/sos'
                      ? 'bg-transparent border-transparent text-red-500'
                      : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {!isActive && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                    )}
                    <item.icon className={`w-5 h-5 relative z-10 ${isActive ? 'drop-shadow-sm' : ''}`} />
                    <span className="text-[10px] relative z-10 tracking-wide text-center leading-tight">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}