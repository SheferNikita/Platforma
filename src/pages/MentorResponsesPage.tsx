import React, { useState, useEffect } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { MessageCircle, BookOpen, FileText, Calendar, ArrowLeft, ChevronDown, ChevronUp, Loader2, User, Volume2 } from 'lucide-react';
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

interface DialogItem {
  id: string;
  type: 'diary' | 'note';
  noteType?: string;
  content: string;
  reply: ReplyHistoryItem[] | string | null;
  createdAt: string;
  repliedAt: string | null;
  repliedByName: string | null;
}

interface LessonGroup {
  lessonId: string;
  lessonTitle: string;
  lessonOrder: number;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  items: DialogItem[];
}

function parseReply(reply: any): ReplyHistoryItem[] {
  if (!reply) return [];
  if (Array.isArray(reply)) return reply;
  if (typeof reply === 'string') {
    try {
      const parsed = JSON.parse(reply);
      if (Array.isArray(parsed)) return parsed;
      return [{ text: reply, authorId: 'legacy', authorName: 'Наставник', authorRole: 'MENTOR', createdAt: new Date().toISOString() }];
    } catch {
      return [{ text: reply, authorId: 'legacy', authorName: 'Наставник', authorRole: 'MENTOR', createdAt: new Date().toISOString() }];
    }
  }
  return [];
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getTypeLabel(item: DialogItem): string {
  if (item.type === 'diary') return 'Дневник';
  if (item.noteType === 'question') return 'Вопрос';
  if (item.noteType === 'report') return 'Отчёт';
  return 'Заметка';
}

function getTypeIcon(item: DialogItem) {
  if (item.type === 'diary') return <BookOpen className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

export function MentorResponsesPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<LessonGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meResponse = await api.get('/auth/me') as { user: { tariff?: string } };
        const tariff = meResponse.user?.tariff || 'BASIC';
        if (tariff === 'BASIC' || tariff === 'FAMILY') {
          navigate('/lessons');
          return;
        }

        const data = await api.get('/public/mentor-responses') as LessonGroup[];
        setLessons(data);
        if (data.length > 0) {
          setExpandedLesson(data[0].lessonId);
        }
      } catch (err: any) {
        if (err.message?.includes('403') || err.message?.includes('тариф')) {
          navigate('/lessons');
          return;
        }
        setError(err.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const toggleLesson = (lessonId: string) => {
    setExpandedLesson(expandedLesson === lessonId ? null : lessonId);
    setExpandedItem(null);
  };

  const toggleItem = (itemId: string) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  const playAudio = (audioData: string, itemId: string) => {
    if (playingAudio === itemId) {
      setPlayingAudio(null);
      return;
    }
    try {
      const audio = new Audio(audioData);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(itemId);
    } catch (e) {
      console.error('Error playing audio:', e);
    }
  };

  const countReplies = (item: DialogItem): number => {
    const replies = parseReply(item.reply);
    return replies.filter(r => r.authorRole !== 'STUDENT').length;
  };

  if (loading) {
    return (
      <PageWrapper title="Ответы от наставника">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender)]" />
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper title="Ответы от наставника">
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-[var(--button-lavender)] hover:underline"
          >
            Вернуться назад
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Ответы от наставника">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#8b7355] hover:text-[#6b5744] mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Назад</span>
        </button>

        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-[#e8e4da]/50 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--button-lavender)] to-[var(--button-lavender-dark)] flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#3d3527]">Ответы от наставника</h1>
              <p className="text-sm text-[#8b7355]">Все ваши диалоги по урокам</p>
            </div>
          </div>
        </div>

        {lessons.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-[#e8e4da]/50 text-center">
            <MessageCircle className="w-12 h-12 text-[#8b7355]/30 mx-auto mb-4" />
            <p className="text-[#8b7355]">Пока нет ответов от наставника</p>
            <p className="text-sm text-[#8b7355]/70 mt-2">
              Когда вы получите ответы на дневники или заметки, они появятся здесь
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map((lesson) => (
              <div
                key={lesson.lessonId}
                className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-[#e8e4da]/50 overflow-hidden"
              >
                <button
                  onClick={() => toggleLesson(lesson.lessonId)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#f5f3ed]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--button-lavender)]/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-[var(--button-lavender)]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[#3d3527]">{lesson.lessonTitle}</p>
                      <p className="text-xs text-[#8b7355]">{lesson.moduleTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#8b7355] bg-[#f5f3ed] px-3 py-1 rounded-full">
                      {lesson.items.length} {lesson.items.length === 1 ? 'запись' : lesson.items.length < 5 ? 'записи' : 'записей'}
                    </span>
                    {expandedLesson === lesson.lessonId ? (
                      <ChevronUp className="w-5 h-5 text-[#8b7355]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#8b7355]" />
                    )}
                  </div>
                </button>

                {expandedLesson === lesson.lessonId && (
                  <div className="border-t border-[#e8e4da]/50 px-6 py-4 space-y-3">
                    {lesson.items.map((item) => {
                      const replies = parseReply(item.reply);
                      const mentorRepliesCount = countReplies(item);
                      
                      return (
                        <div
                          key={item.id}
                          className="bg-[#f5f3ed]/50 rounded-xl overflow-hidden"
                        >
                          <button
                            onClick={() => toggleItem(item.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#f5f3ed] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                item.type === 'diary' 
                                  ? 'bg-[var(--button-lavender)]/20 text-[var(--button-lavender)]'
                                  : 'bg-amber-100 text-amber-600'
                              }`}>
                                {getTypeIcon(item)}
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-[#3d3527]">
                                    {getTypeLabel(item)}
                                  </span>
                                  <span className="text-xs text-[#8b7355]">
                                    от {formatDate(item.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-[#8b7355]">
                                  {mentorRepliesCount} {mentorRepliesCount === 1 ? 'ответ' : mentorRepliesCount < 5 ? 'ответа' : 'ответов'} от наставника
                                </p>
                              </div>
                            </div>
                            {expandedItem === item.id ? (
                              <ChevronUp className="w-4 h-4 text-[#8b7355]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#8b7355]" />
                            )}
                          </button>

                          {expandedItem === item.id && (
                            <div className="px-4 pb-4 space-y-3">
                              <div className="bg-white rounded-lg p-3 border border-[#e8e4da]/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="w-4 h-4 text-[#8b7355]" />
                                  <span className="text-xs font-medium text-[#8b7355]">Вы</span>
                                  <span className="text-xs text-[#8b7355]/70">
                                    {formatDateTime(item.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm text-[#3d3527] whitespace-pre-wrap">
                                  {item.content}
                                </p>
                              </div>

                              {replies.map((reply, idx) => (
                                <div
                                  key={idx}
                                  className={`rounded-lg p-3 border ${
                                    reply.authorRole === 'STUDENT'
                                      ? 'bg-white border-[#e8e4da]/50'
                                      : 'bg-[var(--button-lavender)]/10 border-[var(--button-lavender)]/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <User className={`w-4 h-4 ${
                                      reply.authorRole === 'STUDENT' ? 'text-[#8b7355]' : 'text-[var(--button-lavender)]'
                                    }`} />
                                    <span className={`text-xs font-medium ${
                                      reply.authorRole === 'STUDENT' ? 'text-[#8b7355]' : 'text-[var(--button-lavender-dark)]'
                                    }`}>
                                      {reply.authorRole === 'STUDENT' ? 'Вы' : reply.authorName}
                                    </span>
                                    <span className="text-xs text-[#8b7355]/70">
                                      {formatDateTime(reply.createdAt)}
                                    </span>
                                  </div>
                                  
                                  {reply.audioData && (
                                    <button
                                      onClick={() => playAudio(reply.audioData!, `${item.id}-${idx}`)}
                                      className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                                        playingAudio === `${item.id}-${idx}`
                                          ? 'bg-[var(--button-lavender)] text-white'
                                          : 'bg-white border border-[var(--button-lavender)]/30 text-[var(--button-lavender)]'
                                      }`}
                                    >
                                      <Volume2 className="w-4 h-4" />
                                      <span>
                                        {playingAudio === `${item.id}-${idx}` ? 'Воспроизводится...' : 'Голосовое сообщение'}
                                      </span>
                                    </button>
                                  )}
                                  
                                  {reply.text && (
                                    <p className="text-sm text-[#3d3527] whitespace-pre-wrap">
                                      {reply.text}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
