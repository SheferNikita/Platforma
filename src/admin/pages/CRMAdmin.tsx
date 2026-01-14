import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ClipboardList, Search, Eye, CheckCircle, XCircle, Clock, User, Phone, Mail, ShoppingBag } from 'lucide-react';
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
  product: { name: string };
}

const statusConfig = {
  NEW: { label: 'Новая', color: 'bg-blue-100 text-blue-700', icon: Clock },
  PAID: { label: 'Оплачено', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELLED: { label: 'Отменена', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export function CRMAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, search]);

  async function loadOrders() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const data = await api.get<Order[]>(`/public/orders/admin/list?${params.toString()}`);
      setOrders(data);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
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

  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'NEW').length,
    paid: orders.filter(o => o.status === 'PAID').length,
    cancelled: orders.filter(o => o.status === 'CANCELLED').length,
    totalRevenue: orders.filter(o => o.status === 'PAID').reduce((sum, o) => sum + o.amount, 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">CRM</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление заявками</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Всего заявок</p>
          <p className="text-2xl font-bold text-[#3d3527]">{stats.total}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Новые</p>
          <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Оплачено</p>
          <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Отменено</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
          <p className="text-sm text-[#3d3527]/60">Выручка</p>
          <p className="text-2xl font-bold text-[#a67c52]">{stats.totalRevenue.toLocaleString()} ₽</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
          <input
            type="text"
            placeholder="Поиск по имени, email, телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
        >
          <option value="all">Все статусы</option>
          <option value="NEW">Новые</option>
          <option value="PAID">Оплачено</option>
          <option value="CANCELLED">Отменено</option>
        </select>
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
          <table className="w-full">
            <thead className="bg-[#f5f3ed]">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Клиент</th>
                <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Продукт</th>
                <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Сумма</th>
                <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Статус</th>
                <th className="text-left p-4 text-sm font-medium text-[#3d3527]">Дата</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const StatusIcon = statusConfig[order.status].icon;
                return (
                  <tr key={order.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-[#3d3527]">{order.firstName} {order.lastName}</p>
                        <p className="text-sm text-[#3d3527]/60">{order.email}</p>
                      </div>
                    </td>
                    <td className="p-4 text-[#3d3527]">{order.product.name}</td>
                    <td className="p-4 font-medium text-[#3d3527]">{order.amount.toLocaleString()} ₽</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig[order.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[order.status].label}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-[#3d3527]/60">
                      {format(new Date(order.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                    </td>
                    <td className="p-4">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-[#3d3527] mb-6">Детали заявки</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#f5f3ed] rounded-xl">
            <ShoppingBag className="w-10 h-10 text-[#a67c52]" />
            <div>
              <p className="font-medium text-[#3d3527]">{order.product.name}</p>
              <p className="text-xl font-bold text-[#a67c52]">{order.amount.toLocaleString()} ₽</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#3d3527]/40" />
              <div>
                <p className="text-xs text-[#3d3527]/60">Имя</p>
                <p className="text-[#3d3527]">{order.firstName} {order.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#3d3527]/40" />
              <div>
                <p className="text-xs text-[#3d3527]/60">Телефон</p>
                <p className="text-[#3d3527]">{order.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Mail className="w-5 h-5 text-[#3d3527]/40" />
              <div>
                <p className="text-xs text-[#3d3527]/60">Email</p>
                <p className="text-[#3d3527]">{order.email}</p>
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
            <div className="flex gap-2">
              {order.status !== 'PAID' && (
                <button
                  onClick={() => onUpdateStatus(order.id, 'PAID')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200"
                >
                  <CheckCircle className="w-4 h-4" />
                  Оплачено
                </button>
              )}
              {order.status !== 'CANCELLED' && (
                <button
                  onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200"
                >
                  <XCircle className="w-4 h-4" />
                  Отменить
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-[#3d3527]/50">
            Создана: {format(new Date(order.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
            {order.paidAt && (
              <span className="ml-4">
                Оплачена: {format(new Date(order.paidAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
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
