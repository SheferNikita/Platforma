import { useState, useEffect } from 'react';
import { History, Filter, RotateCcw, ChevronLeft, ChevronRight, User, Calendar, X } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, any> | null;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

interface Meta {
  entityTypes: Record<string, string>;
  actions: Record<string, string>;
}

export function AuditLogAdmin() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<Meta>({ entityTypes: {}, actions: {} });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    entityType: '',
    action: ''
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filters.entityType, filters.action]);

  async function loadMeta() {
    try {
      const data = await api.get<Meta>('/admin/audit-logs/meta');
      setMeta(data);
    } catch (error) {
      console.error('Load meta error:', error);
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((page - 1) * limit)
      });
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.action) params.append('action', filters.action);
      
      const result = await api.get<{ logs: AuditLogEntry[]; total: number }>(`/admin/audit-logs?${params}`);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      toast.error('Ошибка загрузки журнала');
    } finally {
      setLoading(false);
    }
  }

  async function rollback(id: string) {
    setRolling(id);
    try {
      await api.post(`/admin/audit-logs/rollback/${id}`, {});
      toast.success('Изменение отменено');
      loadLogs();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отката');
    } finally {
      setRolling(null);
    }
  }

  function formatValue(value: any): string {
    if (value === null || value === undefined) return '(пусто)';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'string') {
      if (value.startsWith('data:')) return '(файл)';
      if (value.length > 100) return value.slice(0, 100) + '...';
    }
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 100) + '...';
    return String(value);
  }

  function getActionBadge(action: string) {
    const colors: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700'
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <History className="w-8 h-8 text-[var(--button-lavender-dark)]" />
          <div>
            <h1 className="text-2xl font-bold text-[#3d3527]">Журнал действий</h1>
            <p className="text-sm text-[#3d3527]/60">Все изменения на платформе</p>
          </div>
        </div>
      </div>

      <div className="bg-white/60 rounded-xl p-4 border border-[#e8e4da]">
        <div className="flex flex-wrap gap-4 items-center">
          <Filter className="w-5 h-5 text-[#3d3527]/60" />
          
          <select
            value={filters.entityType}
            onChange={(e) => { setFilters(f => ({ ...f, entityType: e.target.value })); setPage(1); }}
            className="px-4 py-2 rounded-xl border border-[#e8e4da] bg-white/80 focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/50"
          >
            <option value="">Все типы</option>
            {Object.entries(meta.entityTypes).map(([key, label]) => (
              <option key={key} value={key}>{String(label)}</option>
            ))}
          </select>
          
          <select
            value={filters.action}
            onChange={(e) => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}
            className="px-4 py-2 rounded-xl border border-[#e8e4da] bg-white/80 focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/50"
          >
            <option value="">Все действия</option>
            {Object.entries(meta.actions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          
          <button
            onClick={() => { setFilters({ entityType: '', action: '' }); setPage(1); }}
            className="px-4 py-2 text-[#3d3527]/60 hover:text-[#3d3527] transition-colors flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Сбросить
          </button>
          
          <span className="text-sm text-[#3d3527]/60 ml-auto">
            Всего: {total}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--button-lavender)]"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white/60 rounded-xl p-8 border border-[#e8e4da] text-center">
          <History className="w-12 h-12 text-[#3d3527]/30 mx-auto mb-4" />
          <p className="text-[#3d3527]/60">Журнал пуст</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div
              key={log.id}
              className="bg-white/60 rounded-xl border border-[#e8e4da] overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-white/80 transition-colors"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadge(log.action)}`}>
                        {meta.actions[log.action] || log.action}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                        {meta.entityTypes[log.entity] || log.entity}
                      </span>
                    </div>
                    
                    <p className="font-medium text-[#3d3527] truncate">
                      {log.details?.title || log.entityId || 'Без названия'}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[#3d3527]/60">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {log.userName || log.userEmail || 'Система'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(log.createdAt).toLocaleString('ru')}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); rollback(log.id); }}
                    disabled={rolling === log.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[var(--button-lavender)]/20 text-[var(--button-lavender-dark)] rounded-lg text-sm hover:bg-[var(--button-lavender)]/30 transition-colors disabled:opacity-50 self-start"
                  >
                    <RotateCcw className={`w-4 h-4 ${rolling === log.id ? 'animate-spin' : ''}`} />
                    Отменить
                  </button>
                </div>
              </div>
              
              {expandedId === log.id && (log.oldData || log.newData || log.details) && (
                <div className="border-t border-[#e8e4da] p-4 bg-[#faf8f5]">
                  {log.action === 'CREATE' && log.newData && (
                    <div>
                      <h4 className="text-sm font-medium text-[#3d3527] mb-2">Созданные данные:</h4>
                      <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(log.newData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.action === 'DELETE' && log.oldData && (
                    <div>
                      <h4 className="text-sm font-medium text-[#3d3527] mb-2">Удалённые данные:</h4>
                      <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(log.oldData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.action === 'UPDATE' && log.oldData && (
                    <div>
                      <h4 className="text-sm font-medium text-[#3d3527] mb-2">Данные до изменения:</h4>
                      <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(log.oldData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.details && !log.oldData && !log.newData && (
                    <div>
                      <h4 className="text-sm font-medium text-[#3d3527] mb-2">Детали:</h4>
                      <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-[#e8e4da] hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="px-4 py-2 text-sm text-[#3d3527]">
            {page} из {totalPages}
          </span>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-[#e8e4da] hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
