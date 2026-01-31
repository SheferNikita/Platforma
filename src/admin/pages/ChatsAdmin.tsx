import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, MessageCircle, Eye, EyeOff, Users, Phone, Video, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ChatLink {
  id: string;
  name: string;
  description: string;
  platform: string;
  icon: string;
  link: string;
  members: number | null;
  isSchedule: boolean;
  tariffs: string[];
  isPublished: boolean;
  order: number;
}

const TARIFF_OPTIONS = [
  { value: 'BASIC', label: 'Базовый' },
  { value: 'FAMILY', label: 'Для родственников' },
  { value: 'WITH_MENTOR', label: 'С наставником' },
  { value: 'WITH_PSYCHOLOGIST', label: 'С психологом' },
  { value: 'INDIVIDUAL_PSYCHOLOGIST', label: 'Индивидуальный с психологом' },
];

const ICON_OPTIONS = [
  { value: 'message', label: 'Сообщение', icon: MessageCircle },
  { value: 'group', label: 'Группа', icon: Users },
  { value: 'phone', label: 'Телефон', icon: Phone },
  { value: 'video', label: 'Видео', icon: Video },
];

const PLATFORM_OPTIONS = ['Telegram', 'WhatsApp', 'Zoom', 'Discord', 'Skype', 'Другое'];

export function ChatsAdmin() {
  const [chats, setChats] = useState<ChatLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatLink | null>(null);

  useEffect(() => { loadChats(); }, []);

  async function loadChats() {
    try {
      const data = await api.get<ChatLink[]>('/content/chats');
      setChats(data);
    } catch (error) { 
      toast.error('Ошибка загрузки'); 
    } finally { 
      setLoading(false); 
    }
  }

  async function saveChat(data: Partial<ChatLink>) {
    try {
      if (editingChat) {
        await api.put(`/content/chats/${editingChat.id}`, data);
        toast.success('Чат обновлен');
      } else {
        const { nextOrder } = await api.get<{ nextOrder: number }>('/content/chats/next-order');
        await api.post('/content/chats', { ...data, order: nextOrder });
        toast.success('Чат создан');
      }
      loadChats();
      setShowModal(false);
      setEditingChat(null);
    } catch (error) { 
      toast.error('Ошибка сохранения'); 
    }
  }

  async function deleteChat(id: string) {
    if (!confirm('Удалить чат?')) return;
    try {
      await api.delete(`/content/chats/${id}`);
      toast.success('Удалено');
      loadChats();
    } catch (error) { 
      toast.error('Ошибка удаления'); 
    }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/chats/${id}`, { isPublished: !isPublished });
      loadChats();
    } catch (error) { 
      toast.error('Ошибка'); 
    }
  }

  const getIcon = (iconType: string) => {
    const IconComponent = ICON_OPTIONS.find(o => o.value === iconType)?.icon || MessageCircle;
    return <IconComponent className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--button-lavender-dark)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#3d3527]">Чаты</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление карточками чатов и групп поддержки</p>
        </div>
        <button
          onClick={() => { setEditingChat(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--button-lavender-dark)] text-white rounded-lg hover:bg-[var(--button-lavender-light)] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Добавить чат
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="text-center py-12 text-[#3d3527]/60">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>Чаты не добавлены</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`bg-white/80 backdrop-blur-sm rounded-xl p-5 border-2 ${
                chat.isPublished ? 'border-[#e8e4da]' : 'border-red-200 bg-red-50/30'
              } shadow-sm`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 bg-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center text-[var(--button-lavender-dark)]">
                    {getIcon(chat.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#3d3527] truncate">{chat.name}</h3>
                    <p className="text-sm text-[#3d3527]/60 truncate">{chat.platform}</p>
                    {chat.members && (
                      <p className="text-xs text-[#3d3527]/50 mt-1">{chat.members} участников</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePublish(chat.id, chat.isPublished)}
                    className={`p-2 rounded-lg transition-colors ${
                      chat.isPublished ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'
                    }`}
                    title={chat.isPublished ? 'Скрыть' : 'Опубликовать'}
                  >
                    {chat.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditingChat(chat); setShowModal(true); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {chat.description && (
                <p className="text-sm text-[#3d3527]/70 mt-3 line-clamp-2">{chat.description}</p>
              )}
              
              <div className="mt-3 flex flex-wrap gap-1">
                {chat.tariffs?.map(tariff => {
                  const label = TARIFF_OPTIONS.find(t => t.value === tariff)?.label || tariff;
                  return (
                    <span key={tariff} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {label}
                    </span>
                  );
                })}
              </div>
              
              {chat.isSchedule && (
                <span className="mt-2 inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Ведёт на расписание
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ChatModal
          chat={editingChat}
          onSave={saveChat}
          onClose={() => { setShowModal(false); setEditingChat(null); }}
        />
      )}
    </div>
  );
}

interface ChatModalProps {
  chat: ChatLink | null;
  onSave: (data: Partial<ChatLink>) => void;
  onClose: () => void;
}

function ChatModal({ chat, onSave, onClose }: ChatModalProps) {
  const [form, setForm] = useState({
    name: chat?.name || '',
    description: chat?.description || '',
    platform: chat?.platform || 'Telegram',
    icon: chat?.icon || 'message',
    link: chat?.link || '',
    members: chat?.members || '',
    isSchedule: chat?.isSchedule || false,
    tariffs: chat?.tariffs || ['BASIC', 'FAMILY', 'WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'],
    isPublished: chat?.isPublished !== false,
  });

  function handleTariffToggle(value: string) {
    setForm(prev => ({
      ...prev,
      tariffs: prev.tariffs.includes(value)
        ? prev.tariffs.filter(t => t !== value)
        : [...prev.tariffs, value]
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.link.trim()) {
      toast.error('Заполните название и ссылку');
      return;
    }
    onSave({
      ...form,
      members: form.members ? Number(form.members) : null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#e8e4da]">
          <h2 className="text-xl font-semibold text-[#3d3527]">
            {chat ? 'Редактировать чат' : 'Новый чат'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#e8e4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender-dark)]/20"
              placeholder="Чат поддержки"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-[#e8e4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender-dark)]/20"
              placeholder="Краткое описание чата"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Платформа</label>
              <select
                value={form.platform}
                onChange={e => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 border border-[#e8e4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender-dark)]/20"
              >
                {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Иконка</label>
              <select
                value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 border border-[#e8e4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender-dark)]/20"
              >
                {ICON_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка *</label>
            <input
              type="text"
              value={form.link}
              onChange={e => setForm({ ...form, link: e.target.value })}
              className="w-full px-3 py-2 border border-[#e8e4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender-dark)]/20"
              placeholder="https://t.me/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-2">Видимость по тарифам</label>
            <div className="space-y-2">
              {TARIFF_OPTIONS.map(tariff => (
                <label key={tariff.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.tariffs.includes(tariff.value)}
                    onChange={() => handleTariffToggle(tariff.value)}
                    className="rounded border-[#e8e4da]"
                  />
                  <span className="text-sm text-[#3d3527]">{tariff.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublished"
              checked={form.isPublished}
              onChange={e => setForm({ ...form, isPublished: e.target.checked })}
              className="rounded border-[#e8e4da]"
            />
            <label htmlFor="isPublished" className="text-sm text-[#3d3527]">
              Опубликовано
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e8e4da]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#e8e4da] rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--button-lavender-dark)] text-white rounded-lg hover:bg-[var(--button-lavender-light)] transition-colors"
            >
              {chat ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
