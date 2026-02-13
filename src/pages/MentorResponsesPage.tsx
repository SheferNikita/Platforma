import React, { useState, useEffect, useRef } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { MessageCircle, BookOpen, FileText, ArrowLeft, ChevronDown, ChevronUp, Loader2, User, Volume2, Send, Mic, StopCircle, Paperclip, X, Image, File } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useSettings } from '../lib/settings';
import { useAuth } from '../lib/auth';

interface AttachmentItem {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  data: string;
}

interface ReplyHistoryItem {
  text: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  audioData?: string;
  audioDuration?: number;
  audioMimeType?: string;
  attachments?: AttachmentItem[];
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
  if (typeof reply === 'object') {
    if (reply.text) {
      return [reply as ReplyHistoryItem];
    }
    return [];
  }
  if (typeof reply === 'string') {
    try {
      const parsed = JSON.parse(reply);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed.text) return [parsed];
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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export function MentorResponsesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSectionVisible, loading: settingsLoading } = useSettings();
  const [lessons, setLessons] = useState<LessonGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  
  const [replyingTo, setReplyingTo] = useState<{ id: string; type: 'diary' | 'note' } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioMimeTypeRef = useRef<string>('audio/webm');

  // Проверка видимости раздела
  const isSectionEnabled = isSectionVisible('mentor_responses', user?.tariff);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const meResponse = await api.get('/auth/me') as { user: { tariff?: string } };
        const tariff = meResponse.user?.tariff || 'BASIC';
        const allowedTariffs = ['WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];
        if (!allowedTariffs.includes(tariff)) {
          navigate('/lessons');
          return;
        }

        const data = await api.get('/public/mentor-responses') as LessonGroup[];
        setLessons(data);
        if (data.length > 0) {
          setExpandedLesson(data[0].lessonId);
        }
      } catch (err: any) {
        if (err.status === 403) {
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

  const playAudio = (audioData: string, itemId: string, mimeType?: string) => {
    if (playingAudio === itemId) {
      setPlayingAudio(null);
      return;
    }
    try {
      const audio = new Audio(`data:${mimeType || 'audio/webm'};base64,${audioData}`);
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

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Ваш браузер не поддерживает запись аудио');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { createMediaRecorder } = await import('../lib/audioRecorder');
      const { recorder, mimeType: recMimeType } = createMediaRecorder(stream);
      audioMimeTypeRef.current = recMimeType;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recMimeType });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Запись началась');
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Доступ к микрофону запрещен');
        } else if (error.name === 'NotFoundError') {
          toast.error('Микрофон не найден');
        } else {
          toast.error('Не удалось получить доступ к микрофону');
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Запись остановлена');
    }
  };

  const removeAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
      toast.success(`Файл прикреплён`);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const openReplyForm = (item: DialogItem) => {
    setReplyingTo({ id: item.id, type: item.type });
    setReplyText('');
    setAttachedFiles([]);
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const closeReplyForm = () => {
    setReplyingTo(null);
    setReplyText('');
    setAttachedFiles([]);
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const submitReply = async () => {
    if (!replyingTo) return;
    if (!replyText.trim() && !audioBlob) {
      toast.error('Напишите текст или запишите голосовое сообщение');
      return;
    }

    setIsSubmitting(true);
    try {
      let audioData: string | undefined;
      if (audioBlob) {
        audioData = await fileToBase64(new window.File([audioBlob], 'audio.webm', { type: audioMimeTypeRef.current }));
      }

      const attachments = await Promise.all(
        attachedFiles.map(async (file) => ({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          data: await fileToBase64(file)
        }))
      );

      const endpoint = replyingTo.type === 'diary' 
        ? `/public/diary/${replyingTo.id}/student-reply`
        : `/public/note/${replyingTo.id}/student-reply`;

      const response = await api.post<{ success: boolean; message: ReplyHistoryItem }>(endpoint, {
        reply: replyText.trim(),
        audioData,
        audioDuration: recordingTime,
        audioMimeType: audioMimeTypeRef.current,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      if (response.success) {
        setLessons(prev => prev.map(lesson => ({
          ...lesson,
          items: lesson.items.map(item => {
            if (item.id === replyingTo.id) {
              const existingReplies = parseReply(item.reply);
              return {
                ...item,
                reply: [...existingReplies, response.message]
              };
            }
            return item;
          })
        })));

        toast.success('Ответ отправлен');
        closeReplyForm();
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка при отправке');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Редирект если раздел скрыт (пропускаем пока настройки грузятся)
  if (!settingsLoading && !isSectionEnabled) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender)]" />
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
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
    <PageWrapper>
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
                                      onClick={() => playAudio(reply.audioData!, `${item.id}-${idx}`, reply.audioMimeType)}
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
                                  
                                  {reply.attachments && reply.attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {reply.attachments.map((att, attIdx) => (
                                        <div key={attIdx} className="flex items-center gap-2 bg-white/70 px-2 py-1 rounded text-xs">
                                          {att.mimeType?.startsWith('image/') ? (
                                            <Image className="w-3 h-3 text-[#8b7355]" />
                                          ) : (
                                            <File className="w-3 h-3 text-[#8b7355]" />
                                          )}
                                          <span className="text-[#8b7355]">{att.originalName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}

                              {replyingTo?.id === item.id ? (
                                <div className="bg-white rounded-lg p-4 border border-[var(--button-lavender)]/30">
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                                  />
                                  
                                  <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Напишите ответ..."
                                    className="w-full p-3 border border-[#e8e4da] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/30 text-sm"
                                    rows={3}
                                  />
                                  
                                  {attachedFiles.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {attachedFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-[#f5f3ed] px-2 py-1 rounded-lg text-sm">
                                          {getFileIcon(file)}
                                          <span className="text-xs text-[#8b7355] max-w-[100px] truncate">{file.name}</span>
                                          <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-600">
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {audioBlob && (
                                    <div className="mt-2 flex items-center gap-2 bg-[var(--button-lavender)]/10 px-3 py-2 rounded-lg">
                                      <Volume2 className="w-4 h-4 text-[var(--button-lavender)]" />
                                      <span className="text-sm text-[var(--button-lavender-dark)]">
                                        Голосовое сообщение ({formatTime(recordingTime)})
                                      </span>
                                      <button onClick={removeAudio} className="ml-auto text-red-400 hover:text-red-600">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                  
                                  {isRecording && (
                                    <div className="mt-2 flex items-center gap-2 text-red-500">
                                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                      <span className="text-sm">Запись: {formatTime(recordingTime)}</span>
                                    </div>
                                  )}
                                  
                                  <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 rounded-lg hover:bg-[#f5f3ed] transition-colors"
                                        title="Прикрепить файл"
                                      >
                                        <Paperclip className="w-5 h-5 text-[#8b7355]" />
                                      </button>
                                      
                                      {isRecording ? (
                                        <button
                                          onClick={stopRecording}
                                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                          title="Остановить запись"
                                        >
                                          <StopCircle className="w-5 h-5" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={startRecording}
                                          className="p-2 rounded-lg hover:bg-[#f5f3ed] transition-colors"
                                          title="Записать голосовое"
                                          disabled={!!audioBlob}
                                        >
                                          <Mic className={`w-5 h-5 ${audioBlob ? 'text-[#8b7355]/30' : 'text-[#8b7355]'}`} />
                                        </button>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={closeReplyForm}
                                        className="px-4 py-2 text-sm text-[#8b7355] hover:bg-[#f5f3ed] rounded-lg transition-colors"
                                      >
                                        Отмена
                                      </button>
                                      <button
                                        onClick={submitReply}
                                        disabled={isSubmitting || (!replyText.trim() && !audioBlob)}
                                        className="px-4 py-2 text-sm bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-lg hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >
                                        {isSubmitting ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Send className="w-4 h-4" />
                                        )}
                                        Отправить
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openReplyForm(item)}
                                  className="w-full mt-2 py-2 text-sm text-[var(--button-lavender-dark)] hover:bg-[var(--button-lavender)]/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  Ответить
                                </button>
                              )}
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
