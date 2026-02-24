import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Phone, Eye, EyeOff, User, ArrowLeft, ArrowRight, Move, Check, X, Upload, Globe, MapPin, MessageCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  telegram: string;
  photo: string | null;
  order: number;
  isPublished: boolean;
  format: string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  city: string | null;
}

function normalizeTelegramForDisplay(input: string): string {
  if (!input) return '';
  let username = input.trim();
  if (username.includes('t.me/')) {
    username = username.split('t.me/').pop() || '';
  } else if (username.includes('telegram.me/')) {
    username = username.split('telegram.me/').pop() || '';
  }
  username = username.replace(/^@/, '');
  username = username.split('?')[0];
  return username;
}

function getTelegramLink(input: string): string {
  if (!input) return '';
  const username = normalizeTelegramForDisplay(input);
  return `https://t.me/${username}`;
}

function getDisplayTelegram(input: string): string {
  if (!input) return '';
  return normalizeTelegramForDisplay(input);
}

const FORMAT_LABELS: Record<string, string> = {
  offline: 'Очно',
  online: 'Онлайн',
  both: 'Очно и Онлайн'
};

const FORMAT_COLORS: Record<string, string> = {
  offline: 'bg-blue-100 text-blue-700',
  online: 'bg-green-100 text-green-700',
  both: 'bg-purple-100 text-purple-700'
};

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

  function moveContactLocal(index: number, direction: 'left' | 'right') {
    const newContacts = [...contacts];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Контакты</h1>
          <p className="text-sm md:text-base text-[#3d3527]/60 mt-1">Полезные контакты специалистов и клиник</p>
        </div>
        <div className="flex gap-2">
          {reordering ? (
            <>
              <button
                onClick={cancelReorder}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed] w-full sm:w-auto"
              >
                <X className="w-5 h-5" /> Отменить
              </button>
              <button
                onClick={saveReorder}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg disabled:opacity-50 w-full sm:w-auto"
              >
                <Check className="w-5 h-5" /> {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startReordering}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed] w-full sm:w-auto"
              >
                <Move className="w-5 h-5" /> Переместить
              </button>
              <button onClick={() => { setEditingContact(null); setShowModal(true); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg w-full sm:w-auto">
                <Plus className="w-5 h-5" /> Добавить
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : contacts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Нет контактов</div>
        ) : (
          contacts.map((contact, index) => (
            <div key={contact.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-3 md:p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {reordering && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveContactLocal(index, 'left')}
                        disabled={index === 0}
                        className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowLeft className="w-4 h-4 text-[#a67c52]" />
                      </button>
                      <button
                        onClick={() => moveContactLocal(index, 'right')}
                        disabled={index === contacts.length - 1}
                        className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowRight className="w-4 h-4 text-[#a67c52]" />
                      </button>
                    </div>
                  )}
                  {contact.photo ? (
                    <img src={contact.photo} alt={contact.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
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
              <p className="text-sm text-[#3d3527]/60 mb-1">{contact.role}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {contact.format && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${FORMAT_COLORS[contact.format] || 'bg-gray-100 text-gray-600'}`}>
                    {FORMAT_LABELS[contact.format] || contact.format}
                  </span>
                )}
                {contact.city && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {contact.city}
                  </span>
                )}
              </div>
              <div className="space-y-1 text-sm text-[#3d3527]/80">
                {contact.phone && <p><Phone className="w-3.5 h-3.5 inline mr-1.5" />{contact.phone}</p>}
                {contact.email && <p><Mail className="w-3.5 h-3.5 inline mr-1.5" />{contact.email}</p>}
                {contact.telegram && (
                  <a href={getTelegramLink(contact.telegram)} target="_blank" rel="noopener noreferrer" className="block hover:text-[#a67c52]">
                    <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" />@{getDisplayTelegram(contact.telegram)}
                  </a>
                )}
                {contact.website && (
                  <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="block hover:text-[#a67c52] truncate">
                    <Globe className="w-3.5 h-3.5 inline mr-1.5" />{contact.website}
                  </a>
                )}
                {contact.address && (
                  <p className="truncate"><MapPin className="w-3.5 h-3.5 inline mr-1.5" />{contact.address}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold text-[#3d3527]">{editingContact ? 'Редактировать' : 'Новый контакт'}</h2>
              <button onClick={() => { setShowModal(false); setEditingContact(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Закрыть">
                <X className="w-5 h-5 text-[#3d3527]" />
              </button>
            </div>
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
  const [photo, setPhoto] = useState(contact?.photo || '');
  const [format, setFormat] = useState(contact?.format || '');
  const [address, setAddress] = useState(contact?.address || '');
  const [website, setWebsite] = useState(contact?.website || '');
  const [description, setDescription] = useState(contact?.description || '');
  const [city, setCity] = useState(contact?.city || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      let token: string | null = null;
      try { token = localStorage.getItem('token'); } catch {}
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch('/api/uploads/avatar', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка загрузки');
      }
      const data = await res.json();
      setPhoto(data.url);
      toast.success('Фото загружено');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки фото');
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    const normalizedTelegram = normalizeTelegramForDisplay(telegram);
    onSave({ 
      name, role, phone, email, telegram: normalizedTelegram, photo: photo || null,
      format: format || null, address: address || null, website: website || null, 
      description: description || null, city: city || null
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          {photo ? (
            <img src={photo} alt="Аватар" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileUpload} className="hidden" />
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-[#f5f3ed] border border-[#d4c9b0] rounded-xl hover:bg-[#ebe8dc] disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Загрузка...' : 'Загрузить фото'}
          </button>
          {photo && (
            <button
              type="button"
              onClick={() => setPhoto('')}
              className="text-sm text-red-500 hover:text-red-700 mt-1"
            >
              Удалить фото
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Название / Имя *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="Клиника или ФИО специалиста" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Специализация</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="Наркологическая помощь" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Формат приёма</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '', label: 'Не указан' },
            { value: 'offline', label: 'Очно' },
            { value: 'online', label: 'Онлайн' },
            { value: 'both', label: 'Очно и Онлайн' }
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormat(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm transition-all ${
                format === opt.value
                  ? 'bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white shadow-md'
                  : 'bg-[#f5f3ed] border border-[#d4c9b0] text-[#3d3527] hover:bg-[#ebe8dc]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl resize-none" 
          rows={3}
          placeholder="Краткое описание услуг или специализации"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Телефон</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="+7 (999) 123-45-67" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="info@example.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Telegram</label>
          <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="@username или ссылка" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Сайт</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="https://example.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Город</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="Москва" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Адрес</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl" placeholder="ул. Примерная, д. 1" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
        <button onClick={handleSave} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">Сохранить</button>
      </div>
    </div>
  );
}
