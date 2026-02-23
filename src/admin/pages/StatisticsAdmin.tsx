import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  BarChart3,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  BookOpen,
  FileText,
  ClipboardCheck,
  Users,
  X,
  Filter,
  ArrowUpDown
} from 'lucide-react';

interface MentorBreakdownItem {
  mentorId: string;
  mentorName: string;
  count: number;
}

interface StudentStat {
  id: string;
  userId: string;
  name: string;
  email: string;
  tariff: string;
  groups: { id: string; title: string }[];
  lessonsCompleted: number;
  diariesSubmitted: number;
  pendingReview: number;
  checkedByMentor: number;
  mentorBreakdown: MentorBreakdownItem[];
}

interface TariffStat {
  tariff: string;
  label: string;
  studentCount: number;
  totalLessons: number;
  avgCompleted: number;
  percentage: number;
}

interface GroupOption {
  id: string;
  title: string;
}

interface StatisticsResponse {
  students: StudentStat[];
  tariffStats: TariffStat[];
  groups: GroupOption[];
  role: 'admin' | 'mentor';
}

type SortField = 'name' | 'lessonsCompleted' | 'diariesSubmitted' | 'pendingReview' | 'checkedByMentor' | 'tariff' | 'group';
type SortDir = 'asc' | 'desc';

const tariffLabels: Record<string, string> = {
  BASIC: 'Базовый',
  FAMILY: 'Семейный',
  RELATIVE: 'Родственник',
  WITH_MENTOR: 'С наставником',
  WITH_PSYCHOLOGIST: 'С психологом',
  INDIVIDUAL_PSYCHOLOGIST: 'Индив. психолог'
};

const tariffColors: Record<string, string> = {
  BASIC: 'bg-gray-100 text-gray-700',
  FAMILY: 'bg-blue-50 text-blue-700',
  RELATIVE: 'bg-purple-50 text-purple-700',
  WITH_MENTOR: 'bg-green-50 text-green-700',
  WITH_PSYCHOLOGIST: 'bg-amber-50 text-amber-700',
  INDIVIDUAL_PSYCHOLOGIST: 'bg-rose-50 text-rose-700'
};

export function StatisticsAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchApplied) params.append('search', searchApplied);
      if (groupFilter) params.append('miniGroupId', groupFilter);
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(`/api/public/statistics?${params.toString()}`, {
        credentials: 'include',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Ошибка загрузки');
      const result = await response.json() as StatisticsResponse;
      setData(result);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [searchApplied, groupFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchApplied(value.trim());
    }, 500);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const sortedStudents = useMemo(() => {
    if (!data) return [];
    const list = [...data.students];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'ru');
          break;
        case 'lessonsCompleted':
          cmp = a.lessonsCompleted - b.lessonsCompleted;
          break;
        case 'diariesSubmitted':
          cmp = a.diariesSubmitted - b.diariesSubmitted;
          break;
        case 'pendingReview':
          cmp = a.pendingReview - b.pendingReview;
          break;
        case 'checkedByMentor':
          cmp = a.checkedByMentor - b.checkedByMentor;
          break;
        case 'tariff':
          cmp = (tariffLabels[a.tariff] || a.tariff).localeCompare(tariffLabels[b.tariff] || b.tariff, 'ru');
          break;
        case 'group':
          const ag = a.groups.map(g => g.title).join(', ') || 'Без группы';
          const bg = b.groups.map(g => g.title).join(', ') || 'Без группы';
          cmp = ag.localeCompare(bg, 'ru');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, sortField, sortDir]);

  const goToModeration = useCallback((email: string) => {
    navigate(`/admin/moderation?email=${encodeURIComponent(email)}`);
  }, [navigate]);

  const exportToExcel = useCallback(() => {
    if (!data || data.students.length === 0) return;
    const isAdmin = data.role === 'admin';
    const BOM = '\uFEFF';
    const separator = '\t';

    const headers = isAdmin
      ? ['Имя', 'Email', 'Тариф', 'Группа', 'Уроков пройдено', 'Дневников сдано', 'Заданий на проверку', 'Проверено наставником', 'Разбивка по наставникам']
      : ['Имя', 'Email', 'Уроков пройдено', 'Дневников сдано', 'Заданий на проверку'];

    const rows = sortedStudents.map(s => {
      const base = [
        s.name,
        s.email,
      ];
      if (isAdmin) {
        const mentorDetail = s.mentorBreakdown.map(m => `${m.mentorName}: ${m.count}`).join('; ') || '-';
        return [
          ...base,
          tariffLabels[s.tariff] || s.tariff,
          s.groups.map(g => g.title).join(', ') || 'Без группы',
          String(s.lessonsCompleted),
          String(s.diariesSubmitted),
          String(s.pendingReview),
          String(s.checkedByMentor),
          mentorDetail
        ];
      }
      return [
        ...base,
        String(s.lessonsCompleted),
        String(s.diariesSubmitted),
        String(s.pendingReview)
      ];
    });

    const content = BOM + [headers, ...rows].map(row => row.join(separator)).join('\n');
    const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statistics_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, sortedStudents]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-[#a67c52]" />
      : <ChevronDown className="w-3 h-3 text-[#a67c52]" />;
  };

  const isAdmin = data?.role === 'admin';

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#a67c52]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-[#3d3527] flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#a67c52]" />
          Статистика
        </h1>
        <button
          onClick={exportToExcel}
          disabled={!data || data.students.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#8b6542] text-white rounded-xl hover:shadow-lg transition-all text-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Экспорт в Excel
        </button>
      </div>

      {isAdmin && data!.tariffStats.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-[#d4c9b0]/30 shadow-sm">
          <h2 className="text-base md:text-lg font-semibold text-[#3d3527] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#a67c52]" />
            Процент просмотренных лекций по тарифам
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data!.tariffStats.map(ts => (
              <div key={ts.tariff} className="bg-gradient-to-br from-[#faf8f4] to-[#f0ede3] rounded-xl p-4 border border-[#d4c9b0]/20">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tariffColors[ts.tariff] || 'bg-gray-100'}`}>
                    {ts.label}
                  </span>
                  <span className="text-xs text-[#3d3527]/50">{ts.studentCount} уч.</span>
                </div>
                <div className="text-2xl font-bold text-[#3d3527] mb-1">{ts.percentage}%</div>
                <div className="w-full bg-[#d4c9b0]/30 rounded-full h-2 mb-1">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${ts.percentage}%`,
                      background: 'linear-gradient(90deg, #a67c52, #c49a6c)'
                    }}
                  />
                </div>
                <div className="text-xs text-[#3d3527]/50">
                  В среднем {ts.avgCompleted} из {ts.totalLessons} уроков
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-[#d4c9b0]/30 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d3527]/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="pl-9 pr-8 py-2 w-full border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSearchApplied(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#f5f3ed] rounded-full"
              >
                <X className="w-3 h-3 text-[#3d3527]/50" />
              </button>
            )}
          </div>

          {isAdmin && data!.groups.length > 0 && (
            <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d3527]/40" />
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="pl-9 pr-8 py-2 w-full sm:w-auto border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm bg-white appearance-none cursor-pointer min-w-[180px]"
              >
                <option value="">Все группы</option>
                {data!.groups.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          )}

          <div className="text-sm text-[#3d3527]/50 ml-auto">
            <Users className="w-4 h-4 inline mr-1" />
            {sortedStudents.length} уч.
          </div>
        </div>

        {sortedStudents.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{searchApplied || groupFilter ? 'Ничего не найдено' : 'Нет учеников'}</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {sortedStudents.map(student => (
                <div key={student.id} className="bg-gradient-to-br from-[#faf8f4] to-[#f0ede3] rounded-xl p-4 border border-[#d4c9b0]/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-[#3d3527] text-sm truncate flex-1">{student.name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${tariffColors[student.tariff] || 'bg-gray-100'}`}>
                      {tariffLabels[student.tariff] || student.tariff}
                    </span>
                  </div>
                  <div className="text-xs text-[#3d3527]/50 mb-3">{student.email}</div>

                  {isAdmin && student.groups.length > 0 && (
                    <div className="text-xs text-[#3d3527]/60 mb-3">
                      {student.groups.map(g => g.title).join(', ')}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-center bg-white/60 rounded-lg p-2">
                      <BookOpen className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                      <div className="text-lg font-bold text-[#3d3527]">{student.lessonsCompleted}</div>
                      <div className="text-[10px] text-[#3d3527]/50">Уроков</div>
                    </div>
                    <div className="text-center bg-white/60 rounded-lg p-2">
                      <FileText className="w-4 h-4 mx-auto mb-1 text-green-500" />
                      <div className="text-lg font-bold text-[#3d3527]">{student.diariesSubmitted}</div>
                      <div className="text-[10px] text-[#3d3527]/50">Дневников</div>
                    </div>
                    <div
                      className="text-center bg-white/60 rounded-lg p-2 cursor-pointer hover:bg-amber-50 transition-colors"
                      onClick={() => goToModeration(student.email)}
                    >
                      <ClipboardCheck className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                      <div className="text-lg font-bold text-amber-600">{student.pendingReview}</div>
                      <div className="text-[10px] text-[#3d3527]/50">На проверку</div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="mt-2">
                      <div
                        className="flex items-center justify-between text-xs text-[#3d3527]/70 cursor-pointer hover:text-[#a67c52]"
                        onClick={() => setExpandedMentor(expandedMentor === student.id ? null : student.id)}
                      >
                        <span>Проверено: <strong>{student.checkedByMentor}</strong></span>
                        {student.mentorBreakdown.length > 0 && (
                          expandedMentor === student.id
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                      {expandedMentor === student.id && student.mentorBreakdown.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {student.mentorBreakdown.map(m => (
                            <div key={m.mentorId} className="flex justify-between text-xs text-[#3d3527]/60 pl-2">
                              <span>{m.mentorName}</span>
                              <span className="font-medium">{m.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#3d3527]/60 text-xs uppercase border-b border-[#d4c9b0]/30">
                    <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Имя <SortIcon field="name" /></div>
                    </th>
                    {isAdmin && (
                      <>
                        <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none" onClick={() => handleSort('tariff')}>
                          <div className="flex items-center gap-1">Тариф <SortIcon field="tariff" /></div>
                        </th>
                        <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none" onClick={() => handleSort('group')}>
                          <div className="flex items-center gap-1">Группа <SortIcon field="group" /></div>
                        </th>
                      </>
                    )}
                    <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none text-center" onClick={() => handleSort('lessonsCompleted')}>
                      <div className="flex items-center justify-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Уроки <SortIcon field="lessonsCompleted" />
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none text-center" onClick={() => handleSort('diariesSubmitted')}>
                      <div className="flex items-center justify-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Дневники <SortIcon field="diariesSubmitted" />
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none text-center" onClick={() => handleSort('pendingReview')}>
                      <div className="flex items-center justify-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5" /> На проверку <SortIcon field="pendingReview" />
                      </div>
                    </th>
                    {isAdmin && (
                      <th className="p-3 cursor-pointer hover:text-[#a67c52] select-none text-center" onClick={() => handleSort('checkedByMentor')}>
                        <div className="flex items-center justify-center gap-1">Проверено <SortIcon field="checkedByMentor" /></div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map(student => (
                    <tr key={student.id} className="border-t border-[#d4c9b0]/20 hover:bg-[#f5f3ed]/50">
                      <td className="p-3">
                        <div className="font-medium text-[#3d3527]">{student.name}</div>
                        <div className="text-xs text-[#3d3527]/50">{student.email}</div>
                      </td>
                      {isAdmin && (
                        <>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tariffColors[student.tariff] || 'bg-gray-100'}`}>
                              {tariffLabels[student.tariff] || student.tariff}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-[#3d3527]/70">
                            {student.groups.length > 0
                              ? student.groups.map(g => g.title).join(', ')
                              : <span className="text-[#3d3527]/30">—</span>
                            }
                          </td>
                        </>
                      )}
                      <td className="p-3 text-center font-medium text-[#3d3527]">{student.lessonsCompleted}</td>
                      <td className="p-3 text-center font-medium text-[#3d3527]">{student.diariesSubmitted}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => goToModeration(student.email)}
                          className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg font-medium transition-colors ${
                            student.pendingReview > 0
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer'
                              : 'text-[#3d3527]/40'
                          }`}
                          title="Перейти в обратную связь"
                        >
                          {student.pendingReview}
                        </button>
                      </td>
                      {isAdmin && (
                        <td className="p-3 text-center">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setExpandedMentor(expandedMentor === student.id ? null : student.id)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors ${
                                student.checkedByMentor > 0
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
                                  : 'text-[#3d3527]/40'
                              }`}
                            >
                              {student.checkedByMentor}
                              {student.mentorBreakdown.length > 0 && (
                                expandedMentor === student.id
                                  ? <ChevronUp className="w-3 h-3" />
                                  : <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                            {expandedMentor === student.id && student.mentorBreakdown.length > 0 && (
                              <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border border-[#d4c9b0]/30 p-3 z-20 min-w-[180px]">
                                <div className="text-xs font-medium text-[#3d3527]/60 mb-2">Разбивка по наставникам</div>
                                {student.mentorBreakdown.map(m => (
                                  <div key={m.mentorId} className="flex justify-between text-xs py-1 text-[#3d3527]">
                                    <span>{m.mentorName}</span>
                                    <span className="font-medium ml-4">{m.count}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
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
