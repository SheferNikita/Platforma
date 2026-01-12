import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Bell, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface ScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  duration: string | null;
  location: string | null;
  eventType: string;
  maxParticipants: number | null;
  isOnline: boolean;
}

export function ScheduleTab() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await api.get<ScheduleEvent[]>('/public/events');
      setEvents(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  }

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MEETING: 'Встреча',
      WEBINAR: 'Вебинар',
      CONSULTATION: 'Консультация',
      GROUP: 'Групповое занятие',
    };
    return labels[type] || type;
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      MEETING: 'bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-700 border border-blue-200',
      WEBINAR: 'bg-gradient-to-r from-purple-500/10 to-purple-600/10 text-purple-700 border border-purple-200',
      CONSULTATION: 'bg-gradient-to-r from-green-500/10 to-green-600/10 text-green-700 border border-green-200',
      GROUP: 'bg-gradient-to-r from-orange-500/10 to-orange-600/10 text-orange-700 border border-orange-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('ru-RU', options);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender-dark)]" />
        <span className="ml-3 text-lg">Загрузка расписания...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={loadEvents}
          className="px-4 py-2 bg-[var(--button-lavender-dark)] text-white rounded-lg hover:opacity-90"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Нет предстоящих мероприятий</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        <div className="absolute -top-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Расписание мероприятий</h2>
        <p className="opacity-70 leading-relaxed">
          Онлайн и офлайн встречи, вебинары и тренинги
        </p>
      </div>

      <div className="space-y-5">
        {events.map((event, index) => (
          <div
            key={event.id}
            className="border-2 rounded-2xl p-4 md:p-7 transition-all duration-300 transform hover:-translate-y-1 animate-slide-up border-[var(--button-lavender-dark)]/40 bg-gradient-to-br from-white/80 to-white/40 shadow-[0_4px_16px_var(--book-shadow)] hover:shadow-[0_8px_24px_var(--book-shadow-strong)]"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex flex-col md:flex-row gap-4 md:gap-7">
              <div className="flex-shrink-0 text-center md:text-left">
                <div className="inline-flex md:block p-4 md:p-5 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/10 rounded-2xl shadow-inner min-w-[100px] md:min-w-[120px]">
                  <div className="text-3xl md:text-4xl bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                    {new Date(event.date).getDate()}
                  </div>
                  <div className="text-xs md:text-sm opacity-60 mt-1 tracking-wide uppercase">
                    {new Date(event.date).toLocaleDateString('ru-RU', { month: 'short' })}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-2 md:gap-3 mb-3 md:mb-4">
                  <h3 className="flex-1 text-base md:text-lg">{event.title}</h3>
                  <span className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs ${getEventTypeColor(event.eventType)}`}>
                    {getEventTypeLabel(event.eventType)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-5 text-xs md:text-sm opacity-70">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
                    <span className="leading-relaxed truncate">{formatDate(event.date)}</span>
                  </div>
                  {event.time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
                      <span className="truncate">{event.time} {event.duration && `(${event.duration})`}</span>
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  {event.maxParticipants && (
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
                      До {event.maxParticipants} участников
                    </div>
                  )}
                </div>

                {event.description && (
                  <p className="text-xs md:text-sm mb-4 md:mb-5 opacity-80 leading-relaxed">
                    {event.description}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <button className="px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group">
                    <span className="relative z-10">Записаться</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  </button>
                  <button className="px-4 md:px-5 py-2 md:py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]">
                    <Bell className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    Напомнить
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-8 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/5 border-2 border-[var(--button-lavender-dark)]/30 rounded-2xl shadow-[0_4px_16px_rgba(122,132,171,0.08)]">
        <h4 className="mb-3 text-[var(--button-lavender-dark)]">Хотите предложить мероприятие?</h4>
        <p className="text-sm opacity-80 mb-5 leading-relaxed">
          Если у вас есть идея для встречи, вебинара или мастер-класса — свяжитесь с нами!
        </p>
        <button className="px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group">
          <span className="relative z-10">Отправить предложение</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        </button>
      </div>
    </div>
  );
}
