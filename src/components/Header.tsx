import React from 'react';
import { BookOpen } from 'lucide-react';
import { SobrietyCounter } from './SobrietyCounter';
import { NotificationBell } from './NotificationBell';
import { useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <header className="mb-10 bg-gradient-to-br from-[#fdfcf9] via-[#f0f8fc] to-[#f8f6f1] rounded-2xl shadow-[0_12px_32px_var(--ethereal-shadow),0_4px_12px_var(--book-shadow),inset_0_1px_0_rgba(255,255,255,0.9)] border border-[var(--sky-light)]/40 p-8 relative overflow-hidden transform transition-all duration-500 hover:shadow-[0_16px_40px_var(--ethereal-shadow),0_8px_20px_var(--book-shadow)]">
      {/* Enhanced paper texture with shimmer */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
      }}></div>
      
      {/* Небесное свечение */}
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[var(--sky-soft)]/20 to-transparent pointer-events-none"></div>
      
      {/* Decorative corner ornaments */}
      <div className="absolute top-0 left-0 w-24 h-24 opacity-15">
        <svg viewBox="0 0 100 100" className="text-[var(--sky-blue)]">
          <path d="M0,0 Q50,0 50,50 Q0,50 0,0" fill="currentColor"/>
        </svg>
      </div>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-15 rotate-90">
        <svg viewBox="0 0 100 100" className="text-[var(--sky-blue)]">
          <path d="M0,0 Q50,0 50,50 Q0,50 0,0" fill="currentColor"/>
        </svg>
      </div>
      
      <div className="flex justify-between items-center relative z-10">
        <div className="w-12"></div> {/* Spacer for balance */}
        <SobrietyCounter />
        <NotificationBell />
      </div>
    </header>
  );
}