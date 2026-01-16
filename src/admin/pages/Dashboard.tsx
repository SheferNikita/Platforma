import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Users, CreditCard, TrendingUp, BookOpen, Calendar, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardData {
  overview: {
    totalStudents: number;
    activeStudents: number;
    newStudentsThisMonth: number;
    totalPayments: number;
    revenueThisMonth: number;
    avgCompletionRate: number;
  };
  revenueChart: { date: string; total: number }[];
  recentPayments: any[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const result = await api.get<DashboardData>('/metrics/dashboard');
      setData(result);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Всего учеников',
      value: data?.overview.totalStudents || 0,
      icon: Users,
      color: 'from-blue-500 to-blue-600'
    },
    {
      label: 'Активных подписок',
      value: data?.overview.activeStudents || 0,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600'
    },
    {
      label: 'Новых за месяц',
      value: data?.overview.newStudentsThisMonth || 0,
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600'
    },
    {
      label: 'Выручка за месяц',
      value: `${(data?.overview.revenueThisMonth || 0).toLocaleString()} ₽`,
      icon: CreditCard,
      color: 'from-[#a67c52] to-[#c4a57b]'
    },
    {
      label: 'Всего платежей',
      value: data?.overview.totalPayments || 0,
      icon: CreditCard,
      color: 'from-orange-500 to-orange-600'
    },
    {
      label: 'Средний прогресс',
      value: `${data?.overview.avgCompletionRate || 0}%`,
      icon: BookOpen,
      color: 'from-teal-500 to-teal-600'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Дашборд</h1>
        <p className="text-sm md:text-base text-[#3d3527]/60 mt-1">Обзор ключевых метрик платформы</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white/80 backdrop-blur-md rounded-xl md:rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-[#3d3527]/60 truncate">{stat.label}</p>
                <p className="text-xl md:text-3xl font-bold text-[#3d3527] mt-1 md:mt-2 truncate">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                <stat.icon className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-md rounded-xl md:rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6 shadow-sm">
          <h2 className="text-lg md:text-xl font-bold text-[#3d3527] mb-4 md:mb-6">Выручка за 30 дней</h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenueChart || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a67c52" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a67c52" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4c9b0" />
                <XAxis dataKey="date" stroke="#3d3527" fontSize={12} />
                <YAxis stroke="#3d3527" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(255,255,255,0.9)', 
                    border: '1px solid #d4c9b0',
                    borderRadius: '12px'
                  }} 
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#a67c52"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-xl md:rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6 shadow-sm">
          <h2 className="text-lg md:text-xl font-bold text-[#3d3527] mb-4 md:mb-6">Последние платежи</h2>
          <div className="space-y-4">
            {data?.recentPayments?.length === 0 ? (
              <p className="text-[#3d3527]/60 text-center py-8">Пока нет платежей</p>
            ) : (
              data?.recentPayments?.map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-[#f5f3ed]/50 rounded-xl">
                  <div>
                    <p className="font-medium text-[#3d3527]">{payment.student?.user?.name}</p>
                    <p className="text-sm text-[#3d3527]/60">{payment.product?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#3d3527]">{payment.amount?.toLocaleString()} ₽</p>
                    <p className="text-xs text-green-600">Оплачено</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
