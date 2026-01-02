import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Lock, CheckCircle, PlayCircle } from 'lucide-react';

interface Lesson {
  id: number;
  title: string;
  description: string;
  duration: string;
  isCompleted: boolean;
  isLocked: boolean;
  module: number;
  moduleName: string;
}

export function LessonsTab() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([
    {
      id: 1,
      title: 'Введение в курс трезвости',
      description: 'Знакомство с программой, постановка целей и первые шаги на пути к трезвой жизни.',
      duration: '30 минут',
      isCompleted: false,
      isLocked: false,
      module: 1,
      moduleName: 'Модуль 1: Основы трезвости',
    },
    {
      id: 2,
      title: 'Физиология зависимости',
      description: 'Как алкоголь влияет на мозг и тело. Понимание механизмов зависимости.',
      duration: '45 минут',
      isCompleted: false,
      isLocked: false,
      module: 1,
      moduleName: 'Модуль 1: Основы трезвости',
    },
    {
      id: 3,
      title: 'Психология зависимости',
      description: 'Эмоциональные триггеры, стресс и способы справляться с трудностями без алкоголя.',
      duration: '40 минут',
      isCompleted: false,
      isLocked: false,
      module: 1,
      moduleName: 'Модуль 1: Основы трезвости',
    },
    {
      id: 4,
      title: 'Социальные аспекты трезвости',
      description: 'Как выстраивать отношения, справляться с давлением окружения и находить поддержку.',
      duration: '35 минут',
      isCompleted: false,
      isLocked: false,
      module: 1,
      moduleName: 'Модуль 1: Основы трезвости',
    },
    {
      id: 5,
      title: 'Работа с триггерами',
      description: 'Идентификация личных триггеров и разработка стратегий их преодоления.',
      duration: '50 минут',
      isCompleted: false,
      isLocked: true,
      module: 2,
      moduleName: 'Модуль 2: Управление зависимостью',
    },
    {
      id: 6,
      title: 'Здоровый образ жизни',
      description: 'Питание, спорт, сон и другие аспекты здоровой жизни в трезвости.',
      duration: '40 минут',
      isCompleted: false,
      isLocked: true,
      module: 2,
      moduleName: 'Модуль 2: Управление зависимостью',
    },
    {
      id: 7,
      title: 'Профилактика срывов',
      description: 'Разработка плана действий на случай рецидива и укрепление мотивации.',
      duration: '45 минут',
      isCompleted: false,
      isLocked: true,
      module: 2,
      moduleName: 'Модуль 2: Управление зависимостью',
    },
    {
      id: 8,
      title: 'Долгосрочная трезвость',
      description: 'Планирование будущего, новые цели и поддержание трезвого образа жизни.',
      duration: '35 минут',
      isCompleted: false,
      isLocked: true,
      module: 2,
      moduleName: 'Модуль 2: Управление зависимостью',
    },
  ]);

  const toggleComplete = (id: number) => {
    setLessons(lessons.map(lesson => 
      lesson.id === id ? { ...lesson, isCompleted: !lesson.isCompleted } : lesson
    ));
  };

  // Группировка уроков по модулям
  const groupedLessons = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.module]) {
      acc[lesson.module] = {
        moduleName: lesson.moduleName,
        lessons: []
      };
    }
    acc[lesson.module].lessons.push(lesson);
    return acc;
  }, {} as Record<number, { moduleName: string; lessons: Lesson[] }>);

  return (
    <div className="animate-fade-in">
      <div className="mb-12 border-b border-[var(--sky-blue)]/20 pb-8 relative">
        {/* Decorative element */}
        <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-4">Программа обучения</h2>
        <p className="opacity-70 leading-relaxed max-w-3xl">
          Последовательный курс занятий для решения проблем, вызванных употреблением алкоголя
        </p>
      </div>

      <div className="space-y-6">
        {Object.values(groupedLessons).map((module, index) => (
          <div key={module.moduleName} className="animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
            <h3 className="text-[var(--book-text)] font-bold mb-4">{module.moduleName}</h3>
            <div className="space-y-4">
              {module.lessons.map((lesson, lessonIndex) => (
                <div
                  key={lesson.id}
                  className={`border-2 rounded-2xl p-5 md:p-8 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                    lesson.isLocked
                      ? 'border-[var(--book-border)]/40 bg-gradient-to-br from-gray-50/60 to-gray-100/40 opacity-60'
                      : lesson.isCompleted
                      ? 'border-[var(--success-green)]/30 bg-gradient-to-br from-[var(--success-green)]/6 to-white/70 shadow-[0_8px_24px_rgba(74,124,89,0.12)] hover:shadow-[0_12px_32px_rgba(74,124,89,0.18)] hover:border-[var(--success-green)]/40'
                      : 'border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] hover:shadow-[0_12px_32px_var(--ethereal-glow),0_4px_16px_var(--book-shadow-medium)] hover:border-[var(--sky-blue)]/40'
                  } animate-slide-up`}
                  style={{ animationDelay: `${index * 0.05 + lessonIndex * 0.02}s` }}
                >
                  {/* Hover shimmer effect */}
                  {!lesson.isLocked && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
                  )}
                  
                  <div className="flex items-start gap-4 md:gap-5 relative z-10">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl p-0.5 shadow-lg transition-all duration-300 ${
                        lesson.isLocked 
                          ? 'bg-gray-300' 
                          : lesson.isCompleted 
                          ? 'bg-gradient-to-br from-[#c5cde5] to-[#b4bdd8]' 
                          : 'bg-gradient-to-br from-[#b4bdd8] via-[#c5cde5] to-[#d5dbed]'
                      }`}>
                        <div className={`w-full h-full rounded-2xl flex items-center justify-center ${
                          lesson.isCompleted 
                            ? 'bg-white' 
                            : 'bg-gradient-to-br from-white to-[#e8ebf5]/30'
                        }`}>
                          {lesson.isLocked ? (
                            <Lock className="w-5 h-5 md:w-6 md:h-6 text-[var(--icon-lavender)]" />
                          ) : lesson.isCompleted ? (
                            <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-[var(--icon-lavender)] drop-shadow-sm" />
                          ) : (
                            <PlayCircle className="w-5 h-5 md:w-6 md:h-6 text-[var(--icon-lavender)] drop-shadow-sm" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0">
                          <h3 
                            className={`text-[var(--book-text)] mb-2.5 text-lg md:text-xl ${
                              !lesson.isLocked ? 'cursor-pointer hover:text-[var(--button-lavender-dark)] transition-colors duration-200' : ''
                            }`}
                            onClick={() => !lesson.isLocked && navigate(`/lesson/${lesson.id}`)}
                          >
                            Урок {lesson.id}: {lesson.title}
                          </h3>
                          <div className="flex items-center gap-3 md:gap-4 text-sm opacity-60 flex-wrap">
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <BookOpen className="w-4 h-4 text-[var(--icon-lavender)]" />
                              {lesson.duration}
                            </span>
                            {lesson.isCompleted && (
                              <span className="flex items-center gap-1.5 text-[var(--success-green)] font-medium whitespace-nowrap">
                                ✓ Пройден
                              </span>
                            )}
                            {lesson.isLocked && (
                              <span className="text-gray-500 whitespace-nowrap">
                                Заблокирован
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm mb-5 md:mb-6 opacity-80 leading-relaxed">
                        {lesson.description}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        {!lesson.isLocked && (
                          <>
                            <button
                              onClick={() => navigate(`/lesson/${lesson.id}`)}
                              className="px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group/btn"
                            >
                              <span className="relative z-10">{lesson.isCompleted ? 'Повторить урок' : 'Начать урок'}</span>
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                            </button>
                            <button
                              onClick={() => toggleComplete(lesson.id)}
                              className="px-5 py-2.5 border-2 border-[var(--button-lavender)]/70 rounded-xl hover:bg-[var(--button-lavender)]/10 hover:border-[var(--button-lavender-dark)]/80 transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                              {lesson.isCompleted ? 'Снять отметку' : 'Отметить пройденным'}
                            </button>
                          </>
                        )}
                        {lesson.isLocked && (
                          <span className="text-sm italic opacity-60 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-[var(--icon-lavender)]" />
                            Пройдите предыдущие уроки, чтобы разблокировать
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}