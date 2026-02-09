import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, MessageSquare, Library, Calendar, Users, Building, User, AlertCircle, Users2, MessageCircle, MoreHorizontal, X, Shield } from 'lucide-react';
import { SobrietyCounter } from './SobrietyCounter';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';

export function Navigation() {
  const { user, isAdmin } = useAuth();
  const { isSectionVisible, settings } = useSettings();
  const userTariff = user?.tariff;
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);
  
  const hasMiniGroupAccess = user?.tariff === 'WITH_MENTOR' || user?.tariff === 'WITH_PSYCHOLOGIST';
  const hasMentorResponsesAccess = user?.tariff === 'WITH_MENTOR' || user?.tariff === 'WITH_PSYCHOLOGIST' || user?.tariff === 'INDIVIDUAL_PSYCHOLOGIST';
  
  const allNavItems = [
    { path: '/', label: 'Уроки', icon: BookOpen, section: 'lessons' as const },
    { path: '/mentor-responses', label: 'Ответы', icon: MessageCircle, section: 'mentor_responses' as const, tariffCheck: hasMentorResponsesAccess },
    { path: '/chats', label: 'Чаты', icon: MessageSquare, section: 'chats' as const },
    { path: '/library', label: 'Библиотека', icon: Library, section: 'library' as const },
    { path: '/schedule', label: 'Расписание', icon: Calendar, section: 'schedule' as const },
    { path: '/mini-group', label: 'Мини-группа', icon: Users2, section: 'mini_group' as const, tariffCheck: hasMiniGroupAccess },
    { path: '/contacts', label: 'Контакты', icon: Users, section: 'contacts' as const },
    { path: '/communities', label: 'Общины', icon: Building, section: 'communities' as const },
  ];

  const navItems = allNavItems.filter(item => {
    if (item.tariffCheck === false) return false;
    return isSectionVisible(item.section, userTariff);
  });

  const mobilePrimaryPaths = ['/', '/chats', '/library', '/sos'];

  const allMobileItems = [
    { path: '/', label: 'Уроки', icon: BookOpen, section: 'lessons' as const },
    { path: '/mentor-responses', label: 'Ответы', icon: MessageCircle, section: 'mentor_responses' as const, tariffCheck: hasMentorResponsesAccess },
    { path: '/chats', label: 'Чаты', icon: MessageSquare, section: 'chats' as const },
    { path: '/library', label: 'Библиотека', icon: Library, section: 'library' as const },
    { path: '/schedule', label: 'Расписание', icon: Calendar, section: 'schedule' as const },
    { path: '/mini-group', label: 'Группа', icon: Users2, section: 'mini_group' as const, tariffCheck: hasMiniGroupAccess },
    { path: '/contacts', label: 'Контакты', icon: Users, section: 'contacts' as const },
    { path: '/communities', label: 'Общины', icon: Building, section: 'communities' as const },
    { path: '/sos', label: 'SOS', icon: AlertCircle, section: 'sos' as const },
    { path: '/profile', label: 'Профиль', icon: User, section: 'profile' as const },
  ];

  const filteredMobileItems = allMobileItems.filter(item => {
    if (item.tariffCheck === false) return false;
    return isSectionVisible(item.section, userTariff);
  });

  const mobileMainItems = filteredMobileItems.filter(item => mobilePrimaryPaths.includes(item.path));
  const mobileMoreItems = filteredMobileItems.filter(item => !mobilePrimaryPaths.includes(item.path));
  const isMoreActive = mobileMoreItems.some(item => location.pathname === item.path);
  const mainColCount = mobileMainItems.length + (mobileMoreItems.length > 0 ? 1 : 0);

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
              {settings.logo && (
                <NavLink to="/" className="flex-shrink-0 mr-2 lg:mr-4">
                  <img 
                    src={settings.logo} 
                    alt={settings.platformName || 'Платформа'} 
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg object-cover"
                  />
                </NavLink>
              )}
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
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 lg:px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(166,124,82,0.35)] transition-all duration-300 text-xs lg:text-sm font-medium transform hover:scale-105 active:scale-95"
                >
                  <Shield className="w-4 h-4" />
                  <span>В админку</span>
                </NavLink>
              )}
              <NotificationBell />
              {isSectionVisible('sos', userTariff) && (
                <NavLink
                  to="/sos"
                  className="px-3 lg:px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-[0_8px_20px_rgba(239,68,68,0.45)] transition-all duration-300 text-xs lg:text-sm font-medium transform hover:scale-105 active:scale-95 flex items-center gap-1.5 lg:gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>SOS</span>
                </NavLink>
              )}
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
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation - Fixed Bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {moreOpen && (
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setMoreOpen(false)} />
        )}

        {moreOpen && (
          <div className="relative z-[70] bg-gradient-to-t from-[#fdfbf7] via-[#f0f4f8] to-[#f5f3ed] border-t-2 border-[#b5cad9]/30 rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.12)] px-4 pt-4 pb-2 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#3d3527]">Разделы</span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-[#3d3527]/10 transition-colors">
                <X className="w-5 h-5 text-[#3d3527]/60" />
              </button>
            </div>
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 mb-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-all duration-200 text-sm font-medium"
              >
                <Shield className="w-5 h-5" />
                <span>В админку</span>
              </NavLink>
            )}
            <div className="grid grid-cols-4 gap-1 mb-2">
              {mobileMoreItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-b from-[#e8eaf5]/80 to-[#f0f1f9]/60 text-[var(--button-lavender-dark)] shadow-sm'
                        : item.path === '/sos'
                        ? 'hover:bg-red-50 text-red-500'
                        : 'hover:bg-white/60 text-[#3d3527]/70'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[11px] tracking-wide text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gradient-to-t from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md shadow-[0_-4px_24px_var(--ethereal-shadow),0_-2px_8px_var(--book-shadow)] border-t-2 border-[#b5cad9]/30 relative z-[70]">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
          }}></div>
          
          <div className={`grid relative z-10`} style={{ gridTemplateColumns: `repeat(${mainColCount}, 1fr)` }}>
            {mobileMainItems.map((item) => (
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

            {mobileMoreItems.length > 0 && (
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all duration-300 border-t-3 ${
                  moreOpen
                    ? 'bg-gradient-to-t from-[#e8eaf5]/60 to-[#f0f1f9]/40 border-[var(--button-lavender-dark)] text-[var(--button-lavender-dark)]'
                    : isMoreActive
                    ? 'bg-gradient-to-t from-[#e8eaf5]/40 to-transparent border-[var(--button-lavender-dark)]/60 text-[var(--button-lavender-dark)]'
                    : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <MoreHorizontal className="w-5 h-5 relative z-10" />
                <span className="text-[10px] relative z-10 tracking-wide text-center leading-tight">Ещё</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}