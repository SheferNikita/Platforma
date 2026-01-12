import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Library, Eye, EyeOff, ArrowUp, ArrowDown, Move, Check, X } from 'lucide-react';
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
  const [reordering, setReordering] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalItemsRef = useRef<LibraryItem[]>([]);

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
        const { nextOrder } = await api.get<{ nextOrder: number }>('/content/library/next-order');
        await api.post('/content/library', { ...data, order: nextOrder });
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

  function startReordering() {
    originalItemsRef.current = [...items];
    setReordering(true);
  }

  function moveItemLocal(index: number, direction: 'up' | 'down') {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  }

  async function saveReorder() {
    setSaving(true);
    try {
      const reorderData = items.map((item, index) => ({ id: item.id, order: index + 1 }));
      await api.post('/content/library/reorder-batch', { items: reorderData });
      toast.success('Порядок сохранен');
      setReordering(false);
      loadItems();
    } catch (error) {
      toast.error('Ошибка сохранения порядка');
    } finally {
      setSaving(false);
    }
  }

  function cancelReorder() {
    setItems(originalItemsRef.current);
    setReordering(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Библиотека</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление материалами библиотеки</p>
        </div>
        <div className="flex gap-2">
          {reordering ? (
            <>
              <button
                onClick={cancelReorder}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed]"
              >
                <X className="w-5 h-5" /> Отменить
              </button>
              <button
                onClick={saveReorder}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg disabled:opacity-50"
              >
                <Check className="w-5 h-5" /> {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startReordering}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed]"
              >
                <Move className="w-5 h-5" /> Переместить
              </button>
              <button onClick={() => { setEditingItem(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
                <Plus className="w-5 h-5" /> Добавить
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-[#3d3527]/60">Библиотека пуста</div>
        ) : (
          <div className="divide-y divide-[#d4c9b0]/30">
            {items.map((item, index) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-[#f5f3ed]/50">
                <div className="flex items-center gap-4">
                  {reordering && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveItemLocal(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-4 h-4 text-[#a67c52]" />
                      </button>
                      <button
                        onClick={() => moveItemLocal(index, 'down')}
                        disabled={index === items.length - 1}
                        className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-4 h-4 text-[#a67c52]" />
                      </button>
                    </div>
                  )}
                  <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                    <Library className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#3d3527]">{item.title}</p>
                    <p className="text-sm text-[#3d3527]/60">
                      {item.type === 'article' ? 'Статья' : 
                       item.type === 'video' ? 'Видео' : 
                       item.type === 'audio' ? 'Аудио' : 
                       item.type === 'book' ? 'Книга' : item.type}
                    </p>
                    {item.description && (
                      <p className="text-sm text-[#3d3527]/50 mt-1 line-clamp-2">{item.description}</p>
                    )}
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
  const [downloadUrl, setDownloadUrl] = useState((item as any)?.downloadUrl || '');
  const [isPublished, setIsPublished] = useState(item?.isPublished ?? true);

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
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка для открытия</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка для скачивания (опционально)</label>
        <input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]" />
        <p className="text-xs text-[#3d3527]/50 mt-1">Если заполнено, на карточке появится кнопка «Скачать»</p>
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-5 h-5 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
          />
          <span className="flex items-center gap-2 text-[#3d3527]">
            <Eye className="w-4 h-4" />
            Опубликован (виден ученикам)
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button onClick={() => onSave({ title, description, type, url, downloadUrl: downloadUrl || null, isPublished })} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl">Сохранить</button>
      </div>
    </div>
  );
}
