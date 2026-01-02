import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, MessageSquare, Library, Calendar, Users, Building, User, AlertCircle } from 'lucide-react';
import { SobrietyCounter } from './SobrietyCounter';
import { NotificationBell } from './NotificationBell';

export function Navigation() {
  const navItems = [
    { path: '/', label: 'Уроки', icon: BookOpen },
    { path: '/chats', label: 'Чаты', icon: MessageSquare },
    { path: '/library', label: 'Библиотека', icon: Library },
    { path: '/schedule', label: 'Расписание', icon: Calendar },
    { path: '/contacts', label: 'Контакты', icon: Users },
    { path: '/communities', label: 'Общины', icon: Building },
  ];

  const mobileNavItems = [
    { path: '/', label: 'Уроки', icon: BookOpen },
    { path: '/chats', label: 'Чаты', icon: MessageSquare },
    { path: '/library', label: 'Библиотека', icon: Library },
    { path: '/schedule', label: 'Расписание', icon: Calendar },
    { path: '/communities', label: 'Общины', icon: Building },
    { path: '/profile', label: 'Профиль', icon: User },
  ];

  return (
    <>
      {/* Desktop Navigation - Fixed Top */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md shadow-[0_4px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] border-b-2 border-[#b5cad9]/30">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
        }}></div>
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-5 py-4 transition-all duration-300 border-b-3 relative overflow-hidden group ${
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
                      <item.icon className={`w-4 h-4 ${isActive ? 'drop-shadow-sm' : ''}`} />
                      <span className="relative z-10 tracking-wide text-sm">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
            <div className="py-2 flex items-center gap-3">
              <NotificationBell />
              <NavLink
                to="/sos"
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-[0_8px_20px_rgba(239,68,68,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                <span>SOS</span>
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] border-[var(--button-lavender-dark)] text-white shadow-lg'
                      : 'bg-white/60 border-[var(--sky-light)]/50 hover:border-[var(--button-lavender)]/60 hover:bg-[var(--button-lavender)]/10'
                  }`
                }
              >
                <User className="w-5 h-5" />
              </NavLink>
              <SobrietyCounter />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - Fixed Bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Счетчик трезвости над меню */}
        <div className="bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md border-t-2 border-[#b5cad9]/30 px-4 py-2.5 shadow-[0_-2px_12px_var(--ethereal-shadow)]">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
          }}></div>
          <div className="relative z-10 flex items-center justify-between">
            <NotificationBell />
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <SobrietyCounter />
            </div>
            <NavLink
              to="/sos"
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-[0_8px_20px_rgba(239,68,68,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              <span>SOS</span>
            </NavLink>
          </div>
        </div>
        
        {/* еню навигации */}
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