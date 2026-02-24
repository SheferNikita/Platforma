import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Check, Award } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { safeStorage } from '../lib/safeStorage';

interface ProfileData {
  id: string;
  sobrietyDate: string | null;
}

export function SobrietyCounter() {
  const { user: authUser } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [days, setDays] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const getStorageKey = (id: string) => `sobrietyData_${id}`;

  useEffect(() => {
    if (!authUser) return;
    const loadFromProfile = async () => {
      try {
        const profile = await api.get<ProfileData>('/public/profile');
        const currentUserId = profile.id;
        setUserId(currentUserId);
        
        // Clear old shared localStorage key (migration from old system)
        safeStorage.removeItem('sobrietyData');
        
        if (profile.sobrietyDate) {
          const dateStr = new Date(profile.sobrietyDate).toISOString().split('T')[0];
          setStartDate(dateStr);
          calculateDays(dateStr);
          const saved = safeStorage.getItem(getStorageKey(currentUserId));
          if (saved) {
            const data = JSON.parse(saved);
            setLastCheckIn(data.lastCheckIn);
          }
          setShowSetup(false);
          return;
        }
        
        const saved = safeStorage.getItem(getStorageKey(currentUserId));
        if (saved) {
          const data = JSON.parse(saved);
          setStartDate(data.startDate);
          setLastCheckIn(data.lastCheckIn);
          calculateDays(data.startDate);
        } else {
          setShowSetup(true);
        }
      } catch (error) {
        console.log('Could not load profile');
        setShowSetup(true);
      }
    };
    
    loadFromProfile();
  }, [authUser]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Проверяем, что клик был вне контейнера счетчика И вне портала меню
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideMenu = !menuRef.current || !menuRef.current.contains(target);
      
      if (isOutsideContainer && isOutsideMenu) {
        setIsMenuOpen(false);
        setIsEditingDate(false);
      }
    };

    if (isMenuOpen) {
      // Добавляем слушатель с небольшой задержкой, чтобы избежать закрытия при открытии
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside as any);
      }, 10);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside as any);
      };
    }
  }, [isMenuOpen]);

  const calculateDays = (start: string) => {
    const startDateTime = new Date(start).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - startDateTime) / (1000 * 60 * 60 * 24));
    setDays(diffDays);
  };

  const saveToServer = async (date: string) => {
    try {
      await api.put('/public/profile', { sobrietyDate: date });
    } catch (error) {
      console.error('Failed to sync sobriety date to server:', error);
    }
  };

  const handleStart = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setLastCheckIn(today);
    setDays(0);
    safeStorage.setItem(getStorageKey(userId), JSON.stringify({
      startDate: today,
      lastCheckIn: today
    }));
    setShowSetup(false);
    await saveToServer(today);
  };

  const handleCheckIn = () => {
    if (!userId || !startDate) return;
    const today = new Date().toISOString().split('T')[0];
    setLastCheckIn(today);
    calculateDays(startDate);
    safeStorage.setItem(getStorageKey(userId), JSON.stringify({
      startDate,
      lastCheckIn: today
    }));
  };

  const handleReset = async () => {
    if (!userId) return;
    if (confirm('Вы уверены, что хотите сбросить счетчик?')) {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setLastCheckIn(today);
      setDays(0);
      safeStorage.setItem(getStorageKey(userId), JSON.stringify({
        startDate: today,
        lastCheckIn: today
      }));
      setIsMenuOpen(false);
      await saveToServer(today);
    }
  };

  const handleSetCustomDate = async () => {
    if (!userId || !customDate) return;
    const today = new Date().toISOString().split('T')[0];
    if (customDate > today) {
      alert('Дата не может быть в будущем');
      return;
    }
    setStartDate(customDate);
    calculateDays(customDate);
    // Preserve existing lastCheckIn or keep null if not set
    const currentCheckIn = lastCheckIn;
    safeStorage.setItem(getStorageKey(userId), JSON.stringify({
      startDate: customDate,
      lastCheckIn: currentCheckIn
    }));
    setIsEditingDate(false);
    setIsMenuOpen(false);
    setShowSetup(false);
    await saveToServer(customDate);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom, right: window.innerWidth - rect.right });
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
          <span className="relative z-10 whitespace-nowrap font-medium">Счетчик трезвости</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        </button>
      </div>
    );
  }

  return (
    <div 
      className="relative z-[100]"
      ref={containerRef}
    >
      <div 
        onClick={toggleMenu}
        className="bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/40 to-white/80 backdrop-blur-sm rounded-xl border-2 border-[#b5cad9]/40 px-4 py-2.5 shadow-[0_4px_16px_var(--ethereal-shadow),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 hover:shadow-[0_8px_24px_var(--ethereal-glow)] cursor-pointer active:scale-[0.98]"
        ref={buttonRef}
      >
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
              onClick={(e) => {
                e.stopPropagation();
                handleCheckIn();
              }}
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

      {/* Расширенное меню при наведении/клике */}
      {isMenuOpen && createPortal(
        <div 
          ref={menuRef}
          className="fixed bg-gradient-to-br from-[#fdfbf7]/98 via-[#e3ebf1]/50 to-white/85 backdrop-blur-lg rounded-xl border-2 border-[#b5cad9]/40 p-4 shadow-[0_12px_32px_var(--ethereal-shadow),0_4px_16px_var(--book-shadow)] min-w-[250px] z-[9999] animate-fade-in" 
          style={{ top: `${menuPosition.top + 8}px`, right: `${menuPosition.right}px` }}
        >
          <div className="text-[10px] opacity-60 mb-3 tracking-wide">
            Начало: {startDate && new Date(startDate).toLocaleDateString('ru-RU')}
          </div>
          
          {isEditingDate ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] opacity-60 block mb-1">Дата начала трезвости:</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-xs border-2 border-[var(--button-lavender)]/40 rounded-lg focus:outline-none focus:border-[var(--button-lavender-dark)] bg-white/80"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetCustomDate}
                  className="flex-1 px-3 py-2 text-xs bg-gradient-to-r from-[#6b8e6f] to-[#7a9d7e] text-white rounded-lg hover:shadow-md transition-all duration-200"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => { setIsEditingDate(false); setCustomDate(''); }}
                  className="px-3 py-2 text-xs opacity-70 hover:opacity-100 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => { setIsEditingDate(true); setCustomDate(startDate || ''); }}
                className="w-full px-4 py-2 text-xs opacity-70 hover:opacity-100 hover:bg-[var(--button-lavender-dark)]/10 rounded-lg transition-all duration-200 hover:text-[var(--button-lavender-dark)] border border-transparent hover:border-[var(--button-lavender-dark)]/20 text-left"
              >
                Изменить дату начала
              </button>
              <button
                onClick={handleReset}
                className="w-full px-4 py-2 text-xs opacity-70 hover:opacity-100 hover:bg-[var(--button-lavender-dark)]/10 rounded-lg transition-all duration-200 hover:text-[var(--button-lavender-dark)] border border-transparent hover:border-[var(--button-lavender-dark)]/20 text-left"
              >
                Сбросить счетчик
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}