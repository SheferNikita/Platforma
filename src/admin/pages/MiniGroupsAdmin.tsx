import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Users2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface MiniGroup {
  id: string;
  title: string;
  description: string;
  schedule: string;
  curator: string;
  maxMembers: number;
  isPublished: boolean;
}

export function MiniGroupsAdmin() {
  const [groups, setGroups] = useState<MiniGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MiniGroup | null>(null);

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    try {
      const data = await api.get<MiniGroup[]>('/content/mini-groups');
      setGroups(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function saveGroup(data: Partial<MiniGroup>) {
    try {
      if (editingGroup) {
        await api.put(`/content/mini-groups/${editingGroup.id}`, data);
        toast.success('Группа обновлена');
      } else {
        await api.post('/content/mini-groups', data);
        toast.success('Группа создана');
      }
      loadGroups();
      setShowModal(false);
      setEditingGroup(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  async function deleteGroup(id: string) {
    if (!confirm('Удалить группу?')) return;
    try {
      await api.delete(`/content/mini-groups/${id}`);
      toast.success('Удалено');
      loadGroups();
    } catch (error) { toast.error('Ошибка удаления'); }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/mini-groups/${id}`, { isPublished: !isPublished });
      loadGroups();
    } catch (error) { toast.error('Ошибка'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Мини-группы</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление мини-группами</p>
        </div>
        <button onClick={() => { setEditingGroup(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
          <Plus className="w-5 h-5" /> Добавить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : groups.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Нет групп</div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                  <Users2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePublish(group.id, group.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    {group.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button onClick={() => { setEditingGroup(group); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    <Edit className="w-4 h-4 text-[#3d3527]" />
                  </button>
                  <button onClick={() => deleteGroup(group.id)} className="p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-[#3d3527]">{group.title}</h3>
              <p className="text-sm text-[#3d3527]/60 mt-1 line-clamp-2">{group.description}</p>
              <div className="mt-3 space-y-1 text-sm text-[#3d3527]/80">
                {group.curator && <p>Куратор: {group.curator}</p>}
                {group.schedule && <p>{group.schedule}</p>}
                <p>Макс. участников: {group.maxMembers}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">{editingGroup ? 'Редактировать' : 'Новая группа'}</h2>
            <MiniGroupForm group={editingGroup} onSave={saveGroup} onClose={() => { setShowModal(false); setEditingGroup(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniGroupForm({ group, onSave, onClose }: { group: MiniGroup | null; onSave: (data: any) => void; onClose: () => void }) {
  const [title, setTitle] = useState(group?.title || '');
  const [description, setDescription] = useState(group?.description || '');
  const [schedule, setSchedule] = useState(group?.schedule || '');
  const [curator, setCurator] = useState(group?.curator || '');
  const [maxMembers, setMaxMembers] = useState(group?.maxMembers || 10);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Куратор</label>
          <input value={curator} onChange={(e) => setCurator(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Макс. участников</label>
          <input type="number" value={maxMembers} onChange={(e) => setMaxMembers(parseInt(e.target.value))} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Расписание</label>
        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="Ср 19:00" />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button onClick={() => onSave({ title, description, schedule, curator, maxMembers })} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl">Сохранить</button>
      </div>
    </div>
  );
}
