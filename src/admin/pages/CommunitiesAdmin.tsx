import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Building, Eye, EyeOff, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  schedule: string;
  isPublished: boolean;
}

export function CommunitiesAdmin() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);

  useEffect(() => { loadCommunities(); }, []);

  async function loadCommunities() {
    try {
      const data = await api.get<Community[]>('/content/communities');
      setCommunities(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function saveCommunity(data: Partial<Community>) {
    try {
      if (editingCommunity) {
        await api.put(`/content/communities/${editingCommunity.id}`, data);
        toast.success('Община обновлена');
      } else {
        await api.post('/content/communities', data);
        toast.success('Община создана');
      }
      loadCommunities();
      setShowModal(false);
      setEditingCommunity(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  async function deleteCommunity(id: string) {
    if (!confirm('Удалить общину?')) return;
    try {
      await api.delete(`/content/communities/${id}`);
      toast.success('Удалено');
      loadCommunities();
    } catch (error) { toast.error('Ошибка удаления'); }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/communities/${id}`, { isPublished: !isPublished });
      loadCommunities();
    } catch (error) { toast.error('Ошибка'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Общины</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление общинами</p>
        </div>
        <button onClick={() => { setEditingCommunity(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
          <Plus className="w-5 h-5" /> Добавить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : communities.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Нет общин</div>
        ) : (
          communities.map((community) => (
            <div key={community.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePublish(community.id, community.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    {community.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button onClick={() => { setEditingCommunity(community); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    <Edit className="w-4 h-4 text-[#3d3527]" />
                  </button>
                  <button onClick={() => deleteCommunity(community.id)} className="p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-[#3d3527] text-lg">{community.name}</h3>
              <p className="text-sm text-[#3d3527]/60 mt-1 line-clamp-2">{community.description}</p>
              <div className="mt-3 space-y-1 text-sm text-[#3d3527]/80">
                {community.city && <p className="flex items-center gap-2"><MapPin className="w-4 h-4" />{community.city}</p>}
                {community.schedule && <p>{community.schedule}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">{editingCommunity ? 'Редактировать' : 'Новая община'}</h2>
            <CommunityForm community={editingCommunity} onSave={saveCommunity} onClose={() => { setShowModal(false); setEditingCommunity(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function CommunityForm({ community, onSave, onClose }: { community: Community | null; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(community?.name || '');
  const [description, setDescription] = useState(community?.description || '');
  const [city, setCity] = useState(community?.city || '');
  const [address, setAddress] = useState(community?.address || '');
  const [phone, setPhone] = useState(community?.phone || '');
  const [schedule, setSchedule] = useState(community?.schedule || '');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Город</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Телефон</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Адрес</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Расписание</label>
        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="Пн-Пт 10:00-18:00" />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button onClick={() => onSave({ name, description, city, address, phone, schedule })} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl">Сохранить</button>
      </div>
    </div>
  );
}
