import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Library, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface LibraryItem {
  id: string;
  title: string;
  description: string;
  type: string;
  url: string;
  content: string;
  order: number;
  isPublished: boolean;
}

export function LibraryAdmin() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    try {
      const data = await api.get<LibraryItem[]>('/content/library');
      setItems(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function saveItem(data: Partial<LibraryItem>) {
    try {
      if (editingItem) {
        await api.put(`/content/library/${editingItem.id}`, data);
        toast.success('Элемент обновлен');
      } else {
        await api.post('/content/library', data);
        toast.success('Элемент создан');
      }
      loadItems();
      setShowModal(false);
      setEditingItem(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Удалить элемент?')) return;
    try {
      await api.delete(`/content/library/${id}`);
      toast.success('Удалено');
      loadItems();
    } catch (error) { toast.error('Ошибка удаления'); }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/library/${id}`, { isPublished: !isPublished });
      loadItems();
    } catch (error) { toast.error('Ошибка'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Библиотека</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление материалами библиотеки</p>
        </div>
        <button onClick={() => { setEditingItem(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
          <Plus className="w-5 h-5" /> Добавить
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">Библиотека пуста</div>
        ) : (
          <div className="divide-y divide-[#d4c9b0]/30">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-[#f5f3ed]/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                    <Library className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-[#3d3527]">{item.title}</p>
                    <p className="text-sm text-[#3d3527]/60">{item.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePublish(item.id, item.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    {item.isPublished ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => { setEditingItem(item); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    <Edit className="w-5 h-5 text-[#3d3527]" />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">{editingItem ? 'Редактировать' : 'Новый элемент'}</h2>
            <LibraryForm
              item={editingItem}
              onSave={saveItem}
              onClose={() => { setShowModal(false); setEditingItem(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryForm({ item, onSave, onClose }: { item: LibraryItem | null; onSave: (data: any) => void; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [type, setType] = useState(item?.type || 'article');
  const [url, setUrl] = useState(item?.url || '');
  const [order, setOrder] = useState(item?.order || 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Тип</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl">
            <option value="article">Статья</option>
            <option value="video">Видео</option>
            <option value="audio">Аудио</option>
            <option value="book">Книга</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Порядок</label>
          <input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value))} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button onClick={() => onSave({ title, description, type, url, order })} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl">Сохранить</button>
      </div>
    </div>
  );
}
