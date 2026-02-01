import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { X, Play, Pause, Phone, MessageCircle, Heart } from 'lucide-react';
import { useSettings } from '../lib/settings';
import { useAuth } from '../lib/auth';

export function SOSPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSectionVisible, loading: settingsLoading } = useSettings();
  
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale' | 'pause'>('pause');
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathTimer, setBreathTimer] = useState(60);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [timeOnPage, setTimeOnPage] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Mock user data
  const sobrietyDays = 38;
  const userMotivation = {
    hasPhoto: false,
    hasText: true,
    text: 'Я обещал своей семье стать лучше. Это мой путь к свободе.',
  };

  // Breathing animation cycle
  useEffect(() => {
    if (!isBreathingActive) return;

    const phases = [
      { phase: 'inhale' as const, duration: 4000 },
      { phase: 'hold' as const, duration: 4000 },
      { phase: 'exhale' as const, duration: 4000 },
      { phase: 'pause' as const, duration: 2000 },
    ];

    let currentIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const runCycle = () => {
      const current = phases[currentIndex];
      setBreathPhase(current.phase);
      
      timeoutId = setTimeout(() => {
        currentIndex = (currentIndex + 1) % phases.length;
        runCycle();
      }, current.duration);
    };

    runCycle();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isBreathingActive]);

  // Breath timer countdown
  useEffect(() => {
    if (!isBreathingActive || breathTimer <= 0) return;

    const interval = setInterval(() => {
      setBreathTimer((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isBreathingActive, breathTimer]);

  // Track time on page
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOnPage(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Prevent sleep mode (simplified version)
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.log('Wake Lock not supported or failed');
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, []);

  // Audio controls
  const toggleAudio = async () => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsAudioPlaying(true);
        } catch (err) {
          console.log('Audio play failed:', err);
          setIsAudioPlaying(false);
        }
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  // Exit handling
  const handleExit = () => {
    if (timeOnPage < 30) {
      setShowExitModal(true);
    } else {
      navigate('/');
    }
  };

  const confirmExit = (feeling: 'better' | 'staying') => {
    if (feeling === 'better') {
      // Log successful SOS
      console.log('SOS successful - user feeling better');
      navigate('/');
    } else {
      setShowExitModal(false);
    }
  };

  const getBreathText = () => {
    switch (breathPhase) {
      case 'inhale': return 'ВДОХ';
      case 'hold': return 'ДЕРЖИМ';
      case 'exhale': return 'ВЫДОХ';
      case 'pause': return 'ПАУЗА';
    }
  };

  const getBreathScale = () => {
    switch (breathPhase) {
      case 'inhale': return 'scale-150';
      case 'hold': return 'scale-150';
      case 'exhale': return 'scale-100';
      case 'pause': return 'scale-100';
    }
  };

  const restartBreathing = () => {
    setBreathTimer(60);
    setBreathPhase('pause');
    setIsBreathingActive(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Проверка видимости раздела (после всех hooks)
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
      <div className="fixed bottom-20 left-10 opacity-[0.02] pointer-events-none text-[180px] hidden md:block">
        🕊️
      </div>

      {/* Close button */}
      <button
        onClick={handleExit}
        className="fixed top-6 right-6 z-50 w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] hover:shadow-[0_8px_24px_rgba(122,132,171,0.4)] rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 border-2 border-white/50 shadow-lg"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Scrollable content */}
      <div className="relative z-10 px-4 py-12 md:py-16">
        <div className="max-w-7xl mx-auto">
          {/* Page Title */}
          <div className="mb-8 md:mb-12 flex flex-col items-center">
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full mb-6"></div>
            <h1 className="text-[#3a3a3a] text-3xl md:text-4xl mb-4 text-center">
              Экстренная помощь
            </h1>
            <div className="max-w-2xl w-full flex justify-center">
              <p className="text-sm md:text-base opacity-70 leading-relaxed text-center px-4">
                Я рядом. Ты не один в этот момент. Следуй по шагам, и тяга отступит.
              </p>
            </div>
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full mt-6"></div>
          </div>

          {/* Grid Layout - 2x2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            
            {/* Block 1: Breathing Exercise */}
            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
              {/* Dove background inside card */}
              <div className="absolute top-4 right-4 opacity-[0.04] pointer-events-none text-[100px]">
                🕊️
              </div>
              
              <div className="relative z-10">
                <h2 className="text-[#3a3a3a] text-xl md:text-2xl mb-4 text-center">
                  Шаг 1: Подыши со мной
                </h2>
                
                {!isBreathingActive ? (
                  <div className="flex flex-col items-center justify-center min-h-[280px] md:min-h-[320px]">
                    <div className="text-6xl mb-6">🌬️</div>
                    <p className="text-center opacity-70 text-sm mb-6 px-4">
                      Дыхательная практика поможет успокоить нервную систему и снизить тягу
                    </p>
                    <button
                      onClick={() => setIsBreathingActive(true)}
                      className="px-8 py-4 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl shadow-[0_8px_24px_rgba(122,132,171,0.4)] hover:shadow-[0_12px_32px_rgba(122,132,171,0.5)] transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/50"
                    >
                      Начать практику
                    </button>
                  </div>
                ) : breathTimer > 0 ? (
                  <>
                    <div className="flex items-center justify-center mb-4 min-h-[200px] md:min-h-[240px]">
                      <div 
                        className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-[var(--button-lavender-light)]/30 to-[var(--sky-light)]/40 border-4 border-[var(--button-lavender-dark)]/30 shadow-[0_0_40px_rgba(122,132,171,0.3)] flex items-center justify-center transition-all duration-[4000ms] ease-in-out ${getBreathScale()}`}
                      >
                        <span className="text-[var(--button-lavender-dark)] text-lg md:text-xl tracking-widest font-medium">
                          {getBreathText()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-center mb-3">
                      <div className="inline-block px-6 py-2 bg-white/60 backdrop-blur-sm rounded-full border-2 border-[var(--button-lavender-dark)]/20 shadow-sm">
                        <span className="text-2xl md:text-3xl text-[var(--button-lavender-dark)] tabular-nums">
                          {formatTime(breathTimer)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-center opacity-70 text-sm italic leading-relaxed">
                      Дыши в ритме круга, пока тревога не утихнет
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[280px] md:min-h-[320px]">
                    <div className="text-6xl mb-4">✨</div>
                    <p className="text-center opacity-90 text-lg mb-6 px-4">
                      Минута завершена!
                    </p>
                    <p className="text-center opacity-70 text-sm mb-6 px-4">
                      Как ты себя чувствуешь? Хочешь повторить?
                    </p>
                    <button
                      onClick={restartBreathing}
                      className="px-8 py-4 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl shadow-[0_8px_24px_rgba(122,132,171,0.4)] hover:shadow-[0_12px_32px_rgba(122,132,171,0.5)] transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/50"
                    >
                      Еще раз
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Block 2: Audio Intervention */}
            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
              {/* Dove background inside card */}
              <div className="absolute bottom-4 left-4 opacity-[0.04] pointer-events-none text-[80px]">
                🕊️
              </div>
              
              <div className="relative z-10">
                <h2 className="text-[#3a3a3a] text-xl md:text-2xl mb-4 text-center">
                  Шаг 2: Послушай меня
                </h2>
                
                <div className="flex flex-col items-center">
                  <button
                    onClick={toggleAudio}
                    className="w-20 h-20 md:w-24 md:h-24 mb-4 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(122,132,171,0.4)] hover:shadow-[0_12px_32px_rgba(122,132,171,0.5)] transition-all duration-300 transform hover:scale-105 active:scale-95"
                  >
                    {isAudioPlaying ? (
                      <Pause className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    ) : (
                      <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" />
                    )}
                  </button>
                  
                  <div className="relative w-full h-3 bg-[var(--sky-light)]/30 rounded-full overflow-hidden mb-4">
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full transition-all duration-300"
                      style={{ width: `${audioProgress}%` }}
                    ></div>
                  </div>
                  
                  <p className="text-center opacity-80 text-sm mb-4">
                    Включить навигатор
                  </p>

                  <p className="text-center opacity-70 text-sm italic leading-relaxed">
                    Голос наставника поможет тебе пережить эту волну. Тяга пройдет, как морской прилив.
                  </p>
                  
                  {/* Hidden audio element with mock audio */}
                  <audio
                    ref={audioRef}
                    onTimeUpdate={handleAudioTimeUpdate}
                    onEnded={() => setIsAudioPlaying(false)}
                  >
                    {/* Mock audio - in real app, replace with actual MP3 file */}
                    <source src="/audio/surfing-craving.mp3" type="audio/mpeg" />
                  </audio>
                </div>
              </div>
            </div>

            {/* Block 3: Motivation Anchors */}
            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
              {/* Dove background */}
              <div className="absolute top-4 right-4 opacity-[0.04] pointer-events-none text-[100px]">
                🕊️
              </div>
              
              <div className="relative z-10">
                <h2 className="text-[#3a3a3a] text-xl md:text-2xl mb-4 text-center">
                  {userMotivation.hasPhoto || userMotivation.hasText ? 'Шаг 3: Вспомни, зачем' : 'Шаг 3: Твой путь'}
                </h2>
                
                {userMotivation.hasPhoto || userMotivation.hasText ? (
                  <div className="text-center">
                    <div className="text-5xl mb-4">❤️</div>
                    <p className="text-base md:text-lg leading-relaxed mb-4 italic opacity-90">
                      "{userMotivation.text}"
                    </p>
                    <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full mx-auto mb-3"></div>
                    <p className="opacity-70 text-sm">
                      Это важнее, чем минутное желание.
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-6xl mb-4">🏆</div>
                    <p className="text-xl md:text-2xl mb-3">
                      Твоя трезвость: <span className="text-[var(--button-lavender-dark)]">{sobrietyDays} дней</span>
                    </p>
                    <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full mx-auto mb-3"></div>
                    <p className="opacity-80 text-sm md:text-base">
                      Не обнуляй этот результат сегодня.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Block 4: Emergency Contact */}
            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
              {/* Dove background */}
              <div className="absolute bottom-4 left-4 opacity-[0.04] pointer-events-none text-[100px]">
                🕊️
              </div>
              
              <div className="relative z-10">
                <h2 className="text-[#3a3a3a] text-xl md:text-2xl mb-4 text-center">
                  Шаг 4: Позови на помощь
                </h2>
                
                <div className="space-y-3">
                  <button className="w-full px-6 py-4 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl shadow-[0_8px_24px_rgba(122,132,171,0.4)] hover:shadow-[0_12px_32px_rgba(122,132,171,0.5)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border-2 border-white/50 text-sm md:text-base">
                    <MessageCircle className="w-5 h-5" />
                    <span>Мне нужна помощь человека</span>
                  </button>
                  
                  <button className="w-full px-6 py-4 bg-white/60 backdrop-blur-md text-[var(--button-lavender-dark)] border-2 border-[var(--button-lavender-dark)]/30 rounded-xl hover:bg-[var(--button-lavender-light)]/10 hover:border-[var(--button-lavender-dark)]/50 transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg text-sm md:text-base">
                    <Phone className="w-5 h-5" />
                    <span>Позвонить другу</span>
                  </button>

                  <p className="text-center opacity-70 text-sm italic leading-relaxed mt-4">
                    Не стыдно попросить помощи. Это признак силы, а не слабости.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="border-2 border-[var(--sky-light)]/50 bg-gradient-to-br from-white via-[#f8f9fa] to-white rounded-3xl p-8 md:p-10 max-w-md w-full shadow-[0_24px_60px_rgba(0,0,0,0.3),0_8px_24px_var(--ethereal-shadow)] animate-fade-in relative overflow-hidden">
            {/* Dove background */}
            <div className="absolute top-4 right-4 opacity-[0.04] pointer-events-none text-[120px]">
              🕊️
            </div>
            
            <div className="text-center mb-8 relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full flex items-center justify-center shadow-lg">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl md:text-3xl mb-3 text-[#3a3a3a]">
                Тяга отступила?
              </h3>
              <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[var(--button-lavender-dark)] to-transparent rounded-full mx-auto"></div>
            </div>
            
            <div className="space-y-3 relative z-10">
              <button
                onClick={() => confirmExit('better')}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#6b9d7c] to-[#5a8c6b] text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                Да, мне легче
              </button>
              
              <button
                onClick={() => confirmExit('staying')}
                className="w-full px-6 py-4 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border border-gray-300"
              >
                Нет, я еще здесь
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}