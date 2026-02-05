import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { X, MessageCircle } from 'lucide-react';
import { useSettings } from '../lib/settings';
import { useAuth } from '../lib/auth';

export function SOSPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, isSectionVisible, loading: settingsLoading } = useSettings();

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--button-lavender)]"></div>
      </div>
    );
  }
  
  if (!isSectionVisible('sos', user?.tariff)) {
    return <Navigate to="/" replace />;
  }

  const sosText = settings.sosText || 'Здесь можно будет обратиться за помощью в экстренной ситуации. Напишите в чате:';
  const sosChatLink = settings.sosChatLink || 'https://t.me/+Ls7ahkX5onkwNmQ6';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed] relative overflow-x-hidden">
      {/* Paper texture overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
      }}></div>

      {/* Dove background - subtle */}
      <div className="fixed top-20 right-10 opacity-[0.02] pointer-events-none text-[200px] hidden md:block">
        🕊️
      </div>

      {/* Close button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 right-6 z-50 w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] hover:shadow-[0_8px_24px_rgba(122,132,171,0.4)] rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 border-2 border-white/50 shadow-lg"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Centered content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          {/* Page Title */}
          <div className="mb-8 flex flex-col items-center">
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full mb-6"></div>
            <h1 className="text-[#3a3a3a] text-3xl md:text-4xl mb-4 text-center">
              Экстренная помощь
            </h1>
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full"></div>
          </div>

          {/* Single Card */}
          <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-3xl p-8 md:p-10 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
            {/* Dove background inside card */}
            <div className="absolute top-4 right-4 opacity-[0.04] pointer-events-none text-[100px]">
              🕊️
            </div>
            
            <div className="relative z-10 text-center">
              {/* Icon */}
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full flex items-center justify-center shadow-lg">
                <MessageCircle className="w-10 h-10 text-white" />
              </div>

              {/* Text */}
              <p className="text-[#3d3527] text-lg md:text-xl leading-relaxed mb-8">
                {sosText}
              </p>

              {/* Button */}
              <a
                href={sosChatLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl shadow-[0_8px_24px_rgba(122,132,171,0.4)] hover:shadow-[0_12px_32px_rgba(122,132,171,0.5)] transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/50 text-lg font-medium"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Написать в чат
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
