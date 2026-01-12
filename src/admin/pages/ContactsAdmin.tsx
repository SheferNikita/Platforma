import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Phone, Eye, EyeOff, User, ArrowUp, ArrowDown, Move, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  telegram: string;
  order: number;
  isPublished: boolean;
}

export function ContactsAdmin() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [reordering, setReordering] = useState(false);
  const [saving, setSaving] = useState(false);
  const originalContactsRef = useRef<Contact[]>([]);

  useEffect(() => { loadContacts(); }, []);

  async function loadContacts() {
    try {
      const data = await api.get<Contact[]>('/content/contacts');
      setContacts(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function saveContact(data: Partial<Contact>) {
    try {
      if (editingContact) {
        await api.put(`/content/contacts/${editingContact.id}`, data);
        toast.success('Контакт обновлен');
      } else {
        const { nextOrder } = await api.get<{ nextOrder: number }>('/content/contacts/next-order');
        await api.post('/content/contacts', { ...data, order: nextOrder });
        toast.success('Контакт создан');
      }
      loadContacts();
      setShowModal(false);
      setEditingContact(null);
    } catch (error) { toast.error('Ошибка сохранения'); }
  }

  async function deleteContact(id: string) {
    if (!confirm('Удалить контакт?')) return;
    try {
      await api.delete(`/content/contacts/${id}`);
      toast.success('Удалено');
      loadContacts();
    } catch (error) { toast.error('Ошибка удаления'); }
  }

  async function togglePublish(id: string, isPublished: boolean) {
    try {
      await api.put(`/content/contacts/${id}`, { isPublished: !isPublished });
      loadContacts();
    } catch (error) { toast.error('Ошибка'); }
  }

  function startReordering() {
    originalContactsRef.current = [...contacts];
    setReordering(true);
  }

  function moveContactLocal(index: number, direction: 'up' | 'down') {
    const newContacts = [...contacts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newContacts.length) return;
    [newContacts[index], newContacts[targetIndex]] = [newContacts[targetIndex], newContacts[index]];
    setContacts(newContacts);
  }

  async function saveReorder() {
    setSaving(true);
    try {
      const reorderData = contacts.map((contact, index) => ({ id: contact.id, order: index + 1 }));
      await api.post('/content/contacts/reorder-batch', { items: reorderData });
      toast.success('Порядок сохранен');
      setReordering(false);
      loadContacts();
    } catch (error) {
      toast.error('Ошибка сохранения порядка');
    } finally {
      setSaving(false);
    }
  }

  function cancelReorder() {
    setContacts(originalContactsRef.current);
    setReordering(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Контакты</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление контактами кураторов</p>
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
              <button onClick={() => { setEditingContact(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
                <Plus className="w-5 h-5" /> Добавить
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : contacts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Нет контактов</div>
        ) : (
          contacts.map((contact, index) => (
            <div key={contact.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {reordering && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveContactLocal(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-4 h-4 text-[#a67c52]" />
                      </button>
                      <button
                        onClick={() => moveContactLocal(index, 'down')}
                        disabled={index === contacts.length - 1}
                        className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-4 h-4 text-[#a67c52]" />
                      </button>
                    </div>
                  )}
                  <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePublish(contact.id, contact.isPublished)} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    {contact.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button onClick={() => { setEditingContact(contact); setShowModal(true); }} className="p-2 hover:bg-[#f5f3ed] rounded-lg">
                    <Edit className="w-4 h-4 text-[#3d3527]" />
                  </button>
                  <button onClick={() => deleteContact(contact.id)} className="p-2 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-[#3d3527]">{contact.name}</h3>
              <p className="text-sm text-[#3d3527]/60 mb-2">{contact.role}</p>
              <div className="space-y-1 text-sm text-[#3d3527]/80">
                {contact.phone && <p><Phone className="w-4 h-4 inline mr-2" />{contact.phone}</p>}
                {contact.telegram && <p>@{contact.telegram}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[#3d3527] mb-4">{editingContact ? 'Редактировать' : 'Новый контакт'}</h2>
            <ContactForm contact={editingContact} onSave={saveContact} onClose={() => { setShowModal(false); setEditingContact(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ContactForm({ contact, onSave, onClose }: { contact: Contact | null; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(contact?.name || '');
  const [role, setRole] = useState(contact?.role || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [telegram, setTelegram] = useState(contact?.telegram || '');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Имя</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Роль</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="Куратор" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Телефон</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Telegram</label>
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="username" />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button onClick={() => onSave({ name, role, phone, email, telegram })} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl">Сохранить</button>
      </div>
    </div>
  );
}
