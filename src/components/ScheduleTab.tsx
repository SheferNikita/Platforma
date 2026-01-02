import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Users, Bell, ChevronDown, ChevronUp } from 'lucide-react';

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  type: 'meeting' | 'webinar' | 'consultation' | 'group';
  description: string;
  maxParticipants?: number;
  registered?: number;
}

export function ScheduleTab() {
  const [isPastEventsOpen, setIsPastEventsOpen] = useState(false);
  const [events] = useState<Event[]>([
    {
      id: 1,
      title: 'Групповая встреча поддержки',
      date: '2025-12-15',
      time: '19:00',
      duration: '1.5 часа',
      location: 'Онлайн (Zoom)',
      type: 'meeting',
      description: 'Еженедельная встреча для обмена опытом, обсуждения трудностей и поддержки друг друга.',
      maxParticipants: 25,
      registered: 18,
    },
    {
      id: 2,
      title: 'Вебинар: Физиология зависимости',
      date: '2025-12-18',
      time: '18:00',
      duration: '2 часа',
      location: 'Онлайн (YouTube Live)',
      type: 'webinar',
      description: 'Доктор рассказал о влиянии алкоголя на организм и процессах восстановления.',
    },
    {
      id: 3,
      title: 'Утренняя медитация',
      date: '2025-12-20',
      time: '08:00',
      duration: '30 минут',
      location: 'Онлайн (Zoom)',
      type: 'group',
      description: 'Совместная практика осознанности для бодрого и трезвого начала дня.',
      maxParticipants: 50,
      registered: 32,
    },
    {
      id: 4,
      title: 'Вебинар: Работа с триггерами',
      date: '2025-12-28',
      time: '18:00',
      duration: '2 часа',
      location: 'Онлайн (YouTube Live)',
      type: 'webinar',
      description: 'Психолог расскажет о методах выявления и преодоления триггеров зависимости.',
    },
    {
      id: 5,
      title: 'Индивидуальная консультация',
      date: '2025-12-29',
      time: '14:00',
      duration: '50 минут',
      location: 'Онлайн или очно',
      type: 'consultation',
      description: 'Личная встреча с психологом для проработки индивидуальных вопросов.',
    },
    {
      id: 6,
      title: 'Групповая встреча поддержки',
      date: '2025-12-30',
      time: '19:00',
      duration: '1.5 часа',
      location: 'Онлайн (Zoom)',
      type: 'meeting',
      description: 'Еженедельная встреча для обмена опытом, обсуждения трудностей и поддержки друг друга.',
      maxParticipants: 25,
      registered: 15,
    },
    {
      id: 7,
      title: 'Вебинар: Здоровый образ жизни',
      date: '2026-01-05',
      time: '18:30',
      duration: '1.5 часа',
      location: 'Онлайн (YouTube Live)',
      type: 'webinar',
      description: 'Эксперт по питанию расскажет о роли здорового образа жизни в поддержании трезвости.',
    },
    {
      id: 8,
      title: 'Новогодняя встреча сообщества',
      date: '2026-01-10',
      time: '16:00',
      duration: '2 часа',
      location: 'Онлайн (Zoom)',
      type: 'group',
      description: 'Совместное празднование в трезвости: игры, общение, поддержка.',
      maxParticipants: 100,
      registered: 67,
    },
  ]);

  const getEventTypeLabel = (type: string) => {
    const labels = {
      meeting: 'Встреча',
      webinar: 'Вебинар',
      consultation: 'Консультация',
      group: 'Групповое занятие',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getEventTypeColor = (type: string) => {
    const colors = {
      meeting: 'bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-700 border border-blue-200',
      webinar: 'bg-gradient-to-r from-purple-500/10 to-purple-600/10 text-purple-700 border border-purple-200',
      consultation: 'bg-gradient-to-r from-green-500/10 to-green-600/10 text-green-700 border border-green-200',
      group: 'bg-gradient-to-r from-orange-500/10 to-orange-600/10 text-orange-700 border border-orange-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
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

  const isUpcoming = (dateStr: string, timeStr: string) => {
    const eventDate = new Date(`${dateStr} ${timeStr}`);
    return eventDate > new Date();
  };

  // Разделяем события на предстоящие и прошедшие
  const upcomingEvents = events.filter(event => isUpcoming(event.date, event.time));
  const pastEvents = events.filter(event => !isUpcoming(event.date, event.time));

  const renderEvent = (event: Event, index: number, upcoming: boolean) => (
    <div
      key={event.id}
      className={`border-2 rounded-2xl p-4 md:p-7 transition-all duration-300 transform hover:-translate-y-1 animate-slide-up ${
        upcoming
          ? 'border-[var(--button-lavender-dark)]/40 bg-gradient-to-br from-white/80 to-white/40 shadow-[0_4px_16px_var(--book-shadow)] hover:shadow-[0_8px_24px_var(--book-shadow-strong)]'
          : 'border-[var(--sky-light)]/50 bg-gradient-to-br from-gray-50/50 to-gray-100/30 opacity-60'
      }`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex flex-col md:flex-row gap-4 md:gap-7">
        {/* Date Section */}
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

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 md:gap-3 mb-3 md:mb-4">
            <h3 className="flex-1 text-base md:text-lg">{event.title}</h3>
            <span className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs ${getEventTypeColor(event.type)}`}>
              {getEventTypeLabel(event.type)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-5 text-xs md:text-sm opacity-70">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
              <span className="leading-relaxed truncate">{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
              <span className="truncate">{event.time} ({event.duration})</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
              <span className="truncate">{event.location}</span>
            </div>
            {event.maxParticipants && (
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)]" />
                {event.registered}/{event.maxParticipants} участников
              </div>
            )}
          </div>

          <p className="text-xs md:text-sm mb-4 md:mb-5 opacity-80 leading-relaxed">
            {event.description}
          </p>

          {upcoming && (
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
          )}
          
          {!upcoming && (
            <span className="text-sm italic opacity-60">Мероприятие завершено</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        {/* Decorative element */}
        <div className="absolute -top-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Расписание мероприятий</h2>
        <p className="opacity-70 leading-relaxed">
          Онлайн и офлайн встречи, вебинары, консультации и групповые занятия. 
          Присоединяйтесь к сообществу и находите поддержку.
        </p>
      </div>

      <div className="space-y-5">
        {upcomingEvents.map((event, index) => renderEvent(event, index, true))}
      </div>

      {/* Прошедшие события */}
      {pastEvents.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setIsPastEventsOpen(!isPastEventsOpen)}
            className="w-full mb-5 p-4 md:p-5 bg-gradient-to-br from-[var(--sky-soft)]/30 to-white/50 border-2 border-[var(--sky-light)]/40 rounded-2xl hover:shadow-[0_4px_12px_var(--book-shadow)] transition-all duration-300 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--button-lavender-light)]/20 to-[var(--button-lavender-dark)]/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[var(--icon-lavender)]" />
              </div>
              <div className="text-left">
                <h3 className="text-base md:text-lg">Прошедшие события</h3>
                <p className="text-xs md:text-sm opacity-60 mt-0.5">
                  {pastEvents.length} {pastEvents.length === 1 ? 'событие' : pastEvents.length < 5 ? 'события' : 'событий'}
                </p>
              </div>
            </div>
            {isPastEventsOpen ? (
              <ChevronUp className="w-5 h-5 text-[var(--icon-lavender)] transition-transform duration-300" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--icon-lavender)] transition-transform duration-300" />
            )}
          </button>

          {isPastEventsOpen && (
            <div className="space-y-5 animate-fade-in">
              {pastEvents.map((event, index) => renderEvent(event, index, false))}
            </div>
          )}
        </div>
      )}

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