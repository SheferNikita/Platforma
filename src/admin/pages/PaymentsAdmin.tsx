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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Платежи</h1>
          <p className="text-[#3d3527]/60 mt-1">История и управление платежами</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm text-[#3d3527]/60">Общая выручка</p>
              <p className="text-2xl md:text-3xl font-bold text-[#3d3527] truncate">{stats.totalRevenue.toLocaleString()} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm text-[#3d3527]/60">Всего платежей</p>
              <p className="text-2xl md:text-3xl font-bold text-[#3d3527] truncate">{stats.totalPayments}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Filter className="w-5 h-5 text-[#3d3527]/40 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
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
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">Платежи не найдены</div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[#d4c9b0]/30">
              {payments.map((payment) => (
                <div key={payment.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#3d3527] truncate">{payment.student.user.name}</p>
                      <p className="text-sm text-[#3d3527]/60 truncate">{payment.student.user.email}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs flex-shrink-0 ml-2 ${statusLabels[payment.status]?.color || 'bg-gray-100'}`}>
                      {statusLabels[payment.status]?.label || payment.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#3d3527]/60 truncate flex-1">{payment.product.name}</span>
                    <span className="font-bold text-[#3d3527] ml-2">{payment.amount.toLocaleString()} ₽</span>
                  </div>
                  <div className="text-xs text-[#3d3527]/60">
                    {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('ru') : new Date(payment.createdAt).toLocaleDateString('ru')}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-[#f5f3ed]">
                  <tr>
                    <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Клиент</th>
                    <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Продукт</th>
                    <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Сумма</th>
                    <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Статус</th>
                    <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527] hidden xl:table-cell">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                      <td className="px-3 lg:px-6 py-3 lg:py-4">
                        <p className="font-medium text-[#3d3527]">{payment.student.user.name}</p>
                        <p className="text-sm text-[#3d3527]/60">{payment.student.user.email}</p>
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 text-[#3d3527]">{payment.product.name}</td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 font-bold text-[#3d3527]">{payment.amount.toLocaleString()} ₽</td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusLabels[payment.status]?.color || 'bg-gray-100'}`}>
                          {statusLabels[payment.status]?.label || payment.status}
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 text-[#3d3527]/60 hidden xl:table-cell">
                        {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('ru') : new Date(payment.createdAt).toLocaleDateString('ru')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
