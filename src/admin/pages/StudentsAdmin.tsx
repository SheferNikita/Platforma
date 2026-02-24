import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Plus, Search, Edit, Trash2, User, Info, Filter, Lock, Unlock, Calendar, Users2, X, ListChecks, Shuffle, TrendingUp, BarChart3, UserCheck, UserX, Mail, Key, Eye, EyeOff, Download, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

interface StudentsStats {
  total: number;
  active: number;
  inactive: number;
  withoutMiniGroup: number;
  averageProgress: number;
  tariffCounts: Record<string, number>;
  miniGroupStats: { id: string; title: string; memberCount: number }[];
}

interface MiniGroupMembership {
  miniGroup: {
    id: string;
    title: string;
  };
}

interface Student {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  student: {
    id: string;
    phone: string;
    sobrietyDate: string;
    notes: string;
    progress: any[];
    enrollments: any[];
    miniGroups: MiniGroupMembership[];
    tariff?: string;
    assignedPsychologistId?: string;
    assignedPsychologist?: { id: string; name: string; email: string };
    city?: string;
    gender?: string;
    age?: number;
    addictionType?: string;
    isClergy?: boolean;
    surveyCompleted?: boolean;
  };
}

interface MiniGroup {
  id: string;
  title: string;
}

interface ModuleAccess {
  moduleId: string;
  moduleTitle: string;
  hasAccess: boolean;
  isActive: boolean;
  isExpired?: boolean;
  expiresAt: string | null;
  accessId: string | null;
}

const TARIFF_LABELS: Record<string, { label: string; color: string }> = {
  BASIC: { label: 'Базовый', color: 'bg-gray-100 text-gray-700' },
  FAMILY: { label: 'Для родственников', color: 'bg-purple-100 text-purple-700' },
  RELATIVE: { label: 'Родственник', color: 'bg-orange-100 text-orange-700' },
  WITH_MENTOR: { label: 'С наставником', color: 'bg-green-100 text-green-700' },
  WITH_PSYCHOLOGIST: { label: 'С психологом', color: 'bg-pink-100 text-pink-700' },
  INDIVIDUAL_PSYCHOLOGIST: { label: 'Индивид. психолог', color: 'bg-blue-100 text-blue-700' }
};

export function StudentsAdmin() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StudentsStats | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [initialTab, setInitialTab] = useState<'info' | 'access'>('info');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterMiniGroup, setFilterMiniGroup] = useState<string>('');
  const [filterTariff, setFilterTariff] = useState<string>('all');
  const [filterPrepayment, setFilterPrepayment] = useState<string>('all');
  const [filterDistributed, setFilterDistributed] = useState<string>('all');
  const [filterSurvey, setFilterSurvey] = useState<string>('all');
  const [miniGroups, setMiniGroups] = useState<MiniGroup[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<string>('20');
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterMiniGroup, filterTariff, filterPrepayment, filterDistributed, filterSurvey, perPage]);

  useEffect(() => {
    loadStudents();
  }, [debouncedSearch, filterStatus, filterMiniGroup, filterTariff, filterPrepayment, filterDistributed, filterSurvey, currentPage, perPage]);

  useEffect(() => {
    Promise.all([
      loadMiniGroups(),
      loadStats()
    ]);
  }, []);

  async function loadMiniGroups() {
    try {
      const groups = await api.get<MiniGroup[]>('/content/mini-groups');
      setMiniGroups(groups);
    } catch (error) {}
  }

  async function loadStats() {
    try {
      const data = await api.get<StudentsStats>('/students/stats');
      setStats(data);
    } catch (error) {}
  }

  async function loadStudents() {
    const requestId = ++loadRequestRef.current;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(currentPage));
      params.set('limit', perPage);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterMiniGroup) params.set('miniGroup', filterMiniGroup);
      if (filterTariff !== 'all') params.set('tariff', filterTariff);
      if (filterPrepayment !== 'all') params.set('prepayment', filterPrepayment);
      if (filterDistributed !== 'all') params.set('distributed', filterDistributed);
      if (filterSurvey !== 'all') params.set('survey', filterSurvey);

      const { students: data, pagination } = await api.get<{ students: Student[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/students?${params.toString()}`);
      
      if (requestId !== loadRequestRef.current) return;
      setStudents(data);
      setTotalStudents(pagination.total);
      setTotalPages(pagination.pages);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setStudents([]);
      setTotalStudents(0);
      setTotalPages(0);
      toast.error('Ошибка загрузки');
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }

  async function saveStudent(data: any) {
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, data);
        toast.success('Ученик обновлен');
      } else {
        await api.post('/students', data);
        toast.success('Ученик добавлен');
      }
      loadStudents();
      setShowModal(false);
      setEditingStudent(null);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сохранения');
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm('Удалить ученика?')) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success('Ученик удален');
      loadStudents();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  function clearFilters() {
    setFilterStatus('all');
    setFilterMiniGroup('');
    setFilterTariff('all');
    setFilterPrepayment('all');
    setFilterDistributed('all');
    setFilterSurvey('all');
  }

  const hasActiveFilters = filterStatus !== 'all' || filterMiniGroup !== '' || filterTariff !== 'all' || filterPrepayment !== 'all' || filterDistributed !== 'all' || filterSurvey !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Ученики</h1>
          <p className="text-sm md:text-base text-[#3d3527]/60 mt-1">Управление учениками платформы</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${showDashboard ? 'bg-[#a67c52]/10 text-[#a67c52]' : 'bg-white/60 text-[#3d3527]/60 hover:bg-white'} border border-[#d4c9b0]/30`}
            title={showDashboard ? 'Скрыть статистику' : 'Показать статистику'}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              try {
                let token: string | null = null;
                try { token = localStorage.getItem('auth_token'); } catch {}
                const res = await fetch('/api/students/export', {
                  credentials: 'include',
                  headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (!res.ok) throw new Error('Ошибка экспорта');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success('Файл скачан');
              } catch (e) {
                toast.error('Ошибка при экспорте');
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white/60 text-[#3d3527]/70 hover:bg-white border border-[#d4c9b0]/30 rounded-xl transition-colors"
            title="Экспорт в CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Экспорт</span>
          </button>
          <button
            onClick={() => { setEditingStudent(null); setShowModal(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow"
          >
            <Plus className="w-5 h-5" /> <span className="sm:inline">Добавить ученика</span>
          </button>
        </div>
      </div>

      {showDashboard && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-lg flex items-center justify-center">
                  <Users2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#3d3527]">{stats.total}</p>
                  <p className="text-xs text-[#3d3527]/60">Всего учеников</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#3d3527]">{stats.active}</p>
                  <p className="text-xs text-[#3d3527]/60">Активных</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#3d3527]">{stats.averageProgress}%</p>
                  <p className="text-xs text-[#3d3527]/60">Ср. прогресс</p>
                </div>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <UserX className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#3d3527]">{stats.withoutMiniGroup}</p>
                  <p className="text-xs text-[#3d3527]/60">Без группы</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <h3 className="text-sm font-semibold text-[#3d3527] mb-3">Распределение по тарифам</h3>
              <div className="space-y-2">
                {Object.entries(stats.tariffCounts).map(([tariff, count]) => {
                  const info = TARIFF_LABELS[tariff] || { label: tariff, color: 'bg-gray-100 text-gray-700' };
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={tariff} className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-lg text-xs ${info.color} min-w-[120px]`}>{info.label}</span>
                      <div className="flex-1 bg-[#f5f3ed] rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-[#a67c52] to-[#c4a57b] h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-[#3d3527] min-w-[40px] text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <h3 className="text-sm font-semibold text-[#3d3527] mb-3">Мини-группы</h3>
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {stats.miniGroupStats.length === 0 ? (
                  <p className="text-sm text-[#3d3527]/60">Нет мини-групп</p>
                ) : (
                  stats.miniGroupStats.map((group) => {
                    const maxMembers = Math.max(...stats.miniGroupStats.map(g => g.memberCount), 1);
                    const percentage = (group.memberCount / maxMembers) * 100;
                    return (
                      <div key={group.id} className="flex items-center gap-3">
                        <span className="text-sm text-[#3d3527] min-w-[140px] truncate" title={group.title}>{group.title}</span>
                        <div className="flex-1 bg-[#f5f3ed] rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-[#a67c52] to-[#c4a57b] h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-[#3d3527] min-w-[30px] text-right">{group.memberCount}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md rounded-xl md:rounded-2xl border border-[#d4c9b0]/30 p-3 md:p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="w-full pl-12 pr-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-xl transition-colors ${
              hasActiveFilters ? 'border-[#a67c52] bg-[#a67c52]/10 text-[#a67c52]' : 'border-[#d4c9b0] text-[#3d3527]'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="sm:inline">Фильтры</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-[#a67c52] rounded-full"></span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-[#d4c9b0]/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Статус</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="all">Все</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Мини-группа</label>
              <select
                value={filterMiniGroup}
                onChange={(e) => setFilterMiniGroup(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="">Все группы</option>
                {miniGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Тариф</label>
              <select
                value={filterTariff}
                onChange={(e) => setFilterTariff(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="all">Все тарифы</option>
                <option value="BASIC">Базовый</option>
                <option value="FAMILY">Для родственников</option>
                <option value="RELATIVE">Родственник</option>
                <option value="WITH_MENTOR">С наставником</option>
                <option value="WITH_PSYCHOLOGIST">С психологом</option>
                <option value="INDIVIDUAL_PSYCHOLOGIST">Индивид. психолог</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Предоплата</label>
              <select
                value={filterPrepayment}
                onChange={(e) => setFilterPrepayment(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="all">Все</option>
                <option value="yes">С предоплатой</option>
                <option value="no">Без предоплаты</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Распределение</label>
              <select
                value={filterDistributed}
                onChange={(e) => setFilterDistributed(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="all">Все</option>
                <option value="yes">Распределён</option>
                <option value="no">Не распределён</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Анкета заполнена</label>
              <select
                value={filterSurvey}
                onChange={(e) => setFilterSurvey(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="all">Все</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                onClick={clearFilters}
                className="w-full sm:w-auto px-4 py-2 text-[#a67c52] hover:bg-[#a67c52]/10 rounded-xl"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60 bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30">
            Ученики не найдены
          </div>
        ) : (
          students.map((student) => (
            <div key={student.id} className="bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[#3d3527] truncate">{student.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${student.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {student.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                    {student.student?.notes?.includes('[PREPAYMENT]') && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                        Предоплата
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#3d3527]/60 truncate">{student.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-[#3d3527]/50">{student.student?.progress?.length || 0} уроков пройдено</p>
                    {!['BASIC', 'FAMILY', 'RELATIVE'].includes(student.student?.tariff || '') && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${student.student?.surveyCompleted ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        Анкета: {student.student?.surveyCompleted ? 'Да' : 'Нет'}
                      </span>
                    )}
                  </div>
                  {student.student?.miniGroups?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {student.student.miniGroups.map(mg => (
                        <span key={mg.miniGroup.id} className="px-2 py-0.5 bg-[#a67c52]/10 text-[#a67c52] rounded-lg text-xs">
                          {mg.miniGroup.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-[#d4c9b0]/30">
                <button
                  onClick={() => { setInitialTab('info'); setSelectedStudent(student); }}
                  className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  <Info className="w-4 h-4 text-[#3d3527]" />
                </button>
                <button
                  onClick={() => { setInitialTab('access'); setSelectedStudent(student); }}
                  className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  <ListChecks className="w-4 h-4 text-[#3d3527]" />
                </button>
                <button
                  onClick={() => { setEditingStudent(student); setShowModal(true); }}
                  className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  <Edit className="w-4 h-4 text-[#3d3527]" />
                </button>
                <button
                  onClick={() => deleteStudent(student.id)}
                  className="p-2 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-[#f5f3ed]">
            <tr>
              <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Ученик</th>
              <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Тариф</th>
              <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Статус</th>
              <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527] hidden lg:table-cell">Прогресс</th>
              <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527] hidden lg:table-cell">Анкета</th>
              <th className="text-left px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527] hidden xl:table-cell">Мини-группы</th>
              <th className="text-right px-3 lg:px-6 py-3 lg:py-4 text-sm font-semibold text-[#3d3527]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52] mx-auto"></div>
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[#3d3527]/60">Ученики не найдены</td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#3d3527] text-sm lg:text-base truncate">{student.name}</p>
                        <p className="text-xs lg:text-sm text-[#3d3527]/60 truncate">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 lg:py-1 rounded-lg text-xs ${
                        student.student?.tariff === 'BASIC' ? 'bg-gray-100 text-gray-700' :
                        student.student?.tariff === 'FAMILY' ? 'bg-purple-100 text-purple-700' :
                        student.student?.tariff === 'RELATIVE' ? 'bg-orange-100 text-orange-700' :
                        student.student?.tariff === 'WITH_MENTOR' ? 'bg-green-100 text-green-700' :
                        student.student?.tariff === 'WITH_PSYCHOLOGIST' ? 'bg-pink-100 text-pink-700' :
                        student.student?.tariff === 'INDIVIDUAL_PSYCHOLOGIST' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {student.student?.tariff === 'BASIC' ? 'Базовый' :
                         student.student?.tariff === 'FAMILY' ? 'Для родственников' :
                         student.student?.tariff === 'RELATIVE' ? 'Родственник' :
                         student.student?.tariff === 'WITH_MENTOR' ? 'С наставником' :
                         student.student?.tariff === 'WITH_PSYCHOLOGIST' ? 'С психологом' :
                         student.student?.tariff === 'INDIVIDUAL_PSYCHOLOGIST' ? 'Индивид. психолог' :
                         'Не указан'}
                      </span>
                      {student.student?.notes?.includes('[PREPAYMENT]') && (
                        <span className="px-2 py-0.5 lg:py-1 rounded-lg text-xs bg-amber-100 text-amber-700">
                          Предоплата
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <span className={`px-2 py-0.5 lg:py-1 rounded-full text-xs ${student.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {student.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 hidden lg:table-cell">
                    <p className="text-sm text-[#3d3527]">{student.student?.progress?.length || 0} уроков</p>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 hidden lg:table-cell">
                    {['BASIC', 'FAMILY', 'RELATIVE'].includes(student.student?.tariff || '') ? (
                      <span className="text-[#3d3527]/40">—</span>
                    ) : student.student?.surveyCompleted ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Да</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Нет</span>
                    )}
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 hidden xl:table-cell">
                    {student.student?.miniGroups?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {student.student.miniGroups.map(mg => (
                          <span key={mg.miniGroup.id} className="px-2 py-0.5 bg-[#a67c52]/10 text-[#a67c52] rounded-lg text-xs">
                            {mg.miniGroup.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#3d3527]/40">—</span>
                    )}
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <div className="flex justify-end gap-1 lg:gap-2">
                      <button
                        onClick={() => { setInitialTab('info'); setSelectedStudent(student); }}
                        className="p-1.5 lg:p-2 hover:bg-[#f5f3ed] rounded-lg"
                        title="Информация об ученике"
                      >
                        <Info className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => { setInitialTab('access'); setSelectedStudent(student); }}
                        className="p-1.5 lg:p-2 hover:bg-[#f5f3ed] rounded-lg"
                        title="Настройка доступов к модулям"
                      >
                        <ListChecks className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => { setEditingStudent(student); setShowModal(true); }}
                        className="p-1.5 lg:p-2 hover:bg-[#f5f3ed] rounded-lg"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => deleteStudent(student.id)}
                        className="p-1.5 lg:p-2 hover:bg-red-50 rounded-lg"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {!loading && students.length > 0 && (
        <div className="mt-4 bg-white/80 backdrop-blur-md rounded-xl border border-[#d4c9b0]/30 px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[#3d3527]/70">
              <span>Показать по:</span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(e.target.value)}
                className="px-2 py-1 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-[#a67c52] bg-white"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">Все</option>
              </select>
              <span className="ml-2">
                Всего: <span className="font-medium text-[#3d3527]">{totalStudents}</span>
              </span>
            </div>

            {perPage !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg hover:bg-[#f5f3ed] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-[#3d3527]" />
                </button>
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('...');
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    typeof p === 'string' ? (
                      <span key={`dots-${idx}`} className="px-1 text-[#3d3527]/40">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === p
                            ? 'bg-[#a67c52] text-white'
                            : 'hover:bg-[#f5f3ed] text-[#3d3527]'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-[#f5f3ed] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-[#3d3527]" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <StudentModal
          student={editingStudent}
          onSave={saveStudent}
          onClose={() => { setShowModal(false); setEditingStudent(null); }}
        />
      )}

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          initialTab={initialTab}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

const TARIFF_OPTIONS = [
  { value: 'BASIC', label: 'Базовый', description: 'Только просмотр уроков' },
  { value: 'FAMILY', label: 'Для родственников', description: 'Только просмотр уроков' },
  { value: 'RELATIVE', label: 'Родственник участника', description: 'Только просмотр уроков' },
  { value: 'WITH_MENTOR', label: 'С наставником', description: 'Полный доступ + мини-группы' },
  { value: 'WITH_PSYCHOLOGIST', label: 'С психологом', description: 'Полный доступ + мини-группы' },
  { value: 'INDIVIDUAL_PSYCHOLOGIST', label: 'Индивидуально с психологом', description: 'Полный доступ, без мини-групп' },
];

function StudentModal({ student, onSave, onClose }: { student: Student | null; onSave: (data: any) => void; onClose: () => void }) {
  const parseNotes = (rawNotes: string) => {
    const hasPrepayment = rawNotes?.includes('[PREPAYMENT]') || false;
    const cleanNotes = rawNotes?.replace('[PREPAYMENT]', '').trim() || '';
    return { notes: cleanNotes, hasPrepayment };
  };
  
  const parsedNotes = parseNotes(student?.student?.notes || '');
  const [name, setName] = useState(student?.name || '');
  const [email, setEmail] = useState(student?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(student?.student?.phone || '');
  const [notes, setNotes] = useState(parsedNotes.notes);
  const [hasPrepayment, setHasPrepayment] = useState(parsedNotes.hasPrepayment);
  const [sendCredentials, setSendCredentials] = useState(true);
  const [tariff, setTariff] = useState((student?.student as any)?.tariff || 'BASIC');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    return pwd;
  };

  const handleChangePassword = async () => {
    if (!student?.student?.id || newPassword.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }
    setChangingPassword(true);
    try {
      await api.post(`/students/${student.student.id}/password`, { password: newPassword });
      toast.success('Пароль успешно изменен');
      setNewPassword('');
    } catch (error) {
      toast.error('Ошибка при изменении пароля');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendCredentials = async () => {
    if (!student?.student?.id) return;
    setSendingCredentials(true);
    try {
      await api.post(`/students/${student.student.id}/send-credentials`);
      toast.success('Данные для входа отправлены на почту ученика');
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка при отправке данных');
    } finally {
      setSendingCredentials(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#3d3527]">{student ? 'Редактировать ученика' : 'Новый ученик'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Закрыть">
            <X className="w-5 h-5 text-[#3d3527]" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Имя</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!student}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] disabled:bg-gray-100"
            />
          </div>
          {!student && (
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Пароль</label>
              <div className="relative">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-12 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#f5f3ed] rounded-lg transition-colors"
                  title="Сгенерировать пароль"
                >
                  <Shuffle className="w-4 h-4 text-[#a67c52]" />
                </button>
              </div>
            </div>
          )}
          {student && (
            <div className="p-4 bg-[#f5f3ed] rounded-xl space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-[#a67c52]" />
                <span className="font-medium text-[#3d3527]">Безопасность</span>
              </div>
              <div>
                <label className="block text-sm text-[#3d3527]/70 mb-1">Новый пароль</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      className="w-full px-4 py-2 pr-20 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] bg-white"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 hover:bg-[#e8e3d9] rounded-lg transition-colors"
                        title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-[#3d3527]/60" /> : <Eye className="w-4 h-4 text-[#3d3527]/60" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPassword(generatePassword())}
                        className="p-1.5 hover:bg-[#e8e3d9] rounded-lg transition-colors"
                        title="Сгенерировать пароль"
                      >
                        <Shuffle className="w-4 h-4 text-[#a67c52]" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={changingPassword || newPassword.length < 6}
                    className="px-4 py-2 bg-[#a67c52] text-white rounded-xl hover:bg-[#8b6642] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {changingPassword ? '...' : 'Изменить'}
                  </button>
                </div>
              </div>
              <div className="pt-2 border-t border-[#d4c9b0]/50">
                <button
                  type="button"
                  onClick={handleSendCredentials}
                  disabled={sendingCredentials}
                  className="flex items-center gap-2 w-full px-4 py-2.5 bg-white border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="w-4 h-4 text-[#a67c52]" />
                  <span>{sendingCredentials ? 'Отправка...' : 'Напомнить пароль'}</span>
                  <span className="text-xs text-[#3d3527]/60 ml-auto">Отправит новый пароль на почту</span>
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Телефон</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Тариф</label>
            <select
              value={tariff}
              onChange={(e) => setTariff(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            >
              {TARIFF_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-[#3d3527]/60 mt-1">
              {TARIFF_OPTIONS.find(o => o.value === tariff)?.description}
            </p>
          </div>
          <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={hasPrepayment}
              onChange={(e) => setHasPrepayment(e.target.checked)}
              className="w-5 h-5 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
            />
            <div>
              <p className="font-medium text-amber-800">Предоплата</p>
              <p className="text-sm text-amber-600">Ученик внес только предоплату</p>
            </div>
          </label>
          {!student && (
            <label className="flex items-center gap-3 p-3 bg-[#f5f3ed] rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={sendCredentials}
                onChange={(e) => setSendCredentials(e.target.checked)}
                className="w-5 h-5 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
              />
              <div>
                <p className="font-medium text-[#3d3527]">Отправить данные для входа на почту</p>
                <p className="text-sm text-[#3d3527]/60">Ученик получит письмо с логином и паролем</p>
              </div>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => {
              const fullNotes = hasPrepayment ? `[PREPAYMENT] ${notes}`.trim() : notes;
              onSave({ 
                name, email, password, phone, notes: fullNotes, 
                sendCredentials: !student && sendCredentials,
                tariff
              });
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentDetailModal({ student, initialTab, onClose }: { student: Student; initialTab: 'info' | 'access'; onClose: () => void }) {
  const [tab, setTab] = useState<'info' | 'access'>(initialTab);
  const [accessList, setAccessList] = useState<ModuleAccess[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);

  useEffect(() => {
    if (tab === 'access') {
      loadAccess();
    }
  }, [tab]);

  async function loadAccess() {
    setLoadingAccess(true);
    try {
      const data = await api.get<ModuleAccess[]>(`/students/${student.id}/access`);
      setAccessList(data);
    } catch (error) {
      toast.error('Ошибка загрузки доступов');
    } finally {
      setLoadingAccess(false);
    }
  }

  async function toggleAccess(moduleId: string, currentActive: boolean, hasAccess: boolean) {
    try {
      if (!hasAccess) {
        await api.post(`/students/${student.id}/access`, { moduleId, isActive: true });
      } else {
        await api.post(`/students/${student.id}/access`, { moduleId, isActive: !currentActive });
      }
      loadAccess();
      toast.success('Доступ обновлен');
    } catch (error) {
      toast.error('Ошибка обновления доступа');
    }
  }

  async function updateExpiry(moduleId: string, expiresAt: string) {
    try {
      await api.post(`/students/${student.id}/access`, { 
        moduleId, 
        expiresAt: expiresAt || null,
        isActive: true 
      });
      loadAccess();
      toast.success('Срок доступа обновлен');
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  }

  async function removeAccess(moduleId: string) {
    try {
      await api.delete(`/students/${student.id}/access/${moduleId}`);
      loadAccess();
      toast.success('Доступ удален');
    } catch (error) {
      toast.error('Ошибка удаления доступа');
    }
  }

  async function grantAllAccess() {
    try {
      for (const access of accessList.filter(a => !a.isActive)) {
        await api.post(`/students/${student.id}/access`, { moduleId: access.moduleId, isActive: true });
      }
      loadAccess();
      toast.success('Доступ открыт ко всем модулям');
    } catch (error) {
      toast.error('Ошибка');
    }
  }

  async function revokeAllAccess() {
    try {
      for (const access of accessList.filter(a => a.isActive)) {
        await api.post(`/students/${student.id}/access`, { moduleId: access.moduleId, isActive: false });
      }
      loadAccess();
      toast.success('Доступ закрыт ко всем модулям');
    } catch (error) {
      toast.error('Ошибка');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#3d3527]">Профиль ученика</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-[#3d3527]" />
          </button>
        </div>

        <div className="flex gap-2 mb-4 border-b border-[#d4c9b0]/30 pb-4">
          <button
            onClick={() => setTab('info')}
            className={`px-4 py-2 rounded-lg ${tab === 'info' ? 'bg-[#a67c52] text-white' : 'text-[#3d3527] hover:bg-gray-100'}`}
          >
            Информация
          </button>
          <button
            onClick={() => setTab('access')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${tab === 'access' ? 'bg-[#a67c52] text-white' : 'text-[#3d3527] hover:bg-gray-100'}`}
          >
            <Lock className="w-4 h-4" /> Доступы к модулям
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'info' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#3d3527]/60">Имя</p>
                <p className="font-medium text-[#3d3527]">{student.name}</p>
              </div>
              <div>
                <p className="text-sm text-[#3d3527]/60">Email</p>
                <p className="font-medium text-[#3d3527]">{student.email}</p>
              </div>
              <div>
                <p className="text-sm text-[#3d3527]/60">Телефон</p>
                <p className="font-medium text-[#3d3527]">{student.student?.phone || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-[#3d3527]/60">Дата регистрации</p>
                <p className="font-medium text-[#3d3527]">{new Date(student.createdAt).toLocaleDateString('ru')}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-[#3d3527]/60">Мини-группы</p>
                {student.student?.miniGroups?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {student.student.miniGroups.map(mg => (
                      <span key={mg.miniGroup.id} className="px-3 py-1 bg-[#a67c52]/10 text-[#a67c52] rounded-lg text-sm flex items-center gap-1">
                        <Users2 className="w-3 h-3" />
                        {mg.miniGroup.title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-[#3d3527]">—</p>
                )}
              </div>
              {student.student && (
                <div className="col-span-2 p-4 bg-[#f0f4f8] rounded-xl space-y-2 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="w-4 h-4 text-[#5b7a9d]" />
                    <span className="font-medium text-[#3d3527]">Ответы на анкету</span>
                    {student.student.surveyCompleted ? (
                      <span className="ml-auto text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Заполнена</span>
                    ) : (
                      <span className="ml-auto text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Не заполнена</span>
                    )}
                  </div>
                  {student.student.surveyCompleted ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-white/70 rounded-lg">
                        <span className="text-[#3d3527]/60 block text-xs">Город</span>
                        <span className="text-[#3d3527]">{student.student.city || '—'}</span>
                      </div>
                      <div className="p-2 bg-white/70 rounded-lg">
                        <span className="text-[#3d3527]/60 block text-xs">Пол</span>
                        <span className="text-[#3d3527]">
                          {student.student.gender === 'male' ? 'Мужской' : student.student.gender === 'female' ? 'Женский' : student.student.gender || '—'}
                        </span>
                      </div>
                      <div className="p-2 bg-white/70 rounded-lg">
                        <span className="text-[#3d3527]/60 block text-xs">Возраст</span>
                        <span className="text-[#3d3527]">{student.student.age || '—'}</span>
                      </div>
                      <div className="p-2 bg-white/70 rounded-lg">
                        <span className="text-[#3d3527]/60 block text-xs">Духовенство</span>
                        <span className="text-[#3d3527]">{student.student.isClergy ? 'Да' : 'Нет'}</span>
                      </div>
                      <div className="p-2 bg-white/70 rounded-lg sm:col-span-2">
                        <span className="text-[#3d3527]/60 block text-xs">Тип зависимости</span>
                        <span className="text-[#3d3527]">
                          {student.student.addictionType
                            ? student.student.addictionType.split(',').map((t: string) => {
                                const labels: Record<string, string> = {
                                  alcohol: 'Алкогольная',
                                  drugs: 'Наркотическая',
                                  gambling: 'Игровая',
                                  food: 'Пищевая',
                                  codependency: 'Зависимость у родственника',
                                  other: 'Другая'
                                };
                                return labels[t.trim()] || t.trim();
                              }).join(', ')
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#3d3527]/60">Ученик ещё не заполнил анкету</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'access' && (
            <div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={grantAllAccess}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                >
                  <Unlock className="w-4 h-4" /> Открыть все
                </button>
                <button
                  onClick={revokeAllAccess}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  <Lock className="w-4 h-4" /> Закрыть все
                </button>
              </div>

              {loadingAccess ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52]"></div>
                </div>
              ) : accessList.length === 0 ? (
                <p className="text-center py-8 text-[#3d3527]/60">Модули не найдены</p>
              ) : (
                <div className="space-y-3">
                  {accessList.map(access => (
                    <div key={access.moduleId} className="flex items-center gap-4 p-4 bg-[#f5f3ed] rounded-xl">
                      <button
                        onClick={() => toggleAccess(access.moduleId, access.isActive, access.accessId !== null)}
                        className={`p-2 rounded-lg ${
                          access.isExpired ? 'bg-red-100 text-red-500' :
                          access.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {access.isActive && !access.isExpired ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <p className="font-medium text-[#3d3527]">{access.moduleTitle}</p>
                        <p className="text-sm text-[#3d3527]/60">
                          {access.isExpired ? (
                            <span className="text-red-500">Истёк {new Date(access.expiresAt!).toLocaleDateString('ru')}</span>
                          ) : access.isActive ? (
                            access.expiresAt ? (
                              `Доступ до ${new Date(access.expiresAt).toLocaleDateString('ru')}`
                            ) : (
                              'Бессрочный доступ'
                            )
                          ) : (
                            'Нет доступа'
                          )}
                        </p>
                      </div>
                      {(access.isActive || access.isExpired) && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#3d3527]/60" />
                          <input
                            type="date"
                            value={access.expiresAt?.split('T')[0] || ''}
                            onChange={(e) => updateExpiry(access.moduleId, e.target.value)}
                            className="px-3 py-1 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-[#a67c52]"
                          />
                        </div>
                      )}
                      {access.accessId && (
                        <button
                          onClick={() => removeAccess(access.moduleId)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                          title="Удалить запись о доступе"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
