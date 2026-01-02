import React from 'react';
import { MapPin, Users, Calendar, Phone, Globe, Navigation } from 'lucide-react';

interface Community {
  id: number;
  name: string;
  city: string;
  address: string;
  description: string;
  type: string;
  schedule: string;
  contact?: string;
  website?: string;
  members?: number;
}

export function CommunitiesTab() {
  const communities: Community[] = [
    {
      id: 1,
      name: 'Анонимные Алкаголики — Москва Центр',
      city: 'Москва',
      address: 'ул. Тверская, д. 12, каб. 301',
      description: 'Группа АА с программой 12 шагов. Открытые и закрытые встречи для всех, кто хочет бросить пить.',
      type: 'Анонимные Алкаголики',
      schedule: 'Вт, Чт, Вс — 19:00',
      contact: '+7 (495) 123-45-67',
      website: 'https://aa-moscow.ru',
      members: 45,
    },
    {
      id: 2,
      name: 'Клуб Трезвости',
      city: 'Санкт-Петербург',
      address: 'Невский проспект, д. 85',
      description: 'Сообщество трезвенников, организующее совместные мероприятия, спортивные активности и культурные походы.',
      type: 'Клуб',
      schedule: 'Пн, Ср, Пт — 18:30',
      contact: '+7 (812) 234-56-78',
      website: 'https://trezvost-spb.ru',
      members: 67,
    },
    {
      id: 3,
      name: 'Община Трезвости "Новый Путь"',
      city: 'Казань',
      address: 'ул. Баумана, д. 25',
      description: 'Православная община, помогающая в преодолении зависимости через духовное развитие и взаимопомощь.',
      type: 'Религиозная община',
      schedule: 'Сб — 16:00, Вс — 11:00',
      contact: '+7 (843) 345-67-89',
      members: 32,
    },
    {
      id: 4,
      name: 'АА — Новосибирск',
      city: 'Новосибирск',
      address: 'Красный проспект, д. 50, оф. 15',
      description: 'Группа поддержки по программе 12 шагов. Встречи для начинающих и опытных участников.',
      type: 'Анонимные Алкаголики',
      schedule: 'Ср, Пт — 19:00, Вс — 17:00',
      contact: '+7 (383) 456-78-90',
      website: 'https://aa-nsk.ru',
      members: 28,
    },
    {
      id: 5,
      name: 'Трезвый Екатеринбург',
      city: 'Екатеринбург',
      address: 'ул. Ленина, д. 33',
      description: 'Активное сообщество, организующее спортивные мероприятия, лекции и встречи для трезвенников.',
      type: 'Общественная организация',
      schedule: 'Пн, Чт — 18:00',
      contact: '+7 (343) 567-89-01',
      website: 'https://trezviy-ekb.ru',
      members: 54,
    },
    {
      id: 6,
      name: 'Семейный Клуб Трезвости',
      city: 'Москва',
      address: 'Кутузовский проспект, д. 20',
      description: 'Группа поддержки для семей, где есть проблемы с алкоголем. Работа с созависимостью.',
      type: 'Семейная группа',
      schedule: 'Вт — 19:30, Сб — 15:00',
      contact: '+7 (495) 678-90-12',
      members: 38,
    },
    {
      id: 7,
      name: 'АА — Краснодар',
      city: 'Краснодар',
      address: 'ул. Красная, д. 122',
      description: 'Встречи Анонимных Алкаголиков в теплой и поддерживающей атмосфере.',
      type: 'Анонимные Алкаголики',
      schedule: 'Ежедневно — 19:00',
      contact: '+7 (861) 789-01-23',
      website: 'https://aa-krasnodar.ru',
      members: 41,
    },
    {
      id: 8,
      name: 'Онлайн Община "Трезвая Россия"',
      city: 'Онлайн',
      address: 'Zoom / Telegram',
      description: 'Виртуальная община для тех, кто не может посещать очные встречи. Ежедневные онлайн-встречи.',
      type: 'Онлайн-сообщество',
      schedule: 'Ежедневно — 20:00 (МСК)',
      contact: '@trezvaya_russia',
      website: 'https://trezvaya-russia.ru',
      members: 156,
    },
  ];

  const getCommunityTypeColor = (type: string) => {
    if (type.includes('Анонимные')) return 'bg-gradient-to-r from-blue-500/10 to-blue-600/10 text-blue-700 border border-blue-200';
    if (type.includes('Клуб')) return 'bg-gradient-to-r from-green-500/10 to-green-600/10 text-green-700 border border-green-200';
    if (type.includes('Религиозная')) return 'bg-gradient-to-r from-purple-500/10 to-purple-600/10 text-purple-700 border border-purple-200';
    if (type.includes('Онлайн')) return 'bg-gradient-to-r from-orange-500/10 to-orange-600/10 text-orange-700 border border-orange-200';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        <div className="absolute -top-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Общины трезвости</h2>
        <p className="opacity-70 leading-relaxed">
          Найдите сообщество единомышленников в своем городе или присоединяйтесь к онлайн-группам. 
          Живое общение и взаимная поддержка — важная часть пути к трезвости.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {communities.map((community, index) => (
          <div
            key={community.id}
            className="border-2 border-[var(--sky-light)]/50 rounded-2xl p-4 md:p-7 bg-gradient-to-br from-white/80 to-white/40 shadow-[0_4px_16px_var(--book-shadow)] hover:shadow-[0_8px_24px_var(--book-shadow-strong)] transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="mb-4 md:mb-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="flex-1 leading-snug text-base md:text-lg">{community.name}</h3>
              </div>
              <span className={`inline-block px-3 md:px-4 py-1 md:py-1.5 rounded-full text-xs ${getCommunityTypeColor(community.type)}`}>
                {community.type}
              </span>
            </div>

            <p className="text-xs md:text-sm mb-4 md:mb-5 opacity-80 leading-relaxed">
              {community.description}
            </p>

            <div className="space-y-2 md:space-y-3 mb-5 md:mb-6 text-xs md:text-sm">
              <div className="flex items-start gap-2 opacity-70">
                <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5 text-[var(--icon-lavender)]" />
                <div className="min-w-0">
                  <div className="leading-relaxed">{community.city}</div>
                  <div className="text-[10px] md:text-xs opacity-70 leading-relaxed break-words">{community.address}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-70">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 text-[var(--icon-lavender)]" />
                <span className="leading-relaxed">{community.schedule}</span>
              </div>

              {community.members && (
                <div className="flex items-center gap-2 opacity-70">
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 text-[var(--icon-lavender)]" />
                  {community.members} участников
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {community.contact && (
                <a
                  href={`tel:${community.contact}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                >
                  <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10" />
                  <span className="relative z-10">Связаться</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </a>
              )}
              
              {community.website && (
                <a
                  href={community.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Globe className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Сайт
                </a>
              )}

              {community.city !== 'Онлайн' && (
                <button className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]">
                  <Navigation className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  На карте
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-5 md:p-8 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/5 border-2 border-[var(--button-lavender-dark)]/30 rounded-2xl shadow-[0_4px_16px_rgba(122,132,171,0.08)]">
        <h4 className="mb-3 text-[var(--button-lavender-dark)] text-base md:text-lg">Не нашли общину в своем городе?</h4>
        <p className="text-xs md:text-sm opacity-80 mb-5 leading-relaxed">
          Вы можете создать свою группу поддержки или присоединиться к онлайн-сообществам. 
          Мы поможем вам организовать встречи.
        </p>
        <button className="px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group">
          <span className="relative z-10">Создать общину</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        </button>
      </div>

      <div className="mt-6 p-8 bg-white/60 border-2 border-[var(--sky-light)]/50 rounded-2xl shadow-[0_4px_16px_var(--book-shadow)]">
        <h4 className="mb-4">О программе Анонимных Алкаголиков</h4>
        <p className="text-sm opacity-80 mb-4 leading-relaxed">
          АА — это международное сообщество мужчин и женщин, которые делятся друг с другом своим 
          опытом, силами и надеждами, чтобы решить свою общую проблему и помочь другим избавиться от алкоголизма.
        </p>
        <p className="text-sm opacity-80 leading-relaxed">
          Единственное условие для членства в АА — желание бросить пить. 
          Членство в АА бесплатно, группы не связаны ни с какими сектами, религиозными течениями, 
          политическими организациями или учреждениями.
        </p>
      </div>
    </div>
  );
}