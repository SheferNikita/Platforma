import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/PageWrapper';
import { ArrowLeft, ArrowRight, List, CheckCircle, ArrowUp, MessageCircle, HelpCircle, BookOpen, Mic, Paperclip, Image, Video, File, X, StopCircle, FileText, NotebookPen, Download, Loader2, Info, ChevronDown, Trash2, Undo2 } from 'lucide-react';
import AudioPlayer from '../components/AudioPlayer';
import ImageViewer from '../components/ImageViewer';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { KinescopeMultiPlayer } from '../components/KinescopePlayer';
import { useSettings } from '../lib/settings';
import { useAuth } from '../lib/auth';
import { useIsMobile } from '../lib/useIsMobile';
import heic2any from 'heic2any';

type StudentTariff = 'BASIC' | 'FAMILY' | 'RELATIVE' | 'WITH_MENTOR' | 'WITH_PSYCHOLOGIST' | 'INDIVIDUAL_PSYCHOLOGIST';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR', 'ADMIN_ASSISTANT'];

const canAccessMentorFeatures = (tariff: StudentTariff | null, isAdmin = false): boolean => {
  if (isAdmin) return true;
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
  showTask?: boolean;
  taskContent?: string;
  taskAllowedTariffs?: string[];
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
  audioMimeType?: string;
  audioDuration?: number;
  audioAttachmentId?: string;
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
  audioMimeType?: string;
  audioDuration?: number;
  audioAttachmentId?: string;
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_QUALITY = 0.8;

const isHeicFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif') || 
    file.type === 'image/heic' || file.type === 'image/heif';
};

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') || isHeicFile(file);
};

const compressImage = (file: File): Promise<File> => {
  if (file.size < 500 * 1024) return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const needsResize = width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION;
      if (!needsResize && file.size < 2 * 1024 * 1024) { resolve(file); return; }
      if (needsResize) {
        if (width > height) {
          height = Math.round(height * (MAX_IMAGE_DIMENSION / width));
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round(width * (MAX_IMAGE_DIMENSION / height));
          height = MAX_IMAGE_DIMENSION;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        const newName = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new globalThis.File([blob], newName, { type: 'image/jpeg' }));
      }, 'image/jpeg', IMAGE_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

const convertHeicIfNeeded = async (file: File): Promise<File> => {
  if (!isHeicFile(file)) return file;
  try {
    const blob = await (heic2any as any)({ blob: file, toType: 'image/jpeg', quality: IMAGE_QUALITY });
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
    return new globalThis.File([resultBlob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.error('HEIC conversion failed:', err);
    toast.error('Не удалось конвертировать фото из формата HEIC. Попробуйте сохранить фото как JPEG.');
    return file;
  }
};

const processFiles = async (files: File[]): Promise<File[]> => {
  const results: File[] = [];
  let totalSize = 0;
  for (const file of files) {
    let processed = await convertHeicIfNeeded(file);
    if (isImageFile(processed)) {
      processed = await compressImage(processed);
    }
    if (processed.size > MAX_FILE_SIZE) {
      toast.error(`Файл "${file.name}" слишком большой (${(processed.size / 1024 / 1024).toFixed(1)} МБ). Максимум — ${MAX_FILE_SIZE / 1024 / 1024} МБ.`);
      continue;
    }
    const base64Size = Math.ceil(processed.size * 1.37);
    if (totalSize + base64Size > MAX_TOTAL_SIZE) {
      toast.error('Суммарный размер файлов слишком большой. Попробуйте прикрепить меньше файлов.');
      break;
    }
    totalSize += base64Size;
    results.push(processed);
  }
  return results;
};

function SupportButton() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (settings.supportLink) {
      window.open(settings.supportLink, '_blank');
    } else {
      navigate('/contacts');
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm font-medium transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group"
    >
      <span className="relative z-10">СЛУЖБА ЗАБОТЫ</span>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
    </button>
  );
}

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
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
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Lesson completion state
  const [isLessonCompleted, setIsLessonCompleted] = useState(false);
  
  // Chat history state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  const [viewerImages, setViewerImages] = useState<{ url: string; name?: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const openImageViewer = useCallback((images: { url: string; name?: string }[], clickedIndex: number) => {
    setViewerImages(images);
    setViewerIndex(clickedIndex);
    setViewerOpen(true);
  }, []);
  
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // User tariff state
  const [userTariff, setUserTariff] = useState<StudentTariff | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Accordion state for mobile (sections collapsed by default on mobile)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    diary: false,
    notes: false,
    questions: false,
  });
  const [chatDataLoaded, setChatDataLoaded] = useState(false);

  const [deleteMode, setDeleteMode] = useState<'diary' | 'notes' | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [deletingCountdown, setDeletingCountdown] = useState<number | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleDeleteMode = useCallback((type: 'diary' | 'notes') => {
    if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null; }
    if (deleteIntervalRef.current) { clearInterval(deleteIntervalRef.current); deleteIntervalRef.current = null; }
    if (deleteMode === type) {
      setDeleteMode(null);
      setSelectedForDelete(new Set());
      setDeletingCountdown(null);
    } else {
      setDeleteMode(type);
      setSelectedForDelete(new Set());
      setDeletingCountdown(null);
    }
  }, [deleteMode]);

  const toggleSelectMessage = useCallback((messageId: string) => {
    setSelectedForDelete(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId); else next.add(messageId);
      return next;
    });
  }, []);

  const cancelBatchDelete = useCallback(() => {
    setDeletingCountdown(null);
    if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null; }
    if (deleteIntervalRef.current) { clearInterval(deleteIntervalRef.current); deleteIntervalRef.current = null; }
  }, []);

  const confirmBatchDelete = useCallback(() => {
    if (selectedForDelete.size === 0 || !deleteMode) return;
    const type = deleteMode;
    const ids = Array.from(selectedForDelete);
    setDeletingCountdown(5);

    deleteIntervalRef.current = setInterval(() => {
      setDeletingCountdown(prev => {
        if (prev === null || prev <= 1) return prev;
        return prev - 1;
      });
    }, 1000);

    deleteTimerRef.current = setTimeout(async () => {
      if (deleteIntervalRef.current) { clearInterval(deleteIntervalRef.current); deleteIntervalRef.current = null; }
      let successCount = 0;
      for (const id of ids) {
        try {
          const endpoint = type === 'diary'
            ? `/public/lessons/${lessonId}/diary/${id}`
            : `/public/lessons/${lessonId}/personal-notes/${id}`;
          await api.delete(endpoint);
          successCount++;
        } catch (err) {
          console.error('Delete error:', err);
        }
      }
      if (type === 'diary') {
        setDiaryHistory(prev => prev.filter(m => !ids.includes(m.id)));
      } else {
        setNotesHistory(prev => prev.filter(m => !ids.includes(m.id)));
      }
      if (successCount > 0) toast.success(`Удалено: ${successCount}`);
      if (successCount < ids.length) toast.error(`Не удалось удалить: ${ids.length - successCount}`);
      setDeleteMode(null);
      setSelectedForDelete(new Set());
      setDeletingCountdown(null);
      deleteTimerRef.current = null;
    }, 5000);
  }, [selectedForDelete, deleteMode, lessonId]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
    };
  }, []);

  const toggleSection = useCallback((section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);
  
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const diaryFileInputRef = useRef<HTMLInputElement>(null);
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const parseNotesToMessages = (notes: StudentNoteFromAPI[], type: 'question' | 'diary' | 'notes'): ChatMessage[] => {
    const messages: ChatMessage[] = [];
    notes.forEach(note => {
      const entryFiles = type !== 'question' ? note.attachments?.map(att => ({
        name: att.originalName,
        type: att.mimeType,
        url: `/api/public/attachments/${type === 'diary' ? 'diary' : 'note'}/${att.id}`
      })) : undefined;
      messages.push({
        id: note.id,
        text: note.content,
        author: 'student',
        timestamp: new Date(note.createdAt),
        files: entryFiles && entryFiles.length > 0 ? entryFiles : undefined
      });
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
            audioAttachmentId: replyItem.audioAttachmentId,
            hasAudio: !!(replyItem.audioData || replyItem.audioAttachmentId)
          });
        });
      }
    });
    return messages;
  };

  const cancelledRef = useRef(false);

  const fetchLessonData = async (id: string) => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const isMobileView = window.innerWidth < 768;
      const result = await api.get<{
        lesson: LessonData;
        modules: ModuleWithLessons[] | null;
        completedLessonIds: string[];
        isCompleted: boolean;
      }>(`/public/lesson-page/${id}?mobile=${isMobileView}`);
      
      if (cancelledRef.current) return;

      setLessonData(result.lesson);

      if (!isMobileView && result.modules) {
        const currentModule = result.modules.find(m => m.id === result.lesson.module.id);
        if (currentModule) {
          setModuleLessons(currentModule);
        }
      }

      setIsLessonCompleted(result.isCompleted);
    } catch (err: any) {
      if (cancelledRef.current) return;
      console.error('Error fetching lesson:', err);
      const isTimeout = err?.message?.includes('время ожидания') || err?.message?.includes('AbortError');
      if (isTimeout) {
        setError('Не удалось загрузить урок — слишком долгий ответ сервера. Попробуйте ещё раз.');
      } else if (err?.message?.includes('Урок не найден') || err?.message?.includes('Доступ запрещён') || err?.message?.includes('нет доступа')) {
        setError(err.message);
      } else {
        setError('Не удалось загрузить урок. Проверьте подключение к интернету.');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    if (lessonId) {
      fetchLessonData(lessonId);
    }
    return () => { cancelledRef.current = true; };
  }, [lessonId]);

  useEffect(() => {
    if (user?.tariff) {
      setUserTariff(user.tariff as StudentTariff);
    }
    if (user?.role && ADMIN_ROLES.includes(user.role)) {
      setIsAdmin(true);
    }
  }, [user]);

  const loadChatData = useCallback(async () => {
    if (!lessonId || !user || chatDataLoaded) return;
    setChatDataLoaded(true);
    try {
      const [questionsData, diaryData, notesData] = await Promise.all([
        api.get<StudentNoteFromAPI[]>(`/public/lessons/${lessonId}/notes`).catch(() => [] as StudentNoteFromAPI[]),
        api.get<StudentNoteFromAPI[]>(`/public/lessons/${lessonId}/diary`).catch(() => [] as StudentNoteFromAPI[]),
        api.get<StudentNoteFromAPI[]>(`/public/lessons/${lessonId}/personal-notes`).catch(() => [] as StudentNoteFromAPI[])
      ]);

      setChatHistory(parseNotesToMessages(questionsData, 'question'));
      setDiaryHistory(parseNotesToMessages(diaryData, 'diary'));
      setNotesHistory(parseNotesToMessages(notesData, 'notes'));
    } catch (err) {
      console.error('Error fetching chat data:', err);
      setChatDataLoaded(false);
    }
  }, [lessonId, user, chatDataLoaded]);

  useEffect(() => {
    if (!isMobile && lessonId && user) {
      loadChatData();
    }
  }, [isMobile, lessonId, user, loadChatData]);

  useEffect(() => {
    if (isMobile && !chatDataLoaded) {
      const anyOpen = openSections.diary || openSections.notes || openSections.questions;
      if (anyOpen) {
        loadChatData();
      }
    }
  }, [isMobile, openSections, chatDataLoaded, loadChatData]);

  useEffect(() => {
    setChatDataLoaded(false);
    setChatHistory([]);
    setDiaryHistory([]);
    setNotesHistory([]);
    setOpenSections({ diary: false, notes: false, questions: false });
  }, [lessonId]);

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

  const handleMarkComplete = async () => {
    if (isLessonCompleted || !lessonId) return;
    
    try {
      await api.post(`/public/lessons/${lessonId}/complete`, {});
      setIsLessonCompleted(true);
      toast.success('Урок отмечен как пройденный!');
    } catch (err) {
      console.error('Failed to mark lesson complete:', err);
      toast.error('Не удалось отметить урок пройденным');
    }
  };

  const handleSaveDiary = async () => {
    if (!diary.trim() && diaryFiles.length === 0) {
      toast.error('Пожалуйста, напишите что-нибудь или прикрепите файл');
      return;
    }
    if (!lessonId) return;

    try {
      let processedFiles: File[] = [];
      if (diaryFiles.length > 0) {
        setUploadStatus('Подготовка файлов...');
        processedFiles = await processFiles(diaryFiles);
      }

      if (!diary.trim() && processedFiles.length === 0) {
        setUploadStatus(null);
        toast.error('Не удалось обработать файлы. Попробуйте другие файлы или уменьшите их размер.');
        return;
      }

      setUploadStatus('Отправка...');
      const attachments = await Promise.all(
        processedFiles.map(async (file) => ({
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
        files: processedFiles.map(f => ({ 
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
      if (error?.response?.status === 413) {
        toast.error('Файлы слишком большие. Попробуйте уменьшить размер или количество файлов.');
      } else {
        toast.error(error?.response?.data?.error || 'Ошибка при сохранении дневника. Попробуйте ещё раз.');
      }
    } finally {
      setUploadStatus(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!notes.trim() && notesFiles.length === 0) {
      toast.error('Пожалуйста, напишите что-нибудь или прикрепите файл');
      return;
    }
    if (!lessonId) return;

    try {
      let processedFiles: File[] = [];
      if (notesFiles.length > 0) {
        setUploadStatus('Подготовка файлов...');
        processedFiles = await processFiles(notesFiles);
      }

      if (!notes.trim() && processedFiles.length === 0) {
        setUploadStatus(null);
        toast.error('Не удалось обработать файлы. Попробуйте другие файлы или уменьшите их размер.');
        return;
      }

      setUploadStatus('Отправка...');
      const attachments = await Promise.all(
        processedFiles.map(async (file) => ({
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
        files: processedFiles.map(f => ({ 
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
      if (error?.response?.status === 413) {
        toast.error('Файлы слишком большие. Попробуйте уменьшить размер или количество файлов.');
      } else {
        toast.error(error?.response?.data?.error || 'Ошибка при сохранении конспекта. Попробуйте ещё раз.');
      }
    } finally {
      setUploadStatus(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim() && attachedFiles.length === 0) {
      toast.error('Пожалуйста, напишите что-нибудь или прикрепите файл');
      return;
    }

    if (!lessonId) {
      toast.error('Урок не найден');
      return;
    }

    try {
      let processedFiles: File[] = [];
      if (attachedFiles.length > 0) {
        setUploadStatus('Подготовка файлов...');
        processedFiles = await processFiles(attachedFiles);
      }

      if (!feedback.trim() && processedFiles.length === 0) {
        setUploadStatus(null);
        toast.error('Не удалось обработать файлы. Попробуйте другие файлы или уменьшите их размер.');
        return;
      }

      setUploadStatus('Отправка...');
      const attachments = await Promise.all(
        processedFiles.map(async (file) => ({
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

      const newMessage: ChatMessage = {
        id: newNote.id,
        text: feedback,
        author: 'student',
        timestamp: new Date(),
        files: processedFiles.map(f => ({ 
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
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (error: any) {
      console.error('Submit question error:', error);
      if (error?.response?.status === 413) {
        toast.error('Файлы слишком большие. Попробуйте уменьшить размер или количество файлов.');
      } else {
        toast.error(error?.response?.data?.error || 'Ошибка при отправке вопроса. Попробуйте ещё раз.');
      }
    } finally {
      setUploadStatus(null);
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
      const { createMediaRecorder } = await import('../lib/audioRecorder');
      const { recorder, mimeType } = createMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setAudioMimeType(mimeType);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
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
          <div className="mb-6 text-5xl">📡</div>
          <h2 className="mb-2 text-lg font-semibold text-[#3d3527]">{error || 'Урок не найден'}</h2>
          <p className="mb-6 text-sm text-[#3d3527]/60">Попробуйте обновить страницу или вернитесь к списку уроков</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                if (lessonId) {
                  fetchLessonData(lessonId);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 font-medium"
            >
              Попробовать снова
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 border border-[#d4c9b8] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed] transition-all duration-300"
            >
              Вернуться к урокам
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {uploadStatus && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 mx-4 max-w-sm w-full">
            <Loader2 className="w-10 h-10 text-[var(--button-lavender-dark)] animate-spin" />
            <p className="text-lg font-medium text-gray-700 text-center">{uploadStatus}</p>
            <p className="text-sm text-gray-400 text-center">Пожалуйста, не закрывайте страницу</p>
          </div>
        </div>
      )}
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

          <div className="hidden md:flex gap-3 w-full sm:w-auto">
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
          <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-4 md:p-6 lg:p-8 bg-white/90 md:bg-gradient-to-br md:from-white/95 md:to-white/60 md:backdrop-blur-sm shadow-sm md:shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
            <div 
              className="prose prose-lg max-w-none prose-headings:text-[#3a3a3a] prose-p:text-[#3d3527] prose-a:text-[var(--button-lavender-dark)] prose-ul:text-[#3d3527] prose-ol:text-[#3d3527] prose-li:text-[#3d3527] prose-strong:text-[#3a3a3a] prose-blockquote:border-l-[var(--button-lavender-dark)] prose-blockquote:text-[#3d3527]/80"
              dangerouslySetInnerHTML={{ __html: lessonData.content }}
            />
          </div>
        )}

        {/* Прикрепленные файлы */}
        {lessonData.attachments.length > 0 && (
          <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-4 md:p-6 lg:p-8 bg-white/90 md:bg-gradient-to-br md:from-white/90 md:to-white/60 shadow-sm md:shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] md:backdrop-blur-sm">
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

        {/* Блок Задание/Рекомендация */}
        {lessonData.showTask && lessonData.taskContent && (
          (isAdmin || !lessonData.taskAllowedTariffs || lessonData.taskAllowedTariffs.length === 0 || (userTariff && lessonData.taskAllowedTariffs.includes(userTariff))) && (
            <div className="mb-10 border border-[var(--sky-light)]/40 rounded-2xl p-4 md:p-6 lg:p-8 bg-white/90 md:bg-gradient-to-br md:from-white/95 md:to-white/60 md:backdrop-blur-sm shadow-sm md:shadow-[0_4px_16px_var(--ethereal-shadow)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[var(--sky-light)]/30 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#3d3527]/60" />
                </div>
                <h3 className="text-base font-medium text-[#3a3a3a]">Задание / Рекомендация</h3>
              </div>
              <div 
                className="prose prose-sm max-w-none prose-headings:text-[#3a3a3a] prose-p:text-[#3d3527] prose-a:text-[var(--button-lavender-dark)] prose-ul:text-[#3d3527] prose-ol:text-[#3d3527] prose-li:text-[#3d3527] prose-strong:text-[#3a3a3a]"
                dangerouslySetInnerHTML={{ __html: lessonData.taskContent }}
              />
            </div>
          )
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
        {!isAdmin && !canAccessMentorFeatures(userTariff, isAdmin) && userTariff && (
          <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-4 md:p-6 lg:p-8 bg-[var(--sky-soft)]/20 md:bg-gradient-to-br md:from-[var(--sky-soft)]/30 md:to-white/60 shadow-sm md:shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] md:backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
                <Info className="w-5 h-5 text-[var(--icon-lavender)]" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg">Расширенные возможности</h3>
                <p className="text-sm opacity-70 leading-relaxed">
                  Задавать вопросы и вести дневник доступно на форматах участия с наставником или психологом
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Форма дневника с чатом */}
        {canAccessMentorFeatures(userTariff, isAdmin) && lessonData.showDiary !== false && (
        <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-4 md:p-6 lg:p-8 bg-white/80 md:bg-gradient-to-br md:from-white/90 md:to-white/60 shadow-sm md:shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] md:backdrop-blur-sm hover:border-[var(--button-lavender-dark)]/30 transition-all duration-300">
          <div 
            className={`flex items-start gap-3 ${isMobile ? 'cursor-pointer select-none' : 'mb-5'}`}
            onClick={() => isMobile && toggleSection('diary')}
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--button-lavender-light)]/10 md:bg-gradient-to-br md:from-[var(--button-lavender-light)]/10 md:via-[var(--sky-blue)]/8 md:to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
              <FileText className="w-5 h-5 text-[var(--icon-lavender)]" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 md:mb-2 text-lg">Дневник к уроку</h3>
              {(!isMobile || openSections.diary) && (
                <div 
                  className="text-sm opacity-70 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: lessonData.diaryDescription || 'Запишите свои мысли, эмоции и впечатления от пройденного урока' 
                  }}
                />
              )}
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-[var(--icon-lavender)] transition-transform duration-300 flex-shrink-0 mt-2 ${openSections.diary ? 'rotate-180' : ''}`} />
            )}
          </div>

          {(!isMobile || openSections.diary) && <div className={isMobile ? 'mt-4' : ''}>

          {/* Diary chat history */}
          {diaryHistory.length > 0 && (
            <div className="mb-4">
              {diaryHistory.some(m => m.author === 'student') && (
                <div className="flex items-center justify-end gap-2 mb-2">
                  {deleteMode === 'diary' && selectedForDelete.size > 0 && deletingCountdown === null && (
                    <button
                      onClick={confirmBatchDelete}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить ({selectedForDelete.size})
                    </button>
                  )}
                  {deleteMode === 'diary' && deletingCountdown !== null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs">
                      <span className="text-red-600">Удаление через {deletingCountdown}с</span>
                      <button
                        onClick={cancelBatchDelete}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Undo2 className="w-3 h-3" />
                        Отменить
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => toggleDeleteMode('diary')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      deleteMode === 'diary'
                        ? 'bg-red-100 text-red-600 border border-red-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleteMode === 'diary' ? 'Отмена' : 'Удалить'}
                  </button>
                </div>
              )}
              <div className="bg-gradient-to-br from-[var(--sky-soft)]/20 to-white/40 rounded-xl p-2 md:p-3 space-y-1.5 md:space-y-2 border border-[var(--sky-light)]/30">
              {diaryHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.author === 'student' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  {deleteMode === 'diary' && message.author === 'student' && deletingCountdown === null && (
                    <button
                      onClick={() => toggleSelectMessage(message.id)}
                      className="self-center mr-2 flex-shrink-0"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedForDelete.has(message.id)
                          ? 'bg-red-500 border-red-500'
                          : 'border-gray-300 hover:border-red-400'
                      }`}>
                        {selectedForDelete.has(message.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-xl px-2.5 py-1.5 md:px-3 md:py-2 ${
                      message.author === 'student'
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-br-md'
                        : 'bg-white/90 border border-[var(--sky-light)]/40 rounded-bl-md'
                    } shadow-sm`}
                  >
                    {message.audioAttachmentId ? (
                      <AudioPlayer
                        audioUrl={`/api/public/attachments/diary/${message.audioAttachmentId}`}
                        mimeType={message.audioMimeType}
                        duration={message.audioDuration}
                        variant={message.author === 'student' ? 'dark' : 'light'}
                      />
                    ) : message.audioData ? (
                      <AudioPlayer
                        audioData={message.audioData}
                        mimeType={message.audioMimeType}
                        duration={message.audioDuration}
                        variant={message.author === 'student' ? 'dark' : 'light'}
                      />
                    ) : (
                      <p className={`text-xs md:text-sm leading-snug ${message.author === 'curator' ? 'text-gray-800' : ''}`}>
                        {message.text}
                      </p>
                    )}
                    {message.files && message.files.length > 0 && (
                      <div className="mt-1 md:mt-1.5 space-y-1">
                        {message.files.map((file, idx) => (
                          <div key={idx}>
                            {file.type.startsWith('image/') && file.url ? (
                              <img 
                                src={file.url} 
                                alt={file.name}
                                loading="lazy"
                                onClick={() => {
                                  const imageFiles = (message.files || []).filter(f => f.type.startsWith('image/') && f.url);
                                  const imageList = imageFiles.map(f => ({ url: f.url!, name: f.name }));
                                  const clickedIdx = imageFiles.findIndex(f => f.url === file.url);
                                  openImageViewer(imageList, clickedIdx >= 0 ? clickedIdx : 0);
                                }}
                                className="max-w-full max-h-48 md:max-h-64 rounded-lg mt-1 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity object-contain"
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
              onChange={(e) => {
                setDiary(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              placeholder=""
              className="w-full px-4 py-3 pr-12 border-2 border-[var(--sky-light)]/40 rounded-xl focus:outline-none focus:border-[var(--button-lavender-dark)]/50 focus:bg-white transition-all resize-none min-h-[100px] text-sm leading-relaxed backdrop-blur-sm bg-white/80 placeholder:text-xs md:placeholder:text-sm overflow-hidden"
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
          </div>}
        </div>
        )}

        {/* Форма конспекта с чатом */}
        {canAccessMentorFeatures(userTariff, isAdmin) && lessonData.showNotes !== false && (
        <div className="mb-10 border-2 border-[var(--sky-light)]/40 rounded-2xl p-4 md:p-6 lg:p-8 bg-white/80 md:bg-gradient-to-br md:from-white/90 md:to-white/60 shadow-sm md:shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] md:backdrop-blur-sm hover:border-[var(--button-lavender-dark)]/30 transition-all duration-300">
          <div 
            className={`flex items-start gap-3 ${isMobile ? 'cursor-pointer select-none' : 'mb-5'}`}
            onClick={() => isMobile && toggleSection('notes')}
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--button-lavender-light)]/10 md:bg-gradient-to-br md:from-[var(--button-lavender-light)]/10 md:via-[var(--sky-blue)]/8 md:to-[var(--button-lavender-dark)]/10 flex items-center justify-center flex-shrink-0 border border-[var(--sky-light)]/30">
              <NotebookPen className="w-5 h-5 text-[var(--icon-lavender)]" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 md:mb-2 text-lg">Конспект к уроку</h3>
              {(!isMobile || openSections.notes) && (
                <div 
                  className="text-sm opacity-70 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: lessonData.notesDescription || 'Запишите основные моменты урока, важные понятия и выводы' 
                  }}
                />
              )}
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-[var(--icon-lavender)] transition-transform duration-300 flex-shrink-0 mt-2 ${openSections.notes ? 'rotate-180' : ''}`} />
            )}
          </div>

          {(!isMobile || openSections.notes) && <div className={isMobile ? 'mt-4' : ''}>

          {/* Notes chat history */}
          {notesHistory.length > 0 && (
            <div className="mb-4">
              {notesHistory.some(m => m.author === 'student') && (
                <div className="flex items-center justify-end gap-2 mb-2">
                  {deleteMode === 'notes' && selectedForDelete.size > 0 && deletingCountdown === null && (
                    <button
                      onClick={confirmBatchDelete}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить ({selectedForDelete.size})
                    </button>
                  )}
                  {deleteMode === 'notes' && deletingCountdown !== null && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs">
                      <span className="text-red-600">Удаление через {deletingCountdown}с</span>
                      <button
                        onClick={cancelBatchDelete}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Undo2 className="w-3 h-3" />
                        Отменить
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => toggleDeleteMode('notes')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      deleteMode === 'notes'
                        ? 'bg-red-100 text-red-600 border border-red-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleteMode === 'notes' ? 'Отмена' : 'Удалить'}
                  </button>
                </div>
              )}
              <div className="bg-gradient-to-br from-[var(--sky-soft)]/20 to-white/40 rounded-xl p-2 md:p-3 space-y-1.5 md:space-y-2 border border-[var(--sky-light)]/30">
              {notesHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.author === 'student' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  {deleteMode === 'notes' && message.author === 'student' && deletingCountdown === null && (
                    <button
                      onClick={() => toggleSelectMessage(message.id)}
                      className="self-center mr-2 flex-shrink-0"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedForDelete.has(message.id)
                          ? 'bg-red-500 border-red-500'
                          : 'border-gray-300 hover:border-red-400'
                      }`}>
                        {selectedForDelete.has(message.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-xl px-2.5 py-1.5 md:px-3 md:py-2 ${
                      message.author === 'student'
                        ? 'bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-br-md'
                        : 'bg-white/90 border border-[var(--sky-light)]/40 rounded-bl-md'
                    } shadow-sm`}
                  >
                    {message.audioAttachmentId ? (
                      <AudioPlayer
                        audioUrl={`/api/public/attachments/note/${message.audioAttachmentId}`}
                        mimeType={message.audioMimeType}
                        duration={message.audioDuration}
                        variant={message.author === 'student' ? 'dark' : 'light'}
                      />
                    ) : message.audioData ? (
                      <AudioPlayer
                        audioData={message.audioData}
                        mimeType={message.audioMimeType}
                        duration={message.audioDuration}
                        variant={message.author === 'student' ? 'dark' : 'light'}
                      />
                    ) : (
                      <p className={`text-xs md:text-sm leading-snug ${message.author === 'curator' ? 'text-gray-800' : ''}`}>
                        {message.text}
                      </p>
                    )}
                    {message.files && message.files.length > 0 && (
                      <div className="mt-1 md:mt-1.5 space-y-1">
                        {message.files.map((file, idx) => (
                          <div key={idx}>
                            {file.type.startsWith('image/') && file.url ? (
                              <img 
                                src={file.url} 
                                alt={file.name}
                                loading="lazy"
                                onClick={() => {
                                  const imageFiles = (message.files || []).filter(f => f.type.startsWith('image/') && f.url);
                                  const imageList = imageFiles.map(f => ({ url: f.url!, name: f.name }));
                                  const clickedIdx = imageFiles.findIndex(f => f.url === file.url);
                                  openImageViewer(imageList, clickedIdx >= 0 ? clickedIdx : 0);
                                }}
                                className="max-w-full max-h-48 md:max-h-64 rounded-lg mt-1 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity object-contain"
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
              onChange={(e) => {
                setNotes(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              placeholder=""
              className="w-full px-4 py-3 pr-12 border-2 border-[var(--sky-light)]/40 rounded-xl focus:outline-none focus:border-[var(--button-lavender-dark)]/50 focus:bg-white transition-all resize-none min-h-[100px] text-sm leading-relaxed backdrop-blur-sm bg-white/80 placeholder:text-xs md:placeholder:text-sm overflow-hidden"
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
          </div>}
        </div>
        )}

        {/* Дублирование навигации */}
        <div className="mb-10 hidden md:flex justify-center">
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
        <div className="mb-8 p-4 md:p-6 lg:p-8 bg-[var(--sky-soft)]/15 md:bg-gradient-to-br md:from-[var(--sky-soft)]/25 md:to-white/60 border-2 border-[var(--sky-light)]/40 rounded-2xl shadow-sm md:shadow-[0_8px_24px_var(--ethereal-shadow)] text-center md:backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/10 flex items-center justify-center mx-auto mb-4 border border-[var(--button-lavender-light)]/20">
            <HelpCircle className="w-6 h-6 text-[var(--button-lavender-dark)]" />
          </div>
          <h4 className="mb-3 text-[var(--button-lavender-dark)] text-lg">Остались вопросы?</h4>
          <p className="text-sm opacity-70 mb-5 leading-relaxed text-center">
            Если у Вас есть организационные или технические вопросы или сложности, напишите нам:
          </p>
          <SupportButton />
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
        
        {viewerOpen && viewerImages.length > 0 && (
          <ImageViewer
            images={viewerImages}
            initialIndex={viewerIndex}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </div>
    </PageWrapper>
  );
}