import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PageWrapper } from '../components/PageWrapper';
import { ArrowLeft, ArrowRight, List, CheckCircle, ArrowUp, MessageCircle, HelpCircle, BookOpen, Mic, Paperclip, Image, Video, File, X, StopCircle, FileText, NotebookPen, Download, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { KinescopeMultiPlayer } from '../components/KinescopePlayer';

type StudentTariff = 'BASIC' | 'FAMILY' | 'WITH_MENTOR' | 'WITH_PSYCHOLOGIST' | 'INDIVIDUAL_PSYCHOLOGIST';

const canAccessMentorFeatures = (tariff: StudentTariff | null): boolean => {
  if (!tariff) return false;
  const fullAccessTariffs: StudentTariff[] = ['WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];
  return fullAccessTariffs.includes(tariff);
};

interface LessonVideo {
  id: string;
  title?: string;
  url: string;
  order: number;
}

interface LessonAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

interface LessonData {
  id: string;
  title: string;
  description?: string;
  content?: string;
  duration?: string;
  isTextOnly: boolean;
  videos: LessonVideo[];
  attachments: LessonAttachment[];
  module: {
    id: string;
    title: string;
  };
  showDiary?: boolean;
  showNotes?: boolean;
  diaryDescription?: string;
  notesDescription?: string;
}

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: Array<{
    id: string;
    title: string;
    order: number;
  }>;
}

interface ChatMessage {
  id: string;
  text: string;
  author: 'student' | 'curator';
  timestamp: Date;
  files?: { name: string; type: string; url?: string }[];
  hasAudio?: boolean;
  audioData?: string;
  audioDuration?: number;
  curatorName?: string;
}

interface AttachmentFromAPI {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface StudentNoteFromAPI {
  id: string;
  content: string;
  noteType: string;
  reply: string | null;
  repliedAt: string | null;
  repliedBy: { name: string } | null;
  createdAt: string;
  attachments?: AttachmentFromAPI[];
}

interface ReplyHistoryItem {
  text: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  audioData?: string;
  audioDuration?: number;
}

function parseReplyHistory(reply: string | null): ReplyHistoryItem[] {
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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  // Lesson data from API
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [moduleLessons, setModuleLessons] = useState<ModuleWithLessons | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // States for diary and notes (input fields)
  const [diary, setDiary] = useState('');
  const [notes, setNotes] = useState('');
  
  // Chat history for diary and notes
  const [diaryHistory, setDiaryHistory] = useState<ChatMessage[]>([]);
  const [notesHistory, setNotesHistory] = useState<ChatMessage[]>([]);
  
  // States for attachments
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [diaryFiles, setDiaryFiles] = useState<File[]>([]);
  const [notesFiles, setNotesFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Lesson completion state
  const [isLessonCompleted, setIsLessonCompleted] = useState(false);
  
  // Chat history state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Image modal state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  // User tariff state
  const [userTariff, setUserTariff] = useState<StudentTariff | null>(null);
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (fullscreenImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [fullscreenImage]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const diaryFileInputRef = useRef<HTMLInputElement>(null);
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch lesson data from API
  useEffect(() => {
    async function fetchLesson() {
      if (!lessonId) return;
      setLoading(true);
      setError(null);
      try {
        const lesson = await api.get<LessonData>(`/public/lessons/${lessonId}`);
        setLessonData(lesson);
        
        // Fetch module with all lessons for navigation
        const modules = await api.get<ModuleWithLessons[]>('/public/modules');
        const currentModule = modules.find(m => m.id === lesson.module.id);
        if (currentModule) {
          setModuleLessons(currentModule);
        }

        // Fetch chat history (student questions and replies)
        try {
          console.log('[LessonDetailPage] Fetching notes for lesson:', lessonId);
          const notes = await api.get<StudentNoteFromAPI[]>(`/public/lessons/${lessonId}/notes`);
          console.log('[LessonDetailPage] Received notes:', notes);
          const messages: ChatMessage[] = [];
          
          notes.forEach(note => {
            // Add student question
            messages.push({
              id: note.id,
              text: note.content,
              author: 'student',
              timestamp: new Date(note.createdAt)
            });
            
            // Add curator replies if exists
            if (note.reply) {
              const replyHistory = parseReplyHistory(note.reply);
              replyHistory.forEach((replyItem, idx) => {
                messages.push({
                  id: `${note.id}-reply-${idx}`,
                  text: replyItem.text,
                  author: 'curator',
                  timestamp: new Date(replyItem.createdAt),
                  curatorName: replyItem.authorName,
                  audioData: replyItem.audioData,
                  audioDuration: replyItem.audioDuration,
                  hasAudio: !!replyItem.audioData
                });
              });
            }
          });
          
          console.log('[LessonDetailPage] Setting chat history:', messages.length, 'messages');
          setChatHistory(messages);
        } catch (notesErr) {
          console.error('Error fetching notes:', notesErr);
        }

        // Fetch diary history
        try {
          const diaryEntries = await api.get<StudentNoteFromAPI[]>(`/public/lessons/${lessonId}/diary`);
          const diaryMessages: ChatMessage[] = [];
          diaryEntries.forEach(entry => {
            diaryMessages.push({
              id: entry.id,
              text: entry.content,
              author: 'student',
              timestamp: new Date(entry.createdAt)
            });
            if (entry.reply) {
              const replyHistory = parseReplyHistory(entry.reply);
              replyHistory.forEach((replyItem, idx) => {
                diaryMessages.push({
                  id: `${entry.id}-reply-${idx}`,
                  text: replyItem.text,
                  author: 'curator',
                  timestamp: new Date(replyItem.createdAt),
                  curatorName: replyItem.authorName,
                  audioData: replyItem.audioData,
                  audioDuration: replyItem.audioDuration,
                  hasAudio: !!replyItem.audioData
                });
              });
            }
          });
          setDiaryHistory(diaryMessages);
        } catch (diaryErr) {
          console.error('Error fetching diary:', diaryErr);
        }

        // Fetch personal notes history (конспект)
        try {
          const notesEntries = await api.get<StudentNoteFromAPI[]>(`/public/lessons/${lessonId}/personal-notes`);
          const notesMessages: ChatMessage[] = [];
          notesEntries.forEach(entry => {
            notesMessages.push({
              id: entry.id,
              text: entry.content,
              author: 'student',
              timestamp: new Date(entry.createdAt)
            });
            if (entry.reply) {
              const replyHistory = parseReplyHistory(entry.reply);
              replyHistory.forEach((replyItem, idx) => {
                notesMessages.push({
                  id: `${entry.id}-reply-${idx}`,
                  text: replyItem.text,
                  author: 'curator',
                  timestamp: new Date(replyItem.createdAt),
                  curatorName: replyItem.authorName,
                  audioData: replyItem.audioData,
                  audioDuration: replyItem.audioDuration,
                  hasAudio: !!replyItem.audioData
                });
              });
            }
          });
          setNotesHistory(notesMessages);
        } catch (notesErr) {
          console.error('Error fetching personal notes:', notesErr);
        }
      } catch (err) {
        console.error('Error fetching lesson:', err);
        setError('Урок не найден');
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [lessonId]);

  // Fetch user tariff from API
  useEffect(() => {
    async function fetchUserTariff() {
      try {
        const { user } = await api.get<{ user: { tariff?: StudentTariff } }>('/auth/me');
        if (user.tariff) {
          setUserTariff(user.tariff);
        }
      } catch (err) {
        console.error('Error fetching user tariff:', err);
      }
    }
    fetchUserTariff();
  }, []);

  // Navigation helpers
  const currentLessonIndex = moduleLessons?.lessons.findIndex(l => l.id === lessonId) ?? -1;
  const prevLesson = currentLessonIndex > 0 ? moduleLessons?.lessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < (moduleLessons?.lessons.length ?? 0) - 1 ? moduleLessons?.lessons[currentLessonIndex + 1] : null;

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkComplete = () => {
    if (isLessonCompleted) return;
    // Здесь должна быть логика для сохранения статуса урока
    setIsLessonCompleted(true);
    toast.success('Урок отмечен как пройденный!');
  };

  const handleSaveDiary = async () => {
    if (!diary.trim()) {
      toast.error('Пожалуйста, напишите что-нибудь в дневнике');
      return;
    }
    if (!lessonId) return;

    try {
      const attachments = await Promise.all(
        diaryFiles.map(async (file) => ({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          data: await fileToBase64(file)
        }))
      );

      const newEntry = await api.post<{ id: string; attachments?: AttachmentFromAPI[] }>(`/public/lessons/${lessonId}/diary`, { 
        content: diary.trim(),
        attachments: attachments.length > 0 ? attachments : undefined
      });
      
      const newMessage: ChatMessage = {
        id: newEntry.id,
        text: diary.trim(),
        author: 'student',
        timestamp: new Date(),
        files: diaryFiles.map(f => ({ 
          name: f.name, 
          type: f.type,
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
        }))
      };
      setDiaryHistory(prev => [...prev, newMessage]);
      setDiary('');
      setDiaryFiles([]);
      toast.success('Запись в дневнике сохранена!');
    } catch (error: any) {
      console.error('Save diary error:', error);
      toast.error(error.response?.data?.error || 'Ошибка при сохранении дневника');
    }
  };

  const handleSaveNotes = async () => {
    if (!notes.trim()) {
      toast.error('Пожалуйста, напишите что-нибудь в конспекте');
      return;
    }
    if (!lessonId) return;

    try {
      const attachments = await Promise.all(
        notesFiles.map(async (file) => ({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          data: await fileToBase64(file)
        }))
      );

      const newEntry = await api.post<{ id: string; attachments?: AttachmentFromAPI[] }>(`/public/lessons/${lessonId}/personal-notes`, { 
        content: notes.trim(),
        attachments: attachments.length > 0 ? attachments : undefined
      });
      
      const newMessage: ChatMessage = {
        id: newEntry.id,
        text: notes.trim(),
        author: 'student',
        timestamp: new Date(),
        files: notesFiles.map(f => ({ 
          name: f.name, 
          type: f.type,
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
        }))
      };
      setNotesHistory(prev => [...prev, newMessage]);
      setNotes('');
      setNotesFiles([]);
      toast.success('Конспект сохранен!');
    } catch (error: any) {
      console.error('Save notes error:', error);
      toast.error(error.response?.data?.error || 'Ошибка при сохранении конспекта');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      toast.error('Пожалуйста, напишите вопрос');
      return;
    }

    if (!lessonId) {
      toast.error('Урок не найден');
      return;
    }

    try {
      const attachments = await Promise.all(
        attachedFiles.map(async (file) => ({
          filename: `${Date.now()}_${file.name}`,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          data: await fileToBase64(file)
        }))
      );

      const newNote = await api.post<{ id: string; attachments?: AttachmentFromAPI[] }>(`/public/lessons/${lessonId}/notes`, {
        content: feedback.trim(),
        noteType: 'question',
        attachments: attachments.length > 0 ? attachments : undefined
      });

      // Add message to chat history for UI
      const newMessage: ChatMessage = {
        id: newNote.id,
        text: feedback,
        author: 'student',
        timestamp: new Date(),
        files: attachedFiles.map(f => ({ 
          name: f.name, 
          type: f.type,
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
        })),
        hasAudio: !!audioBlob,
        audioDuration: audioBlob ? recordingTime : undefined,
      };
      
      setChatHistory(prev => [...prev, newMessage]);
      toast.success('Ваш вопрос отправлен! Мы свяжемся с вами в ближайшее время.');
      setFeedback('');
      setAttachedFiles([]);
      setAudioBlob(null);
      setRecordingTime(0);
      
      // Auto scroll to new message
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (error: any) {
      console.error('Submit question error:', error);
      toast.error(error.response?.data?.error || 'Ошибка при отправке вопроса');
    }
  };

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days === 1) return 'вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // File handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} ${newFiles.length === 1 ? 'файл' : 'файла'} прикреплен`);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    toast.success('Файл удален');
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      // Check if browser supports mediaDevices API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Ваш браузер не поддерживает запись аудио');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Запись началась');
    } catch (error) {
      // Handle different error types
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error('Доступ к микрофону запрещен. Разрешите доступ в настройках браузера', {
            duration: 5000,
          });
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          toast.error('Микрофон не найден. Подключите микрофон и попробуйте снова');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          toast.error('Микрофон используется другим приложением');
        } else {
          toast.error('Не удалось получить доступ к микрофону. Проверьте настройки');
        }
      } else {
        toast.error('Произошла ошибка при записи аудио');
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
    toast.success('Аудио удалено');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--button-lavender-dark)]" />
        </div>
      </PageWrapper>
    );
  }

  if (error || !lessonData) {
    return (
      <PageWrapper>
        <div className="text-center py-20">
          <h2 className="mb-4">{error || 'Урок не найден'}</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300"
          >
            Вернуться к урокам
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="animate-fade-in max-w-5xl mx-auto">
        {/* Шапка с нвигацией */}
        <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-white/60 hover:border-[var(--button-lavender-dark)]/40 transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
          >
            <List className="w-4 h-4" />
            К списку уроков
          </button>

          <div className="flex gap-3 w-full sm:w-auto">
            {prevLesson && (
              <button
                onClick={() => navigate(`/lesson/${prevLesson.id}`)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-white/60 hover:border-[var(--button-lavender-dark)]/40 transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Предыдущий урок</span>
              </button>
            )}
            {nextLesson && (
              <button
                onClick={() => navigate(`/lesson/${nextLesson.id}`)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group"
              >
                <span className="relative z-10">Следующий урок</span>
                <ArrowRight className="w-4 h-4 relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              </button>
            )}
          </div>
        </div>

        {/* Заголовок урока */}
        <div className="mb-10 border-b border-[var(--sky-blue)]/20 pb-8 relative">
          <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-[#3a3a3a]">{lessonData.title}</h1>
          </div>
          {lessonData.description && (
            <p className="opacity-70 leading-relaxed mb-4">{lessonData.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm opacity-60">
            {lessonData.duration && (
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>Продолжительность: {lessonData.duration}</span>
              </div>
            )}
            {lessonData.isTextOnly && (
              <span className="px-2 py-0.5 bg-[var(--sky-light)]/30 rounded-lg text-xs">
                Текстовый урок
              </span>
            )}
          </div>
        </div>

        {/* Видео блок - только если не текстовый урок */}
        {!lessonData.isTextOnly && lessonData.videos.length > 0 && (
          <div className="mb-10">
            <KinescopeMultiPlayer 
              videos={lessonData.videos.map(v => ({
                url: v.url,
                title: v.title
              }))} 
            />
          </div>
        )}

        {/* Контент урока (HTML) */}
        {lessonData.content && (
          <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-white/95 to-white/60 backdrop-blur-sm shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
            <div 
              className="prose prose-lg max-w-none prose-headings:text-[#3a3a3a] prose-p:text-[#3d3527] prose-a:text-[var(--button-lavender-dark)] prose-ul:text-[#3d3527] prose-ol:text-[#3d3527] prose-li:text-[#3d3527] prose-strong:text-[#3a3a3a] prose-blockquote:border-l-[var(--button-lavender-dark)] prose-blockquote:text-[#3d3527]/80"
              dangerouslySetInnerHTML={{ __html: lessonData.content }}
            />
          </div>
        )}

        {/* Прикрепленные файлы */}
        {lessonData.attachments.length > 0 && (
          <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-white/90 to-white/60 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] backdrop-blur-sm">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
                <Paperclip className="w-5 h-5 text-[var(--icon-lavender)]" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg">Материалы к уроку</h3>
                <p className="text-sm opacity-70">Скачайте дополнительные материалы для изучения</p>
              </div>
            </div>
            <div className="space-y-3">
              {lessonData.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  download={attachment.originalName}
                  className="flex items-center gap-3 p-3 border border-[var(--sky-light)]/40 rounded-xl hover:bg-white/60 hover:border-[var(--button-lavender-dark)]/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--sky-light)]/20 flex items-center justify-center">
                    <File className="w-5 h-5 text-[var(--button-lavender-dark)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.originalName}</p>
                    <p className="text-xs opacity-60">{formatFileSize(attachment.size)}</p>
                  </div>
                  <Download className="w-5 h-5 opacity-40 group-hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка отметить пройденным */}
        <div className="mb-10 flex justify-center">
          <button
            onClick={handleMarkComplete}
            disabled={isLessonCompleted}
            className={`inline-flex items-center gap-2.5 px-10 py-4 text-white rounded-xl transition-all duration-300 text-base font-medium relative overflow-hidden group ${
              isLessonCompleted 
                ? 'bg-gradient-to-r from-[#6b9e7a] to-[#5a8c69] cursor-default' 
                : 'bg-gradient-to-r from-[var(--success-green)] to-[#5a8c69] hover:shadow-[0_12px_28px_rgba(74,124,89,0.35)] transform hover:scale-[1.03] active:scale-[0.98]'
            }`}
          >
            <CheckCircle className="w-5 h-5 relative z-10 drop-shadow-sm" />
            <span className="relative z-10">
              {isLessonCompleted ? 'Урок отмечен пройденным' : 'Отметить урок пройденным'}
            </span>
            {!isLessonCompleted && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            )}
          </button>
        </div>

        {/* Info message for basic tariffs */}
        {!canAccessMentorFeatures(userTariff) && userTariff && (
          <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-[var(--sky-soft)]/30 to-white/60 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
                <Info className="w-5 h-5 text-[var(--icon-lavender)]" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg">Расширенные возможности</h3>
                <p className="text-sm opacity-70 leading-relaxed">
                  Задавать вопросы и вести дневник доступно на тарифах с наставником или психологом
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Форма дневника с чатом */}
        {canAccessMentorFeatures(userTariff) && lessonData.showDiary !== false && (
        <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-white/90 to-white/60 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] backdrop-blur-sm hover:border-[var(--button-lavender-dark)]/30 transition-all duration-300">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
              <FileText className="w-5 h-5 text-[var(--icon-lavender)]" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-lg">Дневник к уроку</h3>
              <div 
                className="text-sm opacity-70 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: lessonData.diaryDescription || 'Запишите свои мысли, эмоции и впечатления от пройденного урока' 
                }}
              />
            </div>
          </div>

          {/* Diary chat history */}
          {diaryHistory.length > 0 && (
            <div className="mb-4 bg-gradient-to-br from-[var(--sky-soft)]/20 to-white/40 rounded-xl p-2 md:p-3 space-y-1.5 md:space-y-2 border border-[var(--sky-light)]/30">
              {diaryHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.author === 'student' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-xl px-2.5 py-1.5 md:px-3 md:py-2 ${
                      message.author === 'student'
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-br-md'
                        : 'bg-white/90 border border-[var(--sky-light)]/40 rounded-bl-md'
                    } shadow-sm`}
                  >
                    {message.audioData ? (
                      <div className="flex items-center gap-2">
                        <audio 
                          src={`data:audio/webm;base64,${message.audioData}`} 
                          controls 
                          className="h-8 max-w-full"
                        />
                        {message.audioDuration && (
                          <span className="text-[10px] opacity-60">
                            {Math.floor(message.audioDuration / 60)}:{(message.audioDuration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className={`text-xs md:text-sm leading-snug ${message.author === 'curator' ? 'text-gray-800' : ''}`}>
                        {message.text}
                      </p>
                    )}
                    {/* Attached files */}
                    {message.files && message.files.length > 0 && (
                      <div className="mt-1 md:mt-1.5 space-y-1">
                        {message.files.map((file, idx) => (
                          <div key={idx}>
                            {file.type.startsWith('image/') && file.url ? (
                              <img 
                                src={file.url} 
                                alt={file.name}
                                onClick={() => setFullscreenImage(file.url!)}
                                className="w-full max-w-full rounded-lg mt-1 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            ) : (
                              <div
                                className={`flex items-center gap-1.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs ${
                                  message.author === 'student' ? 'bg-white/20' : 'bg-[var(--sky-soft)]/30'
                                }`}
                              >
                                <File className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                <span className="truncate max-w-[100px] md:max-w-[120px]">{file.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p
                      className={`text-[8px] md:text-[9px] mt-0.5 md:mt-1 ${
                        message.author === 'student' ? 'text-white/60 text-right' : 'text-gray-400'
                      }`}
                    >
                      {message.curatorName && `${message.curatorName} • `}{formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diary attached files display */}
          {diaryFiles.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {diaryFiles.map((file, index) => (
                  <div key={index} className="group flex items-center gap-2 bg-[var(--sky-soft)]/40 hover:bg-[var(--sky-soft)]/60 px-3 py-2 rounded-xl transition-all duration-200 border border-[var(--sky-light)]/30">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(file)}
                    </div>
                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={() => setDiaryFiles(prev => prev.filter((_, i) => i !== index))}
                      className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/10 text-[var(--button-lavender-dark)] hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                      title="Удалить"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={diary}
              onChange={(e) => setDiary(e.target.value)}
              placeholder="Опишите, что вы узнали сегодня, какие мысли вызвал урок, что вы чувствуете..."
              className="w-full px-4 py-3 pr-12 border-2 border-[var(--sky-light)]/40 rounded-xl focus:outline-none focus:border-[var(--button-lavender-dark)]/50 focus:bg-white transition-all resize-none min-h-[100px] text-sm leading-relaxed backdrop-blur-sm bg-white/80 placeholder:text-xs md:placeholder:text-sm"
            />
            
            {/* Diary attachment button */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <input
                ref={diaryFileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const newFiles = Array.from(files);
                    setDiaryFiles(prev => [...prev, ...newFiles]);
                    toast.success(`${newFiles.length} ${newFiles.length === 1 ? 'файл' : 'файла'} прикреплен`);
                  }
                }}
                className="hidden"
              />
              <button
                onClick={() => diaryFileInputRef.current?.click()}
                className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[var(--button-lavender-light)]/10 border border-[var(--sky-light)]/40 hover:border-[var(--button-lavender-dark)]/40 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 group"
                title="Прикрепить файл"
              >
                <Paperclip className="w-4 h-4 text-[var(--button-lavender-dark)] group-hover:text-[var(--icon-lavender)]" />
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveDiary}
            className="mt-4 inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
          >
            <span className="relative z-10">Отправить запись</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          </button>
        </div>
        )}

        {/* Форма конспекта с чатом */}
        {canAccessMentorFeatures(userTariff) && lessonData.showNotes !== false && (
        <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-white/90 to-white/60 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] backdrop-blur-sm hover:border-[var(--button-lavender-dark)]/30 transition-all duration-300">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
              <NotebookPen className="w-5 h-5 text-[var(--icon-lavender)]" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-lg">Конспект к уроку</h3>
              <div 
                className="text-sm opacity-70 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: lessonData.notesDescription || 'Запишите основные моменты урока, важные понятия и выводы' 
                }}
              />
            </div>
          </div>

          {/* Notes chat history */}
          {notesHistory.length > 0 && (
            <div className="mb-4 bg-gradient-to-br from-[var(--sky-soft)]/20 to-white/40 rounded-xl p-2 md:p-3 space-y-1.5 md:space-y-2 border border-[var(--sky-light)]/30">
              {notesHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.author === 'student' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-xl px-2.5 py-1.5 md:px-3 md:py-2 ${
                      message.author === 'student'
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-br-md'
                        : 'bg-white/90 border border-[var(--sky-light)]/40 rounded-bl-md'
                    } shadow-sm`}
                  >
                    {message.audioData ? (
                      <div className="flex items-center gap-2">
                        <audio 
                          src={`data:audio/webm;base64,${message.audioData}`} 
                          controls 
                          className="h-8 max-w-full"
                        />
                        {message.audioDuration && (
                          <span className="text-[10px] opacity-60">
                            {Math.floor(message.audioDuration / 60)}:{(message.audioDuration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className={`text-xs md:text-sm leading-snug ${message.author === 'curator' ? 'text-gray-800' : ''}`}>
                        {message.text}
                      </p>
                    )}
                    {/* Attached files */}
                    {message.files && message.files.length > 0 && (
                      <div className="mt-1 md:mt-1.5 space-y-1">
                        {message.files.map((file, idx) => (
                          <div key={idx}>
                            {file.type.startsWith('image/') && file.url ? (
                              <img 
                                src={file.url} 
                                alt={file.name}
                                onClick={() => setFullscreenImage(file.url!)}
                                className="w-full max-w-full rounded-lg mt-1 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            ) : (
                              <div
                                className={`flex items-center gap-1.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs ${
                                  message.author === 'student' ? 'bg-white/20' : 'bg-[var(--sky-soft)]/30'
                                }`}
                              >
                                <File className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                <span className="truncate max-w-[100px] md:max-w-[120px]">{file.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p
                      className={`text-[8px] md:text-[9px] mt-0.5 md:mt-1 ${
                        message.author === 'student' ? 'text-white/60 text-right' : 'text-gray-400'
                      }`}
                    >
                      {message.curatorName && `${message.curatorName} • `}{formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes attached files display */}
          {notesFiles.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {notesFiles.map((file, index) => (
                  <div key={index} className="group flex items-center gap-2 bg-[var(--sky-soft)]/40 hover:bg-[var(--sky-soft)]/60 px-3 py-2 rounded-xl transition-all duration-200 border border-[var(--sky-light)]/30">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(file)}
                    </div>
                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={() => setNotesFiles(prev => prev.filter((_, i) => i !== index))}
                      className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/10 text-[var(--button-lavender-dark)] hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                      title="Удалить"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Основные тезисы урока, важные определения, техники и упражнения..."
              className="w-full px-4 py-3 pr-12 border-2 border-[var(--sky-light)]/40 rounded-xl focus:outline-none focus:border-[var(--button-lavender-dark)]/50 focus:bg-white transition-all resize-none min-h-[100px] text-sm leading-relaxed backdrop-blur-sm bg-white/80 placeholder:text-xs md:placeholder:text-sm"
            />
            
            {/* Notes attachment button */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <input
                ref={notesFileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const newFiles = Array.from(files);
                    setNotesFiles(prev => [...prev, ...newFiles]);
                    toast.success(`${newFiles.length} ${newFiles.length === 1 ? 'файл' : 'файла'} прикреплен`);
                  }
                }}
                className="hidden"
              />
              <button
                onClick={() => notesFileInputRef.current?.click()}
                className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[var(--button-lavender-light)]/10 border border-[var(--sky-light)]/40 hover:border-[var(--button-lavender-dark)]/40 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 group"
                title="Прикрепить файл"
              >
                <Paperclip className="w-4 h-4 text-[var(--button-lavender-dark)] group-hover:text-[var(--icon-lavender)]" />
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveNotes}
            className="mt-4 inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
          >
            <span className="relative z-10">Отправить запись</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          </button>
        </div>
        )}

        {/* Окно обратной связи */}
        {canAccessMentorFeatures(userTariff) && (
        <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-6 md:p-8 bg-gradient-to-br from-white/90 to-white/60 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] backdrop-blur-sm">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
              <MessageCircle className="w-5 h-5 text-[var(--icon-lavender)]" />
            </div>
            <div>
              <h3 className="mb-2 text-lg">Есть вопросы по уроку?</h3>
              <p className="text-sm opacity-70 leading-relaxed">
                Задайте свой вопрос, и мы постараемся ответить в ближайшее время
              </p>
            </div>
          </div>
          
          {/* Chat history */}
          {chatHistory.length > 0 && (
            <div className="mb-4 bg-gradient-to-br from-[var(--sky-soft)]/20 to-white/40 rounded-xl p-2 md:p-3 space-y-1.5 md:space-y-2 border border-[var(--sky-light)]/30">
              {chatHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.author === 'student' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-xl px-2.5 py-1.5 md:px-3 md:py-2 ${
                      message.author === 'student'
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-br-md'
                        : 'bg-white/90 border border-[var(--sky-light)]/40 rounded-bl-md'
                    } shadow-sm`}
                  >
                    {/* Audio message */}
                    {message.audioData ? (
                      <div className="flex items-center gap-2">
                        <audio 
                          src={`data:audio/webm;base64,${message.audioData}`} 
                          controls 
                          className="h-8 max-w-full"
                        />
                        {message.audioDuration && (
                          <span className="text-[10px] opacity-60">
                            {Math.floor(message.audioDuration / 60)}:{(message.audioDuration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    ) : message.text && (
                      <p className={`text-xs md:text-sm leading-snug ${message.author === 'curator' ? 'text-gray-800' : ''}`}>
                        {message.text}
                      </p>
                    )}
                    
                    {/* Attached files */}
                    {message.files && message.files.length > 0 && (
                      <div className="mt-1 md:mt-1.5 space-y-1">
                        {message.files.map((file, idx) => (
                          <div key={idx}>
                            {file.type.startsWith('image/') && file.url ? (
                              // Image preview
                              <img 
                                src={file.url} 
                                alt={file.name}
                                onClick={() => setFullscreenImage(file.url!)}
                                className="w-full max-w-full rounded-lg mt-1 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            ) : (
                              // Non-image file
                              <div
                                className={`flex items-center gap-1.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs ${
                                  message.author === 'student'
                                    ? 'bg-white/20'
                                    : 'bg-[var(--sky-soft)]/30'
                                }`}
                              >
                                {file.type.startsWith('video/') && <Video className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                                {!file.type.startsWith('image/') && !file.type.startsWith('video/') && <File className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                                <span className="truncate max-w-[100px] md:max-w-[120px]">{file.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Audio message */}
                    {message.hasAudio && (
                      <div
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md text-[10px] md:text-xs mt-1 md:mt-1.5 ${
                          message.author === 'student'
                            ? 'bg-white/20'
                            : 'bg-[var(--sky-soft)]/30'
                        }`}
                      >
                        <Mic className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        <span>Голосовое {message.audioDuration ? `${formatTime(message.audioDuration)}` : ''}</span>
                      </div>
                    )}
                    
                    {/* Timestamp */}
                    <p
                      className={`text-[8px] md:text-[9px] mt-0.5 md:mt-1 ${
                        message.author === 'student' ? 'text-white/60 text-right' : 'text-gray-400'
                      }`}
                    >
                      {formatMessageTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Attached files display */}
          {attachedFiles.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="group flex items-center gap-2 bg-[var(--sky-soft)]/40 hover:bg-[var(--sky-soft)]/60 px-3 py-2 rounded-xl transition-all duration-200 border border-[var(--sky-light)]/30">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(file)}
                    </div>
                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/10 text-[var(--button-lavender-dark)] hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                      title="Удалить"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Recorded audio display */}
          {audioBlob && (
            <div className="mb-3">
              <div className="group flex items-center gap-2 bg-[var(--sky-soft)]/40 hover:bg-[var(--sky-soft)]/60 px-3 py-2 rounded-xl transition-all duration-200 border border-[var(--sky-light)]/30 inline-flex">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0">
                  <Mic className="w-4 h-4 text-[var(--icon-lavender)]" />
                </div>
                <span className="text-xs">Голосовое сообщение ({formatTime(recordingTime)})</span>
                <button
                  onClick={removeAudio}
                  className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500/10 text-[var(--button-lavender-dark)] hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                  title="Удалить"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          
          {/* Input container with integrated attachment buttons */}
          <div className="relative">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Напишите ваш вопрос здесь..."
              className="w-full px-4 py-3 pr-28 border-2 border-[var(--sky-light)]/40 rounded-xl focus:outline-none focus:border-[var(--button-lavender-dark)]/50 focus:bg-white transition-all resize-none min-h-[100px] text-sm leading-relaxed backdrop-blur-sm bg-white/80 placeholder:text-xs md:placeholder:text-sm"
            />
            
            {/* Attachment buttons - positioned inside textarea */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e, 'file')}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[var(--button-lavender-light)]/10 border border-[var(--sky-light)]/40 hover:border-[var(--button-lavender-dark)]/40 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 group"
                title="Прикрепить файл"
              >
                <Paperclip className="w-4 h-4 text-[var(--button-lavender-dark)] group-hover:text-[var(--icon-lavender)]" />
              </button>
              
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 group ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : 'bg-white/80 hover:bg-[var(--button-lavender-light)]/10 border border-[var(--sky-light)]/40 hover:border-[var(--button-lavender-dark)]/40'
                }`}
                title={isRecording ? `Остановить запись (${formatTime(recordingTime)})` : 'Записать голосовое сообщение'}
              >
                {isRecording ? (
                  <StopCircle className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-[var(--button-lavender-dark)] group-hover:text-[var(--icon-lavender)]" />
                )}
              </button>
            </div>
          </div>
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-500 animate-fade-in">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span>Идет запись... {formatTime(recordingTime)}</span>
            </div>
          )}
          
          <button
            onClick={handleSubmitFeedback}
            className="mt-4 inline-flex items-center justify-center mx-auto px-8 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
          >
            <span className="relative z-10">Отправить вопрос</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          </button>
        </div>
        )}

        {/* Дублирование навигации */}
        <div className="mb-10 flex justify-center">
          <div className="flex gap-3 w-full sm:w-auto">
            {prevLesson && (
              <button
                onClick={() => navigate(`/lesson/${prevLesson.id}`)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-white/60 hover:border-[var(--button-lavender-dark)]/40 transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Предыдущий урок
              </button>
            )}
            {nextLesson && (
              <button
                onClick={() => navigate(`/lesson/${nextLesson.id}`)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group"
              >
                <span className="relative z-10">Следующий урок</span>
                <ArrowRight className="w-4 h-4 relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              </button>
            )}
          </div>
        </div>

        {/* Повал */}
        <div className="mb-8 p-6 md:p-8 bg-gradient-to-br from-[var(--sky-soft)]/25 to-white/60 border-2 border-[var(--sky-light)]/40 rounded-2xl shadow-[0_8px_24px_var(--ethereal-shadow)] text-center backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/10 flex items-center justify-center mx-auto mb-4 border border-[var(--button-lavender-light)]/20">
            <HelpCircle className="w-6 h-6 text-[var(--button-lavender-dark)]" />
          </div>
          <h4 className="mb-3 text-[var(--button-lavender-dark)] text-lg">Остались вопросы?</h4>
          <p className="text-sm opacity-70 mb-5 leading-relaxed text-center">
            Наша техподдержка готова помочь вам в любое время
          </p>
          <button
            onClick={() => navigate('/contacts')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group"
          >
            <span className="relative z-10">Связаться с поддержкой</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          </button>
        </div>

        {/* Кнопка наверх */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-24 md:bottom-8 right-4 md:right-8 p-3.5 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-2xl shadow-[0_8px_24px_rgba(122,132,171,0.35)] hover:shadow-[0_12px_32px_rgba(122,132,171,0.45)] transition-all duration-300 transform hover:scale-110 active:scale-95 z-40 animate-fade-in backdrop-blur-sm"
            title="Наверх"
          >
            <ArrowUp className="w-5 h-5 drop-shadow-sm" />
          </button>
        )}
        
        {/* Fullscreen image modal */}
        {fullscreenImage && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4"
            style={{ margin: 0, padding: '1rem' }}
            onClick={() => setFullscreenImage(null)}
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 transform hover:scale-110 active:scale-95 z-10"
              title="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fullscreenImage}
              alt="Полноразмерное изображение"
              className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] w-auto h-auto object-contain rounded-lg"
              style={{ display: 'block' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
      </div>
    </PageWrapper>
  );
}