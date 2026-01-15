import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { MessageCircle, BookOpen, FileText, CheckCircle, Clock, X, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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

  const stats = {
    total: items.length,
    pending: items.filter(i => !i.reply).length,
    answered: items.filter(i => i.reply).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Модерация</h1>
          <p className="text-[#3d3527]/60 mt-1">Ответы и вопросы учеников</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Всего записей</p>
          <p className="text-2xl font-bold text-[#3d3527]">{stats.total}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Ожидают ответа</p>
          <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">С ответом</p>
          <p className="text-2xl font-bold text-green-600">{stats.answered}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
        >
          <option value="all">Все статусы</option>
          <option value="pending">Ожидают ответа</option>
          <option value="answered">С ответом</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
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
          <div className="overflow-x-auto">
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
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#3d3527]">
                {typeConfig[selectedItem.type]?.label || 'Запись'} от ученика
              </h2>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#f5f3ed] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-[#3d3527]">{selectedItem.student.user.name}</p>
                    <p className="text-sm text-[#3d3527]/60">{selectedItem.student.user.email}</p>
                  </div>
                </div>
                <p className="text-sm text-[#3d3527]/60 mb-2">
                  Урок: <span className="font-medium">{selectedItem.lesson.title}</span>
                </p>
                <p className="text-sm text-[#3d3527]/60">
                  {format(new Date(selectedItem.createdAt), 'd MMMM yyyy в HH:mm', { locale: ru })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-2">Текст ученика:</label>
                <div className="bg-white border border-[#d4c9b0] rounded-xl p-4 whitespace-pre-wrap">
                  {selectedItem.content}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-2">
                  {selectedItem.reply ? 'Ваш ответ:' : 'Напишите ответ:'}
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] resize-none"
                  placeholder="Введите ваш ответ..."
                />
              </div>

              {selectedItem.repliedAt && selectedItem.repliedBy && (
                <p className="text-sm text-[#3d3527]/60">
                  Ответил: {selectedItem.repliedBy.name} • {format(new Date(selectedItem.repliedAt), 'd MMM yyyy в HH:mm', { locale: ru })}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setSelectedItem(null)} 
                className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl"
              >
                Закрыть
              </button>
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || submitting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Отправка...' : selectedItem.reply ? 'Обновить ответ' : 'Отправить ответ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
