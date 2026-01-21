import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { MessageCircle, BookOpen, FileText, CheckCircle, Clock, X, Send, User, Eye, Paperclip, Image, File, Download } from 'lucide-react';
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

const getAttachmentUrl = (attachment: Attachment, itemType: 'diary' | 'question' | 'report'): string => {
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

interface ModerationItem {
  id: string;
  type: 'diary' | 'question' | 'report';
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

const typeConfig = {
  diary: { label: 'Дневник', icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
  question: { label: 'Вопрос', icon: MessageCircle, color: 'bg-purple-100 text-purple-700' },
  report: { label: 'Отчет', icon: FileText, color: 'bg-green-100 text-green-700' }
};

export function ModerationAdmin() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadItems();
  }, [statusFilter, typeFilter]);

  async function loadItems() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const data = await api.get<ModerationItem[]>(`/public/moderation?${params.toString()}`);
      setItems(data);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function submitReply() {
    if (!selectedItem || !replyText.trim()) return;
    
    setSubmitting(true);
    try {
      const endpoint = selectedItem.type === 'diary' 
        ? `/public/moderation/diary/${selectedItem.id}/reply`
        : `/public/moderation/note/${selectedItem.id}/reply`;
      
      await api.post(endpoint, { reply: replyText });
      toast.success('Ответ отправлен');
      setSelectedItem(null);
      setReplyText('');
      loadItems();
    } catch (error) {
      toast.error('Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

  async function markAsViewed() {
    if (!selectedItem) return;
    
    setSubmitting(true);
    try {
      const endpoint = selectedItem.type === 'diary' 
        ? `/public/moderation/diary/${selectedItem.id}/view`
        : `/public/moderation/note/${selectedItem.id}/view`;
      
      await api.post(endpoint, {});
      toast.success('Отмечено как просмотренное');
      setSelectedItem(null);
      setReplyText('');
      loadItems();
    } catch (error) {
      toast.error('Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  const stats = {
    total: items.length,
    pending: items.filter(i => !i.reply).length,
    answered: items.filter(i => i.reply).length
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Модерация</h1>
          <p className="text-[#3d3527]/60 mt-1 text-sm md:text-base">Ответы и вопросы учеников</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-2 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Всего записей</p>
          <p className="text-lg md:text-2xl font-bold text-[#3d3527]">{stats.total}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-2 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Ожидают ответа</p>
          <p className="text-lg md:text-2xl font-bold text-orange-600">{stats.pending}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-2 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">С ответом</p>
          <p className="text-lg md:text-2xl font-bold text-green-600">{stats.answered}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
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
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Записей не найдено</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {items.map((item) => {
                const TypeIcon = typeConfig[item.type]?.icon || MessageCircle;
                return (
                  <div key={`${item.type}-${item.id}`} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${typeConfig[item.type]?.color || 'bg-gray-100'}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig[item.type]?.label || item.type}
                        </span>
                        {item.reply ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setReplyText(item.reply || '');
                        }}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                      >
                        <MessageCircle className="w-4 h-4 text-[#3d3527]" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#3d3527] truncate">{item.student.user.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#3d3527]/60 truncate">{item.lesson.title}</p>
                    <p className="text-sm text-[#3d3527] line-clamp-2">{item.content}</p>
                    <p className="text-xs text-[#3d3527]/50">{format(new Date(item.createdAt), 'd MMM yyyy', { locale: ru })}</p>
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
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Статус</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Ученик</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Урок</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Текст</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Дата</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const TypeIcon = typeConfig[item.type]?.icon || MessageCircle;
                    return (
                      <tr key={`${item.type}-${item.id}`} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${typeConfig[item.type]?.color || 'bg-gray-100'}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeConfig[item.type]?.label || item.type}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.reply ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              Отвечено
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                              <Clock className="w-3 h-3" />
                              Ожидает
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#3d3527]">{item.student.user.name}</p>
                              <p className="text-xs text-[#3d3527]/60">{item.student.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-[#3d3527]">{item.lesson.title}</td>
                        <td className="p-4 text-sm text-[#3d3527] max-w-xs truncate">{item.content}</td>
                        <td className="p-4 text-sm text-[#3d3527]/60">
                          {format(new Date(item.createdAt), 'd MMM yyyy', { locale: ru })}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setReplyText(item.reply || '');
                            }}
                            className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                            title={item.reply ? 'Просмотреть' : 'Ответить'}
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
          </>
        )}
      </div>

      {selectedItem && (
        <ChatDialog
          item={selectedItem}
          replyText={replyText}
          setReplyText={setReplyText}
          submitting={submitting}
          onClose={() => {
            setSelectedItem(null);
            setReplyText('');
          }}
          onSubmitReply={submitReply}
          onMarkAsViewed={markAsViewed}
        />
      )}
    </div>
  );
}

function ChatDialog({
  item,
  replyText,
  setReplyText,
  submitting,
  onClose,
  onSubmitReply,
  onMarkAsViewed
}: {
  item: ModerationItem;
  replyText: string;
  setReplyText: (text: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmitReply: () => void;
  onMarkAsViewed: () => void;
}) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const TypeIcon = typeConfig[item.type]?.icon || BookOpen;

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [item]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
                {typeConfig[item.type]?.label || 'Запись'} к уроку
              </h2>
              <p className="text-sm text-[#3d3527]/60 truncate max-w-[200px] md:max-w-none">
                {item.lesson.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <div className="px-4 md:px-6 py-3 bg-[#f5f3ed]/50 border-b border-[#d4c9b0]/20">
          <p className="text-sm text-[#3d3527]/70">
            {item.type === 'diary' && 'Запишите свои мысли, эмоции и впечатления от пройденного урока'}
            {item.type === 'question' && 'Вопрос от ученика по содержанию урока'}
            {item.type === 'report' && 'Отчет ученика о выполнении задания'}
          </p>
        </div>

        {/* Chat Messages Area */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-[200px] max-h-[40vh] bg-gradient-to-b from-[#f9f8f5] to-white"
        >
          {/* Student Message - left side (incoming) */}
          <div className="flex justify-start">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="bg-gradient-to-br from-[#8b9abc] to-[#a5b0cc] text-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <p className="whitespace-pre-wrap text-sm md:text-base">{item.content}</p>
                
                {/* Attachments */}
                {item.attachments && item.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {item.attachments.map((att) => {
                      const attachmentUrl = getAttachmentUrl(att, item.type);
                      return (
                        <div key={att.id}>
                          {isImageFile(att.mimeType) ? (
                            <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
                              <img 
                                src={attachmentUrl} 
                                alt={att.originalName}
                                className="max-w-full rounded-lg max-h-48 object-cover"
                              />
                            </a>
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
              </div>
            </div>
          </div>

          {/* Mentor Reply (if exists) - right side (outgoing) */}
          {item.reply && (
            <div className="flex justify-end">
              <div className="max-w-[85%] md:max-w-[75%]">
                <div className="bg-gradient-to-br from-[#a67c52] to-[#c4a57b] text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
                  <p className="whitespace-pre-wrap text-sm md:text-base">{item.reply}</p>
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-xs text-[#3d3527]/50">{item.repliedBy?.name || 'Наставник'}</span>
                  {item.repliedAt && (
                    <span className="text-xs text-[#3d3527]/40">
                      {formatDistanceToNow(new Date(item.repliedAt), { locale: ru, addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reply Input Area */}
        <div className="p-4 md:p-6 border-t border-[#d4c9b0]/30 bg-white rounded-b-2xl">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] resize-none text-sm md:text-base"
                placeholder={item.reply ? 'Обновить ваш ответ...' : 'Напишите ответ студенту...'}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={onSubmitReply}
                disabled={!replyText.trim() || submitting}
                className="p-3 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl disabled:opacity-50 hover:shadow-lg transition-all"
                title={item.reply ? 'Обновить ответ' : 'Отправить ответ'}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <button 
              onClick={onClose} 
              className="text-sm text-[#3d3527]/60 hover:text-[#3d3527] transition-colors"
            >
              Закрыть
            </button>
            <div className="flex gap-2">
              {!item.reply && (
                <button
                  onClick={onMarkAsViewed}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 border border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed] rounded-xl disabled:opacity-50 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {submitting ? 'Отметка...' : 'Отметить просмотренным'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
