import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Lock, CheckCircle, PlayCircle, Book, FileText, Loader2, Clock } from 'lucide-react';
import { api } from '../lib/api';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  order: number;
  isPublished?: boolean;
  scheduledAt?: string | null;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
  hasAccess?: boolean;
  accessExpiresAt?: string | null;
}

export function LessonsTab() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [modulesData, progressData] = await Promise.all([
        api.get<Module[]>('/public/modules'),
        api.get<string[]>('/public/progress').catch(() => [])
      ]);
      setModules(modulesData);
      setCompletedLessons(new Set(progressData));
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить программу обучения');
    } finally {
      setLoading(false);
    }
  }

  const toggleComplete = async (lessonId: string) => {
    const isCurrentlyCompleted = completedLessons.has(lessonId);
    
    setCompletedLessons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });

    try {
      if (isCurrentlyCompleted) {
        await api.delete(`/public/lessons/${lessonId}/complete`);
      } else {
        await api.post(`/public/lessons/${lessonId}/complete`, {});
      }
    } catch (err) {
      setCompletedLessons(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyCompleted) {
          newSet.add(lessonId);
        } else {
          newSet.delete(lessonId);
        }
        return newSet;
      });
      console.error('Failed to update lesson progress:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender-dark)]" />
        <span className="ml-3 text-lg">Загрузка программы...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-[var(--button-lavender-dark)] text-white rounded-lg hover:opacity-90"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Программа обучения пока пуста</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-12 border-b border-[var(--sky-blue)]/20 pb-8 relative">
        <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-4">Программа обучения</h2>
        <p className="opacity-70 leading-relaxed max-w-3xl">
          Последовательный курс занятий для людей, которые столкнулись с проблемой зависимости у себя или у близкого
        </p>
      </div>

      <div className="space-y-6">
        {modules.map((module, moduleIndex) => (
          <div key={module.id} className="animate-slide-up" style={{ animationDelay: `${moduleIndex * 0.05}s` }}>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-[var(--book-text)] font-bold">{module.title}</h3>
              {module.hasAccess === false && (
                <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs">
                  <Lock className="w-3 h-3" /> Нет доступа
                </span>
              )}
              {module.hasAccess === true && module.accessExpiresAt && (
                <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs">
                  до {new Date(module.accessExpiresAt).toLocaleDateString('ru')}
                </span>
              )}
            </div>
            {module.description && (
              <p className="text-sm opacity-70 mb-4">{module.description}</p>
            )}
            <div className="space-y-4">
              {module.lessons.map((lesson, lessonIndex) => {
                const isCompleted = completedLessons.has(lesson.id);
                const isScheduled = lesson.scheduledAt && !lesson.isPublished;
                const isLocked = module.hasAccess === false || isScheduled;

                const formatScheduledDate = (dateStr: string) => {
                  const date = new Date(dateStr);
                  const options: Intl.DateTimeFormatOptions = { 
                    timeZone: 'Europe/Moscow',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  };
                  const formatted = date.toLocaleString('ru-RU', options).replace(',', '');
                  return `${formatted} МСК`;
                };

                return (
                  <div
                    key={lesson.id}
                    className={`border-2 rounded-2xl p-5 md:p-8 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
                      isScheduled
                        ? 'border-[#d4a84d]/40 bg-gradient-to-br from-[#fef9e7]/60 to-[#fdf5d9]/40'
                        : isLocked
                        ? 'border-[var(--book-border)]/40 bg-gradient-to-br from-gray-50/60 to-gray-100/40 opacity-60'
                        : isCompleted
                        ? 'border-[var(--success-green)]/30 bg-gradient-to-br from-[var(--success-green)]/6 to-white/70 shadow-[0_8px_24px_rgba(74,124,89,0.12)] hover:shadow-[0_12px_32px_rgba(74,124,89,0.18)] hover:border-[var(--success-green)]/40'
                        : 'border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] hover:shadow-[0_12px_32px_var(--ethereal-glow),0_4px_16px_var(--book-shadow-medium)] hover:border-[var(--sky-blue)]/40'
                    } animate-slide-up`}
                    style={{ animationDelay: `${moduleIndex * 0.05 + lessonIndex * 0.02}s` }}
                  >
                    {!isLocked && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
                    )}
                    
                    <div className="flex items-start gap-4 md:gap-5 relative z-10">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl p-0.5 shadow-lg transition-all duration-300 ${
                          isScheduled
                            ? 'bg-gradient-to-br from-[#d4a84d] to-[#c4983d]'
                            : isLocked 
                            ? 'bg-gray-300' 
                            : isCompleted 
                            ? 'bg-gradient-to-br from-[#c5cde5] to-[#b4bdd8]' 
                            : 'bg-gradient-to-br from-[#b4bdd8] via-[#c5cde5] to-[#d5dbed]'
                        }`}>
                          <div className={`w-full h-full rounded-2xl flex items-center justify-center ${
                            isCompleted 
                              ? 'bg-white' 
                              : 'bg-gradient-to-br from-white to-[#e8ebf5]/30'
                          }`}>
                            {isScheduled ? (
                              <Clock className="w-5 h-5 md:w-6 md:h-6 text-[#a67c00]" />
                            ) : isLocked ? (
                              <Lock className="w-5 h-5 md:w-6 md:h-6 text-[var(--icon-lavender)]" />
                            ) : isCompleted ? (
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
                                !isLocked ? 'cursor-pointer hover:text-[var(--button-lavender-dark)] transition-colors duration-200' : ''
                              }`}
                              onClick={() => !isLocked && navigate(`/lesson/${lesson.id}`)}
                            >
                              {lesson.title}
                            </h3>
                            <div className="flex items-center gap-3 md:gap-4 text-sm opacity-60 flex-wrap">
                              {lesson.duration && (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                  <BookOpen className="w-4 h-4 text-[var(--icon-lavender)]" />
                                  {lesson.duration}
                                </span>
                              )}
                              {isCompleted && (
                                <span className="flex items-center gap-1.5 text-[var(--success-green)] font-medium whitespace-nowrap">
                                  ✓ Пройден
                                </span>
                              )}
                              {isScheduled && lesson.scheduledAt && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-[#fef3cd] text-[#856404] rounded-lg text-xs font-medium whitespace-nowrap">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatScheduledDate(lesson.scheduledAt)}
                                </span>
                              )}
                              {isLocked && !isScheduled && (
                                <span className="text-gray-500 whitespace-nowrap">
                                  Заблокирован
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {lesson.description && (
                          <p className="text-sm mb-5 md:mb-6 opacity-80 leading-relaxed">
                            {lesson.description}
                          </p>
                        )}
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          {!isLocked && (
                            <>
                              <button
                                onClick={() => navigate(`/lesson/${lesson.id}`)}
                                className="px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group/btn"
                              >
                                <span className="relative z-10">{isCompleted ? 'Повторить урок' : 'Начать урок'}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                              </button>
                              <button
                                onClick={() => toggleComplete(lesson.id)}
                                className="px-5 py-2.5 border-2 border-[var(--button-lavender)]/70 rounded-xl hover:bg-[var(--button-lavender)]/10 hover:border-[var(--button-lavender-dark)]/80 transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                {isCompleted ? 'Снять отметку' : 'Отметить пройденным'}
                              </button>
                            </>
                          )}
                          {isScheduled && lesson.scheduledAt && (
                            <span className="text-sm italic opacity-70 flex items-center gap-2 text-[#856404]">
                              <Clock className="w-4 h-4" />
                              Урок откроется {formatScheduledDate(lesson.scheduledAt)}
                            </span>
                          )}
                          {isLocked && !isScheduled && (
                            <span className="text-sm italic opacity-60 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-[var(--icon-lavender)]" />
                              Пройдите предыдущие уроки, чтобы разблокировать
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
