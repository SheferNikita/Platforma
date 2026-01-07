import React from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { Users, MessageCircle, Video, Calendar, User, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MiniGroupPage() {
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
          <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
          
          <h2 className="text-[#3a3a3a] mb-3">Мини-группа</h2>
          <p className="opacity-70 leading-relaxed">
            Ваша группа поддержки на пути к трезвости. Встречайтесь, общайтесь и поддерживайте друг друга.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chat Link Card */}
            <div className="border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-white/90 to-[var(--button-lavender-light)]/5 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
              {/* Dove background */}
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

                <button
                  onClick={() => navigate('/chats')}
                  className="w-full group relative overflow-hidden p-6 rounded-xl border-2 border-[var(--button-lavender)]/40 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/90 hover:shadow-[0_12px_28px_rgba(139,149,188,0.4)] transition-all duration-300 transform hover:-translate-y-1 text-left"
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
                    <span className="text-2xl text-[var(--button-lavender-dark)] opacity-60 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">→</span>
                  </div>
                </button>

                <div className="mt-6 p-4 bg-[var(--sky-soft)]/20 rounded-xl border border-[var(--sky-light)]/30">
                  <p className="text-sm opacity-70 leading-relaxed">
                    💡 <span className="font-medium">Совет:</span> Регулярное общение с группой помогает оставаться мотивированным и получать поддержку в трудные моменты.
                  </p>
                </div>
              </div>
            </div>

            {/* Schedule Card */}
            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-lg">Расписание видео-встреч</h4>
                  <p className="text-sm opacity-60">Регулярные онлайн-встречи группы</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Meeting 1 */}
                <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 rounded-xl border-2 border-[var(--button-lavender)]/30 hover:shadow-[0_8px_20px_rgba(139,149,188,0.25)] transition-all duration-300 hover:-translate-y-0.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-[var(--button-lavender-dark)]" />
                        </div>
                        <div>
                          <h5 className="text-base mb-0.5">Групповая встреча</h5>
                          <p className="text-xs opacity-60">Общее обсуждение прогресса</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-[var(--success-green)]/10 text-[var(--success-green)] rounded-lg text-xs font-medium border border-[var(--success-green)]/20">
                        Онлайн
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 opacity-70">
                        <Calendar className="w-4 h-4 text-[var(--icon-lavender)]" />
                        <span>Каждый понедельник</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>19:00 (МСК)</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>~60 минут</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meeting 2 */}
                <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 rounded-xl border-2 border-[var(--button-lavender)]/30 hover:shadow-[0_8px_20px_rgba(139,149,188,0.25)] transition-all duration-300 hover:-translate-y-0.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Video className="w-5 h-5 text-[var(--button-lavender-dark)]" />
                        </div>
                        <div>
                          <h5 className="text-base mb-0.5">Проверка прогресса</h5>
                          <p className="text-xs opacity-60">Еженедельный отчет и поддержка</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-[var(--success-green)]/10 text-[var(--success-green)] rounded-lg text-xs font-medium border border-[var(--success-green)]/20">
                        Онлайн
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 opacity-70">
                        <Calendar className="w-4 h-4 text-[var(--icon-lavender)]" />
                        <span>Каждую пятницу</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>18:00 (МСК)</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>~45 минут</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meeting 3 */}
                <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 rounded-xl border-2 border-[var(--button-lavender)]/30 hover:shadow-[0_8px_20px_rgba(139,149,188,0.25)] transition-all duration-300 hover:-translate-y-0.5">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-[var(--button-lavender-dark)]" />
                        </div>
                        <div>
                          <h5 className="text-base mb-0.5">Неформальная встреча</h5>
                          <p className="text-xs opacity-60">Общение в свободной атмосфере</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 rounded-lg text-xs font-medium border border-blue-500/20">
                        Опционально
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 opacity-70">
                        <Calendar className="w-4 h-4 text-[var(--icon-lavender)]" />
                        <span>Каждую субботу</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>15:00 (МСК)</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-70">
                        <svg className="w-4 h-4 text-[var(--icon-lavender)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>~30 минут</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Mentor Info */}
          <div className="space-y-6">
            {/* Mentor Card */}
            <div className="border-2 border-[var(--button-lavender-dark)]/40 bg-gradient-to-br from-white/90 to-[var(--button-lavender-light)]/10 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
              {/* Dove background */}
              <div className="absolute top-4 right-4 opacity-[0.05] pointer-events-none text-[100px]">
                🕊️
              </div>

              <div className="relative z-10">
                <h4 className="text-base mb-5 flex items-center gap-2 opacity-80">
                  <User className="w-5 h-5 text-[var(--icon-lavender)]" />
                  Ваш наставник
                </h4>

                {/* Mentor Avatar & Name */}
                <div className="text-center mb-6">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--button-lavender-light)] to-[var(--button-lavender-dark)] p-1 shadow-lg">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-[var(--sky-soft)] flex items-center justify-center overflow-hidden">
                      <User className="w-12 h-12 text-[var(--icon-lavender)]" />
                    </div>
                  </div>
                  <h5 className="text-lg mb-1">Мария Петрова</h5>
                  <p className="text-xs opacity-60">Психолог-консультант</p>
                </div>

                {/* About Mentor */}
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-[var(--sky-soft)]/20 rounded-xl border border-[var(--sky-light)]/30">
                    <p className="text-sm opacity-80 leading-relaxed">
                      Психолог-консультант с 10-летним опытом работы с зависимостями. Специализируется на когнитивно-поведенческой терапии и групповой работе.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-white/60 rounded-xl border border-[var(--sky-light)]/30">
                      <div className="text-xl mb-1 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                        10
                      </div>
                      <div className="text-xs opacity-60">лет опыта</div>
                    </div>
                    <div className="p-3 bg-white/60 rounded-xl border border-[var(--sky-light)]/30">
                      <div className="text-xl mb-1 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                        8
                      </div>
                      <div className="text-xs opacity-60">человек в группе</div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="pt-4 border-t border-[var(--sky-light)]/30 space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white/40 rounded-lg">
                    <Mail className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0" />
                    <span className="text-sm opacity-70 truncate">maria.petrova@example.com</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/40 rounded-lg">
                    <Phone className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0" />
                    <span className="text-sm opacity-70">+7 (999) 888-77-66</span>
                  </div>
                </div>

                {/* Contact Button */}
                <button className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(122,132,171,0.4)] transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Написать наставнику</span>
                </button>
              </div>
            </div>

            {/* Group Info Card */}
            <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
              <h4 className="text-base mb-4 flex items-center gap-2 opacity-80">
                <Users className="w-5 h-5 text-[var(--icon-lavender)]" />
                О группе
              </h4>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                  <span className="opacity-70">Участников</span>
                  <span className="font-medium text-[var(--button-lavender-dark)]">8 человек</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                  <span className="opacity-70">Создана</span>
                  <span className="font-medium text-[var(--button-lavender-dark)]">15.11.2025</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                  <span className="opacity-70">Встреч проведено</span>
                  <span className="font-medium text-[var(--button-lavender-dark)]">12</span>
                </div>
              </div>
            </div>

            {/* Motivational Quote */}
            <div className="border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/80 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow)]">
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