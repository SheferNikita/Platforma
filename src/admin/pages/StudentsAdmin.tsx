import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Search, Edit, Trash2, User, Info, Filter, Lock, Unlock, Calendar, Users2, X, ListChecks, Shuffle } from 'lucide-react';
import { toast } from 'sonner';

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

export function StudentsAdmin() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [initialTab, setInitialTab] = useState<'info' | 'access'>('info');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterMiniGroup, setFilterMiniGroup] = useState<string>('');
  const [miniGroups, setMiniGroups] = useState<MiniGroup[]>([]);

  useEffect(() => {
    loadStudents();
    loadMiniGroups();
  }, [search, filterStatus, filterMiniGroup]);

  async function loadMiniGroups() {
    try {
      const groups = await api.get<MiniGroup[]>('/content/mini-groups');
      setMiniGroups(groups);
    } catch (error) {}
  }

  async function loadStudents() {
    try {
      const { students } = await api.get<{ students: Student[] }>(`/students?search=${search}`);
      let filtered = students;
      
      if (filterStatus === 'active') {
        filtered = filtered.filter(s => s.isActive);
      } else if (filterStatus === 'inactive') {
        filtered = filtered.filter(s => !s.isActive);
      }
      
      if (filterMiniGroup) {
        filtered = filtered.filter(s => 
          s.student?.miniGroups?.some(mg => mg.miniGroup.id === filterMiniGroup)
        );
      }
      
      setStudents(filtered);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
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
  }

  const hasActiveFilters = filterStatus !== 'all' || filterMiniGroup !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Ученики</h1>
          <p className="text-sm md:text-base text-[#3d3527]/60 mt-1">Управление учениками платформы</p>
        </div>
        <button
          onClick={() => { setEditingStudent(null); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" /> <span className="sm:inline">Добавить ученика</span>
        </button>
      </div>

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
                  </div>
                  <p className="text-sm text-[#3d3527]/60 truncate">{student.email}</p>
                  <p className="text-xs text-[#3d3527]/50 mt-1">{student.student?.progress?.length || 0} уроков пройдено</p>
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
        <table className="w-full">
          <thead className="bg-[#f5f3ed]">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Ученик</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Статус</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Прогресс</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Мини-группы</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-[#3d3527]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52] mx-auto"></div>
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#3d3527]/60">Ученики не найдены</td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-[#3d3527]">{student.name}</p>
                        <p className="text-sm text-[#3d3527]/60">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${student.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {student.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[#3d3527]">{student.student?.progress?.length || 0} уроков</p>
                  </td>
                  <td className="px-6 py-4">
                    {student.student?.miniGroups?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {student.student.miniGroups.map(mg => (
                          <span key={mg.miniGroup.id} className="px-2 py-1 bg-[#a67c52]/10 text-[#a67c52] rounded-lg text-xs">
                            {mg.miniGroup.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#3d3527]/40">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setInitialTab('info'); setSelectedStudent(student); }}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                        title="Информация об ученике"
                      >
                        <Info className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => { setInitialTab('access'); setSelectedStudent(student); }}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                        title="Настройка доступов к модулям"
                      >
                        <ListChecks className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => { setEditingStudent(student); setShowModal(true); }}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => deleteStudent(student.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
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
  { value: 'WITH_MENTOR', label: 'С наставником', description: 'Полный доступ + мини-группы' },
  { value: 'WITH_PSYCHOLOGIST', label: 'С психологом', description: 'Полный доступ + мини-группы' },
  { value: 'INDIVIDUAL_PSYCHOLOGIST', label: 'Индивидуально с психологом', description: 'Полный доступ, без мини-групп' },
];

function StudentModal({ student, onSave, onClose }: { student: Student | null; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(student?.name || '');
  const [email, setEmail] = useState(student?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(student?.student?.phone || '');
  const [notes, setNotes] = useState(student?.student?.notes || '');
  const [sendCredentials, setSendCredentials] = useState(true);
  const [tariff, setTariff] = useState((student?.student as any)?.tariff || 'WITH_MENTOR');
  const [assignedPsychologistId, setAssignedPsychologistId] = useState((student?.student as any)?.assignedPsychologistId || '');
  const [psychologists, setPsychologists] = useState<{id: string; name: string; email: string}[]>([]);

  useEffect(() => {
    if (tariff === 'INDIVIDUAL_PSYCHOLOGIST') {
      loadPsychologists();
    }
  }, [tariff]);

  async function loadPsychologists() {
    try {
      const data = await api.get<{id: string; name: string; email: string}[]>('/students/psychologists');
      setPsychologists(data);
    } catch (error) {
      console.error('Failed to load psychologists');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">{student ? 'Редактировать ученика' : 'Новый ученик'}</h2>
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
                  onClick={() => {
                    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    let pwd = '';
                    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                    setPassword(pwd);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#f5f3ed] rounded-lg transition-colors"
                  title="Сгенерировать пароль"
                >
                  <Shuffle className="w-4 h-4 text-[#a67c52]" />
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
          {tariff === 'INDIVIDUAL_PSYCHOLOGIST' && (
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Назначенный психолог</label>
              <select
                value={assignedPsychologistId}
                onChange={(e) => setAssignedPsychologistId(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="">Выберите психолога...</option>
                {psychologists.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                ))}
              </select>
            </div>
          )}
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
            onClick={() => onSave({ 
              name, email, password, phone, notes, 
              sendCredentials: !student && sendCredentials,
              tariff,
              assignedPsychologistId: tariff === 'INDIVIDUAL_PSYCHOLOGIST' ? assignedPsychologistId : null
            })}
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
