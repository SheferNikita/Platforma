import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Users2, Eye, EyeOff, Settings, MessageCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  telegram: string | null;
  photo: string | null;
}

interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
}

interface MiniGroup {
  id: string;
  title: string;
  description: string | null;
  chatLink: string | null;
  curatorId: string | null;
  curator: Contact | null;
  isPublished: boolean;
  events: ScheduleEvent[];
}

export function MiniGroupsAdmin() {
  const [groups, setGroups] = useState<MiniGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MiniGroup | null>(null);
  const [settingsGroup, setSettingsGroup] = useState<MiniGroup | null>(null);

  useEffect(() => { 
    loadGroups(); 
    loadContacts();
  }, []);

  async function loadGroups() {
    try {
      const data = await api.get<MiniGroup[]>('/content/mini-groups');
      setGroups(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function loadContacts() {
    try {
      const data = await api.get<Contact[]>('/content/contacts');
      setContacts(data);
    } catch (error) { }
  }

  async function saveGroup(data: Partial<MiniGroup>) {
    try {
      if (editingGroup) {
        await api.put(`/content/mini-groups/${editingGroup.id}`, data);
        toast.success('Группа обновлена');
        loadGroups();
      } else {
        const newGroup = await api.post<MiniGroup>('/content/mini-groups', data);
        toast.success('Группа создана. Настройте ссылку на чат в настройках.');
        await loadGroups();
        setSettingsGroup(newGroup);
        setShowSettingsModal(true);
      }
      setShowModal(false);
      setEditingGroup(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  async function deleteGroup(id: string) {
    if (!confirm('Удалить группу?')) return;
    try {
      await api.delete(`/content/mini-groups/${id}`);
      toast.success('Удалено');
      loadGroups();
    } catch (error) { toast.error('Ошибка удаления'); }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/mini-groups/${id}`, { isPublished: !isPublished });
      loadGroups();
    } catch (error) { toast.error('Ошибка'); }
  }

  function openSettings(group: MiniGroup) {
    setSettingsGroup(group);
    setShowSettingsModal(true);
  }

  async function saveSettings(data: { chatLink: string }) {
    if (!settingsGroup) return;
    try {
      await api.put(`/content/mini-groups/${settingsGroup.id}`, data);
      toast.success('Настройки сохранены');
      loadGroups();
      setShowSettingsModal(false);
      setSettingsGroup(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Мини-группы</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление мини-группами</p>
        </div>
        <button onClick={() => { setEditingGroup(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
          <Plus className="w-5 h-5" /> Добавить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : groups.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Нет групп</div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                  <Users2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePublish(group.id, group.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title={group.isPublished ? 'Скрыть' : 'Опубликовать'}>
                    {group.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button onClick={() => openSettings(group)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Настройки">
                    <Settings className="w-4 h-4 text-[#3d3527]" />
                  </button>
                  <button onClick={() => { setEditingGroup(group); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Редактировать">
                    <Edit className="w-4 h-4 text-[#3d3527]" />
                  </button>
                  <button onClick={() => deleteGroup(group.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Удалить">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-[#3d3527]">{group.title}</h3>
              <p className="text-sm text-[#3d3527]/60 mt-1 line-clamp-2">{group.description}</p>
              <div className="mt-3 space-y-1 text-sm text-[#3d3527]/80">
                {group.curator && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#3d3527]/60">Куратор:</span>
                    <span>{group.curator.name}</span>
                  </div>
                )}
                {group.chatLink && (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-[#a67c52]" />
                    <a href={group.chatLink} target="_blank" rel="noopener noreferrer" className="text-[#a67c52] hover:underline truncate">
                      Ссылка на чат
                    </a>
                  </div>
                )}
                {group.events && group.events.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#a67c52]" />
                    <span>{group.events.length} событий в расписании</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">{editingGroup ? 'Редактировать' : 'Новая группа'}</h2>
            <MiniGroupForm 
              group={editingGroup} 
              contacts={contacts}
              onSave={saveGroup} 
              onClose={() => { setShowModal(false); setEditingGroup(null); }} 
            />
          </div>
        </div>
      )}

      {showSettingsModal && settingsGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">Настройки: {settingsGroup.title}</h2>
            <MiniGroupSettings 
              group={settingsGroup} 
              onSave={saveSettings} 
              onClose={() => { setShowSettingsModal(false); setSettingsGroup(null); }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniGroupForm({ group, contacts, onSave, onClose }: { 
  group: MiniGroup | null; 
  contacts: Contact[];
  onSave: (data: any) => void; 
  onClose: () => void 
}) {
  const [title, setTitle] = useState(group?.title || '');
  const [description, setDescription] = useState(group?.description || '');
  const [curatorId, setCuratorId] = useState(group?.curatorId || '');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Куратор</label>
        <select 
          value={curatorId} 
          onChange={(e) => setCuratorId(e.target.value)} 
          className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl bg-white"
        >
          <option value="">Выберите куратора</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name} {contact.role ? `(${contact.role})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button 
          onClick={() => onSave({ 
            title, 
            description, 
            curatorId: curatorId || null
          })} 
          className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

function MiniGroupSettings({ group, onSave, onClose }: { 
  group: MiniGroup; 
  onSave: (data: { chatLink: string }) => void; 
  onClose: () => void 
}) {
  const [chatLink, setChatLink] = useState(group.chatLink || '');

  return (
    <div className="space-y-4">
      <div className="p-4 bg-[#f5f3ed] rounded-xl">
        <h3 className="font-medium text-[#3d3527] mb-2">Информация о группе</h3>
        <div className="space-y-2 text-sm text-[#3d3527]/80">
          <p><span className="font-medium">Название:</span> {group.title}</p>
          <p><span className="font-medium">Описание:</span> {group.description || 'Не указано'}</p>
          {group.curator && (
            <p><span className="font-medium">Наставник:</span> {group.curator.name} {group.curator.role ? `(${group.curator.role})` : ''}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка на чат</label>
        <input 
          value={chatLink} 
          onChange={(e) => setChatLink(e.target.value)} 
          className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" 
          placeholder="https://t.me/+..."
        />
        <p className="text-xs text-[#3d3527]/60 mt-1">Ссылка на Telegram-чат или другой мессенджер</p>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl">
        <h3 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Расписание мини-группы
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Расписание мини-группы управляется через раздел "Расписание". 
          События, привязанные к этой группе, автоматически отобразятся здесь.
        </p>
        {group.events && group.events.length > 0 ? (
          <div className="space-y-2">
            {group.events.slice(0, 3).map((event) => (
              <div key={event.id} className="text-sm bg-white p-2 rounded-lg">
                <span className="font-medium">{event.title}</span>
                <span className="text-blue-600 ml-2">
                  {new Date(event.date).toLocaleDateString('ru-RU')}
                  {event.time && ` в ${event.time}`}
                </span>
              </div>
            ))}
            {group.events.length > 3 && (
              <p className="text-sm text-blue-600">...и еще {group.events.length - 3} событий</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-blue-600">Нет привязанных событий</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button 
          onClick={() => onSave({ chatLink })} 
          className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
