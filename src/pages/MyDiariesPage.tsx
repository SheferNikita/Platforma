import React, { useState, useEffect } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { BookOpen, Calendar, ArrowLeft, ChevronDown, ChevronUp, Loader2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface ReplyHistoryItem {
  text: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  audioData?: string;
  audioDuration?: number;
}

function parseReplyHistory(reply: string | null | undefined): ReplyHistoryItem[] {
  if (!reply) return [];
  try {
    const parsed = JSON.parse(reply);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [{ text: reply, authorId: 'legacy', authorName: 'Наставник', authorRole: 'MENTOR', createdAt: new Date().toISOString() }];
  } catch {
    return [{ text: reply, authorId: 'legacy', authorName: 'Наставник', authorRole: 'MENTOR', createdAt: new Date().toISOString() }];
  }
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface DiaryEntry {
  id: string;
  lessonId: string;
  lessonTitle: string;
  moduleName: string;
  date: string;
  content: string;
  reply?: string;
  repliedAt?: string;
}

export function MyDiariesPage() {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userTariff, setUserTariff] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiaries = async () => {
      try {
        const meResponse = await api.get('/auth/me') as { user: { tariff?: string } };
        const tariff = meResponse.user?.tariff || 'BASIC';
        if (tariff === 'BASIC' || tariff === 'FAMILY' || tariff === 'RELATIVE') {
          navigate('/lessons');
          return;
        }
        setUserTariff(tariff);

        const data = await api.get('/public/my-diaries') as DiaryEntry[];
        setDiaries(data);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    fetchDiaries();
  }, [navigate]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getWordForm = (count: number) => {
    if (count === 1) return 'запись';
    if (count >= 2 && count <= 4) return 'записи';
    return 'записей';
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender)]" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="animate-fade-in">
        <button
          onClick={() => navigate('/profile')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-[var(--sky-light)]/40 rounded-xl hover:bg-[var(--sky-soft)]/20 transition-all duration-300 transform hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4" />
          Вернуться к профилю
        </button>

        <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
          <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
          
          <h2 className="text-[#3a3a3a] mb-3">Мои дневники</h2>
          <p className="opacity-70 leading-relaxed">
            Все ваши дневниковые записи к урокам. Отслеживайте свой прогресс и размышления на пути к трезвости.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        {diaries.length > 0 && (
          <div className="mb-8 border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 rounded-2xl p-4 md:p-6 shadow-[0_8px_24px_var(--ethereal-shadow)]">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-2xl mb-1">
                    <span className="bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">{diaries.length}</span>
                    <span className="text-sm opacity-70 ml-2">{getWordForm(diaries.length)} в дневнике</span>
                  </div>
                </div>
              </div>
              <div className="text-sm opacity-70">
                Последняя запись: {new Date(diaries[0].date).toLocaleDateString('ru-RU')}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {diaries.map((diary, index) => (
            <div
              key={diary.id}
              className="border-2 border-[var(--sky-light)]/40 rounded-2xl bg-gradient-to-br from-white/90 to-white/50 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_var(--ethereal-glow),0_4px_16px_var(--book-shadow-medium)] animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="p-6 md:p-7">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--button-lavender-light)]/10 border border-[var(--button-lavender)]/20 rounded-lg text-xs mb-3">
                      <span className="opacity-70">{diary.moduleName}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/lesson/${diary.lessonId}`)}
                      className="block text-left w-full group/title"
                    >
                      <h3 className="text-lg md:text-xl mb-2 hover:text-[var(--button-lavender-dark)] transition-colors duration-200">
                        <span className="bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">{diary.lessonTitle}</span>
                        <span className="inline-block ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-200">→</span>
                      </h3>
                    </button>
                    <div className="flex items-center gap-2 text-sm opacity-60">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(diary.date).toLocaleDateString('ru-RU', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className={`text-sm opacity-80 leading-relaxed whitespace-pre-line transition-all duration-300 ${
                    expandedId === diary.id ? '' : 'line-clamp-3'
                  }`}>
                    {diary.content}
                  </div>
                  
                  {expandedId !== diary.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/90 to-transparent pointer-events-none"></div>
                  )}
                </div>

                {diary.reply && expandedId === diary.id && (
                  <div className="mt-4 space-y-3">
                    {parseReplyHistory(diary.reply).map((replyItem, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 bg-[var(--button-lavender-light)]/10 border border-[var(--button-lavender)]/20 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-[var(--button-lavender-dark)]">{replyItem.authorName}</span>
                            <span className="text-xs opacity-50">{formatDateTime(replyItem.createdAt)}</span>
                          </div>
                          {replyItem.audioData ? (
                            <div className="flex items-center gap-2">
                              <audio 
                                src={`data:audio/webm;base64,${replyItem.audioData}`} 
                                controls 
                                className="h-8 max-w-full"
                              />
                              {replyItem.audioDuration && (
                                <span className="text-xs opacity-60">
                                  {Math.floor(replyItem.audioDuration / 60)}:{(replyItem.audioDuration % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm opacity-80 whitespace-pre-line">{replyItem.text}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => toggleExpand(diary.id)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-[var(--button-lavender)]/30 rounded-xl hover:bg-[var(--button-lavender)]/10 transition-all duration-300 transform hover:scale-105"
                >
                  {expandedId === diary.id ? (
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

        {diaries.length === 0 && !error && (
          <div className="text-center py-16 border-2 border-[var(--sky-light)]/40 rounded-2xl bg-gradient-to-br from-white/90 to-white/50">
            <div className="text-6xl mb-4 opacity-20">📔</div>
            <h3 className="text-lg mb-2">Дневников пока нет</h3>
            <p className="text-sm opacity-70 mb-6 max-w-md mx-auto">
              Начните заполнять дневники к урокам, чтобы отслеживать свой прогресс и мысли на пути к трезвости.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm transform hover:scale-105"
            >
              Перейти к урокам
            </button>
          </div>
        )}

        <div className="mt-10 border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/80 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow)] relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-[0.04] text-[100px] pointer-events-none">
            🕊️
          </div>
          <div className="text-center relative z-10">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-sm italic opacity-80 leading-relaxed">
              "Дневник — это зеркало вашего пути. Записывайте свои мысли, чувства и победы. Они помогут вам не сбиться с дороги."
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
