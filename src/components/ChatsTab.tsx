import React, { useState, useEffect } from 'react';
import { MessageCircle, Users, Phone, Video, ExternalLink, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface ChatLink {
  id: string;
  name: string;
  description: string;
  platform: string;
  icon: string;
  link: string;
  members: number | null;
  isSchedule: boolean;
}

export function ChatsTab() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatLink[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    try {
      const data = await api.get<ChatLink[]>('/public/chats');
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  }

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'message':
        return <MessageCircle className="w-6 h-6" />;
      case 'group':
        return <Users className="w-6 h-6" />;
      case 'phone':
        return <Phone className="w-6 h-6" />;
      case 'video':
        return <Video className="w-6 h-6" />;
      default:
        return <MessageCircle className="w-6 h-6" />;
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-12 border-b border-[var(--sky-blue)]/20 pb-8">
          <h2 className="text-[#3a3a3a] mb-4">Чаты и группы поддержки</h2>
          <p className="opacity-70 leading-relaxed max-w-3xl">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-12 border-b border-[var(--sky-blue)]/20 pb-8 relative">
        <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-4">Чаты и группы поддержки</h2>
      </div>

      {chats.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>Чаты пока не добавлены</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:gap-7">
          {chats.map((chat, index) => (
            <div
              key={chat.id}
              className="border-2 border-[var(--sky-light)]/40 rounded-2xl p-5 md:p-7 bg-gradient-to-br from-white/90 to-white/50 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] hover:shadow-[0_12px_32px_var(--ethereal-glow),0_4px_16px_var(--book-shadow-medium)] hover:border-[var(--sky-blue)]/40 transition-all duration-300 transform hover:-translate-y-1 animate-slide-up relative overflow-hidden group"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
              
              <div className="flex items-start gap-4 mb-5 relative z-10">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[var(--button-lavender-light)]/10 via-[var(--sky-blue)]/8 to-[var(--button-lavender-dark)]/10 rounded-2xl flex items-center justify-center text-[var(--icon-lavender)] shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)] border border-[var(--sky-light)]/30">
                  {getIcon(chat.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="mb-2 text-lg">{chat.name}</h3>
                  <div className="flex items-center gap-2 text-sm opacity-60 flex-wrap">
                    <span className="font-medium">{chat.platform}</span>
                    {chat.members && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                        <span>{chat.members} участников</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm mb-6 opacity-80 leading-relaxed relative z-10">
                {chat.description}
              </p>

              {chat.isSchedule ? (
                <button
                  onClick={() => navigate('/schedule')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group/btn z-10"
                >
                  <span className="relative z-10 font-medium">Расписание</span>
                  <Calendar className="w-4 h-4 relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                </button>
              ) : (
                <a
                  href={chat.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-xl hover:shadow-[0_8px_20px_rgba(139,149,188,0.45)] transition-all duration-300 text-sm transform hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group/btn z-10"
                >
                  <span className="relative z-10 font-medium">Присоединиться</span>
                  <ExternalLink className="w-4 h-4 relative z-10" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
