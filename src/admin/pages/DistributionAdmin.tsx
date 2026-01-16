import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Users2, UserPlus, Check, RefreshCw, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  user: { id: string; name: string; email: string; createdAt: string };
  payments: Array<{ product: { name: string } }>;
}

interface MiniGroup {
  id: string;
  title: string;
  curator: { id: string; name: string } | null;
  _count: { members: number };
}

export function DistributionAdmin() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<MiniGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [studentsData, groupsData] = await Promise.all([
        api.get<Student[]>('/public/distribution/unassigned'),
        api.get<MiniGroup[]>('/public/distribution/mini-groups')
      ]);
      setStudents(studentsData);
      setGroups(groupsData);
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

  const filteredStudents = students.filter(s => 
    s.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#3d3527]">Распределение</h1>
          <p className="text-[#3d3527]/60 mt-1">
            {students.length > 0 
              ? `${students.length} учеников ожидают распределения`
              : 'Все ученики распределены по группам'
            }
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-[#3d3527] hover:bg-white/50 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

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
          <div className="lg:col-span-2 bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-[#d4c9b0]/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#3d3527]">
                Нераспределённые ученики
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#3d3527]/40" />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white/80 border border-[#d4c9b0]/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                  />
                </div>
                <button
                  onClick={selectAll}
                  className="text-sm text-[#a67c52] hover:underline"
                >
                  {selectedStudents.size === filteredStudents.length ? 'Снять всё' : 'Выбрать всех'}
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                    selectedStudents.has(student.id)
                      ? 'bg-[#a67c52]/10 border-2 border-[#a67c52]'
                      : 'bg-white/40 border border-[#d4c9b0]/30 hover:bg-white/60'
                  }`}
                  onClick={() => toggleStudent(student.id)}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    selectedStudents.has(student.id)
                      ? 'bg-[#a67c52] border-[#a67c52]'
                      : 'border-[#d4c9b0]'
                  }`}>
                    {selectedStudents.has(student.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#3d3527] truncate">{student.user.name}</p>
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
              ))}
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-[#d4c9b0]/30 h-fit sticky top-6">
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
    </div>
  );
}
