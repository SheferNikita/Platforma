import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, Building, Eye, EyeOff, MapPin, Globe, Clock, User, Phone, X } from 'lucide-react';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  format: 'offline' | 'online';
  communityType: 'mixed' | 'dependent' | 'codependent';
  dayOfWeek: string;
  time: string;
  city?: string;
  address?: string;
  link?: string;
  leader: string;
  leaderContact: string;
  isPublished: boolean;
}

const FORMAT_OPTIONS = [
  { value: 'offline', label: 'Очная' },
  { value: 'online', label: 'Онлайн' }
];

const TYPE_OPTIONS = [
  { value: 'mixed', label: 'Смешанная' },
  { value: 'dependent', label: 'Для зависимых' },
  { value: 'codependent', label: 'Для созависимых' }
];

const DAY_OPTIONS = [
  'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'
];

export function CommunitiesAdmin() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline');
  const [sectionVisible, setSectionVisible] = useState(true);

  useEffect(() => { 
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [communitiesData, visibilityData] = await Promise.all([
        api.get<Community[]>('/content/communities'),
        api.get<{ value: string | null }>('/content/settings/communities_visible').catch(() => ({ value: null }))
      ]);
      setCommunities(communitiesData);
      setSectionVisible(visibilityData.value !== 'false');
    } catch (error) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }

  async function loadCommunities() {
    try {
      const data = await api.get<Community[]>('/content/communities');
      setCommunities(data);
    } catch (error) { toast.error('Ошибка загрузки'); }
  }

  async function toggleVisibility() {
    try {
      const newValue = !sectionVisible;
      await api.put('/content/settings/communities_visible', { value: newValue ? 'true' : 'false' });
      setSectionVisible(newValue);
      toast.success(newValue ? 'Раздел отображается у учеников' : 'Раздел скрыт у учеников');
    } catch (error) { toast.error('Ошибка сохранения'); }
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

  const filteredCommunities = communities.filter(c => c.format === activeTab);

  const getTypeLabel = (type: string) => {
    return TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Общины</h1>
          <p className="text-sm md:text-base text-[#3d3527]/60 mt-1">Управление общинами</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={toggleVisibility} 
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${sectionVisible ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
          >
            {sectionVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm">{sectionVisible ? 'Виден ученикам' : 'Скрыт от учеников'}</span>
          </button>
          <button onClick={() => { setEditingCommunity(null); setShowModal(true); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg">
            <Plus className="w-5 h-5" /> Добавить
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[#d4c9b0]/30">
        <button
          onClick={() => setActiveTab('offline')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'offline' ? 'text-[#a67c52] border-b-2 border-[#a67c52]' : 'text-[#3d3527]/60 hover:text-[#3d3527]'}`}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Очные ({communities.filter(c => c.format === 'offline').length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('online')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'online' ? 'text-[#a67c52] border-b-2 border-[#a67c52]' : 'text-[#3d3527]/60 hover:text-[#3d3527]'}`}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Онлайн ({communities.filter(c => c.format === 'online').length})
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>
        ) : filteredCommunities.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">
            {activeTab === 'offline' ? 'Нет очных общин' : 'Нет онлайн общин'}
          </div>
        ) : (
          filteredCommunities.map((community) => (
            <div key={community.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                  {activeTab === 'offline' ? <Building className="w-6 h-6 text-white" /> : <Globe className="w-6 h-6 text-white" />}
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
              
              <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-[#f5f3ed] text-[#3d3527]/80">
                {getTypeLabel(community.communityType)}
              </span>
              
              <div className="mt-3 space-y-1.5 text-sm text-[#3d3527]/80">
                {community.dayOfWeek && community.time && (
                  <p className="flex items-center gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    {community.dayOfWeek}, {community.time}
                  </p>
                )}
                
                {activeTab === 'offline' ? (
                  <>
                    {community.city && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        {community.city}
                      </p>
                    )}
                    {community.address && (
                      <p className="text-xs text-[#3d3527]/60 ml-6">{community.address}</p>
                    )}
                  </>
                ) : (
                  community.link && (
                    <p className="flex items-center gap-2">
                      <Globe className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{community.link}</span>
                    </p>
                  )
                )}
                
                {community.leader && (
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4 flex-shrink-0" />
                    {community.leader}
                  </p>
                )}
                {community.leaderContact && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{community.leaderContact}</span>
                  </p>
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
              <h2 className="text-lg md:text-xl font-bold text-[#3d3527]">{editingCommunity ? 'Редактировать' : 'Новая община'}</h2>
              <button onClick={() => { setShowModal(false); setEditingCommunity(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Закрыть">
                <X className="w-5 h-5 text-[#3d3527]" />
              </button>
            </div>
            <CommunityForm 
              community={editingCommunity} 
              onSave={saveCommunity} 
              onClose={() => { setShowModal(false); setEditingCommunity(null); }} 
              defaultFormat={activeTab}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CommunityForm({ community, onSave, onClose, defaultFormat }: { 
  community: Community | null; 
  onSave: (data: any) => void; 
  onClose: () => void;
  defaultFormat: 'offline' | 'online';
}) {
  const [name, setName] = useState(community?.name || '');
  const [format, setFormat] = useState<'offline' | 'online'>(community?.format || defaultFormat);
  const [communityType, setCommunityType] = useState(community?.communityType || 'mixed');
  const [dayOfWeek, setDayOfWeek] = useState(community?.dayOfWeek || '');
  const [time, setTime] = useState(community?.time || '');
  const [city, setCity] = useState(community?.city || '');
  const [address, setAddress] = useState(community?.address || '');
  const [link, setLink] = useState(community?.link || '');
  const [leader, setLeader] = useState(community?.leader || '');
  const [leaderContact, setLeaderContact] = useState(community?.leaderContact || '');

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Введите название');
      return;
    }
    onSave({ 
      name, 
      format, 
      communityType, 
      dayOfWeek, 
      time, 
      city: format === 'offline' ? city : null,
      address: format === 'offline' ? address : null,
      link: format === 'online' ? link : null,
      leader, 
      leaderContact 
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Название *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Формат</label>
          <select 
            value={format} 
            onChange={(e) => setFormat(e.target.value as 'offline' | 'online')} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none"
          >
            {FORMAT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Тип</label>
          <select 
            value={communityType} 
            onChange={(e) => setCommunityType(e.target.value as 'mixed' | 'dependent' | 'codependent')} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none"
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">День недели</label>
          <select 
            value={dayOfWeek} 
            onChange={(e) => setDayOfWeek(e.target.value)} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none"
          >
            <option value="">Выберите день</option>
            {DAY_OPTIONS.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Время</label>
          <input 
            type="time" 
            value={time} 
            onChange={(e) => setTime(e.target.value)} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" 
          />
        </div>
      </div>
      
      {format === 'offline' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Город</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Адрес</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка</label>
          <input 
            value={link} 
            onChange={(e) => setLink(e.target.value)} 
            className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" 
            placeholder="Ссылка на ТГ или 'можно получить у ведущего'"
          />
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Ведущий</label>
        <input value={leader} onChange={(e) => setLeader(e.target.value)} className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-[#3d3527] mb-1">Контакт ведущего</label>
        <input 
          value={leaderContact} 
          onChange={(e) => setLeaderContact(e.target.value)} 
          className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:ring-2 focus:ring-[#a67c52]/20 focus:border-[#a67c52] outline-none" 
          placeholder="Телефон или ссылка на ТГ"
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl transition-colors">Отмена</button>
        <button onClick={handleSave} className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-all">Сохранить</button>
      </div>
    </div>
  );
}
