import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'lesson' | 'event' | 'community' | 'system';
  link: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, right: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      title: 'Новый урок доступен',
      message: 'Урок 4: "Работа с эмоциями" теперь открыт для изучения',
      time: '5 минут назад',
      isRead: false,
      type: 'lesson',
      link: '/lesson/4',
    },
    {
      id: 2,
      title: 'Предстоящее мероприятие',
      message: 'Групповая встреча "Поддержка и мотивация" начнется через 2 часа',
      time: '1 час назад',
      isRead: false,
      type: 'event',
      link: '/schedule',
    },
    {
      id: 3,
      title: 'Поздравляем!',
      message: 'Вы достигли 7 дней трезвости! Продолжайте в том же духе',
      time: '2 часа назад',
      isRead: false,
      type: 'system',
      link: '/',
    },
    {
      id: 4,
      title: 'Новое сообщение в общине',
      message: 'В вашей общине появилось новое обсуждение',
      time: 'Вчера',
      isRead: true,
      type: 'community',
      link: '/communities',
    },
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'lesson':
        return 'from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/10 border-[var(--button-lavender-light)]/30';
      case 'event':
        return 'from-[var(--sky-light)]/10 to-[var(--sky-blue)]/10 border-[var(--sky-light)]/30';
      case 'community':
        return 'from-[var(--divine-gold)]/10 to-[var(--celestial-gold)]/10 border-[var(--divine-gold)]/30';
      case 'system':
        return 'from-[var(--success-green)]/10 to-[var(--success-green)]/10 border-[var(--success-green)]/30';
      default:
        return 'from-white/50 to-white/30 border-[var(--sky-light)]/30';
    }
  };

  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      navigate(notification.link);
    }, 300);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Расчет позиции меню при открытии
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      
      if (isMobile) {
        // На мобильных - фиксированное позиционирование с отступами
        setMenuPosition({
          top: rect.bottom,
          left: 16,
          right: 16
        });
      } else {
        // На десктопе - выравнивание по правому краю кнопки
        setMenuPosition({
          top: rect.bottom,
          left: 0,
          right: window.innerWidth - rect.right
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Проверяем клик вне контейнера И вне меню в портале
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsClosing(true);
        setTimeout(() => {
          setIsOpen(false);
          setIsClosing(false);
        }, 300);
      }
    };

    // Небольшая задержка, чтобы избежать немедленного закрытия при открытии
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-white/60 border-2 border-[var(--sky-light)]/50 hover:bg-white/80 hover:border-[var(--button-lavender-dark)]/50 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_2px_8px_var(--book-shadow)]"
        aria-label="Уведомления"
      >
        <Bell className="w-5 h-5 text-[var(--icon-lavender)]" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white text-xs rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(139,149,188,0.5)] animate-pulse-subtle">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && createPortal(
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => {
              setIsClosing(true);
              setTimeout(() => {
                setIsOpen(false);
                setIsClosing(false);
              }, 300);
            }}
          ></div>
          
          {/* Notification Panel */}
          <div 
            ref={menuRef}
            className={`fixed w-auto bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-sm rounded-2xl shadow-[0_12px_32px_var(--ethereal-shadow),0_4px_12px_var(--book-shadow)] border-2 border-[var(--sky-light)]/50 z-[9999] overflow-hidden ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            style={{ 
              top: `${menuPosition.top + 8}px`, 
              left: menuPosition.left > 0 ? `${menuPosition.left}px` : 'auto',
              right: menuPosition.right > 0 ? `${menuPosition.right}px` : 'auto',
              maxWidth: window.innerWidth < 768 ? `calc(100vw - 32px)` : '384px'
            }}
          >
            {/* Header */}
            <div className="p-4 border-b-2 border-[var(--sky-light)]/30 bg-gradient-to-r from-[var(--sky-soft)]/30 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg">Уведомления</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-[var(--button-lavender-dark)] hover:text-[var(--button-lavender)] transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Прочитать все
                  </button>
                )}
              </div>
              {unreadCount > 0 && (
                <p className="text-xs opacity-60">
                  {unreadCount} {unreadCount === 1 ? 'новое уведомление' : 'новых уведомлений'}
                </p>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-[var(--icon-lavender)]/30" />
                  <p className="text-sm opacity-60">Нет уведомлений</p>
                </div>
              ) : (
                <div className="p-2">
                  {notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      className={`mb-2 p-3 rounded-xl border-2 transition-all duration-300 hover:shadow-[0_4px_12px_var(--book-shadow)] cursor-pointer ${
                        notification.isRead 
                          ? 'bg-white/40 border-[var(--sky-light)]/20 opacity-70' 
                          : `bg-gradient-to-br ${getNotificationColor(notification.type)} border-2`
                      } animate-slide-up`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm flex-1">{notification.title}</h4>
                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                              title="Отметить как прочитанное"
                            >
                              <Check className="w-3.5 h-3.5 text-[var(--button-lavender-dark)]" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                            title="Удалить"
                          >
                            <X className="w-3.5 h-3.5 text-[var(--icon-lavender)]" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs opacity-80 mb-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-xs opacity-50">
                        {notification.time}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t-2 border-[var(--sky-light)]/30 bg-gradient-to-r from-[var(--sky-soft)]/20 to-transparent">
                <button className="w-full text-xs text-[var(--button-lavender-dark)] hover:text-[var(--button-lavender)] transition-colors text-center">
                  Посмотреть все уведомления
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}