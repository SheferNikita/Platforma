import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Shield, User, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function AdminsAdmin() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    try {
      const data = await api.get<Admin[]>('/admin');
      setAdmins(data);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function saveAdmin(data: any) {
    try {
      if (editingAdmin) {
        await api.put(`/admin/${editingAdmin.id}`, data);
        toast.success('Администратор обновлен');
      } else {
        await api.post('/admin', data);
        toast.success('Администратор создан');
      }
      loadAdmins();
      setShowModal(false);
      setEditingAdmin(null);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сохранения');
    }
  }

  async function deleteAdmin(id: string) {
    if (!confirm('Удалить администратора?')) return;
    try {
      await api.delete(`/admin/${id}`);
      toast.success('Администратор удален');
      loadAdmins();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления');
    }
  }

  const roleLabels: Record<string, { label: string; color: string; description: string }> = {
    SUPER_ADMIN: { label: 'Супер-админ', color: 'bg-purple-100 text-purple-700', description: 'Полный доступ ко всему' },
    ADMIN: { label: 'Администратор', color: 'bg-blue-100 text-blue-700', description: 'Полный доступ к админке, кроме удаления супер-админа' },
    CURATOR: { label: 'Куратор наставников', color: 'bg-teal-100 text-teal-700', description: 'Полный доступ кроме «Продукты» и «CRM»' },
    MENTOR: { label: 'Наставник', color: 'bg-green-100 text-green-700', description: 'Видит только свои мини-группы и своих учеников' },
    MODERATOR: { label: 'Модератор', color: 'bg-orange-100 text-orange-700', description: 'Уроки, библиотека, общины, расписание, email' }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-[#3d3527]/20 mx-auto mb-4" />
        <p className="text-[#3d3527]/60">Доступ только для администраторов</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Администраторы</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление администраторами и ролями</p>
        </div>
        <button
          onClick={() => { setEditingAdmin(null); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" /> Добавить админа
        </button>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">Администраторы не найдены</div>
        ) : (
          admins.map((admin) => (
            <div key={admin.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[#3d3527] truncate">{admin.name}</p>
                    <p className="text-sm text-[#3d3527]/60 truncate">{admin.email}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {(isSuperAdmin || admin.role !== 'SUPER_ADMIN') && (
                    <button
                      onClick={() => { setEditingAdmin(admin); setShowModal(true); }}
                      className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                    >
                      <Edit className="w-4 h-4 text-[#3d3527]" />
                    </button>
                  )}
                  {admin.id !== user?.id && (isSuperAdmin || admin.role !== 'SUPER_ADMIN') && (
                    <button
                      onClick={() => deleteAdmin(admin.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`px-2 py-1 rounded-full text-xs ${roleLabels[admin.role]?.color || 'bg-gray-100'}`}>
                  {roleLabels[admin.role]?.label || admin.role}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {admin.isActive ? 'Активен' : 'Неактивен'}
                </span>
                <span className="text-xs text-[#3d3527]/60">
                  {new Date(admin.createdAt).toLocaleDateString('ru')}
                </span>
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
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Администратор</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Роль</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Статус</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#3d3527]">Дата создания</th>
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
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#3d3527]/60">Администраторы не найдены</td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="border-t border-[#d4c9b0]/30 hover:bg-[#f5f3ed]/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-[#3d3527]">{admin.name}</p>
                        <p className="text-sm text-[#3d3527]/60">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${roleLabels[admin.role]?.color || 'bg-gray-100'}`}>
                      {roleLabels[admin.role]?.label || admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {admin.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#3d3527]/60">
                    {new Date(admin.createdAt).toLocaleDateString('ru')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {(isSuperAdmin || admin.role !== 'SUPER_ADMIN') && (
                        <button
                          onClick={() => { setEditingAdmin(admin); setShowModal(true); }}
                          className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                        >
                          <Edit className="w-4 h-4 text-[#3d3527]" />
                        </button>
                      )}
                      {admin.id !== user?.id && (isSuperAdmin || admin.role !== 'SUPER_ADMIN') && (
                        <button
                          onClick={() => deleteAdmin(admin.id)}
                          className="p-2 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AdminModal
          admin={editingAdmin}
          onSave={saveAdmin}
          onClose={() => { setShowModal(false); setEditingAdmin(null); }}
          canAssignSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}

function AdminModal({ admin, onSave, onClose, canAssignSuperAdmin }: { admin: Admin | null; onSave: (data: any) => void; onClose: () => void; canAssignSuperAdmin: boolean }) {
  const [name, setName] = useState(admin?.name || '');
  const [email, setEmail] = useState(admin?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(admin?.role || 'ADMIN');
  const [isActive, setIsActive] = useState(admin?.isActive ?? true);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">{admin ? 'Редактировать админа' : 'Новый администратор'}</h2>
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
              disabled={!!admin}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">
              Пароль {admin && '(оставьте пустым, чтобы не менять)'}
            </label>
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
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            >
              {canAssignSuperAdmin && <option value="SUPER_ADMIN">Супер-администратор</option>}
              <option value="ADMIN">Администратор</option>
              <option value="CURATOR">Куратор наставников</option>
              <option value="MENTOR">Наставник</option>
              <option value="MODERATOR">Модератор</option>
            </select>
            <p className="text-xs text-[#3d3527]/60 mt-1">
              {role === 'SUPER_ADMIN' && 'Полный доступ ко всему, включая историю изменений'}
              {role === 'ADMIN' && 'Полный доступ к админке, кроме удаления супер-админа'}
              {role === 'CURATOR' && 'Полный доступ кроме «Продукты» и «CRM»'}
              {role === 'MENTOR' && 'Видит только свои мини-группы и своих учеников'}
              {role === 'MODERATOR' && 'Уроки, библиотека, общины, расписание, email'}
            </p>
          </div>
          {admin && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-[#d4c9b0]"
              />
              <label htmlFor="isActive" className="text-sm text-[#3d3527]">Активен</label>
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl w-full sm:w-auto">Отмена</button>
          <button
            onClick={() => {
              const data: any = { name, role };
              if (!admin) {
                data.email = email;
                data.password = password;
              } else {
                data.isActive = isActive;
                if (password) data.password = password;
              }
              onSave(data);
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl w-full sm:w-auto"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
