import React, { useState } from 'react';
import { Book, FileText, Video, Headphones, Download, ExternalLink } from 'lucide-react';

interface Resource {
  id: number;
  title: string;
  author?: string;
  description: string;
  type: 'book' | 'article' | 'video' | 'audio';
  category: string;
  url?: string;
}

export function LibraryTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const resources: Resource[] = [
    {
      id: 1,
      title: 'Легкий способ бросить пить',
      author: 'Аллен Карр',
      description: 'Классическая книга, помогающая изменить отношение к алкоголю и освободиться от зависимости.',
      type: 'book',
      category: 'Книги',
      url: '#',
    },
    {
      id: 2,
      title: 'Анонимные Алкаголики: Большая книга',
      author: 'АА',
      description: 'Основополагающий текст программы 12 шагов, проверенный миллионами людей.',
      type: 'book',
      category: 'Книги',
      url: '#',
    },
    {
      id: 3,
      title: 'Как работает мозг зависимого человека',
      description: 'Научная статья о нейробиологии зависимости и путях восстановления.',
      type: 'article',
      category: 'Научные статьи',
      url: '#',
    },
    {
      id: 4,
      title: 'Медитация для преодоления тяги',
      description: 'Аудиопрактика для работы с желанием употребить алкоголь (20 минут).',
      type: 'audio',
      category: 'Практики',
      url: '#',
    },
    {
      id: 5,
      title: 'Истории восстановления',
      description: 'Серия видеоинтервью с людьми, прошедшими путь от зависимости к трезвости.',
      type: 'video',
      category: 'Видео',
      url: '#',
    },
    {
      id: 6,
      title: 'Влияние алкоголя на организм',
      description: 'Подробная статья о физиологических последствиях употребления алкоголя.',
      type: 'article',
      category: 'Научные статьи',
      url: '#',
    },
    {
      id: 7,
      title: 'Трезвость как стиль жизни',
      author: 'Владимир Жданов',
      description: 'Лекции о пользе трезвого образа жизни и методах борьбы с зависимостью.',
      type: 'video',
      category: 'Видео',
      url: '#',
    },
    {
      id: 8,
      title: 'Дыхательные практики для снятия стресса',
      description: 'Аудиогид по техникам дыхания, помогающим справиться с тревогой без алкоголя.',
      type: 'audio',
      category: 'Практики',
      url: '#',
    },
    {
      id: 9,
      title: 'Это голая правда',
      author: 'Алла Ильченко',
      description: 'Книга о том, как алкоголь влияет на жизнь и как вернуть контроль.',
      type: 'book',
      category: 'Книги',
      url: '#',
    },
    {
      id: 10,
      title: 'Социальные аспекты трезвости',
      description: 'Статья о том, как выстраивать отношения и социальную жизнь без алкоголя.',
      type: 'article',
      category: 'Психология',
      url: '#',
    },
  ];

  const categories = ['all', ...Array.from(new Set(resources.map(r => r.category)))];

  const filteredResources = selectedCategory === 'all' 
    ? resources 
    : resources.filter(r => r.category === selectedCategory);

  const getIcon = (type: string) => {
    switch (type) {
      case 'book':
        return <Book className="w-5 h-5" />;
      case 'article':
        return <FileText className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'audio':
        return <Headphones className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      book: 'Книга',
      article: 'Статья',
      video: 'Видео',
      audio: 'Аудио',
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        {/* Decorative element */}
        <div className="absolute -top-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Библиотека материалов</h2>
        <p className="opacity-70 leading-relaxed">
          Полезные книги, статьи, видео и аудиоматериалы для углубления знаний и поддержки на пути к трезвости.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 md:gap-3 mb-8">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 md:px-5 py-2 md:py-2.5 rounded-xl border-2 transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${
              selectedCategory === category
                ? 'bg-[var(--button-lavender)] text-white border-transparent shadow-[0_4px_12px_rgba(139,149,188,0.35)]'
                : 'bg-white/50 border-[var(--sky-light)]/50 hover:bg-white/80 hover:border-[var(--button-lavender-dark)]/50'
            }`}
          >
            {category === 'all' ? 'Все материалы' : category}
          </button>
        ))}
      </div>

      {/* Resources Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredResources.map((resource, index) => (
          <div
            key={resource.id}
            className="border-2 border-[var(--sky-light)]/50 rounded-2xl p-4 md:p-7 bg-gradient-to-br from-white/80 to-white/40 shadow-[0_4px_16px_var(--book-shadow)] hover:shadow-[0_8px_24px_var(--book-shadow-strong)] transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start gap-3 md:gap-5 mb-4">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/10 rounded-xl flex items-center justify-center text-[var(--icon-lavender)] shadow-inner">
                {getIcon(resource.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="mb-2 text-base md:text-lg">{resource.title}</h4>
                {resource.author && (
                  <p className="text-xs md:text-sm opacity-60 italic mb-2">{resource.author}</p>
                )}
                <span className="inline-block px-2.5 md:px-3 py-0.5 md:py-1 bg-gradient-to-r from-[var(--book-bg)] to-white/80 text-[10px] md:text-xs rounded-full border border-[var(--sky-light)]/40">
                  {getTypeLabel(resource.type)}
                </span>
              </div>
            </div>

            <p className="text-xs md:text-sm mb-4 md:mb-5 opacity-80 leading-relaxed">
              {resource.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
              <a
                href={resource.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
              >
                <span className="relative z-10">Открыть</span>
                <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              </a>
              {resource.type === 'book' || resource.type === 'article' ? (
                <button className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]">
                  <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Скачать
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}