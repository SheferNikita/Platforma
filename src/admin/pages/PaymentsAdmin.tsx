import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { CreditCard, Filter, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string;
  createdAt: string;
  student: { user: { name: string; email: string } };
  product: { name: string };
}

export function PaymentsAdmin() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, totalPayments: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadPayments();
  }, [statusFilter]);

  async function loadPayments() {
    try {
      const data = await api.get<{ payments: Payment[]; stats: any }>(`/payments?status=${statusFilter}`);
      setPayments(data.payments);
      setStats(data.stats);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700' },
    COMPLETED: { label: 'Оплачен', color: 'bg-green-100 text-green-700' },
    FAILED: { label: 'Ошибка', color: 'bg-red-100 text-red-700' },
    REFUNDED: { label: 'Возврат', color: 'bg-gray-100 text-gray-700' }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Платежи</h1>
          <p className="text-[#3d3527]/60 mt-1">История и управление платежами</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-[#3d3527]/60">Общая выручка</p>
              <p className="text-3xl font-bold text-[#3d3527]">{stats.totalRevenue.toLocaleString()} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-[#3d3527]/60">Всего платежей</p>
              <p className="text-3xl font-bold text-[#3d3527]">{stats.totalPayments}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-[#3d3527]/40" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
          >
            <option value="">Все статусы</option>
            <option value="COMPLETED">Оплачен</option>
            <option value="PENDING">Ожидает</option>
            <option value="FAILED">Ошибка</option>
            <option value="REFUNDED">Возврат</option>
          </select>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#f5f3ed]">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Клиент</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Продукт</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Сумма</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Статус</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Дата</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52] mx-auto"></div>
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#3d3527]/60">Платежи не найдены</td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-[#3d3527]">{payment.student.user.name}</p>
                    <p className="text-sm text-[#3d3527]/60">{payment.student.user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-[#3d3527]">{payment.product.name}</td>
                  <td className="px-6 py-4 font-bold text-[#3d3527]">{payment.amount.toLocaleString()} ₽</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusLabels[payment.status]?.color || 'bg-gray-100'}`}>
                      {statusLabels[payment.status]?.label || payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#3d3527]/60">
                    {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('ru') : new Date(payment.createdAt).toLocaleDateString('ru')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
