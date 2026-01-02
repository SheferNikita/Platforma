import React, { useState, useEffect } from 'react';
import { Calendar, Check, Award } from 'lucide-react';

export function SobrietyCounter() {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [days, setDays] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Load data from localStorage
    const saved = localStorage.getItem('sobrietyData');
    if (saved) {
      const data = JSON.parse(saved);
      setStartDate(data.startDate);
      setLastCheckIn(data.lastCheckIn);
      calculateDays(data.startDate);
    } else {
      setShowSetup(true);
    }
  }, []);

  const calculateDays = (start: string) => {
    const startDateTime = new Date(start).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - startDateTime) / (1000 * 60 * 60 * 24));
    setDays(diffDays);
  };

  const handleStart = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setLastCheckIn(today);
    setDays(0);
    localStorage.setItem('sobrietyData', JSON.stringify({
      startDate: today,
      lastCheckIn: today
    }));
    setShowSetup(false);
  };

  const handleCheckIn = () => {
    const today = new Date().toISOString().split('T')[0];
    setLastCheckIn(today);
    if (startDate) {
      calculateDays(startDate);
      localStorage.setItem('sobrietyData', JSON.stringify({
        startDate,
        lastCheckIn: today
      }));
    }
  };

  const handleReset = () => {
    if (confirm('Вы уверены, что хотите сбросить счетчик?')) {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setLastCheckIn(today);
      setDays(0);
      localStorage.setItem('sobrietyData', JSON.stringify({
        startDate: today,
        lastCheckIn: today
      }));
    }
  };

  const isCheckedInToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return lastCheckIn === today;
  };

  if (showSetup) {
    return (
      <div className="bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/40 to-white/80 backdrop-blur-sm rounded-xl border-2 border-[#b5cad9]/40 px-4 py-2 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow),inset_0_1px_0_rgba(255,255,255,0.9)] transform transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_32px_var(--ethereal-glow)] min-w-[200px]">
        <button
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-[#6b8e6f] to-[#7a9d7e] text-white text-xs rounded-lg hover:shadow-[0_8px_20px_rgba(107,142,111,0.35)] transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group"
        >
          <Calendar className="w-4 h-4 relative z-10 flex-shrink-0 drop-shadow-sm" />
          <span className="relative z-10 whitespace-nowrap font-medium">Начать трезвую жизнь</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        </button>
      </div>
    );
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/40 to-white/80 backdrop-blur-sm rounded-xl border-2 border-[#b5cad9]/40 px-4 py-2.5 shadow-[0_4px_16px_var(--ethereal-shadow),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 hover:shadow-[0_8px_24px_var(--ethereal-glow)]">
        {/* Минималистичный вид */}
        <div className="flex items-center gap-3">
          <Award className="w-4 h-4 text-[var(--button-lavender-dark)] flex-shrink-0 drop-shadow-sm" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-2xl md:text-2xl bg-gradient-to-br from-[var(--sky-blue)] via-[var(--button-lavender-light)] to-[var(--button-lavender-dark)] bg-clip-text text-transparent flex-shrink-0 font-semibold drop-shadow-sm">
              {days}
            </span>
            <span className="text-[10px] opacity-70 whitespace-nowrap">
              {days === 1 ? 'день' : (days >= 2 && days <= 4) ? 'дня' : 'дней'} <span className="hidden sm:inline">трезвости</span>
            </span>
          </div>
          
          {/* Кнопка отметки - всегда видна */}
          {!isCheckedInToday() ? (
            <button
              onClick={handleCheckIn}
              className="ml-auto p-1.5 bg-gradient-to-r from-[#6b8e6f] to-[#7a9d7e] text-white rounded-lg hover:shadow-[0_6px_16px_rgba(107,142,111,0.35)] transition-all duration-300 transform hover:scale-110 active:scale-95 group flex-shrink-0"
              title="Отметить день"
            >
              <Check className="w-3.5 h-3.5 drop-shadow-sm" />
            </button>
          ) : (
            <div className="ml-auto p-1.5 bg-[#6b8e6f]/15 text-[#6b8e6f] rounded-lg border-2 border-[#6b8e6f]/25 flex-shrink-0 shadow-inner" title="Отмечено сегодня">
              <Check className="w-3.5 h-3.5 drop-shadow-sm" />
            </div>
          )}
        </div>
      </div>

      {/* Расширенное меню при наведении */}
      {isHovered && (
        <div className="absolute top-full right-0 mt-2 bg-gradient-to-br from-[#fdfbf7]/98 via-[#e3ebf1]/50 to-white/85 backdrop-blur-lg rounded-xl border-2 border-[#b5cad9]/40 p-4 shadow-[0_12px_32px_var(--ethereal-shadow),0_4px_16px_var(--book-shadow)] min-w-[220px] z-50 animate-fade-in">
          <div className="text-[10px] opacity-60 mb-3 tracking-wide">
            Начало: {startDate && new Date(startDate).toLocaleDateString('ru-RU')}
          </div>
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 text-xs opacity-70 hover:opacity-100 hover:bg-[var(--button-lavender-dark)]/10 rounded-lg transition-all duration-200 hover:text-[var(--button-lavender-dark)] border border-transparent hover:border-[var(--button-lavender-dark)]/20"
          >
            Сбросить счетчик
          </button>
        </div>
      )}
    </div>
  );
}