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

interface Mentor {
  id: string;
  name: string;
  email: string;
  role: 'MENTOR' | 'PSYCHOLOGIST' | 'INTERN';
}

interface ScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  location: string | null;
  link: string | null;
  isOnline: boolean;
}

interface Student {
  id: string;
  user: { id: string; name: string; email: string };
}

interface MiniGroupMember {
  id: string;
  studentId: string;
  student: Student;
  joinedAt: string;
}

interface MiniGroup {
  id: string;
  title: string;
  description: string | null;
  chatLink: string | null;
  curatorId: string | null;
  curator: Contact | null;
  mentorIds: string[];
  isPublished: boolean;
  events: ScheduleEvent[];
  _count?: { members: number };
}

export function MiniGroupsAdmin() {
  const [groups, setGroups] = useState<MiniGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MiniGroup | null>(null);
  const [settingsGroup, setSettingsGroup] = useState<MiniGroup | null>(null);

  useEffect(() => { 
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [groupsData, contactsData, mentorsData] = await Promise.all([
        api.get<MiniGroup[]>('/content/mini-groups'),
        api.get<Contact[]>('/content/contacts').catch(() => [] as Contact[]),
        api.get<Mentor[]>('/admin/mentors').catch(() => [] as Mentor[])
      ]);
      setGroups(groupsData);
      setContacts(contactsData);
      setMentors(mentorsData);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function loadGroups() {
    try {
      const data = await api.get<MiniGroup[]>('/content/mini-groups');
      setGroups(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
  }

  function getMentorNames(curatorId: string, mentorsList: Mentor[]): string {
    const ids = curatorId.split(',').filter(Boolean);
    const names = ids.map(id => {
      const mentor = mentorsList.find(m => m.id === id);
      return mentor ? mentor.name : '';
    }).filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Не назначены';
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

  async function saveSettings(data: Partial<MiniGroup>) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Мини-группы</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление мини-группами</p>
        </div>
        <button onClick={() => { setEditingGroup(null); setShowModal(true); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg w-full sm:w-auto">
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
            <div key={group.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                    <Users2 className="w-6 h-6 text-white" />
                  </div>
                  {group.isPublished ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Активна</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Скрыта</span>
                  )}
                </div>
                <button onClick={() => openSettings(group)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Настройки">
                  <Settings className="w-5 h-5 text-[#3d3527]" />
                </button>
              </div>
              <h3 className="font-bold text-[#3d3527]">{group.title}</h3>
              <p className="text-sm text-[#3d3527]/60 mt-1 line-clamp-2">{group.description}</p>
              <div className="mt-3 space-y-1 text-sm text-[#3d3527]/80">
                {group.curatorId && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#3d3527]/60">Наставники:</span>
                    <span>{getMentorNames(group.curatorId, mentors)}</span>
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
                <div className="flex items-center gap-2">
                  <Users2 className="w-3.5 h-3.5 text-[#a67c52]" />
                  <span>{group._count?.members || 0} участников</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">{editingGroup ? 'Редактировать' : 'Новая группа'}</h2>
            <MiniGroupForm 
              group={editingGroup} 
              mentors={mentors}
              onSave={saveGroup} 
              onClose={() => { setShowModal(false); setEditingGroup(null); }} 
            />
          </div>
        </div>
      )}

      {showSettingsModal && settingsGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">Настройки группы</h2>
            <MiniGroupSettings 
              group={settingsGroup}
              mentors={mentors}
              onSave={saveSettings} 
              onClose={() => { setShowSettingsModal(false); setSettingsGroup(null); }}
              onRefresh={loadGroups}
              onDelete={deleteGroup}
              onTogglePublish={togglePublish}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniGroupForm({ group, mentors, onSave, onClose }: { 
  group: MiniGroup | null; 
  mentors: Mentor[];
  onSave: (data: any) => void; 
  onClose: () => void 
}) {
  const [title, setTitle] = useState(group?.title || '');
  const [description, setDescription] = useState(group?.description || '');
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>(() => {
    // mentorIds comes from backend transformation
    if (group?.mentorIds && Array.isArray(group.mentorIds)) {
      return group.mentorIds;
    }
    return [];
  });

  const addMentor = () => {
    setSelectedMentorIds([...selectedMentorIds, '']);
  };

  const updateMentor = (index: number, value: string) => {
    const newIds = [...selectedMentorIds];
    newIds[index] = value;
    setSelectedMentorIds(newIds);
  };

  const removeMentor = (index: number) => {
    setSelectedMentorIds(selectedMentorIds.filter((_, i) => i !== index));
  };

  const getAvailableMentors = (currentIndex: number) => {
    const selectedOthers = selectedMentorIds.filter((_, i) => i !== currentIndex);
    return mentors.filter(m => !selectedOthers.includes(m.id));
  };

  const getRoleLabel = (role: string) => {
    return role === 'INTERN' ? '(Помощник)' : '';
  };

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
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Наставники</label>
        <div className="space-y-2">
          {selectedMentorIds.length === 0 ? (
            <div className="text-sm text-[#3d3527]/60 py-2">Наставники не назначены</div>
          ) : (
            selectedMentorIds.map((mentorId, index) => (
              <div key={index} className="flex gap-2">
                <select 
                  value={mentorId} 
                  onChange={(e) => updateMentor(index, e.target.value)} 
                  className="flex-1 px-4 py-2 border border-[#d4c9b0] rounded-xl bg-white"
                >
                  <option value="">Выберите наставника</option>
                  {getAvailableMentors(index).map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.name} {getRoleLabel(mentor.role)}
                    </option>
                  ))}
                </select>
                <button 
                  type="button"
                  onClick={() => removeMentor(index)}
                  className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
          {selectedMentorIds.length < mentors.length && (
            <button 
              type="button"
              onClick={addMentor}
              className="flex items-center gap-2 text-sm text-[#a67c52] hover:text-[#8b6a47] py-2"
            >
              <Plus className="w-4 h-4" />
              Добавить наставника
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl w-full sm:w-auto">Отмена</button>
        <button 
          onClick={() => onSave({ 
            title, 
            description, 
            curatorId: selectedMentorIds.filter(Boolean).join(',') || null
          })} 
          className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl w-full sm:w-auto"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  link: string;
  isOnline: boolean;
}

function MiniGroupSettings({ group, mentors, onSave, onClose, onRefresh, onDelete, onTogglePublish }: { 
  group: MiniGroup; 
  mentors: Mentor[];
  onSave: (data: Partial<MiniGroup>) => void; 
  onClose: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string, isPublished: boolean) => void;
}) {
  const [title, setTitle] = useState(group.title);
  const [description, setDescription] = useState(group.description || '');
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>(() => {
    // mentorIds comes from backend transformation
    if (group.mentorIds && Array.isArray(group.mentorIds)) {
      return group.mentorIds;
    }
    return [];
  });
  const [chatLink, setChatLink] = useState(group.chatLink || '');

  const addMentor = () => {
    setSelectedMentorIds([...selectedMentorIds, '']);
  };

  const updateMentor = (index: number, value: string) => {
    const newIds = [...selectedMentorIds];
    newIds[index] = value;
    setSelectedMentorIds(newIds);
  };

  const removeMentor = (index: number) => {
    setSelectedMentorIds(selectedMentorIds.filter((_, i) => i !== index));
  };

  const getAvailableMentors = (currentIndex: number) => {
    const selectedOthers = selectedMentorIds.filter((_, i) => i !== currentIndex);
    return mentors.filter(m => !selectedOthers.includes(m.id));
  };

  const getRoleLabel = (role: string) => {
    return role === 'INTERN' ? '(Помощник)' : '';
  };
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventFormData>({
    title: '', description: '', date: '', time: '', location: '', link: '', isOnline: true
  });
  const [members, setMembers] = useState<MiniGroupMember[]>([]);
  const [searchStudents, setSearchStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    loadEvents();
    loadMembers();
  }, [group.id]);

  async function loadEvents() {
    try {
      const data = await api.get<ScheduleEvent[]>(`/content/mini-groups/${group.id}/events`);
      setEvents(data);
    } catch (error) {}
  }

  async function loadMembers() {
    try {
      const data = await api.get<MiniGroupMember[]>(`/content/mini-groups/${group.id}/members`);
      setMembers(data);
    } catch (error) {}
  }

  async function searchForStudents(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchStudents([]);
      return;
    }
    try {
      const data = await api.get<Student[]>(`/content/students/search?q=${encodeURIComponent(query)}&excludeGroupId=${group.id}`);
      setSearchStudents(data);
    } catch (error) {}
  }

  async function addMember(studentId: string) {
    try {
      await api.post(`/content/mini-groups/${group.id}/members`, { studentId });
      toast.success('Участник добавлен');
      await loadMembers();
      setSearchQuery('');
      setSearchStudents([]);
      setShowAddMember(false);
      onRefresh();
    } catch (error) {
      toast.error('Ошибка добавления');
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Удалить участника из группы?')) return;
    try {
      await api.delete(`/content/mini-groups/${group.id}/members/${memberId}`);
      toast.success('Участник удален');
      await loadMembers();
      onRefresh();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  function openAddEvent() {
    setEditingEvent(null);
    setEventForm({ title: '', description: '', date: '', time: '', location: '', link: '', isOnline: true });
    setShowEventForm(true);
  }

  function openEditEvent(event: ScheduleEvent) {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      date: event.date.split('T')[0],
      time: event.time || '',
      location: event.location || '',
      link: event.link || '',
      isOnline: event.isOnline
    });
    setShowEventForm(true);
  }

  async function saveEvent() {
    try {
      if (editingEvent) {
        await api.put(`/content/mini-groups/${group.id}/events/${editingEvent.id}`, eventForm);
        toast.success('Событие обновлено');
      } else {
        await api.post(`/content/mini-groups/${group.id}/events`, eventForm);
        toast.success('Событие добавлено');
      }
      setShowEventForm(false);
      await loadEvents();
      onRefresh();
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Удалить событие?')) return;
    try {
      await api.delete(`/content/mini-groups/${group.id}/events/${eventId}`);
      toast.success('Событие удалено');
      await loadEvents();
      onRefresh();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Основные настройки группы */}
      <div className="p-4 bg-[#f5f3ed] rounded-xl space-y-3">
        <h3 className="font-medium text-[#3d3527] mb-2">Основные настройки</h3>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
          <input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl bg-white" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl bg-white resize-none" 
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Наставники</label>
          <div className="space-y-2">
            {selectedMentorIds.length === 0 ? (
              <div className="text-sm text-[#3d3527]/60 py-2">Наставники не назначены</div>
            ) : (
              selectedMentorIds.map((mentorId, index) => (
                <div key={index} className="flex gap-2">
                  <select 
                    value={mentorId} 
                    onChange={(e) => updateMentor(index, e.target.value)} 
                    className="flex-1 px-4 py-2 border border-[#d4c9b0] rounded-xl bg-white"
                  >
                    <option value="">Выберите наставника</option>
                    {getAvailableMentors(index).map((mentor) => (
                      <option key={mentor.id} value={mentor.id}>
                        {mentor.name} {getRoleLabel(mentor.role)}
                      </option>
                    ))}
                  </select>
                  <button 
                    type="button"
                    onClick={() => removeMentor(index)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
            {selectedMentorIds.length < mentors.length && (
              <button 
                type="button"
                onClick={addMentor}
                className="flex items-center gap-2 text-sm text-[#a67c52] hover:text-[#8b6a47] py-2"
              >
                <Plus className="w-4 h-4" />
                Добавить наставника
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка на чат</label>
          <input 
            value={chatLink} 
            onChange={(e) => setChatLink(e.target.value)} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl bg-white" 
            placeholder="@username, username или https://t.me/..."
          />
          <p className="text-xs text-[#3d3527]/60 mt-1">Можно указать @username, username без @ или полную ссылку</p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-blue-800 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Расписание мини-группы
          </h3>
          <button 
            onClick={openAddEvent}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
        
        {showEventForm && (
          <div className="bg-white p-4 rounded-lg mb-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input 
                value={eventForm.title}
                onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                <input 
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Время</label>
                <input 
                  type="time"
                  value={eventForm.time}
                  onChange={(e) => setEventForm({...eventForm, time: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea 
                value={eventForm.description}
                onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  checked={eventForm.isOnline}
                  onChange={(e) => setEventForm({...eventForm, isOnline: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Онлайн</span>
              </label>
              {eventForm.isOnline ? (
                <input 
                  value={eventForm.link}
                  onChange={(e) => setEventForm({...eventForm, link: e.target.value})}
                  placeholder="Ссылка на онлайн-встречу"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                <input 
                  value={eventForm.location}
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  placeholder="Адрес"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowEventForm(false)}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                Отмена
              </button>
              <button 
                onClick={saveEvent}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                {editingEvent ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        )}
        
        {events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div>
                  <span className="font-medium text-gray-800">{event.title}</span>
                  <span className="text-blue-600 ml-2 text-sm">
                    {new Date(event.date).toLocaleDateString('ru-RU')}
                    {event.time && ` в ${event.time}`}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => openEditEvent(event)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteEvent(event.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-blue-600">Нет событий. Нажмите "Добавить" чтобы создать.</p>
        )}
      </div>

      <div className="p-4 bg-green-50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-green-800 flex items-center gap-2">
            <Users2 className="w-4 h-4" />
            Участники группы ({members.length})
          </h3>
          <button 
            onClick={() => setShowAddMember(!showAddMember)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>

        {showAddMember && (
          <div className="bg-white p-4 rounded-lg mb-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Поиск ученика</label>
              <input 
                value={searchQuery}
                onChange={(e) => searchForStudents(e.target.value)}
                placeholder="Введите имя или email (минимум 2 символа)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            {searchStudents.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {searchStudents.map((student) => (
                  <div 
                    key={student.id} 
                    className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                    onClick={() => addMember(student.id)}
                  >
                    <div>
                      <span className="font-medium text-gray-800">{student.user.name}</span>
                      <span className="text-gray-500 text-sm ml-2">{student.user.email}</span>
                    </div>
                    <Plus className="w-4 h-4 text-green-600" />
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && searchStudents.length === 0 && (
              <p className="text-sm text-gray-500">Ученики не найдены</p>
            )}
          </div>
        )}

        {members.length > 0 ? (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div>
                  <span className="font-medium text-gray-800">{member.student.user.name}</span>
                  <span className="text-gray-500 text-sm ml-2">{member.student.user.email}</span>
                </div>
                <button 
                  onClick={() => removeMember(member.id)}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Удалить из группы"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-600">Нет участников. Нажмите "Добавить" чтобы добавить ученика.</p>
        )}
      </div>

      <div className="flex justify-between sticky bottom-0 bg-white pt-3 border-t border-[#d4c9b0]/30 mt-4">
        <div className="flex gap-2">
          <button 
            onClick={() => onTogglePublish(group.id, group.isPublished)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
              group.isPublished 
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {group.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {group.isPublished ? 'Скрыть' : 'Опубликовать'}
          </button>
          <button 
            onClick={() => {
              if (confirm('Удалить группу?')) {
                onDelete(group.id);
                onClose();
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-sm hover:bg-red-200"
          >
            <Trash2 className="w-4 h-4" />
            Удалить
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Закрыть</button>
          <button 
            onClick={() => onSave({ title, description, curatorId: selectedMentorIds.filter(Boolean).join(',') || null, chatLink })} 
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
