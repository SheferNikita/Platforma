import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { PageWrapper } from '../components/PageWrapper';
import { Users, MessageCircle, Video, Calendar, User, Mail, Phone, ExternalLink, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';

interface Curator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  telegram: string | null;
  photo: string | null;
}

interface ScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  duration: string | null;
  location: string | null;
  isOnline: boolean;
  meetingLink: string | null;
}

interface MiniGroup {
  id: string;
  title: string;
  description: string | null;
  chatLink: string | null;
  curator: Curator | null;
  events: ScheduleEvent[];
  memberCount: number;
  createdAt: string;
}

export function MiniGroupPage() {
  const { user } = useAuth();
  const { isSectionVisible, loading: settingsLoading } = useSettings();
  const [group, setGroup] = useState<MiniGroup | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверка доступа по тарифу
  const isAdminUser = user?.role !== 'STUDENT';
  const hasMiniGroupAccess = isAdminUser || user?.tariff === 'WITH_MENTOR' || user?.tariff === 'WITH_PSYCHOLOGIST';
  const isSectionEnabled = isSectionVisible('mini_group', user?.tariff, user?.role);

  useEffect(() => {
    if (hasMiniGroupAccess && isSectionEnabled) {
      loadGroup();
    }
  }, [hasMiniGroupAccess, isSectionEnabled]);

  // Редирект для учеников без доступа или если раздел скрыт (пропускаем пока настройки грузятся)
  if (!hasMiniGroupAccess || (!settingsLoading && !isSectionEnabled)) {
    return <Navigate to="/" replace />;
  }

  async function loadGroup() {
    try {
      const data = await api.get<MiniGroup | null>('/public/my-mini-group');
      setGroup(data);
    } catch (error: any) {
      if (error?.message?.includes('401') || error?.message?.includes('Не авторизован')) {
        setGroup(null);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--button-lavender)]"></div>
        </div>
      </PageWrapper>
    );
  }

  if (!group) {
    return (
      <PageWrapper>
        <div className="animate-fade-in">
          <div className="mb-8 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
            <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
            <h2 className="text-[#3a3a3a] mb-3">Мини-группа</h2>
            <p className="opacity-70 leading-relaxed">
              Ваша группа поддержки на пути к трезвости
            </p>
          </div>

          <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[var(--button-lavender-light)] to-[var(--button-lavender-dark)] rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl mb-2 text-center">Вы пока не состоите в мини-группе</h3>
            <p className="opacity-60 text-center">
              Обратитесь к администратору для добавления в группу поддержки. Участие в мини-группе поможет вам получать поддержку и мотивацию на пути к трезвости.
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="animate-fade-in">
        <div className="mb-8 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
          <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
          
          <h2 className="text-[#3a3a3a] mb-3">{group.title}</h2>
          <p className="opacity-70 leading-relaxed">
            {group.description || 'Ваша группа поддержки на пути к трезвости'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {group.chatLink && (
              <div className="border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-white/90 to-[var(--button-lavender-light)]/5 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg relative overflow-hidden">
                <div className="absolute bottom-4 right-4 opacity-[0.04] pointer-events-none text-[120px]">
                  🕊️
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg">Общение в группе</h4>
                      <p className="text-sm opacity-60">Всегда на связи с участниками</p>
                    </div>
                  </div>

                  <a
                    href={group.chatLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full group relative overflow-hidden p-6 rounded-xl border-2 border-[var(--button-lavender)]/40 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/90 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-left block"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-7 h-7 text-[var(--button-lavender-dark)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-base mb-1.5">Открыть чат мини-группы</h5>
                          <p className="text-sm opacity-60 leading-relaxed">Общайтесь, делитесь опытом и поддерживайте друг друга</p>
                        </div>
                      </div>
                      <ExternalLink className="w-6 h-6 text-[var(--button-lavender-dark)] opacity-60 group-hover:opacity-100 transition-all duration-300" />
                    </div>
                  </a>

                  <div className="mt-6 p-4 bg-[var(--sky-soft)]/20 rounded-xl border border-[var(--sky-light)]/30">
                    <p className="text-sm opacity-70 leading-relaxed">
                      💡 <span className="font-medium">Совет:</span> Регулярное общение с группой помогает оставаться мотивированным и получать поддержку в трудные моменты.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {group.events.length > 0 && (
              <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg">Расписание встреч</h4>
                    <p className="text-sm opacity-60">Ближайшие события группы</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {group.events.map((event) => (
                    <div 
                      key={event.id}
                      className="group relative overflow-hidden p-5 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 rounded-xl border-2 border-[var(--button-lavender)]/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 text-[var(--button-lavender-dark)]" />
                            </div>
                            <div>
                              <h5 className="text-base mb-0.5">{event.title}</h5>
                              {event.description && (
                                <p className="text-xs opacity-60">{event.description}</p>
                              )}
                            </div>
                          </div>
                          {event.isOnline && (
                            <span className="px-2.5 py-1 bg-[var(--success-green)]/10 text-[var(--success-green)] rounded-lg text-xs font-medium border border-[var(--success-green)]/20">
                              Онлайн
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="flex items-center gap-2 opacity-70">
                            <Calendar className="w-4 h-4 text-[var(--icon-lavender)]" />
                            <span>{format(new Date(event.date), 'd MMMM yyyy', { locale: ru })}</span>
                          </div>
                          <div className="flex items-center gap-2 opacity-70">
                            <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{event.time}</span>
                          </div>
                          {event.duration && (
                            <div className="flex items-center gap-2 opacity-70">
                              <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>~{event.duration}</span>
                            </div>
                          )}
                        </div>
                        {event.meetingLink && (
                          <a
                            href={event.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-lg text-sm hover:shadow-lg transition-all"
                          >
                            <Video className="w-4 h-4" />
                            Присоединиться
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {group.curator && (
              <div className="border-2 border-[var(--button-lavender-dark)]/40 bg-gradient-to-br from-white/90 to-[var(--button-lavender-light)]/10 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-4 right-4 opacity-[0.05] pointer-events-none text-[100px]">
                  🕊️
                </div>

                <div className="relative z-10">
                  <h4 className="text-base mb-5 flex items-center gap-2 opacity-80">
                    <User className="w-5 h-5 text-[var(--icon-lavender)]" />
                    Ваш куратор
                  </h4>

                  <div className="text-center mb-6">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--button-lavender-light)] to-[var(--button-lavender-dark)] p-1 shadow-lg">
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-[var(--sky-soft)] flex items-center justify-center overflow-hidden">
                        {group.curator.photo ? (
                          <img src={group.curator.photo} alt={group.curator.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-12 h-12 text-[var(--icon-lavender)]" />
                        )}
                      </div>
                    </div>
                    <h5 className="text-lg mb-1">{group.curator.name}</h5>
                    <p className="text-xs opacity-60">Куратор группы</p>
                  </div>

                  <div className="pt-4 border-t border-[var(--sky-light)]/30 space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-white/40 rounded-lg">
                      <Mail className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0" />
                      <span className="text-sm opacity-70 truncate">{group.curator.email}</span>
                    </div>
                    {group.curator.phone && (
                      <div className="flex items-center gap-3 p-3 bg-white/40 rounded-lg">
                        <Phone className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0" />
                        <span className="text-sm opacity-70">{group.curator.phone}</span>
                      </div>
                    )}
                    {group.curator.telegram && (
                      <a
                        href={group.curator.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Написать куратору</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 shadow-lg">
              <h4 className="text-base mb-4 flex items-center gap-2 opacity-80">
                <Users className="w-5 h-5 text-[var(--icon-lavender)]" />
                О группе
              </h4>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                  <span className="opacity-70">Участников</span>
                  <span className="font-medium text-[var(--button-lavender-dark)]">{group.memberCount} человек</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                  <span className="opacity-70">Создана</span>
                  <span className="font-medium text-[var(--button-lavender-dark)]">
                    {format(new Date(group.createdAt), 'd.MM.yyyy', { locale: ru })}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/80 rounded-2xl p-6 shadow-lg">
              <div className="text-center">
                <div className="text-3xl mb-3">🤝</div>
                <p className="text-sm italic opacity-80 leading-relaxed">
                  "Вместе мы сильнее. Поддержка группы — ключ к успеху на пути к трезвости."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
