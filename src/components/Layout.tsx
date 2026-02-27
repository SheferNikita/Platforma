import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { User, Calendar, Users } from 'lucide-react';
import { Navigation } from './Navigation';
import { SobrietyCounter } from './SobrietyCounter';
import { NotificationBell } from './NotificationBell';
import { useSettings } from '../lib/settings';
import { useAuth } from '../lib/auth';

export function Layout() {
  const location = useLocation();
  const { isSectionVisible } = useSettings();
  const { user } = useAuth();
  const userTariff = user?.tariff;
  
  const showSchedule = isSectionVisible('schedule', userTariff, user?.role);
  const showContacts = isSectionVisible('contacts', userTariff, user?.role);

  // Scroll to top on route change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Небесный фоновый эффект */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#7d9db5]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-[#b5cad9]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-[#7d9db5]/20 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation */}
      <Navigation />

      {/* Main Content with padding for fixed navigation */}
      <div className="pt-0 md:pt-24 pb-24 md:pb-8 px-4 md:px-8 lg:px-12 relative">
        {/* Mobile top bar - Only on mobile, part of scrollable content */}
        <div className="md:hidden bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md border-2 border-[#b5cad9]/30 rounded-2xl px-4 py-3 shadow-[0_2px_12px_var(--ethereal-shadow)] mb-6 mt-6 relative z-0">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-2xl" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
          }}></div>
          
          {/* First row: Quick links */}
          {(showSchedule || showContacts) && (
            <div className="relative z-10 flex items-center gap-2 mb-3">
              {showSchedule && (
                <NavLink
                  to="/schedule"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 flex-1 justify-center ${
                      isActive
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] border-[var(--button-lavender-dark)] text-white shadow-lg'
                        : 'bg-white/60 border-[var(--sky-light)]/50 hover:border-[var(--button-lavender)]/60 hover:bg-[var(--button-lavender)]/10'
                    }`
                  }
                >
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium">Расписание</span>
                </NavLink>
              )}
              {showContacts && (
                <NavLink
                  to="/contacts"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 flex-1 justify-center ${
                      isActive
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] border-[var(--button-lavender-dark)] text-white shadow-lg'
                        : 'bg-white/60 border-[var(--sky-light)]/50 hover:border-[var(--button-lavender)]/60 hover:bg-[var(--button-lavender)]/10'
                    }`
                  }
                >
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Контакты</span>
                </NavLink>
              )}
            </div>
          )}
          
          {/* Second row: Notifications, Counter, Profile */}
          <div className="relative z-10 grid grid-cols-3 gap-2 items-center">
            <div className="flex justify-start">
              <NotificationBell />
            </div>
            <div className="flex justify-center">
              <SobrietyCounter />
            </div>
            <div className="flex justify-end">
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
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8">
          <Outlet />
          
          {/* Footer */}
          <footer className="mt-10 text-center opacity-50 text-sm tracking-wide">
            <div className="inline-block">
              <p className="relative">
                Платформа Школы трезвости.
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4c9b0] to-transparent"></span>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}