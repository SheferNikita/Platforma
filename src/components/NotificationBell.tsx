import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  type: string;
  link: string | null;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString('ru-RU');
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, right: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/notifications', {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        if (res.status === 401) {
          setNotifications([]);
          return;
        }
        throw new Error('Failed to fetch notifications');
      }
      const data = await res.json();
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'NEW_LESSON':
      case 'MENTOR_REPLY':
        return 'from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/10 border-[var(--button-lavender-light)]/30';
      case 'NEW_EVENT':
      case 'EVENT_REMINDER_24H':
      case 'EVENT_REMINDER_1H':
      case 'EVENT_CHANGED':
        return 'from-[var(--sky-light)]/10 to-[var(--sky-blue)]/10 border-[var(--sky-light)]/30';
      case 'NEW_LIBRARY_ITEM':
      case 'NEW_COMMUNITY_POST':
        return 'from-[var(--divine-gold)]/10 to-[var(--celestial-gold)]/10 border-[var(--divine-gold)]/30';
      case 'NEW_MODULE_ACCESS':
      case 'SOBRIETY_MILESTONE':
      case 'PROGRESS_ACHIEVEMENT':
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
      if (notification.link) {
        navigate(notification.link);
      }
    }, 300);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      
      if (isMobile) {
        setMenuPosition({
          top: rect.bottom,
          left: 16,
          right: 16
        });
      } else {
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

  const handleOpenChange = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={handleOpenChange}
        className="relative p-2.5 rounded-xl bg-white/60 border-2 border-[var(--sky-light)]/50 hover:bg-white/80 hover:border-[var(--button-lavender-dark)]/50 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_2px_8px_var(--book-shadow)]"
        aria-label="Уведомления"
      >
        <Bell className="w-5 h-5 text-[var(--icon-lavender)]" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white text-xs rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(139,149,188,0.5)] animate-pulse-subtle">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <>
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

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-[var(--icon-lavender)] animate-spin" />
                  <p className="text-sm opacity-60">Загрузка...</p>
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              ) : notifications.length === 0 ? (
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
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t-2 border-[var(--sky-light)]/30 bg-gradient-to-r from-[var(--sky-soft)]/20 to-transparent">
                <button 
                  onClick={() => {
                    setIsClosing(true);
                    setTimeout(() => {
                      setIsOpen(false);
                      setIsClosing(false);
                      navigate('/notifications');
                    }, 300);
                  }}
                  className="w-full text-xs text-[var(--button-lavender-dark)] hover:text-[var(--button-lavender)] transition-colors text-center"
                >
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
