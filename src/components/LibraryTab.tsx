import React, { useState, useEffect } from 'react';
import { Book, FileText, Video, Headphones, Download, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface LibraryItem {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  type: string;
  category: string | null;
  url: string | null;
  order: number;
}

export function LibraryTab() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadLibrary();
  }, []);

  async function loadLibrary() {
    try {
      setLoading(true);
      const data = await api.get<LibraryItem[]>('/public/library');
      setItems(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить библиотеку');
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...Array.from(new Set(items.map(r => r.category).filter(Boolean)))];

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(r => r.category === selectedCategory);

  const getIcon = (type: string) => {
    switch (type) {
      case 'BOOK':
        return <Book className="w-5 h-5" />;
      case 'ARTICLE':
        return <FileText className="w-5 h-5" />;
      case 'VIDEO':
        return <Video className="w-5 h-5" />;
      case 'AUDIO':
        return <Headphones className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      BOOK: 'Книга',
      ARTICLE: 'Статья',
      VIDEO: 'Видео',
      AUDIO: 'Аудио',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender-dark)]" />
        <span className="ml-3 text-lg">Загрузка библиотеки...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={loadLibrary}
          className="px-4 py-2 bg-[var(--button-lavender-dark)] text-white rounded-lg hover:opacity-90"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Библиотека пока пуста</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        <div className="absolute -top-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Библиотека материалов</h2>
        <p className="opacity-70 leading-relaxed">
          Полезные книги, статьи, видео и аудиоматериалы для углубления знаний и поддержки на пути к трезвости.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-3 mb-8">
        {categories.map((category) => (
          <button
            key={category || 'all'}
            onClick={() => setSelectedCategory(category || 'all')}
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

      <div className="grid gap-6 md:grid-cols-2">
        {filteredItems.map((item, index) => (
          <div
            key={item.id}
            className="border-2 border-[var(--sky-light)]/50 rounded-2xl p-4 md:p-7 bg-gradient-to-br from-white/80 to-white/40 shadow-[0_4px_16px_var(--book-shadow)] hover:shadow-[0_8px_24px_var(--book-shadow-strong)] transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start gap-3 md:gap-5 mb-4">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/10 rounded-xl flex items-center justify-center text-[var(--icon-lavender)] shadow-inner">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="mb-2 text-base md:text-lg">{item.title}</h4>
                {item.author && (
                  <p className="text-xs md:text-sm opacity-60 italic mb-2">{item.author}</p>
                )}
                <span className="inline-block px-2.5 md:px-3 py-0.5 md:py-1 bg-gradient-to-r from-[var(--book-bg)] to-white/80 text-[10px] md:text-xs rounded-full border border-[var(--sky-light)]/40">
                  {getTypeLabel(item.type)}
                </span>
              </div>
            </div>

            {item.description && (
              <p className="text-xs md:text-sm mb-4 md:mb-5 opacity-80 leading-relaxed">
                {item.description}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                >
                  <span className="relative z-10">Открыть</span>
                  <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </a>
              )}
              {(item.type === 'BOOK' || item.type === 'ARTICLE') && item.url && (
                <button className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]">
                  <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Скачать
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
