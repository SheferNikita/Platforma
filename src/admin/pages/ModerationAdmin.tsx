import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { MessageCircle, BookOpen, FileText, CheckCircle, Clock, X, Send, User, Eye, Paperclip, Image, File, Download, Mic, Square, Play, Pause, Search, Users } from 'lucide-react';
import AudioPlayer from '../../components/AudioPlayer';
import ImageViewer from '../../components/ImageViewer';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

const getAttachmentUrl = (attachment: Attachment, itemType: 'diary' | 'question' | 'report' | 'personal'): string => {
  const type = itemType === 'diary' ? 'diary' : 'note';
  return `/api/public/attachments/${type}/${attachment.id}`;
};

interface ChatMessage {
  id: string;
  type: 'student' | 'mentor';
  content: string;
  createdAt: string;
  author?: { name: string };
  attachments?: Attachment[];
}

interface ReplyMessage {
  text: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  audioData?: string;
  audioDuration?: number;
  audioMimeType?: string;
  audioAttachmentId?: string;
  fileAttachmentIds?: string[];
  fileAttachments?: Array<{id: string; originalName: string; mimeType: string}>;
}

function parseReplyHistory(reply: string | null): ReplyMessage[] {
  if (!reply) return [];
  try {
    const parsed = JSON.parse(reply);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [{ text: reply, authorId: 'legacy', authorName: 'Наставник', authorRole: 'MENTOR', createdAt: new Date().toISOString() }];
  } catch {
    if (reply === '[Просмотрено]') return [];
    return [{ text: reply, authorId: 'legacy', authorName: 'Наставник', authorRole: 'MENTOR', createdAt: new Date().toISOString() }];
  }
}

interface ModerationItem {
  id: string;
  type: 'diary' | 'question' | 'report' | 'personal';
  content: string;
  reply: string | null;
  repliedAt: string | null;
  repliedBy: { name: string } | null;
  createdAt: string;
  lesson: { id: string; title: string };
  student: {
    id: string;
    user: { name: string; email: string };
  };
  attachments?: Attachment[];
}

interface DialogSummary {
  studentId: string;
  lessonId: string;
  type: 'diary' | 'question' | 'report';
  student: { id: string; user: { name: string; email: string } };
  lesson: { id: string; title: string };
  totalCount: number;
  unansweredCount: number;
  latestContent: string;
  latestDate: string;
  hasAttachments: boolean;
}

interface DialogsResponse {
  dialogs: DialogSummary[];
  total: number;
  hasMore: boolean;
}

const typeConfig = {
  diary: { label: 'Дневник', icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
  question: { label: 'Вопрос', icon: MessageCircle, color: 'bg-purple-100 text-purple-700' },
  report: { label: 'Отчет', icon: FileText, color: 'bg-green-100 text-green-700' },
  personal: { label: 'Конспект', icon: FileText, color: 'bg-teal-100 text-teal-700' }
};

function getAttachmentTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Фото';
  if (mimeType.startsWith('video/')) return 'Видео';
  if (mimeType.startsWith('audio/')) return 'Аудио';
  if (mimeType.includes('pdf')) return 'PDF-документ';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Документ';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Таблица';
  return 'Файл';
}

function getContentPreview(item: ModerationItem): string {
  if (item.content && item.content.trim()) return item.content;
  if (item.attachments && item.attachments.length > 0) {
    const types = item.attachments.map(a => getAttachmentTypeLabel(a.mimeType));
    const unique = [...new Set(types)];
    return `📎 ${unique.join(', ')} (${item.attachments.length})`;
  }
  return 'Без содержания';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getRecordCountLabel(count: number): string {
  if (count === 1) return '1 запись';
  if (count >= 2 && count <= 4) return `${count} записи`;
  return `${count} записей`;
}

export function ModerationAdmin() {
  const [dialogs, setDialogs] = useState<DialogSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [miniGroupFilter, setMiniGroupFilter] = useState<string>('all');
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [emailSearch, setEmailSearch] = useState('');
  const [emailSearchApplied, setEmailSearchApplied] = useState('');
  const [miniGroups, setMiniGroups] = useState<{ id: string; title: string }[]>([]);
  const [selectedDialog, setSelectedDialog] = useState<DialogSummary | null>(null);
  const [dialogItems, setDialogItems] = useState<ModerationItem[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadMiniGroups();
  }, []);

  useEffect(() => {
    setOffset(0);
    setDialogs([]);
    loadDialogs(0, true);
  }, [statusFilter, typeFilter, miniGroupFilter, lessonFilter, emailSearchApplied]);

  const handleEmailSearch = useCallback((value: string) => {
    setEmailSearch(value);
    if (emailSearchTimerRef.current) {
      clearTimeout(emailSearchTimerRef.current);
    }
    emailSearchTimerRef.current = setTimeout(() => {
      setEmailSearchApplied(value.trim());
    }, 600);
  }, []);

  async function loadMiniGroups() {
    try {
      const data = await api.get<{ id: string; title: string }[]>('/public/moderation/mini-groups');
      setMiniGroups(data);
    } catch (error) {
      console.error('Failed to load mini-groups:', error);
    }
  }

  const uniqueLessons = React.useMemo(() => {
    const lessonMap = new Map<string, { id: string; title: string }>();
    dialogs.forEach(d => {
      if (!lessonMap.has(d.lessonId)) {
        lessonMap.set(d.lessonId, {
          id: d.lessonId,
          title: d.lesson.title
        });
      }
    });
    return Array.from(lessonMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [dialogs]);

  async function loadDialogs(newOffset: number, replace: boolean) {
    try {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (miniGroupFilter !== 'all') params.append('miniGroupId', miniGroupFilter);
      if (lessonFilter !== 'all') params.append('lessonId', lessonFilter);
      if (emailSearchApplied) params.append('email', emailSearchApplied);
      params.append('offset', String(newOffset));
      params.append('limit', '50');

      const data = await api.get<DialogsResponse>(`/public/moderation?${params.toString()}`);
      if (replace) {
        setDialogs(data.dialogs);
      } else {
        setDialogs(prev => [...prev, ...data.dialogs]);
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
      setOffset(newOffset + data.dialogs.length);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function handleLoadMore() {
    loadDialogs(offset, false);
  }

  async function openDialog(dialog: DialogSummary) {
    setSelectedDialog(dialog);
    setReplyText('');
    setDialogLoading(true);
    try {
      const params = new URLSearchParams({
        studentId: dialog.studentId,
        lessonId: dialog.lessonId,
        type: dialog.type
      });
      const items = await api.get<ModerationItem[]>(`/public/moderation/dialog?${params.toString()}`);
      setDialogItems(items);
    } catch (error) {
      toast.error('Ошибка загрузки диалога');
      setSelectedDialog(null);
    } finally {
      setDialogLoading(false);
    }
  }

  async function reloadDialogItems() {
    if (!selectedDialog) return;
    try {
      const params = new URLSearchParams({
        studentId: selectedDialog.studentId,
        lessonId: selectedDialog.lessonId,
        type: selectedDialog.type
      });
      const items = await api.get<ModerationItem[]>(`/public/moderation/dialog?${params.toString()}`);
      setDialogItems(items);
    } catch (error) {
      console.error('Failed to reload dialog items:', error);
    }
  }

  function getTargetItem(): ModerationItem | null {
    const unanswered = dialogItems.filter(i => !i.reply);
    if (unanswered.length > 0) return unanswered[unanswered.length - 1];
    return dialogItems.length > 0 ? dialogItems[dialogItems.length - 1] : null;
  }

  async function submitReply(files?: File[]) {
    const targetItem = getTargetItem();
    const hasFiles = files && files.length > 0;
    if (!targetItem || (!replyText.trim() && !hasFiles)) return;

    setSubmitting(true);
    try {
      const endpoint = targetItem.type === 'diary'
        ? `/public/moderation/diary/${targetItem.id}/reply`
        : `/public/moderation/note/${targetItem.id}/reply`;

      let attachments: Array<{ filename: string; originalName: string; mimeType: string; size: number; data: string }> | undefined;
      if (hasFiles) {
        attachments = await Promise.all(
          files.map(async (file) => {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
            });
            return {
              filename: `${Date.now()}_${file.name}`,
              originalName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              data: base64
            };
          })
        );
      }

      await api.post<ModerationItem>(endpoint, { 
        reply: replyText,
        attachments: attachments && attachments.length > 0 ? attachments : undefined
      });
      toast.success('Сообщение отправлено');
      setReplyText('');
      await Promise.all([reloadDialogItems(), loadDialogs(0, true)]);
    } catch (error) {
      toast.error('Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAudioReply(audioData: string, duration: number, mimeType?: string) {
    const targetItem = getTargetItem();
    if (!targetItem) return;

    setSubmitting(true);
    try {
      const endpoint = targetItem.type === 'diary'
        ? `/public/moderation/diary/${targetItem.id}/reply`
        : `/public/moderation/note/${targetItem.id}/reply`;

      await api.post<ModerationItem>(endpoint, {
        reply: '',
        audioData,
        audioDuration: duration,
        audioMimeType: mimeType || 'audio/webm'
      });
      toast.success('Голосовое сообщение отправлено');
      await Promise.all([reloadDialogItems(), loadDialogs(0, true)]);
    } catch (error) {
      toast.error('Ошибка отправки голосового сообщения');
    } finally {
      setSubmitting(false);
    }
  }

  async function markAsViewed() {
    const targetItem = getTargetItem();
    if (!targetItem) return;

    setSubmitting(true);
    try {
      const endpoint = targetItem.type === 'diary'
        ? `/public/moderation/diary/${targetItem.id}/view`
        : `/public/moderation/note/${targetItem.id}/view`;

      await api.post(endpoint, {});
      toast.success('Отмечено как просмотренное');
      await Promise.all([reloadDialogItems(), loadDialogs(0, true)]);
    } catch (error) {
      toast.error('Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  const stats = {
    total: total,
    pending: dialogs.filter(d => d.unansweredCount > 0).length,
    answered: dialogs.filter(d => d.unansweredCount === 0).length
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Обратная связь</h1>
          <p className="text-[#3d3527]/60 mt-1 text-sm md:text-base">Ответы и вопросы учеников</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-2 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Всего диалогов</p>
          <p className="text-lg md:text-2xl font-bold text-[#3d3527]">{stats.total}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-2 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Ожидают ответа</p>
          <p className="text-lg md:text-2xl font-bold text-orange-600">{stats.pending}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-2 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Все отвечены</p>
          <p className="text-lg md:text-2xl font-bold text-green-600">{stats.answered}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base"
        >
          <option value="all">Все статусы</option>
          <option value="pending">Ожидают ответа</option>
          <option value="answered">С ответом</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base"
        >
          <option value="all">Все типы</option>
          <option value="diary">Дневник</option>
          <option value="question">Вопрос</option>
          <option value="report">Отчет</option>
        </select>
        <select
          value={miniGroupFilter}
          onChange={(e) => setMiniGroupFilter(e.target.value)}
          className="px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base max-w-[200px]"
        >
          <option value="all">Все мини-группы</option>
          {miniGroups.map(group => (
            <option key={group.id} value={group.id}>
              {group.title}
            </option>
          ))}
        </select>
        <select
          value={lessonFilter}
          onChange={(e) => setLessonFilter(e.target.value)}
          className="px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base max-w-[250px]"
        >
          <option value="all">Все уроки</option>
          {uniqueLessons.map(lesson => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d3527]/40" />
          <input
            type="text"
            value={emailSearch}
            onChange={(e) => handleEmailSearch(e.target.value)}
            placeholder="Поиск по email..."
            className="pl-9 pr-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base w-full sm:w-[250px]"
          />
          {emailSearch && (
            <button
              onClick={() => { setEmailSearch(''); setEmailSearchApplied(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3d3527]/40 hover:text-[#3d3527]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : dialogs.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Диалогов не найдено</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {dialogs.map((dialog) => {
                const key = `${dialog.studentId}__${dialog.lessonId}__${dialog.type}`;
                const TypeIcon = typeConfig[dialog.type]?.icon || MessageCircle;
                return (
                  <div
                    key={key}
                    className="p-3 space-y-2 cursor-pointer active:bg-[#f5f3ed]/50"
                    onClick={() => openDialog(dialog)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${typeConfig[dialog.type]?.color || 'bg-gray-100'}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig[dialog.type]?.label || dialog.type}
                        </span>
                        <span className="text-xs text-[#3d3527]/60">{getRecordCountLabel(dialog.totalCount)}</span>
                        {dialog.unansweredCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3" />
                            {dialog.unansweredCount} без ответа
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                          </span>
                        )}
                        {dialog.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-[#3d3527]/40" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#3d3527] truncate">{dialog.student.user.name}</p>
                        <p className="text-xs text-[#3d3527]/50 truncate">{dialog.student.user.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#3d3527]/60 truncate">{dialog.lesson.title}</p>
                    <p className="text-sm text-[#3d3527] line-clamp-2">{dialog.latestContent || 'Без содержания'}</p>
                    <p className="text-xs text-[#3d3527]/50">{format(new Date(dialog.latestDate), 'd MMM yyyy', { locale: ru })}</p>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#f5f3ed]">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Тип</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Ученик</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Урок</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Записи</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Статус</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Последнее</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Дата</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {dialogs.map((dialog) => {
                    const key = `${dialog.studentId}__${dialog.lessonId}__${dialog.type}`;
                    const TypeIcon = typeConfig[dialog.type]?.icon || MessageCircle;
                    return (
                      <tr
                        key={key}
                        className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50 cursor-pointer"
                        onClick={() => openDialog(dialog)}
                      >
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${typeConfig[dialog.type]?.color || 'bg-gray-100'}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeConfig[dialog.type]?.label || dialog.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#3d3527]">{dialog.student.user.name}</p>
                              <p className="text-xs text-[#3d3527]/60">{dialog.student.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-[#3d3527] max-w-[180px] truncate">{dialog.lesson.title}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-[#3d3527]">{getRecordCountLabel(dialog.totalCount)}</span>
                            {dialog.hasAttachments && (
                              <Paperclip className="w-3.5 h-3.5 text-[#3d3527]/40" />
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {dialog.unansweredCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                              <Clock className="w-3 h-3" />
                              {dialog.unansweredCount} без ответа
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              Отвечено
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-[#3d3527] max-w-xs truncate">{dialog.latestContent || 'Без содержания'}</td>
                        <td className="p-4 text-sm text-[#3d3527]/60 whitespace-nowrap">
                          {format(new Date(dialog.latestDate), 'd MMM yyyy', { locale: ru })}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDialog(dialog);
                            }}
                            className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                            title="Открыть диалог"
                          >
                            <MessageCircle className="w-4 h-4 text-[#3d3527]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center py-4 border-t border-[#d4c9b0]/30">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 text-sm"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Загрузка...
                    </span>
                  ) : (
                    'Загрузить ещё'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedDialog && (
        <ChatDialog
          dialog={selectedDialog}
          items={dialogItems}
          dialogLoading={dialogLoading}
          replyText={replyText}
          setReplyText={setReplyText}
          submitting={submitting}
          hasUnanswered={dialogItems.some(i => !i.reply)}
          onClose={() => {
            setSelectedDialog(null);
            setDialogItems([]);
            setReplyText('');
          }}
          onSubmitReply={submitReply}
          onSubmitAudioReply={submitAudioReply}
          onMarkAsViewed={markAsViewed}
        />
      )}
    </div>
  );
}

function ChatDialog({
  dialog,
  items,
  dialogLoading,
  replyText,
  setReplyText,
  submitting,
  hasUnanswered,
  onClose,
  onSubmitReply,
  onSubmitAudioReply,
  onMarkAsViewed
}: {
  dialog: DialogSummary;
  items: ModerationItem[];
  dialogLoading: boolean;
  replyText: string;
  setReplyText: (text: string) => void;
  submitting: boolean;
  hasUnanswered: boolean;
  onClose: () => void;
  onSubmitReply: (files?: File[]) => void;
  onSubmitAudioReply: (audioData: string, duration: number, mimeType?: string) => void;
  onMarkAsViewed: () => void;
}) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const TypeIcon = typeConfig[dialog.type]?.icon || BookOpen;

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [viewerImages, setViewerImages] = useState<{ url: string; name?: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const openImageViewer = useCallback((clickedId: string) => {
    const allImages: { url: string; name?: string; id: string }[] = [];
    for (const item of items) {
      if (!item.attachments) continue;
      for (const att of item.attachments) {
        if (att.mimeType.startsWith('image/')) {
          allImages.push({
            url: getAttachmentUrl(att, item.type),
            name: att.originalName,
            id: att.id,
          });
        }
      }
    }
    const clickedIdx = allImages.findIndex(a => a.id === clickedId);
    setViewerImages(allImages.map(({ url, name }) => ({ url, name })));
    setViewerIndex(clickedIdx >= 0 ? clickedIdx : 0);
    setViewerOpen(true);
  }, [items]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [items]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const { createMediaRecorder } = await import('../../lib/audioRecorder');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { recorder, mimeType } = createMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setAudioMimeType(mimeType);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      toast.error('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (isRecording || isPaused)) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    }
  };

  const cancelRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPaused(false);
  };

  const sendAudioMessage = async () => {
    if (!audioBlob) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      onSubmitAudioReply(base64, recordingTime, audioMimeType);
      cancelRecording();
    };
    reader.readAsDataURL(audioBlob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isImageFile = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#d4c9b0]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
              <TypeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#3d3527]">
                {typeConfig[dialog.type]?.label || 'Запись'} к уроку
              </h2>
              <p className="text-sm text-[#3d3527]/60 truncate max-w-[200px] md:max-w-none">
                {dialog.lesson.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#3d3527]">{dialog.student.user.name}</p>
              <p className="text-xs text-[#3d3527]/60">{dialog.student.user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages Area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-[200px] max-h-[40vh] bg-gradient-to-b from-[#f9f8f5] to-white"
        >
          {dialogLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52]"></div>
            </div>
          ) : (
            items.map((item, itemIndex) => (
              <React.Fragment key={item.id}>
                {/* Student Message - left side */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] md:max-w-[75%]">
                    <div className={`bg-gradient-to-br from-[#8b9abc] to-[#a5b0cc] text-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm ${!item.reply ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}>
                      <p className="whitespace-pre-wrap text-sm md:text-base">{item.content}</p>

                      {item.attachments && item.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.attachments.map((att) => {
                            const attachmentUrl = getAttachmentUrl(att, item.type);
                            return (
                              <div key={att.id}>
                                {isImageFile(att.mimeType) ? (
                                  <img
                                    src={attachmentUrl}
                                    alt={att.originalName}
                                    className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => openImageViewer(att.id)}
                                  />
                                ) : (
                                  <a
                                    href={attachmentUrl}
                                    download={att.originalName}
                                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 transition-colors"
                                  >
                                    <File className="w-4 h-4" />
                                    <span className="text-sm truncate flex-1">{att.originalName}</span>
                                    <span className="text-xs opacity-70">{formatFileSize(att.size)}</span>
                                    <Download className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#3d3527]/50">{item.student.user.name}</span>
                      <span className="text-xs text-[#3d3527]/40">
                        {formatDistanceToNow(new Date(item.createdAt), { locale: ru, addSuffix: true })}
                      </span>
                      {!item.reply && (
                        <span className="text-xs text-orange-500 font-medium">● без ответа</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mentor Replies for this item - right side */}
                {parseReplyHistory(item.reply).map((msg, index) => (
                  <div key={`${item.id}-reply-${index}`} className="flex justify-end">
                    <div className="max-w-[85%] md:max-w-[75%]">
                      <div className="bg-gradient-to-br from-[#a67c52] to-[#c4a57b] text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                        {msg.audioAttachmentId ? (
                          <AudioPlayer
                            audioUrl={`/api/public/attachments/${dialog.type === 'diary' ? 'diary' : 'note'}/${msg.audioAttachmentId}`}
                            mimeType={msg.audioMimeType}
                            duration={msg.audioDuration}
                            variant="dark"
                          />
                        ) : msg.audioData ? (
                          <AudioPlayer
                            audioData={msg.audioData}
                            mimeType={msg.audioMimeType}
                            duration={msg.audioDuration}
                            variant="dark"
                          />
                        ) : null}
                        {!msg.audioAttachmentId && !msg.audioData && msg.text && (
                          <p className="whitespace-pre-wrap text-sm md:text-base">{msg.text}</p>
                        )}
                        {msg.audioAttachmentId && msg.text && msg.text !== '🎤 Голосовое сообщение' && (
                          <p className="whitespace-pre-wrap text-sm md:text-base mt-2">{msg.text}</p>
                        )}
                        {msg.fileAttachments && msg.fileAttachments.length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {msg.fileAttachments.map((att) => (
                              <a
                                key={att.id}
                                href={`/api/public/attachments/${dialog.type === 'diary' ? 'diary' : 'note'}/${att.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 transition-colors"
                              >
                                <Download className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm truncate">{att.originalName}</span>
                              </a>
                            ))}
                          </div>
                        ) : msg.fileAttachmentIds && msg.fileAttachmentIds.length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {msg.fileAttachmentIds.map((attId) => (
                              <a
                                key={attId}
                                href={`/api/public/attachments/${dialog.type === 'diary' ? 'diary' : 'note'}/${attId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 transition-colors"
                              >
                                <Download className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm truncate">Скачать вложение</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <span className="text-xs text-[#3d3527]/50">{msg.authorName}</span>
                        <span className="text-xs text-[#3d3527]/40">
                          {formatDistanceToNow(new Date(msg.createdAt), { locale: ru, addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Reply Input Area */}
        <div className="p-4 md:p-6 border-t border-[#d4c9b0]/30 bg-white rounded-b-2xl">
          {/* Recording UI */}
          {(isRecording || isPaused) && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className={`font-medium ${isPaused ? 'text-yellow-600' : 'text-red-600'}`}>
                {isPaused ? 'Пауза' : 'Запись'}: {formatTime(recordingTime)}
              </span>
              <div className="flex-1" />
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className={`p-2 rounded-lg transition-colors ${isPaused ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}
                title={isPaused ? 'Продолжить запись' : 'Пауза'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={stopRecording}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                title="Остановить запись"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Recorded Audio Preview */}
          {audioUrl && !isRecording && !isPaused && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-[#f5f3ed] rounded-xl border border-[#d4c9b0]">
              <audio src={audioUrl} controls className="flex-1 h-10" />
              <span className="text-sm text-[#3d3527]/60">{formatTime(recordingTime)}</span>
              <button
                onClick={cancelRecording}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Отменить"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={sendAudioMessage}
                disabled={submitting}
                className="p-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-lg disabled:opacity-50 hover:shadow-lg transition-all"
                title="Отправить голосовое сообщение"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Text Input */}
          {!audioUrl && !isRecording && !isPaused && (
            <div>
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#f5f3ed] px-3 py-1.5 rounded-lg border border-[#d4c9b0] text-sm">
                      {file.type.startsWith('image/') ? <Image className="w-4 h-4 text-[#a67c52]" /> : <File className="w-4 h-4 text-[#a67c52]" />}
                      <span className="max-w-[150px] truncate text-[#3d3527]">{file.name}</span>
                      <span className="text-[#3d3527]/40 text-xs">({(file.size / 1024).toFixed(0)} КБ)</span>
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] resize-none text-sm md:text-base"
                    placeholder="Напишите сообщение..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        setAttachedFiles(prev => [...prev, ...Array.from(files)]);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 bg-[#f5f3ed] text-[#a67c52] rounded-xl hover:bg-[#ebe7dd] transition-all border border-[#d4c9b0]"
                    title="Прикрепить файл"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={startRecording}
                    className="p-3 bg-[#f5f3ed] text-[#a67c52] rounded-xl hover:bg-[#ebe7dd] transition-all border border-[#d4c9b0]"
                    title="Записать голосовое сообщение"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      onSubmitReply(attachedFiles.length > 0 ? attachedFiles : undefined);
                      setAttachedFiles([]);
                    }}
                    disabled={(!replyText.trim() && attachedFiles.length === 0) || submitting}
                    className="p-3 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl disabled:opacity-50 hover:shadow-lg transition-all"
                    title="Отправить сообщение"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <button
              onClick={onClose}
              className="text-sm text-[#3d3527]/60 hover:text-[#3d3527] transition-colors"
            >
              Закрыть
            </button>
            <div className="flex gap-2">
              {hasUnanswered && (
                <button
                  onClick={onMarkAsViewed}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 border border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed] rounded-xl disabled:opacity-50 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {submitting ? 'Отметка...' : 'Отметить выполненным'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewerOpen && viewerImages.length > 0 && (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
