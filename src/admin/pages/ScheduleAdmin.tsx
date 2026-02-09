import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Calendar, Eye, EyeOff, Video, MapPin, Users2 } from 'lucide-react';
import { toast } from 'sonner';

interface MiniGroup {
  id: string;
  title: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  isOnline: boolean;
  link: string;
  miniGroupId: string | null;
  miniGroup?: MiniGroup | null;
  isPublished: boolean;
}

export function ScheduleAdmin() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [miniGroups, setMiniGroups] = useState<MiniGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  useEffect(() => { 
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [eventsData, groupsData] = await Promise.all([
        api.get<ScheduleEvent[]>('/content/schedule'),
        api.get<MiniGroup[]>('/content/mini-groups').catch(() => [] as MiniGroup[])
      ]);
      setEvents(eventsData);
      setMiniGroups(groupsData);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function loadEvents() {
    try {
      const data = await api.get<ScheduleEvent[]>('/content/schedule');
      setEvents(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
  }

  async function saveEvent(data: Partial<ScheduleEvent>) {
    try {
      if (editingEvent) {
        await api.put(`/content/schedule/${editingEvent.id}`, data);
        toast.success('Событие обновлено');
      } else {
        await api.post('/content/schedule', data);
        toast.success('Событие создано');
      }
      loadEvents();
      setShowModal(false);
      setEditingEvent(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Удалить событие?')) return;
    try {
      await api.delete(`/content/schedule/${id}`);
      toast.success('Удалено');
      loadEvents();
    } catch (error) { toast.error('Ошибка удаления'); }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/schedule/${id}`, { isPublished: !isPublished });
      loadEvents();
    } catch (error) { toast.error('Ошибка'); }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Расписание</h1>
          <p className="text-sm md:text-base text-[#3d3527]/60 mt-1">Управление расписанием событий</p>
        </div>
        <button onClick={() => { setEditingEvent(null); setShowModal(true); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg w-full sm:w-auto">
          <Plus className="w-5 h-5" /> Добавить
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">Нет событий</div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {events.map((event) => (
                <div key={event.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#3d3527] text-sm">{event.title}</p>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-[#3d3527]/60 mt-1">
                        <span>{new Date(event.date).toLocaleDateString('ru')}</span>
                        {event.time && <span>• {event.time}</span>}
                        {event.isOnline ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                      </div>
                      {event.miniGroup && (
                        <span className="flex items-center gap-1 text-xs text-[#a67c52] mt-1">
                          <Users2 className="w-3 h-3" />
                          {event.miniGroup.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button onClick={() => togglePublish(event.id, event.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                      {event.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => { setEditingEvent(event); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                      <Edit className="w-4 h-4 text-[#3d3527]" />
                    </button>
                    <button onClick={() => deleteEvent(event.id)} className="p-2 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block divide-y divide-[#d4c9b0]/30">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 hover:bg-[#f5f3ed]/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#3d3527]">{event.title}</p>
                      <div className="flex items-center gap-2 text-sm text-[#3d3527]/60">
                        <span>{new Date(event.date).toLocaleDateString('ru')}</span>
                        {event.time && <span>• {event.time}</span>}
                        {event.isOnline ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                        {event.miniGroup && (
                          <span className="flex items-center gap-1 text-[#a67c52]">
                            <Users2 className="w-3.5 h-3.5" />
                            {event.miniGroup.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePublish(event.id, event.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                      {event.isPublished ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button onClick={() => { setEditingEvent(event); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                      <Edit className="w-5 h-5 text-[#3d3527]" />
                    </button>
                    <button onClick={() => deleteEvent(event.id)} className="p-2 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg md:text-xl font-bold text-[#3d3527] mb-4">{editingEvent ? 'Редактировать' : 'Новое событие'}</h2>
            <ScheduleForm 
              event={editingEvent} 
              miniGroups={miniGroups}
              onSave={saveEvent} 
              onClose={() => { setShowModal(false); setEditingEvent(null); }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleForm({ event, miniGroups, onSave, onClose }: { 
  event: ScheduleEvent | null; 
  miniGroups: MiniGroup[];
  onSave: (data: any) => void; 
  onClose: () => void 
}) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [date, setDate] = useState(event?.date?.split('T')[0] || '');
  const [time, setTime] = useState(event?.time || '');
  const [location, setLocation] = useState(event?.location || '');
  const [isOnline, setIsOnline] = useState(event?.isOnline ?? false);
  const [link, setLink] = useState(event?.link || '');

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Время</label>
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="18:00" className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="isOnline" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} className="w-4 h-4" />
        <label htmlFor="isOnline" className="text-sm text-[#3d3527]">Онлайн</label>
      </div>
      {isOnline ? (
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Место</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      )}
      {event?.miniGroupId && (
        <div className="p-3 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Привязано к мини-группе:</span>{' '}
            {miniGroups.find(g => g.id === event.miniGroupId)?.title || 'Группа'}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Управление событиями мини-групп доступно в разделе "Мини-группы" → Настройки группы
          </p>
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button 
          onClick={() => onSave({ 
            title, 
            description, 
            date, 
            time, 
            location, 
            isOnline, 
            link
          })} 
          className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
