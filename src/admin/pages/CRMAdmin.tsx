import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ClipboardList, Search, Eye, CheckCircle, XCircle, Clock, User, Phone, Mail, ShoppingBag, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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
}

interface Product {
  id: string;
  name: string;
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
  paidDateTo: ''
};

const statusConfig = {
  NEW: { label: 'Новая', color: 'bg-blue-100 text-blue-700', icon: Clock },
  PAID: { label: 'Оплачено', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELLED: { label: 'Отменена', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export function CRMAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadProducts();
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

  async function loadOrders() {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filters.status !== 'all') params.append('status', filters.status);
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
    if (key === 'status') return value !== 'all';
    return value !== '';
  });

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

  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'NEW').length,
    paid: orders.filter(o => o.status === 'PAID').length,
    cancelled: orders.filter(o => o.status === 'CANCELLED').length,
    totalRevenue: orders.filter(o => o.status === 'PAID').reduce((sum, o) => sum + o.amount, 0)
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">CRM</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление заявками</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Всего заявок</p>
          <p className="text-xl md:text-2xl font-bold text-[#3d3527] truncate">{stats.total}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Новые</p>
          <p className="text-xl md:text-2xl font-bold text-blue-600 truncate">{stats.new}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Оплачено</p>
          <p className="text-xl md:text-2xl font-bold text-green-600 truncate">{stats.paid}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Отменено</p>
          <p className="text-xl md:text-2xl font-bold text-red-600 truncate">{stats.cancelled}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-3 md:p-4 col-span-2 sm:col-span-1">
          <p className="text-xs md:text-sm text-[#3d3527]/60">Выручка</p>
          <p className="text-xl md:text-2xl font-bold text-[#a67c52] truncate">{stats.totalRevenue.toLocaleString()} ₽</p>
        </div>
      </div>

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
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">№</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Статус</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Дата заказа</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Дата оплаты</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Контакт</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">E-mail</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Продукт</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Сумма</th>
                    <th className="text-left p-3 text-sm font-medium text-[#3d3527]">Способ оплаты</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const StatusIcon = statusConfig[order.status].icon;
                    return (
                      <tr key={order.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                        <td className="p-3 text-sm text-[#3d3527]">{orders.length - index}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig[order.status].color}`}>
                            {statusConfig[order.status].label}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">
                          {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: ru })}
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">
                          {order.paidAt ? format(new Date(order.paidAt), 'yyyy-MM-dd HH:mm:ss', { locale: ru }) : '—'}
                        </td>
                        <td className="p-3 text-sm text-[#3d3527]">{order.firstName} {order.lastName}</td>
                        <td className="p-3 text-sm text-[#3d3527]">{order.email}</td>
                        <td className="p-3 text-sm text-[#3d3527]">{order.product.name}</td>
                        <td className="p-3 text-sm font-medium text-[#3d3527]">{order.amount.toLocaleString()}</td>
                        <td className="p-3 text-sm text-[#3d3527]">ROBOKASSA</td>
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
