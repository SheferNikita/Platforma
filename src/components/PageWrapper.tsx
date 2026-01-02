import React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <main className="bg-gradient-to-br from-[#f8f9fc]/95 via-[#e3ebf1]/85 to-[#f5f6fa]/90 backdrop-blur-sm rounded-3xl shadow-[0_16px_48px_var(--ethereal-shadow),0_8px_24px_var(--book-shadow),inset_0_1px_0_rgba(255,255,255,0.95)] border-2 border-[#b5cad9]/30 p-8 md:p-12 lg:p-14 min-h-[600px] relative overflow-hidden">
      {/* Enhanced paper texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
      }}></div>
      
      {/* Небесное свечение по центру страницы */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-radial from-[#e3ebf1]/12 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      
      {/* Decorative margin lines - more subtle */}
      <div className="absolute left-10 top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-[#7d9db5]/15 to-transparent hidden lg:block"></div>
      <div className="absolute right-10 top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-[#7d9db5]/15 to-transparent hidden lg:block"></div>
      
      {/* Decorative top accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-[#9ba5ca]/30 to-transparent"></div>
      
      {/* Page content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Enhanced corner fold with gradient - more subtle */}
      <div className="absolute bottom-0 right-0 w-24 h-24 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[96px] border-l-transparent border-b-[96px] border-b-[#7a84ab] opacity-[0.05]"></div>
        <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[80px] border-l-transparent border-b-[80px] border-b-[#9ba5ca] opacity-[0.04]"></div>
      </div>
    </main>
  );
}