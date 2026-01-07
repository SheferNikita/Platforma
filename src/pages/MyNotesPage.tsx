import React, { useState } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { FileText, Calendar, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NoteEntry {
  id: number;
  lessonId: number;
  lessonTitle: string;
  moduleName: string;
  date: string;
  content: string;
}

export function MyNotesPage() {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const notes: NoteEntry[] = [
    {
      id: 1,
      lessonId: 1,
      lessonTitle: 'Первый шаг к трезвости',
      moduleName: 'Модуль 1: Основы трезвости',
      date: '2025-12-01',
      content: `Основные тезисы урока:

• Признание проблемы — первый и самый важный шаг
• Трезвость — это не отказ, а выбор новой жизни
• Поддержка окружающих критически важна
• Каждый день без алкоголя — это победа

Ключевые моменты:
- Зависимость формируется постепенно, незаметно
- Мозг перестраивается и требует вещество для нормального функционирования
- Восстановление возможно, но требует времени и усилий

План действий:
1. Признать проблему перед собой
2. Рассказать близким о своем решении
3. Найти группу поддержки
4. Начать вести дневник трезвости`,
    },
    {
      id: 2,
      lessonId: 3,
      lessonTitle: 'Психология зависимости',
      moduleName: 'Модуль 1: Основы трезвости',
      date: '2025-12-10',
      content: `Психологические механизмы зависимости:

1. Дофаминовая система награды
   - Алкаголь вызывает выброс дофамина
   - Мозг запоминает это как "награду"
   - Формируется условный рефлекс

2. Триггеры и паттерны
   - Эмоциональные триггеры (стресс, тревога, одиночество)
   - Социальные триггеры (встречи с друзьями, праздники)
   - Ситуационные триггеры (определенные места, время суток)

3. Методы работы с триггерами:
   - Осознание и идентификация
   - Избегание или изменение ситуации
   - Альтернативные способы справиться
   - Техники релаксации и осознанности

Важное наблюдение: понимание механизма помогает не винить себя и эффективнее бороться.`,
    },
  ];

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <PageWrapper>
      <div className="animate-fade-in">
        {/* Back Button */}
        <button
          onClick={() => navigate('/profile')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-[var(--sky-light)]/40 rounded-xl hover:bg-[var(--sky-soft)]/20 transition-all duration-300 transform hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться к профилю
        </button>

        {/* Header */}
        <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
          <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
          
          <h2 className="text-[#3a3a3a] mb-3">Мои конспекты</h2>
          <p className="opacity-70 leading-relaxed">
            Все ваши конспекты к урокам. Систематизируйте знания и возвращайтесь к важным моментам обучения.
          </p>
        </div>

        {/* Summary Card */}
        <div className="mb-8 border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow)]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-2xl mb-1">
                  <span className="bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">{notes.length}</span>
                  <span className="text-sm opacity-70 ml-2">{notes.length === 1 ? 'конспект' : notes.length < 5 ? 'конспекта' : 'конспектов'}</span>
                </div>
              </div>
            </div>
            <div className="text-sm opacity-70">
              Последний конспект: {new Date(notes[notes.length - 1].date).toLocaleDateString('ru-RU')}
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-5">
          {notes.map((note, index) => (
            <div
              key={note.id}
              className="border-2 border-[var(--sky-light)]/40 rounded-2xl bg-gradient-to-br from-white/90 to-white/50 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_var(--ethereal-glow),0_4px_16px_var(--book-shadow-medium)] animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="p-6 md:p-7">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--button-lavender-light)]/10 border border-[var(--button-lavender)]/20 rounded-lg text-xs mb-3">
                      <span className="opacity-70">{note.moduleName}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/lesson/${note.lessonId}`)}
                      className="block text-left w-full group/title"
                    >
                      <h3 className="text-lg md:text-xl mb-2 hover:text-[var(--button-lavender-dark)] transition-colors duration-200">
                        <span className="bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">Урок {note.lessonId}:</span> {note.lessonTitle}
                        <span className="inline-block ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-200">→</span>
                      </h3>
                    </button>
                    <div className="flex items-center gap-2 text-sm opacity-60">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(note.date).toLocaleDateString('ru-RU', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                  </div>
                </div>

                {/* Content Preview / Full */}
                <div className="relative">
                  <div className={`text-sm opacity-80 leading-relaxed whitespace-pre-line transition-all duration-300 ${
                    expandedId === note.id ? '' : 'line-clamp-4'
                  }`}>
                    {note.content}
                  </div>
                  
                  {!expandedId || expandedId !== note.id ? (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/90 to-transparent pointer-events-none"></div>
                  ) : null}
                </div>

                {/* Expand Button */}
                <button
                  onClick={() => toggleExpand(note.id)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-[var(--button-lavender)]/30 rounded-xl hover:bg-[var(--button-lavender)]/10 transition-all duration-300 transform hover:scale-105"
                >
                  {expandedId === note.id ? (
                    <>
                      <span>Свернуть</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Читать полностью</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State (shown when no notes) */}
        {notes.length === 0 && (
          <div className="text-center py-16 border-2 border-[var(--sky-light)]/40 rounded-2xl bg-gradient-to-br from-white/90 to-white/50">
            <div className="text-6xl mb-4 opacity-20">📝</div>
            <h3 className="text-lg mb-2">Конспектов пока нет</h3>
            <p className="text-sm opacity-70 mb-6 max-w-md mx-auto">
              Начните делать конспекты к урокам, чтобы лучше усваивать материал и иметь возможность вернуться к важным моментам.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm transform hover:scale-105"
            >
              Перейти к урокам
            </button>
          </div>
        )}

        {/* Motivational Card */}
        <div className="mt-10 border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/80 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow)] relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-[0.04] text-[100px] pointer-events-none">
            🕊️
          </div>
          <div className="text-center relative z-10">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-sm italic opacity-80 leading-relaxed">
              "Конспектирование — это не просто записывание. Это осмысление, структурирование и присвоение знаний."
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}