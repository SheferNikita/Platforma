import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { Users2, UserPlus, Check, RefreshCw, Search, ChevronRight, MapPin, User, Calendar, AlertCircle, Church, Filter, X, Brain, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const GENDER_LABELS: Record<string, string> = {
  male: 'М',
  female: 'Ж'
};

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' }
];

const ADDICTION_LABELS: Record<string, string> = {
  alcohol: 'Алкогольная',
  drugs: 'Наркотическая',
  gambling: 'Игровая',
  food: 'Пищевая',
  codependency: 'Зав. у родств.',
  other: 'Другая'
};

const TARIFF_LABELS: Record<string, string> = {
  BASIC: 'Базовый',
  FAMILY: 'Для родственников',
  RELATIVE: 'Родственник',
  WITH_MENTOR: 'С наставником',
  WITH_PSYCHOLOGIST: 'С психологом',
  INDIVIDUAL_PSYCHOLOGIST: 'Индивид. психолог'
};

const ADDICTION_OPTIONS = [
  { value: 'alcohol', label: 'Алкогольная' },
  { value: 'drugs', label: 'Наркотическая' },
  { value: 'gambling', label: 'Игровая' },
  { value: 'food', label: 'Пищевая' },
  { value: 'codependency', label: 'Зависимость у родственника' },
  { value: 'other', label: 'Другая' }
];

const SURVEY_OPTIONS = [
  { value: 'completed', label: 'Пройден' },
  { value: 'pending', label: 'Не пройден' }
];

const CLERGY_OPTIONS = [
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' }
];

function formatAddictionTypes(addictionType: string | null): string[] {
  if (!addictionType) return [];
  return addictionType.split(',').map(t => t.trim()).filter(Boolean);
}

interface Student {
  id: string;
  city: string | null;
  gender: string | null;
  age: number | null;
  addictionType: string | null;
  isClergy: boolean | null;
  surveyCompleted: boolean;
  user: { id: string; name: string; email: string; createdAt: string };
  payments: Array<{ product: { name: string } }>;
  tariff?: string;
  assignedPsychologistId?: string;
  assignedPsychologist?: { id: string; name: string; email: string };
}

interface Psychologist {
  id: string;
  name: string;
  email: string;
  _count: { assignedStudents: number };
}

interface MiniGroup {
  id: string;
  title: string;
  curator: { id: string; name: string } | null;
  _count: { members: number };
}

interface Filters {
  gender: string;
  addictionType: string;
  surveyStatus: string;
  isClergy: string;
  city: string;
  tariff: string;
}

type TabType = 'group' | 'individual';

export function DistributionAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('group');
  const [students, setStudents] = useState<Student[]>([]);
  const [individualStudents, setIndividualStudents] = useState<Student[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [groups, setGroups] = useState<MiniGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    gender: '',
    addictionType: '',
    surveyStatus: '',
    isClergy: '',
    city: '',
    tariff: ''
  });

  const [showPsychologistModal, setShowPsychologistModal] = useState(false);
  const [selectedStudentForPsychologist, setSelectedStudentForPsychologist] = useState<Student | null>(null);
  const [selectedPsychologistId, setSelectedPsychologistId] = useState<string>('');
  const [assigningPsychologist, setAssigningPsychologist] = useState(false);
  const [individualSearchTerm, setIndividualSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [studentsData, groupsData, individualData, psychologistsData] = await Promise.all([
        api.get<Student[]>('/public/distribution/unassigned'),
        api.get<MiniGroup[]>('/public/distribution/mini-groups'),
        api.get<Student[]>('/public/distribution/individual'),
        api.get<Psychologist[]>('/public/distribution/psychologists')
      ]);
      setStudents(studentsData);
      setGroups(groupsData);
      setIndividualStudents(individualData);
      setPsychologists(psychologistsData);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }

  async function assignStudents() {
    if (!selectedGroup || selectedStudents.size === 0) {
      toast.error('Выберите учеников и группу');
      return;
    }

    setAssigning(true);
    try {
      const studentIds = Array.from(selectedStudents);
      await api.post('/public/distribution/assign-multiple', {
        studentIds,
        miniGroupId: selectedGroup
      });
      
      const groupName = groups.find(g => g.id === selectedGroup)?.title;
      toast.success(`${studentIds.length} уч. добавлено в "${groupName}"`);
      
      setSelectedStudents(new Set());
      setSelectedGroup(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка распределения');
    } finally {
      setAssigning(false);
    }
  }

  async function assignSingle(studentId: string, groupId: string) {
    try {
      await api.post('/public/distribution/assign', {
        studentId,
        miniGroupId: groupId
      });
      
      const groupName = groups.find(g => g.id === groupId)?.title;
      toast.success(`Ученик добавлен в "${groupName}"`);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка распределения');
    }
  }

  async function assignPsychologist() {
    if (!selectedStudentForPsychologist || !selectedPsychologistId) {
      toast.error('Выберите психолога');
      return;
    }

    setAssigningPsychologist(true);
    try {
      await api.post('/public/distribution/assign-psychologist', {
        studentId: selectedStudentForPsychologist.id,
        psychologistId: selectedPsychologistId
      });
      
      const psychologist = psychologists.find(p => p.id === selectedPsychologistId);
      toast.success(`Психолог ${psychologist?.name} назначен ученику`);
      
      setShowPsychologistModal(false);
      setSelectedStudentForPsychologist(null);
      setSelectedPsychologistId('');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка назначения психолога');
    } finally {
      setAssigningPsychologist(false);
    }
  }

  function openPsychologistModal(student: Student) {
    setSelectedStudentForPsychologist(student);
    setSelectedPsychologistId(student.assignedPsychologistId || '');
    setShowPsychologistModal(true);
  }

  function toggleStudent(studentId: string) {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  }

  function selectAll() {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  }

  const uniqueCities = useMemo(() => {
    const cities = students
      .map(s => s.city)
      .filter((city): city is string => !!city);
    return [...new Set(cities)].sort();
  }, [students]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== '').length;
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      gender: '',
      addictionType: '',
      surveyStatus: '',
      isClergy: '',
      city: '',
      tariff: ''
    });
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = searchTerm === '' || 
        s.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGender = filters.gender === '' || s.gender === filters.gender;
      
      const matchesAddiction = filters.addictionType === '' || 
        (s.addictionType && formatAddictionTypes(s.addictionType).includes(filters.addictionType));
      
      const matchesSurvey = filters.surveyStatus === '' ||
        (filters.surveyStatus === 'completed' && s.surveyCompleted) ||
        (filters.surveyStatus === 'pending' && !s.surveyCompleted);
      
      const matchesClergy = filters.isClergy === '' ||
        (filters.isClergy === 'yes' && s.isClergy === true) ||
        (filters.isClergy === 'no' && s.isClergy !== true);
      
      const matchesCity = filters.city === '' || s.city === filters.city;

      const matchesTariff = filters.tariff === '' || s.tariff === filters.tariff;

      return matchesSearch && matchesGender && matchesAddiction && matchesSurvey && matchesClergy && matchesCity && matchesTariff;
    });
  }, [students, searchTerm, filters]);

  const filteredIndividualStudents = useMemo(() => {
    return individualStudents.filter(s => {
      return individualSearchTerm === '' || 
        s.user.name.toLowerCase().includes(individualSearchTerm.toLowerCase()) ||
        s.user.email.toLowerCase().includes(individualSearchTerm.toLowerCase());
    });
  }, [individualStudents, individualSearchTerm]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#a67c52]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Распределение</h1>
          <p className="text-[#3d3527]/60 mt-1">
            {activeTab === 'group' 
              ? (students.length > 0 
                  ? `${students.length} учеников ожидают распределения`
                  : 'Все ученики распределены по группам')
              : `${individualStudents.length} учеников с индивидуальным тарифом`
            }
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[#3d3527] hover:bg-white/50 rounded-xl transition-all w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="flex gap-2 border-b border-[#d4c9b0]/30">
        <button
          onClick={() => setActiveTab('group')}
          className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
            activeTab === 'group'
              ? 'text-[#a67c52] border-[#a67c52]'
              : 'text-[#3d3527]/60 border-transparent hover:text-[#3d3527]'
          }`}
        >
          <Users2 className="w-4 h-4 inline-block mr-2" />
          Групповые
          {students.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-[#a67c52]/10 text-[#a67c52] rounded-full text-xs">
              {students.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
            activeTab === 'individual'
              ? 'text-[#a67c52] border-[#a67c52]'
              : 'text-[#3d3527]/60 border-transparent hover:text-[#3d3527]'
          }`}
        >
          <Brain className="w-4 h-4 inline-block mr-2" />
          Индивидуальные
          {individualStudents.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-[#a67c52]/10 text-[#a67c52] rounded-full text-xs">
              {individualStudents.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'group' && (
        <>
          {students.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-12 text-center border border-[#d4c9b0]/30">
              <Users2 className="w-16 h-16 text-[#a67c52]/40 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#3d3527] mb-2">Все ученики распределены</h3>
              <p className="text-[#3d3527]/60">
                Новые ученики появятся здесь после регистрации или оплаты
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white/60 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-[#d4c9b0]/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold text-[#3d3527]">
                    Нераспределённые ученики
                    {activeFiltersCount > 0 && (
                      <span className="ml-2 text-sm font-normal text-[#a67c52]">
                        (найдено: {filteredStudents.length})
                      </span>
                    )}
                  </h2>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#3d3527]/40" />
                      <input
                        type="text"
                        placeholder="Поиск..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white/80 border border-[#d4c9b0]/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      />
                    </div>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                        showFilters || activeFiltersCount > 0
                          ? 'bg-[#a67c52] text-white'
                          : 'bg-white/80 text-[#3d3527] border border-[#d4c9b0]/30 hover:bg-white'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Фильтры
                      {activeFiltersCount > 0 && (
                        <span className="w-5 h-5 bg-white text-[#a67c52] rounded-full text-xs flex items-center justify-center font-medium">
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={selectAll}
                      className="text-sm text-[#a67c52] hover:underline whitespace-nowrap"
                    >
                      {selectedStudents.size === filteredStudents.length ? 'Снять всё' : 'Выбрать всех'}
                    </button>
                  </div>
                </div>

                {showFilters && (
                  <div className="mb-4 p-4 bg-[#f5f3ed] rounded-xl border border-[#d4c9b0]/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-[#3d3527]">Фильтры</span>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={clearFilters}
                          className="flex items-center gap-1 text-xs text-[#a67c52] hover:underline"
                        >
                          <X className="w-3 h-3" />
                          Сбросить
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-xs text-[#3d3527]/60 mb-1">Тариф</label>
                        <select
                          value={filters.tariff}
                          onChange={(e) => setFilters({ ...filters, tariff: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                        >
                          <option value="">Все</option>
                          {Object.entries(TARIFF_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#3d3527]/60 mb-1">Пол</label>
                        <select
                          value={filters.gender}
                          onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                        >
                          <option value="">Все</option>
                          {GENDER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#3d3527]/60 mb-1">Зависимость</label>
                        <select
                          value={filters.addictionType}
                          onChange={(e) => setFilters({ ...filters, addictionType: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                        >
                          <option value="">Все</option>
                          {ADDICTION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#3d3527]/60 mb-1">Опрос</label>
                        <select
                          value={filters.surveyStatus}
                          onChange={(e) => setFilters({ ...filters, surveyStatus: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                        >
                          <option value="">Все</option>
                          {SURVEY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#3d3527]/60 mb-1">Духовенство</label>
                        <select
                          value={filters.isClergy}
                          onChange={(e) => setFilters({ ...filters, isClergy: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                        >
                          <option value="">Все</option>
                          {CLERGY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#3d3527]/60 mb-1">Город</label>
                        <select
                          value={filters.city}
                          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                        >
                          <option value="">Все</option>
                          {uniqueCities.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className={`p-3 md:p-4 rounded-xl transition-all cursor-pointer ${
                        selectedStudents.has(student.id)
                          ? 'bg-[#a67c52]/10 border-2 border-[#a67c52]'
                          : 'bg-white/40 border border-[#d4c9b0]/30 hover:bg-white/60'
                      }`}
                      onClick={() => toggleStudent(student.id)}
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                          selectedStudents.has(student.id)
                            ? 'bg-[#a67c52] border-[#a67c52]'
                            : 'border-[#d4c9b0]'
                        }`}>
                          {selectedStudents.has(student.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-[#3d3527] truncate">{student.user.name}</p>
                            {student.tariff && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-xs font-semibold">
                                <CreditCard className="w-3 h-3" />
                                {TARIFF_LABELS[student.tariff] || student.tariff}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#3d3527]/60 truncate">{student.user.email}</p>
                        </div>
                        
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-[#3d3527]/40">
                            {formatDate(student.user.createdAt)}
                          </p>
                          {student.payments[0] && (
                            <p className="text-xs text-[#a67c52] truncate max-w-[150px]">
                              {student.payments[0].product.name}
                            </p>
                          )}
                        </div>

                        <div className="relative group">
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="p-2 text-[#3d3527]/40 hover:text-[#a67c52] hover:bg-[#a67c52]/10 rounded-lg transition-all"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-[#d4c9b0]/30 py-1 z-10 hidden group-hover:block">
                            {groups.map((group) => (
                              <button
                                key={group.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assignSingle(student.id, group.id);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-[#3d3527] hover:bg-[#f5f3ed] transition-all"
                              >
                                <span className="truncate block">{group.title}</span>
                                <span className="text-xs text-[#3d3527]/40">{group._count.members} уч.</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {student.surveyCompleted ? (
                        <div className="flex flex-wrap gap-1.5 md:gap-2 mt-3 ml-8 md:ml-9">
                          {student.city && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">
                              <MapPin className="w-3 h-3" />
                              {student.city}
                            </span>
                          )}
                          {student.gender && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs">
                              <User className="w-3 h-3" />
                              {GENDER_LABELS[student.gender] || student.gender}
                            </span>
                          )}
                          {student.age && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                              <Calendar className="w-3 h-3" />
                              {student.age} лет
                            </span>
                          )}
                          {student.isClergy && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs">
                              <Church className="w-3 h-3" />
                              Духовенство
                            </span>
                          )}
                          {formatAddictionTypes(student.addictionType).map((type, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                              {ADDICTION_LABELS[type] || type}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-3 ml-8 md:ml-9 text-amber-600 text-xs">
                          <AlertCircle className="w-3 h-3" />
                          Опрос не пройден
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-[#d4c9b0]/30 h-fit lg:sticky lg:top-6">
                <h2 className="text-lg font-semibold text-[#3d3527] mb-4">
                  Назначить в группу
                </h2>

                {selectedStudents.size > 0 && (
                  <div className="mb-4 p-3 bg-[#a67c52]/10 rounded-xl">
                    <p className="text-sm text-[#3d3527]">
                      Выбрано: <span className="font-bold">{selectedStudents.size}</span> уч.
                    </p>
                  </div>
                )}

                <div className="space-y-2 mb-6">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        selectedGroup === group.id
                          ? 'bg-[#a67c52] text-white'
                          : 'bg-white/40 hover:bg-white/60 text-[#3d3527] border border-[#d4c9b0]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{group.title}</span>
                        <span className={`text-sm ${selectedGroup === group.id ? 'text-white/80' : 'text-[#3d3527]/60'}`}>
                          {group._count.members} уч.
                        </span>
                      </div>
                      {group.curator && (
                        <p className={`text-xs mt-1 ${selectedGroup === group.id ? 'text-white/70' : 'text-[#3d3527]/50'}`}>
                          Куратор: {group.curator.name}
                        </p>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={assignStudents}
                  disabled={!selectedGroup || selectedStudents.size === 0 || assigning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Распределить
                </button>

                {groups.length === 0 && (
                  <p className="text-sm text-[#3d3527]/60 text-center mt-4">
                    Сначала создайте мини-группы в разделе "Мини-группы"
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'individual' && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-[#d4c9b0]/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-[#3d3527]">
              Ученики с индивидуальным тарифом
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#3d3527]/40" />
              <input
                type="text"
                placeholder="Поиск..."
                value={individualSearchTerm}
                onChange={(e) => setIndividualSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/80 border border-[#d4c9b0]/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
              />
            </div>
          </div>

          {filteredIndividualStudents.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 text-[#a67c52]/40 mx-auto mb-3" />
              <p className="text-[#3d3527]/60">Нет учеников с индивидуальным тарифом</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#d4c9b0]/30">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#3d3527]/60">Имя</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#3d3527]/60">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#3d3527]/60">Тариф</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#3d3527]/60">Психолог</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#3d3527]/60">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndividualStudents.map((student) => (
                    <React.Fragment key={student.id}>
                      <tr className="border-b border-[#d4c9b0]/20 hover:bg-white/40 transition-all">
                        <td className="py-3 px-4">
                          <p className="font-medium text-[#3d3527]">{student.user.name}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-[#3d3527]/70">{student.user.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          {student.tariff && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                              <CreditCard className="w-3 h-3" />
                              {TARIFF_LABELS[student.tariff] || student.tariff}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {student.assignedPsychologist ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-[#a67c52]/10 rounded-full flex items-center justify-center">
                                <Brain className="w-4 h-4 text-[#a67c52]" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#3d3527]">{student.assignedPsychologist.name}</p>
                                <p className="text-xs text-[#3d3527]/50">{student.assignedPsychologist.email}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-[#3d3527]/40 italic">Не назначен</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openPsychologistModal(student)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#a67c52]/10 hover:bg-[#a67c52]/20 text-[#a67c52] rounded-lg text-sm transition-all"
                          >
                            <UserPlus className="w-4 h-4" />
                            {student.assignedPsychologist ? 'Изменить' : 'Назначить'}
                          </button>
                        </td>
                      </tr>
                      <tr className="border-b border-[#d4c9b0]/10">
                        <td colSpan={5} className="px-4 pb-3 pt-0">
                          {student.surveyCompleted ? (
                            <div className="flex flex-wrap gap-1.5">
                              {student.city && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">
                                  <MapPin className="w-3 h-3" />
                                  {student.city}
                                </span>
                              )}
                              {student.gender && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs">
                                  <User className="w-3 h-3" />
                                  {GENDER_LABELS[student.gender] || student.gender}
                                </span>
                              )}
                              {student.age && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                                  <Calendar className="w-3 h-3" />
                                  {student.age} лет
                                </span>
                              )}
                              {student.isClergy && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs">
                                  <Church className="w-3 h-3" />
                                  Духовенство
                                </span>
                              )}
                              {formatAddictionTypes(student.addictionType).map((type, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                                  {ADDICTION_LABELS[type] || type}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-600 text-xs">
                              <AlertCircle className="w-3 h-3" />
                              Опрос не пройден
                            </div>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showPsychologistModal && selectedStudentForPsychologist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#f5f3ed] rounded-2xl p-4 md:p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-[#3d3527]">Назначить психолога</h3>
              <button onClick={() => { setShowPsychologistModal(false); setSelectedStudentForPsychologist(null); setSelectedPsychologistId(''); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Закрыть">
                <X className="w-5 h-5 text-[#3d3527]" />
              </button>
            </div>
            <p className="text-sm text-[#3d3527]/60 mb-4">
              Ученик: <span className="font-medium text-[#3d3527]">{selectedStudentForPsychologist.user.name}</span>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#3d3527] mb-2">Выберите психолога</label>
              <select
                value={selectedPsychologistId}
                onChange={(e) => setSelectedPsychologistId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#d4c9b0]/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
              >
                <option value="">Выберите психолога...</option>
                {psychologists.map((psychologist) => (
                  <option key={psychologist.id} value={psychologist.id}>
                    {psychologist.name} ({psychologist._count.assignedStudents} уч.)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPsychologistModal(false);
                  setSelectedStudentForPsychologist(null);
                  setSelectedPsychologistId('');
                }}
                className="flex-1 px-4 py-2.5 border border-[#d4c9b0]/50 text-[#3d3527] rounded-xl hover:bg-white/50 transition-all"
              >
                Отмена
              </button>
              <button
                onClick={assignPsychologist}
                disabled={!selectedPsychologistId || assigningPsychologist}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningPsychologist ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Назначить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
