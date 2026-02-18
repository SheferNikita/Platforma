import React, { useState, useEffect, useRef } from 'react';
import { Settings, Upload, Save, RotateCcw, Mail, History, AlertCircle, Check, X, Play, Pause, Edit2, Loader2, Eye, EyeOff, ChevronDown, Trash2, Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { EmailTemplateEditor } from '../../components/EmailTemplateEditor';

interface VisibilitySetting {
  enabled: boolean;
  tariffs: string[];
}

const TARIFF_OPTIONS = [
  { value: 'ALL', label: 'Все тарифы' },
  { value: 'BASIC', label: 'Базовый' },
  { value: 'FAMILY', label: 'Семейный' },
  { value: 'RELATIVE', label: 'Родственник' },
  { value: 'WITH_MENTOR', label: 'С наставником' },
  { value: 'WITH_PSYCHOLOGIST', label: 'С психологом' },
  { value: 'INDIVIDUAL_PSYCHOLOGIST', label: 'Индивидуальный психолог' },
];

const SECTION_ICONS: Record<string, string> = {
  visibility_lessons: '📚',
  visibility_mentor_responses: '💬',
  visibility_chats: '💬',
  visibility_library: '📖',
  visibility_schedule: '📅',
  visibility_mini_group: '👥',
  visibility_contacts: '📞',
  visibility_communities: '🏛️',
  visibility_sos: '🚨',
  visibility_profile: '👤',
};

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

type TabType = 'general' | 'sos' | 'visibility' | 'notifications' | 'email' | 'history';

const NOTIFICATION_GROUPS: { id: string; label: string; icon: string }[] = [
  { id: 'learning', label: 'Обучение', icon: '📚' },
  { id: 'mentoring', label: 'Наставничество', icon: '💬' },
  { id: 'access', label: 'Доступ к модулям', icon: '🔓' },
  { id: 'schedule', label: 'Расписание', icon: '📅' },
  { id: 'groups', label: 'Мини-группы', icon: '👥' },
  { id: 'sobriety', label: 'Трезвость', icon: '🎉' },
  { id: 'other', label: 'Прочее', icon: '📌' },
];

const NOTIFICATION_ITEMS: { key: string; label: string; group: string; description: string }[] = [
  { key: 'notif_NEW_LESSON', label: 'Новый урок', group: 'learning', description: 'Уведомление при открытии нового урока' },
  { key: 'notif_INCOMPLETE_LESSON', label: 'Напоминание об уроке', group: 'learning', description: 'Если ученик начал урок, но не завершил' },
  { key: 'notif_PROGRESS_25', label: 'Прогресс 25%', group: 'learning', description: 'Четверть модуля пройдена' },
  { key: 'notif_PROGRESS_50', label: 'Прогресс 50%', group: 'learning', description: 'Половина модуля пройдена' },
  { key: 'notif_PROGRESS_75', label: 'Прогресс 75%', group: 'learning', description: 'Три четверти модуля пройдены' },
  { key: 'notif_PROGRESS_100', label: 'Прогресс 100%', group: 'learning', description: 'Модуль полностью пройден' },
  { key: 'notif_MENTOR_REPLY', label: 'Ответ от наставника', group: 'mentoring', description: 'Наставник ответил на вопрос ученика' },
  { key: 'notif_NEW_MODULE_ACCESS', label: 'Открытие доступа', group: 'access', description: 'Ученику предоставлен доступ к модулю' },
  { key: 'notif_ACCESS_EXPIRES_14D', label: 'Истекает через 14 дней', group: 'access', description: 'Напоминание за 14 дней до окончания доступа' },
  { key: 'notif_ACCESS_EXPIRES_7D', label: 'Истекает через 7 дней', group: 'access', description: 'Напоминание за 7 дней до окончания доступа' },
  { key: 'notif_ACCESS_EXPIRES_1D', label: 'Истекает через 1 день', group: 'access', description: 'Напоминание за 1 день до окончания доступа' },
  { key: 'notif_NEW_EVENT', label: 'Новое мероприятие', group: 'schedule', description: 'Добавлено новое событие в расписание' },
  { key: 'notif_EVENT_CHANGED', label: 'Изменение в расписании', group: 'schedule', description: 'Изменились время или дата мероприятия' },
  { key: 'notif_EVENT_REMINDER_24H', label: 'Напоминание за 24 часа', group: 'schedule', description: 'За 24 часа до начала мероприятия' },
  { key: 'notif_EVENT_REMINDER_1H', label: 'Напоминание за 1 час', group: 'schedule', description: 'За 1 час до начала мероприятия' },
  { key: 'notif_ADDED_TO_GROUP', label: 'Добавление в группу', group: 'groups', description: 'Ученик добавлен в мини-группу' },
  { key: 'notif_MENTOR_CHANGED', label: 'Изменение наставника', group: 'groups', description: 'В группе сменился наставник' },
  { key: 'notif_SOBRIETY_WEEK', label: 'Неделя трезвости', group: 'sobriety', description: 'Поздравление с неделей трезвости' },
  { key: 'notif_SOBRIETY_MONTH', label: 'Месяц трезвости', group: 'sobriety', description: 'Поздравление с месяцем трезвости' },
  { key: 'notif_SOBRIETY_YEAR', label: 'Год трезвости', group: 'sobriety', description: 'Поздравление с годом трезвости' },
  { key: 'notif_WELCOME', label: 'Приветствие', group: 'other', description: 'При первом входе на платформу' },
  { key: 'notif_NEW_LIBRARY_ITEM', label: 'Новый материал', group: 'other', description: 'Добавлен новый материал в библиотеку' },
];

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
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({});
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [settingsData, historyData, templatesData, templateHistoryData, notifData] = await Promise.all([
        api.get<PlatformSetting[]>('/admin/settings'),
        api.get<SettingHistory[]>('/admin/settings/history').catch(() => [] as SettingHistory[]),
        api.get<EmailTemplate[]>('/admin/email-templates').catch(() => [] as EmailTemplate[]),
        api.get<EmailTemplateHistory[]>('/admin/email-templates/history').catch(() => [] as EmailTemplateHistory[]),
        api.get<Record<string, boolean>>('/admin/notification-settings').catch(() => ({} as Record<string, boolean>))
      ]);

      setSettings(settingsData);
      const values: Record<string, string> = {};
      settingsData.forEach(s => { values[s.key] = s.value || ''; });
      setEditedValues(values);
      setHistory(historyData);
      setTemplates(templatesData);
      setTemplateHistory(templateHistoryData);
      setNotifSettings(notifData);
    } catch (error) {
      console.error('Load settings error:', error);
      toast.error('Ошибка загрузки настроек');
    }
    
    setLoading(false);
  }

  async function saveSetting(key: string, overrideValue?: string) {
    setSaving(key);
    try {
      const value = overrideValue !== undefined ? overrideValue : editedValues[key];
      await api.put(`/admin/settings/${key}`, { value: value || null });
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

  async function toggleNotification(key: string) {
    const newValue = !notifSettings[key];
    setNotifSaving(key);
    setNotifSettings(prev => ({ ...prev, [key]: newValue }));
    console.log(`[NotifToggle] Sending PUT for key="${key}", value=${newValue}`);
    try {
      await api.put('/admin/notification-settings', { [key]: newValue });
      console.log(`[NotifToggle] Success for key="${key}"`);
      toast.success(newValue ? 'Уведомление включено' : 'Уведомление отключено');
    } catch (error: any) {
      console.error(`[NotifToggle] ERROR for key="${key}":`, error.message, error);
      setNotifSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Ошибка сохранения: ' + (error.message || 'неизвестная ошибка'));
    } finally {
      setNotifSaving(null);
    }
  }

  async function toggleAllInGroup(groupId: string, enable: boolean) {
    const groupItems = NOTIFICATION_ITEMS.filter(i => i.group === groupId);
    const updates: Record<string, boolean> = {};
    groupItems.forEach(item => { updates[item.key] = enable; });
    
    console.log(`[NotifToggle] Group "${groupId}" toggle, enable=${enable}, keys:`, Object.keys(updates));
    setNotifSettings(prev => ({ ...prev, ...updates }));
    try {
      await api.put('/admin/notification-settings', updates);
      console.log(`[NotifToggle] Group "${groupId}" success`);
      toast.success(enable ? 'Все уведомления группы включены' : 'Все уведомления группы отключены');
    } catch (error: any) {
      console.error(`[NotifToggle] Group "${groupId}" ERROR:`, error.message, error);
      loadData();
      toast.error('Ошибка сохранения: ' + (error.message || 'неизвестная ошибка'));
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
  const visibilitySettings = settings.filter(s => s.category === 'visibility');

  function parseVisibility(value: string | null): VisibilitySetting {
    try {
      return value ? JSON.parse(value) : { enabled: true, tariffs: ['ALL'] };
    } catch {
      return { enabled: true, tariffs: ['ALL'] };
    }
  }

  async function saveVisibility(key: string, newValue: VisibilitySetting) {
    setSaving(key);
    try {
      await api.put(`/admin/settings/${key}`, { value: JSON.stringify(newValue) });
      toast.success('Настройка сохранена');
      loadData();
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(null);
    }
  }

  function toggleVisibilityEnabled(key: string) {
    const current = parseVisibility(editedValues[key]);
    const newValue = { ...current, enabled: !current.enabled };
    setEditedValues(prev => ({ ...prev, [key]: JSON.stringify(newValue) }));
    saveVisibility(key, newValue);
  }

  function toggleTariff(key: string, tariff: string) {
    const current = parseVisibility(editedValues[key]);
    let newTariffs: string[];
    
    if (tariff === 'ALL') {
      newTariffs = current.tariffs.includes('ALL') ? [] : ['ALL'];
    } else {
      const withoutAll = current.tariffs.filter(t => t !== 'ALL');
      if (withoutAll.includes(tariff)) {
        newTariffs = withoutAll.filter(t => t !== tariff);
      } else {
        newTariffs = [...withoutAll, tariff];
      }
      if (newTariffs.length === 0) {
        newTariffs = ['ALL'];
      }
    }
    
    const newValue = { ...current, tariffs: newTariffs };
    setEditedValues(prev => ({ ...prev, [key]: JSON.stringify(newValue) }));
    saveVisibility(key, newValue);
  }

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

      <div className="flex gap-2 border-b border-[#e8e4da] overflow-x-auto">
        {[
          { id: 'general' as TabType, label: 'Общие', icon: Settings },
          { id: 'sos' as TabType, label: 'SOS', icon: AlertCircle },
          { id: 'visibility' as TabType, label: 'Видимость', icon: Eye },
          { id: 'notifications' as TabType, label: 'Уведомления', icon: Bell },
          { id: 'email' as TabType, label: 'Email-шаблоны', icon: Mail },
          { id: 'history' as TabType, label: 'История', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 md:px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${
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

      {activeTab === 'visibility' && (
        <div className="space-y-6">
          <div className="bg-white/60 rounded-xl p-4 md:p-6 border border-[#e8e4da]">
            <h2 className="text-lg font-semibold text-[#3d3527] mb-2">Видимость разделов</h2>
            <p className="text-sm text-[#3d3527]/60 mb-6">
              Управляйте видимостью разделов платформы для учеников. Отключённые разделы не будут показываться в навигации.
              Вы можете ограничить доступ для определённых тарифов.
            </p>
            
            <div className="space-y-4">
              {visibilitySettings.map(setting => {
                const visibility = parseVisibility(editedValues[setting.key]);
                const icon = SECTION_ICONS[setting.key] || '📁';
                
                return (
                  <div
                    key={setting.key}
                    className={`p-4 rounded-xl border transition-all ${
                      visibility.enabled 
                        ? 'bg-green-50/50 border-green-200' 
                        : 'bg-gray-50/50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <h3 className="font-medium text-[#3d3527]">{setting.label}</h3>
                          <p className="text-xs text-[#3d3527]/50">
                            {visibility.tariffs.includes('ALL') 
                              ? 'Доступен всем тарифам' 
                              : `Доступен: ${visibility.tariffs.map(t => TARIFF_OPTIONS.find(o => o.value === t)?.label || t).join(', ')}`
                            }
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleVisibilityEnabled(setting.key)}
                        disabled={saving === setting.key}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          visibility.enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        } ${saving === setting.key ? 'opacity-50' : ''}`}
                      >
                        {saving === setting.key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : visibility.enabled ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                        {visibility.enabled ? 'Виден' : 'Скрыт'}
                      </button>
                    </div>
                    
                    {visibility.enabled && (
                      <div className="mt-4 pt-4 border-t border-[#e8e4da]/50">
                        <p className="text-sm text-[#3d3527]/70 mb-2">Доступен для тарифов:</p>
                        <div className="flex flex-wrap gap-2">
                          {TARIFF_OPTIONS.map(option => {
                            const isSelected = option.value === 'ALL' 
                              ? visibility.tariffs.includes('ALL')
                              : visibility.tariffs.includes(option.value);
                            const isAllSelected = visibility.tariffs.includes('ALL');
                            
                            return (
                              <button
                                key={option.value}
                                onClick={() => toggleTariff(setting.key, option.value)}
                                disabled={saving === setting.key}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                  isSelected
                                    ? 'bg-[var(--button-lavender)] text-white'
                                    : isAllSelected && option.value !== 'ALL'
                                    ? 'bg-[var(--button-lavender)]/30 text-[var(--button-lavender-dark)] opacity-50'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                } ${saving === setting.key ? 'opacity-50' : ''}`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white/60 rounded-xl p-4 md:p-6 border border-[#e8e4da]">
            <h2 className="text-lg font-semibold text-[#3d3527] mb-2">Уведомления в колокольчике</h2>
            <p className="text-sm text-[#3d3527]/60 mb-6">
              Управляйте тем, какие уведомления получают ученики на платформе. Отключённые уведомления не будут создаваться.
            </p>

            <div className="space-y-6">
              {NOTIFICATION_GROUPS.map(group => {
                const items = NOTIFICATION_ITEMS.filter(i => i.group === group.id);
                const allEnabled = items.every(i => notifSettings[i.key] !== false);
                const someEnabled = items.some(i => notifSettings[i.key] !== false);

                return (
                  <div key={group.id} className="rounded-xl border border-[#e8e4da] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#f5f3ed]">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{group.icon}</span>
                        <h3 className="font-medium text-[#3d3527]">{group.label}</h3>
                        <span className="text-xs text-[#3d3527]/40 ml-1">
                          {items.filter(i => notifSettings[i.key] !== false).length}/{items.length}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleAllInGroup(group.id, !allEnabled)}
                        className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                          allEnabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {allEnabled ? 'Отключить все' : 'Включить все'}
                      </button>
                    </div>
                    <div className="divide-y divide-[#e8e4da]/50">
                      {items.map(item => {
                        const enabled = notifSettings[item.key] !== false;
                        return (
                          <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-[#f5f3ed]/30 transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-medium text-[#3d3527]">{item.label}</p>
                              <p className="text-xs text-[#3d3527]/50 truncate">{item.description}</p>
                            </div>
                            <button
                              onClick={() => toggleNotification(item.key)}
                              disabled={notifSaving === item.key}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                enabled ? 'bg-green-500' : 'bg-gray-300'
                              } ${notifSaving === item.key ? 'opacity-50' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
                <label className="block text-sm font-medium text-[#3d3527] mb-2">Текст письма</label>
                <EmailTemplateEditor
                  key={editingTemplate.id}
                  content={templateForm.body}
                  onChange={(html) => setTemplateForm(prev => ({ ...prev, body: html }))}
                  variables={editingTemplate.variables || []}
                />
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
  onSave: (key: string, overrideValue?: string) => void;
  onFileUpload: (key: string, file: File) => void;
}

function SettingsSection({ title, settings, editedValues, setEditedValues, saving, onSave, onFileUpload }: SettingsSectionProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="bg-white/60 rounded-xl p-4 md:p-6 border border-[#e8e4da]">
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
                  {editedValues[setting.key] && (
                    <button
                      onClick={() => {
                        setEditedValues(prev => ({ ...prev, [setting.key]: '' }));
                        onSave(setting.key, '');
                      }}
                      disabled={saving === setting.key}
                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                      title="Удалить изображение"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
