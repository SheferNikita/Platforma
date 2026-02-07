import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MessageCircle, Globe, MapPin, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';

interface Contact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  photoUrl: string | null;
  order: number;
  format: string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  city: string | null;
}

const FORMAT_LABELS: Record<string, string> = {
  offline: 'Очно',
  online: 'Онлайн',
  both: 'Очно и Онлайн'
};

const FORMAT_STYLES: Record<string, string> = {
  offline: 'bg-blue-50 text-blue-700 border border-blue-200',
  online: 'bg-green-50 text-green-700 border border-green-200',
  both: 'bg-purple-50 text-purple-700 border border-purple-200'
};

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setLoading(true);
      const data = await api.get<Contact[]>('/public/contacts');
      setContacts(data);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить контакты');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--button-lavender-dark)]" />
        <span className="ml-3 text-lg">Загрузка контактов...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={loadContacts}
          className="px-4 py-2 bg-[var(--button-lavender-dark)] text-white rounded-lg hover:opacity-90"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-20">
        <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Информация будет появляться здесь по мере прохождения курса</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-10 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        <div className="absolute -top-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Полезные контакты</h2>
        <p className="opacity-70 leading-relaxed">
          Проверенные специалисты и клиники, которые помогут вам на пути к трезвости.
        </p>
      </div>

      <div className="space-y-5">
        {contacts.map((contact, index) => (
          <div
            key={contact.id}
            className="border-2 border-[var(--sky-light)]/50 rounded-2xl p-4 md:p-7 bg-gradient-to-br from-white/80 to-white/40 shadow-[0_4px_16px_var(--book-shadow)] hover:shadow-[0_8px_24px_var(--book-shadow-strong)] transition-all duration-300 transform hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex flex-col md:flex-row gap-4 md:gap-7">
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/10 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden">
                  {contact.photoUrl ? (
                    <img src={contact.photoUrl} alt={contact.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 md:w-14 md:h-14 text-[var(--icon-lavender)]" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="mb-3 md:mb-4">
                  <h3 className="mb-1 text-base md:text-lg text-center md:text-left">{contact.name}</h3>
                  {contact.role && (
                    <p className="text-[var(--button-lavender-dark)] text-sm md:text-base text-center md:text-left">{contact.role}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2 justify-center md:justify-start">
                    {contact.format && (
                      <span className={`text-xs px-3 py-1 rounded-full ${FORMAT_STYLES[contact.format] || 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                        {FORMAT_LABELS[contact.format] || contact.format}
                      </span>
                    )}
                    {contact.city && (
                      <span className="text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                        {contact.city}
                      </span>
                    )}
                  </div>
                </div>

                {contact.description && (
                  <div className="mb-4 md:mb-5 p-4 md:p-5 bg-gradient-to-r from-[var(--book-bg)] to-white/80 rounded-xl border border-[var(--sky-light)]/40">
                    <p className="text-xs md:text-sm leading-relaxed opacity-80">
                      {contact.description}
                    </p>
                  </div>
                )}

                {contact.address && (
                  <div className="flex items-start gap-2 mb-3 text-xs md:text-sm opacity-70">
                    <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-[var(--icon-lavender)] flex-shrink-0 mt-0.5" />
                    <span>{contact.address}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3">
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_6px_16px_rgba(139,149,188,0.4)] transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                    >
                      <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10" />
                      <span className="relative z-10">{contact.phone}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    </a>
                  )}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Mail className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      Email
                    </a>
                  )}
                  {contact.telegram && (
                    <a
                      href={`https://t.me/${contact.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      Telegram
                    </a>
                  )}
                  {contact.website && (
                    <a
                      href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 border-2 border-[var(--sky-light)]/50 rounded-xl hover:bg-gradient-to-r hover:from-[var(--book-bg)] hover:to-white transition-all duration-300 text-xs md:text-sm transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Globe className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      Сайт
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
