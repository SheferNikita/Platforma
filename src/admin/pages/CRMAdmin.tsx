import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ClipboardList, Search, Eye, CheckCircle, XCircle, Clock, User, Phone, Mail, ShoppingBag, Filter, X, ChevronDown, ChevronUp, Download, Users, BookOpen, MessageSquare, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface StudentData {
  id: string;
  tariff: string;
  lastLoginAt: string | null;
  completedLessons: number;
  miniGroup: {
    id: string;
    name: string;
    mentors: { id: string; name: string }[];
  } | null;
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
  WITH_MENTOR: 'С наставником',
  WITH_PSYCHOLOGIST: 'С психологом',
  INDIVIDUAL_PSYCHOLOGIST: 'Индивидуальный'
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
      const response = await api.get('/public/orders/admin/export', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
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

  const chartData = stats?.tariffDistribution.map(t => ({
    name: tariffLabels[t.tariff] || t.tariff,
    value: t.count
  })) || [];

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

      {chartData.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <h3 className="text-lg font-semibold text-[#3d3527] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#a67c52]" />
            Распределение по тарифам
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2">
              {chartData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="text-[#3d3527]">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <table className="w-full">
                <thead className="bg-[#f5f3ed]">
                  <tr>
                    <th className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={selectAllOrders}
                        className="w-4 h-4 rounded border-[#d4c9b0]"
                      />
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">№</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Статус</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Источник</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Дата оплаты</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Контакт</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Продукт</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Сумма</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Тариф</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Группа</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Уроков</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    return (
                      <tr key={order.id} className={`border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50 ${selectedOrders.includes(order.id) ? 'bg-blue-50' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="w-4 h-4 rounded border-[#d4c9b0]"
                          />
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">{orders.length - index}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig[order.status].color}`}>
                            {statusConfig[order.status].label}
                          </span>
                        </td>
                        <td className="p-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${order.source === 'TILDA' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                            {order.source === 'TILDA' ? 'Tilda' : 'Вручную'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">
                          {order.paidAt ? format(new Date(order.paidAt), 'dd.MM.yy HH:mm', { locale: ru }) : '—'}
                        </td>
                        <td className="p-3 text-sm">
                          <div className="text-[#3d3527]">{order.firstName} {order.lastName}</div>
                          <div className="text-xs text-[#3d3527]/60">{order.email}</div>
                        </td>
                        <td className="p-3 text-sm text-[#3d3527] max-w-[150px] truncate">{order.product.name}</td>
                        <td className="p-3 text-sm font-medium text-[#3d3527]">{order.amount.toLocaleString()} ₽</td>
                        <td className="p-3 text-sm">
                          {order.student ? (
                            <span className={`px-2 py-1 rounded text-xs ${
                              order.student.tariff === 'BASIC' ? 'bg-gray-100 text-gray-700' :
                              order.student.tariff === 'FAMILY' ? 'bg-blue-100 text-blue-700' :
                              order.student.tariff === 'WITH_MENTOR' ? 'bg-green-100 text-green-700' :
                              order.student.tariff === 'WITH_PSYCHOLOGIST' ? 'bg-purple-100 text-purple-700' :
                              'bg-pink-100 text-pink-700'
                            }`}>
                              {tariffLabels[order.student.tariff] || order.student.tariff}
                            </span>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">
                          {order.student?.miniGroup ? (
                            <div>
                              <div className="font-medium text-xs">{order.student.miniGroup.name}</div>
                              <div className="text-xs text-[#3d3527]/60">
                                {order.student.miniGroup.mentors.map(m => m.name).join(', ') || '—'}
                              </div>
                            </div>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">
                          {order.student ? (
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4 text-[#a67c52]" />
                              {order.student.completedLessons}
                            </div>
                          ) : <span className="text-[#3d3527]/40">—</span>}
                        </td>
                        <td className="p-3">
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
        />
      )}
    </div>
  );
}

function OrderModal({ order, onClose, onUpdateStatus }: {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
}) {
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
              <div className="min-w-0">
                <p className="text-xs text-[#3d3527]/60">Email</p>
                <p className="text-[#3d3527] truncate">{order.email}</p>
              </div>
            </div>
          </div>

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

          <div className="text-xs text-[#3d3527]/50 space-y-1 sm:space-y-0">
            <div>Создана: {format(new Date(order.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}</div>
            {order.paidAt && (
              <div>
                Оплачена: {format(new Date(order.paidAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl w-full sm:w-auto"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
