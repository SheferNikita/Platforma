import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ClipboardList, Search, Eye, CheckCircle, XCircle, Clock, User, Phone, Mail, ShoppingBag, Filter, X, ChevronDown, ChevronUp, Download, Users, BookOpen, MessageSquare, TrendingUp, Send, History, UserCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

interface StudentData {
  id: string;
  tariff: string;
  status: 'new' | 'active' | 'inactive';
  lastLoginAt: string | null;
  completedLessons: number;
  miniGroup: {
    id: string;
    name: string;
    mentors: { id: string; name: string }[];
  } | null;
}

interface OrderStatusHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  comment: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  amount: number;
  status: 'NEW' | 'PAID' | 'CANCELLED';
  paidAt: string | null;
  createdAt: string;
  robokassaInvId: number | null;
  product: { id: string; name: string };
  productTariff: string | null;
  source: string | null;
  tildaTranId: string | null;
  tildaOrderId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  comment: string | null;
  student: StudentData | null;
}

interface Product {
  id: string;
  name: string;
}

interface Module {
  id: string;
  title: string;
}

interface CRMStats {
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  avgCheck: number;
  tariffDistribution: { tariff: string; count: number }[];
}

interface Filters {
  orderId: string;
  transactionId: string;
  status: string;
  productId: string;
  amountMin: string;
  amountMax: string;
  orderDateFrom: string;
  orderDateTo: string;
  paidDateFrom: string;
  paidDateTo: string;
  source: string;
}

const initialFilters: Filters = {
  orderId: '',
  transactionId: '',
  status: 'all',
  productId: '',
  amountMin: '',
  amountMax: '',
  orderDateFrom: '',
  orderDateTo: '',
  paidDateFrom: '',
  paidDateTo: '',
  source: 'all'
};

const tariffLabels: Record<string, string> = {
  BASIC: 'Базовый',
  FAMILY: 'Семейный',
  RELATIVE: 'Родственник участника',
  WITH_MENTOR: 'С наставником',
  WITH_PSYCHOLOGIST: 'С психологом',
  INDIVIDUAL_PSYCHOLOGIST: 'Индивидуальный'
};

const studentStatusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'Новый', color: 'bg-blue-100 text-blue-700' },
  active: { label: 'Активный', color: 'bg-green-100 text-green-700' },
  inactive: { label: 'Неактивный', color: 'bg-gray-100 text-gray-700' }
};

const CHART_COLORS = ['#a67c52', '#c9a86c', '#d4c9b0', '#8b7355', '#6b5344'];

const statusConfig = {
  NEW: { label: 'Новая', color: 'bg-blue-100 text-blue-700', icon: Clock },
  PAID: { label: 'Оплачено', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELLED: { label: 'Отменена', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export function CRMAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTariff, setBulkTariff] = useState('');
  const [bulkModuleId, setBulkModuleId] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    loadProducts();
    loadModules();
    loadStats();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [search, filters]);

  async function loadProducts() {
    try {
      const data = await api.get<Product[]>('/products');
      setProducts(data);
    } catch (error) {
      console.error('Error loading products');
    }
  }

  async function loadModules() {
    try {
      const data = await api.get<Module[]>('/content/modules');
      setModules(data);
    } catch (error) {
      console.error('Error loading modules');
    }
  }

  async function loadStats() {
    try {
      const data = await api.get<CRMStats>('/public/orders/admin/stats');
      setStats(data);
    } catch (error) {
      console.error('Error loading stats');
    }
  }

  async function loadOrders() {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.source !== 'all') params.append('source', filters.source);
      if (filters.orderId) params.append('orderId', filters.orderId);
      if (filters.transactionId) params.append('transactionId', filters.transactionId);
      if (filters.productId) params.append('productId', filters.productId);
      if (filters.amountMin) params.append('amountMin', filters.amountMin);
      if (filters.amountMax) params.append('amountMax', filters.amountMax);
      if (filters.orderDateFrom) params.append('orderDateFrom', filters.orderDateFrom);
      if (filters.orderDateTo) params.append('orderDateTo', filters.orderDateTo);
      if (filters.paidDateFrom) params.append('paidDateFrom', filters.paidDateFrom);
      if (filters.paidDateTo) params.append('paidDateTo', filters.paidDateTo);

      const data = await api.get<Order[]>(`/public/orders/admin/list?${params.toString()}`);
      setOrders(data);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilters(initialFilters);
    setSearch('');
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'status' || key === 'source') return value !== 'all';
    return value !== '';
  });

  async function exportToCSV() {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/public/orders/admin/export', {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'orders.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Экспорт завершён');
    } catch (error) {
      toast.error('Ошибка экспорта');
    }
  }

  async function bulkUpdateTariff() {
    if (!selectedOrders.length || !bulkTariff) {
      toast.error('Выберите заказы и тариф');
      return;
    }
    try {
      await api.post('/public/orders/admin/bulk/tariff', { orderIds: selectedOrders, tariff: bulkTariff });
      toast.success('Тариф обновлён');
      loadOrders();
      setSelectedOrders([]);
      setBulkTariff('');
      setShowBulkActions(false);
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  }

  async function bulkGrantAccess() {
    if (!selectedOrders.length || !bulkModuleId) {
      toast.error('Выберите заказы и модуль');
      return;
    }
    try {
      await api.post('/public/orders/admin/bulk/module-access', { orderIds: selectedOrders, moduleId: bulkModuleId });
      toast.success('Доступ открыт');
      loadOrders();
      setSelectedOrders([]);
      setBulkModuleId('');
      setShowBulkActions(false);
    } catch (error) {
      toast.error('Ошибка открытия доступа');
    }
  }

  async function bulkSendEmail() {
    if (!selectedOrders.length || !emailSubject || !emailMessage) {
      toast.error('Заполните тему и текст письма');
      return;
    }
    setSendingEmail(true);
    try {
      const result = await api.post<{ sent: number; total: number }>('/public/orders/admin/bulk/send-email', { 
        orderIds: selectedOrders, 
        subject: emailSubject, 
        message: emailMessage 
      });
      toast.success(`Отправлено ${result.sent} из ${result.total} писем`);
      setSelectedOrders([]);
      setEmailSubject('');
      setEmailMessage('');
      setShowEmailModal(false);
      setShowBulkActions(false);
    } catch (error) {
      toast.error('Ошибка отправки');
    } finally {
      setSendingEmail(false);
    }
  }

  async function deleteOrder() {
    if (!orderToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/public/orders/admin/${orderToDelete.id}`);
      toast.success('Заявка удалена');
      setOrderToDelete(null);
      setSelectedOrder(null);
      loadOrders();
      loadStats();
    } catch (error) {
      toast.error('Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  }

  async function bulkDeleteOrders() {
    if (!selectedOrders.length) return;
    setDeleting(true);
    try {
      const result = await api.delete<{ count: number }>('/public/orders/admin/bulk', { ids: selectedOrders });
      toast.success(`Удалено заявок: ${result.count}`);
      setSelectedOrders([]);
      setShowBulkDeleteConfirm(false);
      setShowBulkActions(false);
      loadOrders();
      loadStats();
    } catch (error) {
      toast.error('Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  }

  function selectAllOrders() {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  }

  async function updateStatus(orderId: string, status: string) {
    try {
      await api.put(`/public/orders/admin/${orderId}/status`, { status });
      toast.success('Статус обновлен');
      loadOrders();
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  }

  const localStats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'NEW').length,
    paid: orders.filter(o => o.status === 'PAID').length,
    cancelled: orders.filter(o => o.status === 'CANCELLED').length,
    totalRevenue: orders.filter(o => o.status === 'PAID').reduce((sum, o) => sum + o.amount, 0)
  };

  const chartData = (stats?.tariffDistribution || []).map(t => ({
    name: tariffLabels[t.tariff] || t.tariff,
    value: t.count
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">CRM</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление заявками</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#a67c52] text-white rounded-xl hover:bg-[#8b6844] transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Экспорт CSV</span>
          </button>
          {selectedOrders.length > 0 && (
            <button
              onClick={() => setShowBulkActions(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Users className="w-4 h-4" />
              Действия ({selectedOrders.length})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Всего заявок</p>
          <p className="text-xl md:text-2xl font-bold text-[#3d3527] truncate">{localStats.total}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Новые</p>
          <p className="text-xl md:text-2xl font-bold text-blue-600 truncate">{localStats.new}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Оплачено</p>
          <p className="text-xl md:text-2xl font-bold text-green-600 truncate">{localStats.paid}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Отменено</p>
          <p className="text-xl md:text-2xl font-bold text-red-600 truncate">{localStats.cancelled}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Выручка</p>
          <p className="text-xl md:text-2xl font-bold text-[#a67c52] truncate">{localStats.totalRevenue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Средний чек</p>
          <p className="text-xl md:text-2xl font-bold text-purple-600 truncate">{stats?.avgCheck?.toLocaleString() || 0} ₽</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {chartData.length > 0 && (
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
            <h3 className="text-lg font-semibold text-[#3d3527] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#a67c52]" />
              Распределение по тарифам
            </h3>
            <div className="space-y-3">
              {chartData.map((item, index) => {
                const total = chartData.reduce((sum, i) => sum + i.value, 0);
                const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3d3527] font-medium">{item.name}</span>
                      <span className="text-[#3d3527]/70">{item.value} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-[#f5f3ed] rounded-full h-3">
                      <div 
                        className="h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <h3 className="text-lg font-semibold text-[#3d3527] mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#a67c52]" />
            Статусы заказов
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">{localStats.new}</p>
              <p className="text-xs text-blue-600 mt-1">Новые</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">{localStats.paid}</p>
              <p className="text-xs text-green-600 mt-1">Оплачено</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700">{localStats.cancelled}</p>
              <p className="text-xs text-red-600 mt-1">Отменено</p>
            </div>
          </div>
          {localStats.total > 0 && (
            <div className="mt-4 pt-4 border-t border-[#d4c9b0]/30">
              <div className="flex justify-between text-sm">
                <span className="text-[#3d3527]/70">Конверсия оплат</span>
                <span className="font-bold text-green-600">
                  {((localStats.paid / localStats.total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <h3 className="text-lg font-semibold text-[#3d3527] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#a67c52]" />
            Источники заказов
          </h3>
          <div className="space-y-3">
            {(() => {
              const sources = orders.reduce((acc, order) => {
                let source = 'Вручную';
                if (order.tildaOrderId) source = 'Tilda';
                else if (order.robokassaInvId) source = 'Robokassa';
                acc[source] = (acc[source] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const sourceColors: Record<string, string> = {
                'Tilda': '#6366f1',
                'Robokassa': '#f59e0b',
                'Вручную': '#8b7355'
              };
              const total = Object.values(sources).reduce((a, b) => a + b, 0);
              return Object.entries(sources).map(([name, value]) => (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#3d3527] font-medium">{name}</span>
                    <span className="text-[#3d3527]/70">{value} ({total > 0 ? ((value / total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                  <div className="w-full bg-[#f5f3ed] rounded-full h-3">
                    <div 
                      className="h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${total > 0 ? (value / total) * 100 : 0}%`,
                        backgroundColor: sourceColors[name] || '#a67c52'
                      }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <h3 className="text-lg font-semibold text-[#3d3527] mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#a67c52]" />
            Топ продуктов
          </h3>
          <div className="space-y-2">
            {(() => {
              const productSales = orders.reduce((acc, order) => {
                const name = order.product?.name || 'Без продукта';
                acc[name] = (acc[name] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              return Object.entries(productSales)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count], index) => (
                  <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-[#f5f3ed]/50 hover:bg-[#f5f3ed] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#a67c52] text-white text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm text-[#3d3527] truncate max-w-[180px]" title={name}>{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#a67c52]">{count}</span>
                  </div>
                ));
            })()}
            {orders.length === 0 && (
              <p className="text-sm text-[#3d3527]/60 text-center py-4">Нет данных</p>
            )}
          </div>
        </div>
      </div>

      {showBulkActions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#3d3527]">Массовые действия</h3>
              <button onClick={() => setShowBulkActions(false)} className="text-[#3d3527]/60 hover:text-[#3d3527]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#3d3527]/60">Выбрано заказов: {selectedOrders.length}</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Изменить тариф</label>
                <div className="flex gap-2">
                  <select
                    value={bulkTariff}
                    onChange={(e) => setBulkTariff(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                  >
                    <option value="">Выберите тариф</option>
                    {Object.entries(tariffLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button
                    onClick={bulkUpdateTariff}
                    disabled={!bulkTariff}
                    className="px-4 py-2 bg-[#a67c52] text-white rounded-xl hover:bg-[#8b6844] disabled:opacity-50"
                  >
                    Применить
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Открыть доступ к модулю</label>
                <div className="flex gap-2">
                  <select
                    value={bulkModuleId}
                    onChange={(e) => setBulkModuleId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                  >
                    <option value="">Выберите модуль</option>
                    {modules.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={bulkGrantAccess}
                    disabled={!bulkModuleId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    Открыть
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Отправить email</label>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700"
                >
                  <Send className="w-4 h-4" />
                  Написать письмо
                </button>
              </div>

              <div className="pt-3 border-t border-[#d4c9b0]/30">
                <label className="block text-sm font-medium text-red-600 mb-1">Удалить заявки</label>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить выбранные ({selectedOrders.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-600">Подтверждение удаления</h3>
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="text-[#3d3527]/60 hover:text-[#3d3527]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#3d3527]">
              Вы уверены, что хотите удалить <strong>{selectedOrders.length}</strong> заявок? Это действие нельзя отменить.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed]"
              >
                Отмена
              </button>
              <button
                onClick={bulkDeleteOrders}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#3d3527]">Отправить email</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-[#3d3527]/60 hover:text-[#3d3527]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#3d3527]/60">Получателей: {selectedOrders.length}</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Тема письма</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Тема..."
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Текст письма</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Текст письма..."
                  rows={5}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-2 border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed]"
              >
                Отмена
              </button>
              <button
                onClick={bulkSendEmail}
                disabled={!emailSubject || !emailMessage || sendingEmail}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Отправить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
            <input
              type="text"
              placeholder="Поиск по имени, email, телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition-colors flex-1 sm:flex-none ${
                hasActiveFilters || showFilters 
                  ? 'bg-[#a67c52] text-white border-[#a67c52]' 
                  : 'border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed]'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Фильтры</span>
              {hasActiveFilters && <span className="bg-white text-[#a67c52] text-xs px-1.5 rounded-full">{Object.entries(filters).filter(([k, v]) => k === 'status' ? v !== 'all' : v !== '').length}</span>}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Сбросить</span>
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Номер заказа</label>
                <input
                  type="text"
                  value={filters.orderId}
                  onChange={(e) => setFilters({ ...filters, orderId: e.target.value })}
                  placeholder="ID заказа..."
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">ID транзакции</label>
                <input
                  type="text"
                  value={filters.transactionId}
                  onChange={(e) => setFilters({ ...filters, transactionId: e.target.value })}
                  placeholder="InvId..."
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Статус</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                >
                  <option value="all">Все статусы</option>
                  <option value="NEW">Новая</option>
                  <option value="PAID">Оплачено</option>
                  <option value="CANCELLED">Отменена</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Товар</label>
                <select
                  value={filters.productId}
                  onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                >
                  <option value="">Все товары</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Источник</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                >
                  <option value="all">Все источники</option>
                  <option value="TILDA">Tilda</option>
                  <option value="MANUAL">Вручную</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Сумма от</label>
                <input
                  type="number"
                  value={filters.amountMin}
                  onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                  placeholder="От"
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Сумма до</label>
                <input
                  type="number"
                  value={filters.amountMax}
                  onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                  placeholder="До"
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата заказа от</label>
                <input
                  type="date"
                  value={filters.orderDateFrom}
                  onChange={(e) => setFilters({ ...filters, orderDateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата заказа до</label>
                <input
                  type="date"
                  value={filters.orderDateTo}
                  onChange={(e) => setFilters({ ...filters, orderDateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата оплаты от</label>
                <input
                  type="date"
                  value={filters.paidDateFrom}
                  onChange={(e) => setFilters({ ...filters, paidDateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата оплаты до</label>
                <input
                  type="date"
                  value={filters.paidDateTo}
                  onChange={(e) => setFilters({ ...filters, paidDateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Заявки не найдены</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {orders.map((order, index) => (
                <div key={order.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-[#3d3527]">{order.firstName} {order.lastName}</p>
                      <p className="text-sm text-[#3d3527]/60">{order.email}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig[order.status].color}`}>
                      {statusConfig[order.status].label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#3d3527]/60 truncate flex-1">{order.product.name}</span>
                    <span className="font-bold text-[#3d3527] ml-2">{order.amount.toLocaleString()} ₽</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#3d3527]/60">
                      {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                    >
                      <Eye className="w-4 h-4 text-[#3d3527]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#f5f3ed]">
                  <tr>
                    <th className="p-2 lg:p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={selectAllOrders}
                        className="w-4 h-4 rounded border-[#d4c9b0]"
                      />
                    </th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527]">№</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527]">Статус</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527] hidden lg:table-cell">Источник</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527] hidden xl:table-cell">Дата оплаты</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527]">Контакт</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527]">Продукт</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527]">Сумма</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527] hidden xl:table-cell">Тариф</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527] hidden xl:table-cell">Статус уч.</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527] hidden xl:table-cell">Группа</th>
                    <th className="text-left p-2 lg:p-3 text-sm font-medium text-[#3d3527] hidden xl:table-cell">Уроков</th>
                    <th className="p-2 lg:p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    return (
                      <tr key={order.id} className={`border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50 ${selectedOrders.includes(order.id) ? 'bg-blue-50' : ''}`}>
                        <td className="p-2 lg:p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="w-4 h-4 rounded border-[#d4c9b0]"
                          />
                        </td>
                        <td className="p-2 lg:p-3 text-sm text-[#3d3527]">{orders.length - index}</td>
                        <td className="p-2 lg:p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig[order.status].color}`}>
                            {statusConfig[order.status].label}
                          </span>
                        </td>
                        <td className="p-2 lg:p-3 text-sm hidden lg:table-cell">
                          <span className={`px-2 py-1 rounded text-xs ${order.source === 'TILDA' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                            {order.source === 'TILDA' ? 'Tilda' : 'Вручную'}
                          </span>
                        </td>
                        <td className="p-2 lg:p-3 text-sm text-[#3d3527] hidden xl:table-cell">
                          {order.paidAt ? format(new Date(order.paidAt), 'dd.MM.yy HH:mm', { locale: ru }) : '—'}
                        </td>
                        <td className="p-2 lg:p-3 text-sm">
                          <div className="text-[#3d3527]">{order.firstName} {order.lastName}</div>
                          <div className="text-xs text-[#3d3527]/60">{order.email}</div>
                        </td>
                        <td className="p-2 lg:p-3 text-sm text-[#3d3527] max-w-[150px] truncate">{order.product.name}</td>
                        <td className="p-2 lg:p-3 text-sm font-medium text-[#3d3527]">{order.amount.toLocaleString()} ₽</td>
                        <td className="p-2 lg:p-3 text-sm hidden xl:table-cell">
                          {order.productTariff ? (
                            <span className={`px-2 py-1 rounded text-xs ${
                              order.productTariff === 'BASIC' ? 'bg-gray-100 text-gray-700' :
                              order.productTariff === 'FAMILY' ? 'bg-blue-100 text-blue-700' :
                              order.productTariff === 'WITH_MENTOR' ? 'bg-green-100 text-green-700' :
                              order.productTariff === 'WITH_PSYCHOLOGIST' ? 'bg-purple-100 text-purple-700' :
                              'bg-pink-100 text-pink-700'
                            }`}>
                              {tariffLabels[order.productTariff] || order.productTariff}
                            </span>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-2 lg:p-3 text-sm hidden xl:table-cell">
                          {order.student?.status ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${studentStatusConfig[order.student.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                              <UserCheck className="w-3 h-3" />
                              {studentStatusConfig[order.student.status]?.label || order.student.status}
                            </span>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-2 lg:p-3 text-sm text-[#3d3527] hidden xl:table-cell">
                          {order.student?.miniGroup ? (
                            <div>
                              <div className="font-medium text-xs">{order.student.miniGroup.name}</div>
                              <div className="text-xs text-[#3d3527]/60">
                                {order.student.miniGroup.mentors.map(m => m.name).join(', ') || '—'}
                              </div>
                            </div>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-2 lg:p-3 text-sm text-[#3d3527] hidden xl:table-cell">
                          {order.student ? (
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4 text-[#a67c52]" />
                              {order.student.completedLessons}
                            </div>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-2 lg:p-3">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                            title="Подробнее"
                          >
                            <Eye className="w-4 h-4 text-[#3d3527]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateStatus}
          onDelete={(order) => setOrderToDelete(order)}
        />
      )}

      {orderToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-[#3d3527] mb-4">Удаление заявки</h3>
            <p className="text-[#3d3527]/70 mb-6">
              Вы уверены, что хотите удалить заявку от{' '}
              <span className="font-medium text-[#3d3527]">{orderToDelete.firstName} {orderToDelete.lastName}</span>?
              <br />
              <span className="text-red-600 text-sm">Это действие необратимо.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOrderToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={deleteOrder}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderModal({ order, onClose, onUpdateStatus, onDelete }: {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onDelete: (order: Order) => void;
}) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadHistory() {
    if (history.length > 0) {
      setShowHistory(!showHistory);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await api.get<OrderStatusHistory[]>(`/public/orders/admin/${order.id}/history`);
      setHistory(data);
      setShowHistory(true);
    } catch (error) {
      toast.error('Ошибка загрузки истории');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendEmail() {
    if (!emailSubject || !emailMessage) {
      toast.error('Заполните тему и текст');
      return;
    }
    setSendingEmail(true);
    try {
      await api.post(`/public/orders/admin/${order.id}/send-email`, { subject: emailSubject, message: emailMessage });
      toast.success('Письмо отправлено');
      setShowEmailForm(false);
      setEmailSubject('');
      setEmailMessage('');
    } catch (error) {
      toast.error('Ошибка отправки');
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg my-4 max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <h2 className="text-lg md:text-xl font-bold text-[#3d3527] mb-4 md:mb-6">Детали заявки</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 md:p-4 bg-[#f5f3ed] rounded-xl">
            <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 text-[#a67c52] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[#3d3527] truncate">{order.product.name}</p>
              <p className="text-lg md:text-xl font-bold text-[#a67c52]">{order.amount.toLocaleString()} ₽</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#3d3527]/40 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-[#3d3527]/60">Имя</p>
                <p className="text-[#3d3527] truncate">{order.firstName} {order.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#3d3527]/40 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-[#3d3527]/60">Телефон</p>
                <p className="text-[#3d3527] truncate">{order.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Mail className="w-5 h-5 text-[#3d3527]/40 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#3d3527]/60">Email</p>
                <p className="text-[#3d3527] truncate">{order.email}</p>
              </div>
              <button
                onClick={() => setShowEmailForm(!showEmailForm)}
                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                title="Написать письмо"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showEmailForm && (
            <div className="border border-purple-200 rounded-xl p-3 space-y-2 bg-purple-50/50">
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Тема письма..."
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Текст письма..."
                rows={3}
                className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
              />
              <button
                onClick={sendEmail}
                disabled={sendingEmail || !emailSubject || !emailMessage}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {sendingEmail ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <><Send className="w-4 h-4" />Отправить</>}
              </button>
            </div>
          )}

          {order.student && (
            <div className="border-t border-[#d4c9b0]/30 pt-4">
              <p className="text-sm text-[#3d3527]/60 mb-2">Данные ученика</p>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 rounded text-xs ${studentStatusConfig[order.student.status]?.color || 'bg-gray-100'}`}>
                  {studentStatusConfig[order.student.status]?.label || order.student.status}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-[#a67c52]/10 text-[#a67c52]">
                  {tariffLabels[order.student.tariff] || order.student.tariff}
                </span>
                {order.student.lastLoginAt && (
                  <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                    Вход: {format(new Date(order.student.lastLoginAt), 'dd.MM.yy', { locale: ru })}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[#d4c9b0]/30 pt-4">
            <p className="text-sm text-[#3d3527]/60 mb-2">Текущий статус</p>
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${statusConfig[order.status].color}`}>
              {statusConfig[order.status].label}
            </span>
          </div>

          <div className="border-t border-[#d4c9b0]/30 pt-4">
            <p className="text-sm text-[#3d3527]/60 mb-2">Изменить статус</p>
            <div className="flex flex-wrap gap-2">
              {order.status !== 'PAID' && (
                <button
                  onClick={() => onUpdateStatus(order.id, 'PAID')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 flex-1 sm:flex-none"
                >
                  <CheckCircle className="w-4 h-4" />
                  Оплачено
                </button>
              )}
              {order.status !== 'CANCELLED' && (
                <button
                  onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 flex-1 sm:flex-none"
                >
                  <XCircle className="w-4 h-4" />
                  Отменить
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-[#d4c9b0]/30 pt-4">
            <button
              onClick={loadHistory}
              className="flex items-center gap-2 text-sm text-[#3d3527]/60 hover:text-[#3d3527]"
            >
              <History className="w-4 h-4" />
              {showHistory ? 'Скрыть историю' : 'Показать историю изменений'}
              {loadingHistory && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#a67c52]"></div>}
            </button>
            {showHistory && history.length > 0 && (
              <div className="mt-2 space-y-2">
                {history.map(h => (
                  <div key={h.id} className="text-xs p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span>
                        {h.fromStatus && <span className="text-gray-500">{statusConfig[h.fromStatus as keyof typeof statusConfig]?.label || h.fromStatus}</span>}
                        {h.fromStatus && ' → '}
                        <span className="font-medium">{statusConfig[h.toStatus as keyof typeof statusConfig]?.label || h.toStatus}</span>
                      </span>
                      <span className="text-gray-400">{h.createdAt && format(new Date(h.createdAt), 'dd.MM.yy HH:mm', { locale: ru })}</span>
                    </div>
                    {h.comment && <p className="text-gray-500 mt-1">{h.comment}</p>}
                  </div>
                ))}
              </div>
            )}
            {showHistory && history.length === 0 && (
              <p className="mt-2 text-xs text-gray-400">Нет записей об изменениях</p>
            )}
          </div>

          <div className="text-xs text-[#3d3527]/50 space-y-1 sm:space-y-0">
            <div>Создана: {format(new Date(order.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}</div>
            {order.paidAt && (
              <div>
                Оплачена: {format(new Date(order.paidAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-6 gap-3">
          <button
            onClick={() => onDelete(order)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Удалить</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
