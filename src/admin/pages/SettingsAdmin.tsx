import React, { useState, useEffect, useRef } from 'react';
import { Settings, Upload, Save, RotateCcw, Mail, History, AlertCircle, Check, X, Play, Pause } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface PlatformSetting {
  id: string;
  key: string;
  value: string | null;
  label: string;
  category: string;
  type: string;
}

interface SettingHistory {
  id: string;
  settingId: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
  setting: { key: string; label: string };
}

interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
  variables: string[];
  isEnabled: boolean;
}

type TabType = 'general' | 'sos' | 'email' | 'history';

export function SettingsAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [history, setHistory] = useState<SettingHistory[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [settingsData, historyData, templatesData] = await Promise.all([
        api.get<PlatformSetting[]>('/admin/settings'),
        api.get<SettingHistory[]>('/admin/settings/history'),
        api.get<EmailTemplate[]>('/admin/email-templates')
      ]);
      setSettings(settingsData);
      setHistory(historyData);
      setTemplates(templatesData);
      
      const values: Record<string, string> = {};
      settingsData.forEach(s => { values[s.key] = s.value || ''; });
      setEditedValues(values);
    } catch (error) {
      console.error('Load settings error:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  }

  async function saveSetting(key: string) {
    setSaving(key);
    try {
      await api.put(`/admin/settings/${key}`, { value: editedValues[key] || null });
      toast.success('Настройка сохранена');
      loadData();
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(null);
    }
  }

  async function rollback(historyId: string) {
    try {
      await api.post(`/admin/settings/rollback/${historyId}`, {});
      toast.success('Настройка восстановлена');
      loadData();
    } catch (error) {
      toast.error('Ошибка отката');
    }
  }

  async function toggleTemplate(template: EmailTemplate) {
    try {
      await api.put(`/admin/email-templates/${template.id}`, { isEnabled: !template.isEnabled });
      toast.success(template.isEnabled ? 'Шаблон отключен' : 'Шаблон включен');
      loadData();
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  }

  function handleFileUpload(key: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setEditedValues(prev => ({ ...prev, [key]: base64 }));
    };
    reader.readAsDataURL(file);
  }

  const generalSettings = settings.filter(s => s.category === 'general');
  const sosSettings = settings.filter(s => s.category === 'sos');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--button-lavender)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-[var(--button-lavender-dark)]" />
        <h1 className="text-2xl font-bold text-[#3d3527]">Настройки платформы</h1>
      </div>

      <div className="flex gap-2 border-b border-[#e8e4da]">
        {[
          { id: 'general' as TabType, label: 'Общие', icon: Settings },
          { id: 'sos' as TabType, label: 'SOS', icon: AlertCircle },
          { id: 'email' as TabType, label: 'Email-уведомления', icon: Mail },
          { id: 'history' as TabType, label: 'История', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--button-lavender-dark)] text-[var(--button-lavender-dark)]'
                : 'border-transparent text-[#3d3527]/60 hover:text-[#3d3527]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          <SettingsSection
            title="Общие настройки"
            settings={generalSettings}
            editedValues={editedValues}
            setEditedValues={setEditedValues}
            saving={saving}
            onSave={saveSetting}
            onFileUpload={handleFileUpload}
          />
        </div>
      )}

      {activeTab === 'sos' && (
        <div className="space-y-6">
          <SettingsSection
            title="Настройки SOS-страницы"
            settings={sosSettings}
            editedValues={editedValues}
            setEditedValues={setEditedValues}
            saving={saving}
            onSave={saveSetting}
            onFileUpload={handleFileUpload}
          />
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#3d3527]">Email-шаблоны</h2>
          {templates.length === 0 ? (
            <p className="text-[#3d3527]/60">Шаблоны пока не созданы</p>
          ) : (
            <div className="space-y-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="bg-white/60 rounded-xl p-4 border border-[#e8e4da]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-[#3d3527]">{template.name}</h3>
                      <p className="text-sm text-[#3d3527]/60">{template.description || template.code}</p>
                      <p className="text-xs text-[#3d3527]/40 mt-1">Тема: {template.subject}</p>
                    </div>
                    <button
                      onClick={() => toggleTemplate(template)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        template.isEnabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {template.isEnabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {template.isEnabled ? 'Включен' : 'Отключен'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#3d3527]">История изменений</h2>
          {history.length === 0 ? (
            <p className="text-[#3d3527]/60">История пуста</p>
          ) : (
            <div className="space-y-2">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className="bg-white/60 rounded-xl p-4 border border-[#e8e4da] flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-[#3d3527]">{entry.setting.label}</p>
                    <p className="text-sm text-[#3d3527]/60">
                      {entry.changedBy} • {new Date(entry.changedAt).toLocaleString('ru')}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs">
                      <span className="text-red-500">Было: {truncateValue(entry.oldValue)}</span>
                      <span className="text-green-600">Стало: {truncateValue(entry.newValue)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => rollback(entry.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[var(--button-lavender)]/20 text-[var(--button-lavender-dark)] rounded-lg text-sm hover:bg-[var(--button-lavender)]/30 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Восстановить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncateValue(value: string | null): string {
  if (!value) return '(пусто)';
  if (value.startsWith('data:')) return '(файл)';
  if (value.length > 50) return value.slice(0, 50) + '...';
  return value;
}

interface SettingsSectionProps {
  title: string;
  settings: PlatformSetting[];
  editedValues: Record<string, string>;
  setEditedValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: string | null;
  onSave: (key: string) => void;
  onFileUpload: (key: string, file: File) => void;
}

function SettingsSection({ title, settings, editedValues, setEditedValues, saving, onSave, onFileUpload }: SettingsSectionProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="bg-white/60 rounded-xl p-6 border border-[#e8e4da]">
      <h2 className="text-lg font-semibold text-[#3d3527] mb-4">{title}</h2>
      <div className="space-y-4">
        {settings.map(setting => (
          <div key={setting.key} className="space-y-2">
            <label className="block text-sm font-medium text-[#3d3527]">{setting.label}</label>
            
            {setting.type === 'TEXT' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editedValues[setting.key] || ''}
                  onChange={(e) => setEditedValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                  className="flex-1 px-4 py-2 rounded-xl border border-[#e8e4da] bg-white/80 focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/50"
                />
                <button
                  onClick={() => onSave(setting.key)}
                  disabled={saving === setting.key}
                  className="px-4 py-2 bg-[var(--button-lavender)] text-white rounded-xl hover:bg-[var(--button-lavender-dark)] transition-colors disabled:opacity-50"
                >
                  {saving === setting.key ? '...' : <Save className="w-4 h-4" />}
                </button>
              </div>
            )}

            {setting.type === 'URL' && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={editedValues[setting.key] || ''}
                  onChange={(e) => setEditedValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                  placeholder="https://..."
                  className="flex-1 px-4 py-2 rounded-xl border border-[#e8e4da] bg-white/80 focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/50"
                />
                <button
                  onClick={() => onSave(setting.key)}
                  disabled={saving === setting.key}
                  className="px-4 py-2 bg-[var(--button-lavender)] text-white rounded-xl hover:bg-[var(--button-lavender-dark)] transition-colors disabled:opacity-50"
                >
                  {saving === setting.key ? '...' : <Save className="w-4 h-4" />}
                </button>
              </div>
            )}

            {setting.type === 'TEXTAREA' && (
              <div className="space-y-2">
                <textarea
                  value={editedValues[setting.key] || ''}
                  onChange={(e) => setEditedValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 rounded-xl border border-[#e8e4da] bg-white/80 focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/50 resize-none"
                />
                <button
                  onClick={() => onSave(setting.key)}
                  disabled={saving === setting.key}
                  className="px-4 py-2 bg-[var(--button-lavender)] text-white rounded-xl hover:bg-[var(--button-lavender-dark)] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving === setting.key ? 'Сохранение...' : <><Save className="w-4 h-4" /> Сохранить</>}
                </button>
              </div>
            )}

            {setting.type === 'IMAGE' && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={el => fileInputRefs.current[setting.key] = el}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileUpload(setting.key, file);
                  }}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  {editedValues[setting.key] && (
                    <img
                      src={editedValues[setting.key]}
                      alt={setting.label}
                      className="w-16 h-16 object-contain rounded-lg border border-[#e8e4da]"
                    />
                  )}
                  <button
                    onClick={() => fileInputRefs.current[setting.key]?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e8e4da] rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Загрузить изображение
                  </button>
                  <button
                    onClick={() => onSave(setting.key)}
                    disabled={saving === setting.key}
                    className="px-4 py-2 bg-[var(--button-lavender)] text-white rounded-xl hover:bg-[var(--button-lavender-dark)] transition-colors disabled:opacity-50"
                  >
                    {saving === setting.key ? '...' : <Save className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {setting.type === 'AUDIO' && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="audio/*"
                  ref={el => fileInputRefs.current[setting.key] = el}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileUpload(setting.key, file);
                  }}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  {editedValues[setting.key] && (
                    <audio controls className="h-10">
                      <source src={editedValues[setting.key]} />
                    </audio>
                  )}
                  <button
                    onClick={() => fileInputRefs.current[setting.key]?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e8e4da] rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Загрузить аудио
                  </button>
                  <button
                    onClick={() => onSave(setting.key)}
                    disabled={saving === setting.key}
                    className="px-4 py-2 bg-[var(--button-lavender)] text-white rounded-xl hover:bg-[var(--button-lavender-dark)] transition-colors disabled:opacity-50"
                  >
                    {saving === setting.key ? '...' : <Save className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
