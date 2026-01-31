import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { History, User, Filter, ChevronLeft, ChevronRight, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: any;
  createdAt: string;
  user: AdminUser;
}

interface Stats {
  totalLogs: number;
  todayLogs: number;
  uniqueAdmins: number;
  topActions: { action: string; count: number }[];
}

const actionLabels: Record<string, string> = {
  'create': 'Создание',
  'update': 'Обновление',
  'delete': 'Удаление',
  'login': 'Вход',
  'logout': 'Выход',
  'publish': 'Публикация',
  'unpublish': 'Снятие с публикации',
  'reply': 'Ответ',
  'view': 'Просмотр',
  'send_email': 'Отправка email',
  'add_member': 'Добавление участника',
  'remove_member': 'Удаление участника',
  'grant_access': 'Выдача доступа',
  'revoke_access': 'Отзыв доступа'
};

const entityLabels: Record<string, string> = {
  'lesson': 'Урок',
  'module': 'Модуль',
  'student': 'Ученик',
  'user': 'Пользователь',
  'product': 'Продукт',
  'payment': 'Платеж',
  'mini_group': 'Мини-группа',
  'schedule': 'Расписание',
  'library': 'Библиотека',
  'contact': 'Контакт',
  'community': 'Сообщество',
  'diary': 'Дневник',
  'note': 'Заметка',
  'email': 'Email'
};

const roleLabels: Record<string, string> = {
  'SUPER_ADMIN': 'Супер-админ',
  'ADMIN': 'Администратор',
  'CURATOR': 'Куратор',
  'MENTOR': 'Наставник',
  'PSYCHOLOGIST': 'Психолог',
  'INTERN': 'Помощник',
  'MODERATOR': 'Модератор',
  'CONTENT_MANAGER': 'Контент-менеджер',
  'SUPPORT': 'Поддержка',
  'FINANCE': 'Финансы'
};

export function AuditLogAdmin() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    userId: '',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadStats();
    loadAdmins();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  async function loadLogs() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filters.action) params.append('action', filters.action);
      if (filters.entity) params.append('entity', filters.entity);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const data = await api.get<{ logs: AuditLog[]; pagination: { totalPages: number } }>(`/audit?${params.toString()}`);
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await api.get<Stats>('/audit/stats');
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function loadAdmins() {
    try {
      const data = await api.get<AdminUser[]>('/audit/admins');
      setAdmins(data);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  }

  function resetFilters() {
    setFilters({ action: '', entity: '', userId: '', startDate: '', endDate: '' });
    setPage(1);
  }

  function getActionColor(action: string) {
    if (action.includes('create') || action.includes('add')) return 'bg-green-100 text-green-700';
    if (action.includes('delete') || action.includes('remove')) return 'bg-red-100 text-red-700';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-100 text-blue-700';
    if (action.includes('login') || action.includes('logout')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">История изменений</h1>
          <p className="text-[#3d3527]/60 mt-1 text-sm md:text-base">Все действия администраторов в системе</p>
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl hover:bg-[#f5f3ed] text-sm md:text-base self-start sm:self-auto"
        >
          <Filter className="w-4 md:w-5 h-4 md:h-5" />
          Фильтры
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 md:w-10 h-8 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <History className="w-4 md:w-5 h-4 md:h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-[#3d3527]/60">Всего записей</p>
                <p className="text-lg md:text-2xl font-bold text-[#3d3527]">{stats.totalLogs.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 md:w-10 h-8 md:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 md:w-5 h-4 md:h-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-[#3d3527]/60">Сегодня</p>
                <p className="text-lg md:text-2xl font-bold text-[#3d3527]">{stats.todayLogs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 md:w-10 h-8 md:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-4 md:w-5 h-4 md:h-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-[#3d3527]/60">Админов</p>
                <p className="text-lg md:text-2xl font-bold text-[#3d3527]">{stats.uniqueAdmins}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 md:w-10 h-8 md:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 md:w-5 h-4 md:h-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-[#3d3527]/60">Топ действие</p>
                <p className="text-sm md:text-lg font-bold text-[#3d3527] truncate">
                  {stats.topActions[0]?.action || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-medium text-[#3d3527] mb-1">Действие</label>
              <input
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                placeholder="Поиск"
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-[#3d3527] mb-1">Сущность</label>
              <input
                value={filters.entity}
                onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
                placeholder="Поиск"
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-[#3d3527] mb-1">Администратор</label>
              <select
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg bg-white text-sm"
              >
                <option value="">Все</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name} ({roleLabels[admin.role] || admin.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-[#3d3527] mb-1">С даты</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-[#3d3527] mb-1">По дату</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3 md:mt-4">
            <button
              onClick={resetFilters}
              className="px-3 md:px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-lg text-sm"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Записей не найдено</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {logs.map((log) => (
                <div key={log.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${getActionColor(log.action)}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    <span className="text-xs text-[#3d3527]/60">
                      {format(new Date(log.createdAt), 'd MMM, HH:mm', { locale: ru })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#3d3527] truncate">{log.user.name}</p>
                      <p className="text-xs text-[#3d3527]/60">{roleLabels[log.user.role] || log.user.role}</p>
                    </div>
                  </div>
                  <div className="text-sm text-[#3d3527]">
                    <span>{entityLabels[log.entity] || log.entity}</span>
                    {log.entityId && (
                      <span className="text-[#3d3527]/50 ml-1 text-xs">#{log.entityId.slice(0, 8)}</span>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-xs text-[#3d3527]/60 truncate">
                      {JSON.stringify(log.details).slice(0, 50)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#f5f3ed]">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Дата и время</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Администратор</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Действие</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Сущность</th>
                    <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                      <td className="p-4 text-sm text-[#3d3527]">
                        {format(new Date(log.createdAt), 'd MMM yyyy, HH:mm:ss', { locale: ru })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#3d3527]">{log.user.name}</p>
                            <p className="text-xs text-[#3d3527]/60">{roleLabels[log.user.role] || log.user.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${getActionColor(log.action)}`}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-[#3d3527]">
                        <span>{entityLabels[log.entity] || log.entity}</span>
                        {log.entityId && (
                          <span className="text-[#3d3527]/50 ml-1 text-xs">#{log.entityId.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-[#3d3527]/70 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details).slice(0, 50) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 md:p-4 border-t border-[#d4c9b0]/30">
            <p className="text-xs md:text-sm text-[#3d3527]/60">
              {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 border border-[#d4c9b0] rounded-lg disabled:opacity-50 hover:bg-[#f5f3ed]"
              >
                <ChevronLeft className="w-4 md:w-5 h-4 md:h-5" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 border border-[#d4c9b0] rounded-lg disabled:opacity-50 hover:bg-[#f5f3ed]"
              >
                <ChevronRight className="w-4 md:w-5 h-4 md:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
