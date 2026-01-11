import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Search, Edit, Trash2, User, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  student: {
    phone: string;
    sobrietyDate: string;
    notes: string;
    progress: any[];
    enrollments: any[];
  };
}

export function StudentsAdmin() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadStudents();
  }, [search]);

  async function loadStudents() {
    try {
      const { students } = await api.get<{ students: Student[] }>(`/students?search=${search}`);
      setStudents(students);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Ученики</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление учениками платформы</p>
        </div>
        <button
          onClick={() => { setEditingStudent(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow"
        >
          <Plus className="w-5 h-5" /> Добавить ученика
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full pl-12 pr-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
          />
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#f5f3ed]">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Ученик</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Статус</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Прогресс</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Подписки</th>
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
                    <p className="text-[#3d3527]">{student.student?.enrollments?.length || 0}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                      >
                        <Eye className="w-4 h-4 text-[#3d3527]" />
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
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

function StudentModal({ student, onSave, onClose }: { student: Student | null; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(student?.name || '');
  const [email, setEmail] = useState(student?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(student?.student?.phone || '');
  const [sobrietyDate, setSobrietyDate] = useState(student?.student?.sobrietyDate?.split('T')[0] || '');
  const [notes, setNotes] = useState(student?.student?.notes || '');

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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
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
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата трезвости</label>
            <input
              type="date"
              value={sobrietyDate}
              onChange={(e) => setSobrietyDate(e.target.value)}
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
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => onSave({ name, email, password, phone, sobrietyDate, notes })}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentDetailModal({ student, onClose }: { student: Student; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">Профиль ученика</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
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
            <p className="font-medium text-[#3d3527]">{student.student?.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-[#3d3527]/60">Дата регистрации</p>
            <p className="font-medium text-[#3d3527]">{new Date(student.createdAt).toLocaleDateString('ru')}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Закрыть</button>
        </div>
      </div>
    </div>
  );
}
