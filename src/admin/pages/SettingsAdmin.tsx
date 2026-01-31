import React, { useState, useEffect, useRef } from 'react';
import { Settings, Upload, Save, RotateCcw, Mail, History, AlertCircle, Check, X, Play, Pause, Edit2, Loader2 } from 'lucide-react';
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

interface EmailTemplateHistory {
  id: string;
  templateId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
  templateName: string;
  templateCode: string;
}

interface UnifiedHistoryItem {
  id: string;
  type: 'setting' | 'template';
  label: string;
  field?: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
}

type TabType = 'general' | 'sos' | 'email' | 'history';

const fieldLabels: Record<string, string> = {
  name: 'Название',
  subject: 'Тема',
  body: 'Текст',
  description: 'Описание',
  isEnabled: 'Статус'
};

export function SettingsAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [history, setHistory] = useState<SettingHistory[]>([]);
  const [templateHistory, setTemplateHistory] = useState<EmailTemplateHistory[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', description: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const settingsData = await api.get<PlatformSetting[]>('/admin/settings');
      setSettings(settingsData);
      
      const values: Record<string, string> = {};
      settingsData.forEach(s => { values[s.key] = s.value || ''; });
      setEditedValues(values);
    } catch (error) {
      console.error('Load settings error:', error);
      toast.error('Ошибка загрузки настроек');
    }
    
    try {
      const historyData = await api.get<SettingHistory[]>('/admin/settings/history');
      setHistory(historyData);
    } catch (error) {
      console.error('Load history error:', error);
    }
    
    try {
      const templatesData = await api.get<EmailTemplate[]>('/admin/email-templates');
      setTemplates(templatesData);
    } catch (error) {
      console.error('Load templates error:', error);
    }
    
    try {
      const templateHistoryData = await api.get<EmailTemplateHistory[]>('/admin/email-templates/history');
      setTemplateHistory(templateHistoryData);
    } catch (error) {
      console.error('Load template history error:', error);
    }
    
    setLoading(false);
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

  function openEditTemplate(template: EmailTemplate) {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      description: template.description || ''
    });
  }

  async function saveTemplate() {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      await api.put(`/admin/email-templates/${editingTemplate.id}`, templateForm);
      toast.success('Шаблон сохранён');
      setEditingTemplate(null);
      loadData();
    } catch (error) {
      toast.error('Ошибка сохранения шаблона');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function rollbackTemplate(historyId: string) {
    try {
      await api.post(`/admin/email-templates/rollback/${historyId}`, {});
      toast.success('Изменение отменено');
      loadData();
    } catch (error) {
      toast.error('Ошибка отката');
    }
  }

  const unifiedHistory: UnifiedHistoryItem[] = [
    ...history.map(h => ({
      id: h.id,
      type: 'setting' as const,
      label: h.setting.label,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      changedAt: h.changedAt
    })),
    ...templateHistory.map(h => ({
      id: h.id,
      type: 'template' as const,
      label: h.templateName || 'Шаблон',
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      changedAt: h.changedAt
    }))
  ].sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

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
          <p className="text-sm text-[#3d3527]/60">Управляйте шаблонами email-уведомлений. Переменные указываются в формате {'{{переменная}}'}</p>
          {templates.length === 0 ? (
            <p className="text-[#3d3527]/60">Шаблоны пока не созданы</p>
          ) : (
            <div className="space-y-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="bg-white/60 rounded-xl p-4 border border-[#e8e4da]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[#3d3527]">{template.name}</h3>
                      <p className="text-sm text-[#3d3527]/60">{template.description || template.code}</p>
                      <p className="text-xs text-[#3d3527]/40 mt-1">Тема: {template.subject}</p>
                      {template.variables && template.variables.length > 0 && (
                        <p className="text-xs text-[#3d3527]/40 mt-1">
                          Переменные: {template.variables.map(v => `{{${v}}}`).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--button-lavender)]/20 text-[var(--button-lavender-dark)] rounded-lg text-sm hover:bg-[var(--button-lavender)]/30 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Редактировать
                      </button>
                      <button
                        onClick={() => toggleTemplate(template)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          template.isEnabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {template.isEnabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {template.isEnabled ? 'Вкл' : 'Откл'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#e8e4da]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#3d3527]">Редактирование шаблона</h2>
                <button onClick={() => setEditingTemplate(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#3d3527]/60 mt-1">Код: {editingTemplate.code}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#d4c9b0] rounded-lg focus:ring-2 focus:ring-[var(--button-lavender)] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Тема письма</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#d4c9b0] rounded-lg focus:ring-2 focus:ring-[var(--button-lavender)] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
                <input
                  type="text"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-[#d4c9b0] rounded-lg focus:ring-2 focus:ring-[var(--button-lavender)] focus:border-transparent"
                  placeholder="Краткое описание назначения шаблона"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-1">Текст письма</label>
                <textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                  rows={10}
                  className="w-full px-4 py-2 border border-[#d4c9b0] rounded-lg focus:ring-2 focus:ring-[var(--button-lavender)] focus:border-transparent font-mono text-sm"
                />
                {editingTemplate.variables && editingTemplate.variables.length > 0 && (
                  <p className="text-xs text-[#3d3527]/60 mt-2">
                    Доступные переменные: {editingTemplate.variables.map(v => `{{${v}}}`).join(', ')}
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-[#e8e4da] flex justify-end gap-3">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 border border-[#d4c9b0] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#3d3527]">История изменений</h2>
          {unifiedHistory.length === 0 ? (
            <p className="text-[#3d3527]/60">История пуста</p>
          ) : (
            <div className="space-y-2">
              {unifiedHistory.map(entry => (
                <div
                  key={`${entry.type}-${entry.id}`}
                  className="bg-white/60 rounded-xl p-4 border border-[#e8e4da] flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${entry.type === 'setting' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {entry.type === 'setting' ? 'Настройка' : 'Email-шаблон'}
                      </span>
                      <p className="font-medium text-[#3d3527]">
                        {entry.label}
                        {entry.field && <span className="text-[#3d3527]/60 text-sm ml-1">({fieldLabels[entry.field] || entry.field})</span>}
                      </p>
                    </div>
                    <p className="text-sm text-[#3d3527]/60">
                      {entry.changedBy} • {new Date(entry.changedAt).toLocaleString('ru')}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs">
                      <span className="text-red-500">Было: {truncateValue(entry.oldValue)}</span>
                      <span className="text-green-600">Стало: {truncateValue(entry.newValue)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => entry.type === 'setting' ? rollback(entry.id) : rollbackTemplate(entry.id)}
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
