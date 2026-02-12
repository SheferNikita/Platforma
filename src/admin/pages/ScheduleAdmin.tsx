import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Calendar, Eye, EyeOff, Video, MapPin, Users2, X, Copy, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';

function isEventPast(dateStr: string, timeStr: string): boolean {
  const datePart = dateStr.split('T')[0];
  const timePart = timeStr || '23:59';
  const mskDateStr = `${datePart}T${timePart}:00+03:00`;
  const eventDate = new Date(mskDateStr);
  return eventDate.getTime() < Date.now();
}

const TARIFF_OPTIONS = [
  { value: 'BASIC', label: 'Базовый' },
  { value: 'FAMILY', label: 'Семейный' },
  { value: 'RELATIVE', label: 'Родственник' },
  { value: 'WITH_MENTOR', label: 'С наставником' },
  { value: 'WITH_PSYCHOLOGIST', label: 'С психологом' },
  { value: 'INDIVIDUAL_PSYCHOLOGIST', label: 'Индивидуальный психолог' },
];

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
  allowedTariffs: string[];
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
      if (editingEvent?.id && !editingEvent.id.startsWith('copy_')) {
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

  function copyEvent(event: ScheduleEvent) {
    const copy: ScheduleEvent = {
      ...event,
      id: 'copy_' + Date.now(),
      title: event.title + ' (копия)',
      miniGroupId: null,
      miniGroup: null,
    };
    setEditingEvent(copy);
    setShowModal(true);
  }

  function getTariffBadge(tariffs: string[]) {
    if (!tariffs || tariffs.length === 0) return null;
    if (tariffs.length === TARIFF_OPTIONS.length) return 'Все тарифы';
    return tariffs.map(t => TARIFF_OPTIONS.find(o => o.value === t)?.label || t).join(', ');
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
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {events.map((event) => {
                const past = isEventPast(event.date, event.time);
                return (
                <div key={event.id} className={`p-3 ${past ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${past ? 'bg-gray-400' : 'bg-gradient-to-br from-[#a67c52] to-[#c4a57b]'}`}>
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#3d3527] text-sm">{event.title}</p>
                        {past && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px] whitespace-nowrap">
                            <Clock className="w-2.5 h-2.5" />
                            Уже прошло
                          </span>
                        )}
                      </div>
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
                      {event.allowedTariffs && event.allowedTariffs.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                          <Shield className="w-3 h-3" />
                          {getTariffBadge(event.allowedTariffs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button onClick={() => togglePublish(event.id, event.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title={event.isPublished ? 'Скрыть' : 'Опубликовать'}>
                      {event.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => copyEvent(event)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Копировать">
                      <Copy className="w-4 h-4 text-[#3d3527]" />
                    </button>
                    <button onClick={() => { setEditingEvent(event); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Редактировать">
                      <Edit className="w-4 h-4 text-[#3d3527]" />
                    </button>
                    <button onClick={() => deleteEvent(event.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Удалить">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              )})}
            </div>
            <div className="hidden md:block divide-y divide-[#d4c9b0]/30">
              {events.map((event) => {
                const pastDesktop = isEventPast(event.date, event.time);
                return (
                <div key={event.id} className={`flex items-center justify-between p-4 hover:bg-[#f5f3ed]/50 ${pastDesktop ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pastDesktop ? 'bg-gray-400' : 'bg-gradient-to-br from-[#a67c52] to-[#c4a57b]'}`}>
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#3d3527]">{event.title}</p>
                        {pastDesktop && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            Уже прошло
                          </span>
                        )}
                      </div>
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
                        {event.allowedTariffs && event.allowedTariffs.length > 0 && (
                          <span className="flex items-center gap-1 text-purple-600">
                            <Shield className="w-3.5 h-3.5" />
                            {getTariffBadge(event.allowedTariffs)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePublish(event.id, event.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title={event.isPublished ? 'Скрыть' : 'Опубликовать'}>
                      {event.isPublished ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button onClick={() => copyEvent(event)} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Копировать">
                      <Copy className="w-5 h-5 text-[#3d3527]" />
                    </button>
                    <button onClick={() => { setEditingEvent(event); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg" title="Редактировать">
                      <Edit className="w-5 h-5 text-[#3d3527]" />
                    </button>
                    <button onClick={() => deleteEvent(event.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Удалить">
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold text-[#3d3527]">
                {editingEvent?.id?.startsWith('copy_') ? 'Копирование события' : editingEvent ? 'Редактировать' : 'Новое событие'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingEvent(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Закрыть">
                <X className="w-5 h-5 text-[#3d3527]" />
              </button>
            </div>
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
  const [allowedTariffs, setAllowedTariffs] = useState<string[]>(event?.allowedTariffs || []);
  const [showTariffs, setShowTariffs] = useState((event?.allowedTariffs || []).length > 0);

  function toggleTariff(tariff: string) {
    setAllowedTariffs(prev => 
      prev.includes(tariff) ? prev.filter(t => t !== tariff) : [...prev, tariff]
    );
  }

  function selectAllTariffs() {
    if (allowedTariffs.length === TARIFF_OPTIONS.length) {
      setAllowedTariffs([]);
    } else {
      setAllowedTariffs(TARIFF_OPTIONS.map(t => t.value));
    }
  }

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
      <div>
        <div className="flex items-center gap-3 mb-2">
          <input 
            type="checkbox" 
            id="showTariffs" 
            checked={showTariffs} 
            onChange={(e) => {
              setShowTariffs(e.target.checked);
              if (!e.target.checked) setAllowedTariffs([]);
            }} 
            className="w-4 h-4" 
          />
          <label htmlFor="showTariffs" className="text-sm font-medium text-[#3d3527]">Ограничить видимость по тарифам</label>
        </div>
        {showTariffs && (
          <div className="p-3 bg-purple-50 rounded-xl space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-purple-700 font-medium">Видно только выбранным тарифам:</span>
              <button 
                type="button"
                onClick={selectAllTariffs} 
                className="text-xs text-purple-600 hover:text-purple-800 underline"
              >
                {allowedTariffs.length === TARIFF_OPTIONS.length ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {TARIFF_OPTIONS.map(tariff => (
                <label key={tariff.value} className="flex items-center gap-2 text-sm text-[#3d3527] cursor-pointer hover:bg-purple-100 rounded-lg px-2 py-1.5 transition-colors">
                  <input
                    type="checkbox"
                    checked={allowedTariffs.includes(tariff.value)}
                    onChange={() => toggleTariff(tariff.value)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  {tariff.label}
                </label>
              ))}
            </div>
            {allowedTariffs.length === 0 && showTariffs && (
              <p className="text-xs text-orange-600 mt-1">Выберите хотя бы один тариф, иначе событие будет видно всем</p>
            )}
          </div>
        )}
      </div>
      {event?.miniGroupId && !event.id.startsWith('copy_') && (
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
            link,
            allowedTariffs: showTariffs ? allowedTariffs : []
          })} 
          className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
