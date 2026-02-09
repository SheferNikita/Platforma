import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import { Send, Users, FileText, Plus, Edit, Trash2, CreditCard, Search, Filter, Check, Eye, TestTube, History, X, ChevronDown, ChevronUp, Calendar, MapPin, UserCheck, UsersRound, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

interface PrepaymentStudent {
  id: string;
  userId: string;
  email: string;
  name: string;
  tariff: string;
  tariffName: string;
  reminderCount: number;
  createdAt: string;
  paymentLink: string;
  savedAmount: number;
}

interface MailingHistoryItem {
  id: string;
  type?: 'manual' | 'bulk';
  subject: string;
  recipients: number;
  sent: number;
  failed: number;
  filters: Record<string, string>;
  adminName: string;
  adminEmail: string;
  createdAt: string;
}

interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'cancelled' | 'error';
  sendMode: 'manual' | 'filtered';
  recipientCount: number;
  actualRecipients?: number;
  sent?: number;
  failed?: number;
  sentAt?: string;
  error?: string;
  filters: Record<string, string>;
  adminName: string;
  adminEmail: string;
  createdAt: string;
}

function toMskString(_date: Date): string {
  const nowUtc = Date.now();
  const mskMs = nowUtc + 3 * 60 * 60 * 1000;
  const msk = new Date(mskMs);
  const y = msk.getUTCFullYear();
  const m = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const d = String(msk.getUTCDate()).padStart(2, '0');
  const h = String(msk.getUTCHours()).padStart(2, '0');
  const min = String(msk.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function mskInputToUtc(mskDateTimeStr: string): string {
  const [datePart, timePart] = mskDateTimeStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hours - 3, minutes);
  return new Date(utcMs).toISOString();
}

function formatMskDateTime(isoString: string): string {
  const date = new Date(isoString);
  const mskMs = date.getTime() + 3 * 60 * 60 * 1000;
  const msk = new Date(mskMs);
  const day = String(msk.getUTCDate()).padStart(2, '0');
  const month = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const year = msk.getUTCFullYear();
  const hours = String(msk.getUTCHours()).padStart(2, '0');
  const minutes = String(msk.getUTCMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes} МСК`;
}

interface BulkFilters {
  tariff: string;
  gender: string;
  city: string;
  addictionType: string;
  surveyStatus: string;
  isClergy: string;
  hasPrepayment: string;
  miniGroupStatus: string;
  dateFrom: string;
  dateTo: string;
}

const TARIFF_LABELS: Record<string, string> = {
  BASIC: 'Базовый',
  FAMILY: 'Семейный',
  RELATIVE: 'Родственник участника',
  WITH_MENTOR: 'Идем с наставником',
  WITH_PSYCHOLOGIST: 'Идем с психологом',
  INDIVIDUAL_PSYCHOLOGIST: 'Индивидуально с психологом'
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Мужской',
  FEMALE: 'Женский'
};

const ADDICTION_LABELS: Record<string, string> = {
  ALCOHOL: 'Алкоголь',
  DRUGS: 'Наркотики',
  GAMBLING: 'Азартные игры',
  GAMING: 'Игромания',
  OTHER: 'Другое'
};

const TARIFF_REMAINING_AMOUNTS: Record<string, string> = {
  BASIC: '5000',
  WITH_MENTOR: '11000',
  WITH_PSYCHOLOGIST: '13000',
  INDIVIDUAL_PSYCHOLOGIST: '19000',
  FAMILY: '2000'
};

const emptyFilters: BulkFilters = {
  tariff: '',
  gender: '',
  city: '',
  addictionType: '',
  surveyStatus: '',
  isClergy: '',
  hasPrepayment: '',
  miniGroupStatus: '',
  dateFrom: '',
  dateTo: ''
};

export function EmailAdmin() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'prepayment' | 'history' | 'scheduled'>('send');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const [sendMode, setSendMode] = useState<'manual' | 'filtered'>('manual');
  const [bulkFilters, setBulkFilters] = useState<BulkFilters>({ ...emptyFilters });
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countingRecipients, setCountingRecipients] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [cities, setCities] = useState<string[]>([]);

  const [showPreview, setShowPreview] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const [mailingHistory, setMailingHistory] = useState<MailingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  const [prepaymentStudents, setPrepaymentStudents] = useState<PrepaymentStudent[]>([]);
  const [loadingPrepayment, setLoadingPrepayment] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [prepaymentFilters, setPrepaymentFilters] = useState({
    tariff: 'ALL',
    minReminders: '',
    maxReminders: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      loadTemplates(),
      loadFilterOptions(),
      loadScheduledEmails()
    ]);
  }, []);

  useEffect(() => {
    if (activeTab === 'prepayment') {
      loadPrepaymentStudents();
    }
    if (activeTab === 'history') {
      loadMailingHistory();
    }
    if (activeTab === 'scheduled') {
      loadScheduledEmails();
    }
  }, [activeTab, historyPage]);

  useEffect(() => {
    if (sendMode === 'filtered') {
      const timer = setTimeout(() => {
        countRecipients();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [bulkFilters, sendMode]);

  async function loadFilterOptions() {
    try {
      const data = await api.get<{ cities: string[] }>('/email/filter-options');
      setCities(data.cities);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  }

  async function countRecipients() {
    setCountingRecipients(true);
    try {
      const activeFilters: any = {};
      for (const [key, value] of Object.entries(bulkFilters)) {
        if (value) activeFilters[key] = value;
      }
      const data = await api.post<{ count: number }>('/email/count-recipients', { filters: activeFilters });
      setRecipientCount(data.count);
    } catch (error) {
      console.error('Failed to count recipients:', error);
      setRecipientCount(null);
    } finally {
      setCountingRecipients(false);
    }
  }

  async function loadTemplates() {
    try {
      const data = await api.get<EmailTemplate[]>('/email/templates');
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (sendMode === 'manual') {
      setSending(true);
      try {
        await api.post('/email/send', { to, subject, body });
        toast.success('Email отправлен');
        setTo('');
        setSubject('');
        setBody('');
      } catch (error: any) {
        toast.error(error.message || 'Ошибка отправки');
      } finally {
        setSending(false);
      }
    }
  }

  async function sendFiltered() {
    if (recipientCount === null || recipientCount === 0) {
      toast.error('Нет получателей по выбранным фильтрам');
      return;
    }
    if (!confirm(`Отправить email ${recipientCount} ученикам?`)) return;
    setSending(true);
    try {
      const activeFilters: any = {};
      for (const [key, value] of Object.entries(bulkFilters)) {
        if (value) activeFilters[key] = value;
      }
      const result = await api.post<{ message: string; sent: number; total: number; failed: number }>('/email/send-to-all', { subject, body, filters: activeFilters });
      toast.success(result.message);
      setSubject('');
      setBody('');
      setBulkFilters({ ...emptyFilters });
      setRecipientCount(null);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  }

  async function sendTestEmail() {
    if (!subject || !body) {
      toast.error('Заполните тему и текст письма');
      return;
    }
    setTestSending(true);
    try {
      const result = await api.post<{ message: string }>('/email/send-test', { subject, body });
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки');
    } finally {
      setTestSending(false);
    }
  }

  async function handleScheduleEmail() {
    if (!subject || !body) {
      toast.error('Заполните тему и текст письма');
      return;
    }
    if (!scheduledDateTime) {
      toast.error('Выберите дату и время отправки');
      return;
    }

    const utcTime = mskInputToUtc(scheduledDateTime);
    if (new Date(utcTime) <= new Date()) {
      toast.error('Время отправки должно быть в будущем');
      return;
    }

    const activeFilters: any = {};
    if (sendMode === 'filtered') {
      for (const [key, value] of Object.entries(bulkFilters)) {
        if (value) activeFilters[key] = value;
      }
    }

    setSending(true);
    try {
      const result = await api.post<{ message: string; recipientCount: number }>('/email/schedule', {
        subject,
        body,
        scheduledAt: utcTime,
        sendMode,
        to: sendMode === 'manual' ? to : undefined,
        filters: sendMode === 'filtered' ? activeFilters : undefined
      });
      toast.success(`Рассылка запланирована на ${formatMskDateTime(utcTime)} (${result.recipientCount} получателей)`);
      setSubject('');
      setBody('');
      setTo('');
      setIsScheduled(false);
      setScheduledDateTime('');
      setBulkFilters({ ...emptyFilters });
      setRecipientCount(null);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка планирования');
    } finally {
      setSending(false);
    }
  }

  async function loadScheduledEmails() {
    setLoadingScheduled(true);
    try {
      const data = await api.get<{ scheduled: ScheduledEmail[] }>('/email/scheduled');
      setScheduledEmails(data.scheduled);
    } catch (error) {
      console.error('Failed to load scheduled emails:', error);
    } finally {
      setLoadingScheduled(false);
    }
  }

  async function cancelScheduledEmail(id: string) {
    if (!confirm('Отменить запланированную рассылку?')) return;
    try {
      await api.delete(`/email/scheduled/${id}`);
      toast.success('Рассылка отменена');
      loadScheduledEmails();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отмены');
    }
  }

  async function loadMailingHistory() {
    setHistoryLoading(true);
    try {
      const data = await api.get<{ history: MailingHistoryItem[]; pagination: { total: number } }>(`/email/mailing-history?page=${historyPage}&limit=20`);
      setMailingHistory(data.history);
      setHistoryTotal(data.pagination.total);
    } catch (error) {
      console.error('Failed to load mailing history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveTemplate(data: Partial<EmailTemplate>) {
    try {
      if (editingTemplate) {
        await api.put(`/email/templates/${editingTemplate.id}`, data);
        toast.success('Шаблон обновлен');
      } else {
        await api.post('/email/templates', data);
        toast.success('Шаблон создан');
      }
      loadTemplates();
      setShowTemplateModal(false);
      setEditingTemplate(null);
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Удалить шаблон?')) return;
    try {
      await api.delete(`/email/templates/${id}`);
      toast.success('Шаблон удален');
      loadTemplates();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  function useTemplate(template: EmailTemplate) {
    setSubject(template.subject);
    setBody(template.body);
    setActiveTab('send');
  }

  async function loadPrepaymentStudents() {
    setLoadingPrepayment(true);
    try {
      const params = new URLSearchParams();
      if (prepaymentFilters.tariff !== 'ALL') params.append('tariff', prepaymentFilters.tariff);
      if (prepaymentFilters.minReminders) params.append('minReminders', prepaymentFilters.minReminders);
      if (prepaymentFilters.maxReminders) params.append('maxReminders', prepaymentFilters.maxReminders);
      if (prepaymentFilters.dateFrom) params.append('dateFrom', prepaymentFilters.dateFrom);
      if (prepaymentFilters.dateTo) params.append('dateTo', prepaymentFilters.dateTo);
      if (prepaymentFilters.search) params.append('search', prepaymentFilters.search);

      const data = await api.get<PrepaymentStudent[]>(`/students/prepayment-students?${params.toString()}`);
      setPrepaymentStudents(data);
      
      const amounts: Record<string, string> = {};
      data.forEach(s => {
        amounts[s.id] = s.savedAmount?.toString() || TARIFF_REMAINING_AMOUNTS[s.tariff] || '0';
      });
      setCustomAmounts(amounts);
    } catch (error: any) {
      console.error('Failed to load prepayment students:', error?.message || error);
      toast.error(error?.message || 'Ошибка загрузки списка');
    } finally {
      setLoadingPrepayment(false);
    }
  }

  async function saveAmount(studentId: string, amount: string) {
    const numAmount = parseInt(amount, 10) || 0;
    try {
      await api.patch(`/students/prepayment-amount/${studentId}`, { amount: numAmount });
    } catch (error) {
      console.error('Failed to save amount:', error);
    }
  }

  function handleAmountChange(studentId: string, value: string) {
    setCustomAmounts(prev => ({ ...prev, [studentId]: value }));
  }

  function toggleStudentSelection(id: string) {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudents(newSet);
  }

  function toggleAllStudents() {
    if (selectedStudents.size === prepaymentStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(prepaymentStudents.map(s => s.id)));
    }
  }

  async function sendPrepaymentReminders() {
    if (selectedStudents.size === 0) {
      toast.error('Выберите учеников для отправки');
      return;
    }

    if (!confirm(`Отправить напоминания ${selectedStudents.size} ученикам?`)) return;

    setSending(true);
    try {
      const remainingAmounts: Record<string, string> = {};
      selectedStudents.forEach(id => {
        remainingAmounts[id] = customAmounts[id] || '0';
      });

      const result = await api.post<{ sent: number; total: number; errors?: string[] }>('/students/send-prepayment-reminders', {
        studentIds: Array.from(selectedStudents),
        remainingAmounts
      });

      toast.success(`Отправлено ${result.sent} из ${result.total} напоминаний`);
      if (result.errors?.length) {
        result.errors.forEach(e => toast.error(e));
      }

      setSelectedStudents(new Set());
      loadPrepaymentStudents();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  }

  const activeFiltersCount = useMemo(() => {
    return Object.values(bulkFilters).filter(v => v !== '').length;
  }, [bulkFilters]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Email рассылки</h1>
        <p className="text-[#3d3527]/60 mt-1 text-sm md:text-base">Отправка писем ученикам</p>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-4">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-3 md:px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${activeTab === 'send' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <Send className="w-4 h-4 inline-block mr-1 md:mr-2" />
          <span className="hidden sm:inline">Отправить письмо</span>
          <span className="sm:hidden">Отправить</span>
        </button>
        <button
          onClick={() => setActiveTab('prepayment')}
          className={`px-3 md:px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${activeTab === 'prepayment' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <CreditCard className="w-4 h-4 inline-block mr-1 md:mr-2" />
          <span className="hidden sm:inline">Напоминания о доплате</span>
          <span className="sm:hidden">Доплата</span>
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-3 md:px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${activeTab === 'scheduled' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <Clock className="w-4 h-4 inline-block mr-1 md:mr-2" />
          <span className="hidden sm:inline">Запланированные</span>
          <span className="sm:hidden">План</span>
          {scheduledEmails.filter(s => s.status === 'pending').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[10px] font-bold">
              {scheduledEmails.filter(s => s.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 md:px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${activeTab === 'history' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <History className="w-4 h-4 inline-block mr-1 md:mr-2" />
          <span className="hidden sm:inline">История рассылок</span>
          <span className="sm:hidden">История</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-3 md:px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${activeTab === 'templates' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <FileText className="w-4 h-4 inline-block mr-1 md:mr-2" />
          Шаблоны
        </button>
      </div>

      {activeTab === 'send' && (
        <div className="space-y-4">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-[#3d3527]">Режим отправки:</span>
              <div className="flex bg-[#f5f3ed] rounded-xl p-1">
                <button
                  onClick={() => setSendMode('manual')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${sendMode === 'manual' ? 'bg-white shadow-sm text-[#3d3527] font-medium' : 'text-[#3d3527]/60 hover:text-[#3d3527]'}`}
                >
                  Ручной ввод
                </button>
                <button
                  onClick={() => setSendMode('filtered')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${sendMode === 'filtered' ? 'bg-white shadow-sm text-[#3d3527] font-medium' : 'text-[#3d3527]/60 hover:text-[#3d3527]'}`}
                >
                  <Filter className="w-3.5 h-3.5 inline-block mr-1" />
                  По фильтрам
                </button>
              </div>
            </div>

            {sendMode === 'manual' ? (
              <form onSubmit={handleSendEmail} className="space-y-3 md:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">
                    <span className="hidden sm:inline">Получатель (email или несколько через запятую)</span>
                    <span className="sm:hidden">Получатель (email)</span>
                  </label>
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">Тема письма</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">Текст письма (HTML)</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] font-mono text-xs md:text-sm"
                    rows={8}
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-[#f5f3ed]/50 border border-[#d4c9b0]/20 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                    />
                    <Clock className="w-4 h-4 text-[#a67c52]" />
                    <span className="text-sm font-medium text-[#3d3527]">Запланировать отправку</span>
                  </label>
                  {isScheduled && (
                    <div className="flex items-center gap-2 ml-auto">
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        min={toMskString(new Date())}
                        className="px-3 py-1.5 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-[#a67c52]"
                      />
                      <span className="text-xs text-[#3d3527]/60 font-medium">МСК</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 md:gap-3">
                  {isScheduled ? (
                    <button
                      type="button"
                      onClick={handleScheduleEmail}
                      disabled={sending || !to || !subject || !body || !scheduledDateTime}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-400 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 text-sm md:text-base"
                    >
                      <Clock className="w-4 h-4" />
                      {sending ? 'Планирование...' : 'Запланировать'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={sending || !to || !subject || !body}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 text-sm md:text-base"
                    >
                      <Send className="w-4 h-4" />
                      {sending ? 'Отправка...' : 'Отправить'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    disabled={!body}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed] transition-colors disabled:opacity-50 text-sm md:text-base"
                  >
                    <Eye className="w-4 h-4" />
                    Предпросмотр
                  </button>
                  <button
                    type="button"
                    onClick={sendTestEmail}
                    disabled={testSending || !subject || !body}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm md:text-base"
                  >
                    <TestTube className="w-4 h-4" />
                    {testSending ? 'Отправка...' : 'Протестировать'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-sm font-medium text-[#3d3527]"
                  >
                    <Filter className="w-4 h-4" />
                    Фильтры
                    {activeFiltersCount > 0 && (
                      <span className="px-2 py-0.5 bg-[#a67c52] text-white rounded-full text-xs">{activeFiltersCount}</span>
                    )}
                    {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={() => setBulkFilters({ ...emptyFilters })}
                      className="text-xs text-[#a67c52] hover:underline"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-[#f5f3ed]/50 rounded-xl border border-[#d4c9b0]/20">
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Тариф</label>
                      <select
                        value={bulkFilters.tariff}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, tariff: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        {Object.entries(TARIFF_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Пол</label>
                      <select
                        value={bulkFilters.gender}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, gender: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        {Object.entries(GENDER_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Город</label>
                      <select
                        value={bulkFilters.city}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, city: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        {cities.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Зависимость</label>
                      <select
                        value={bulkFilters.addictionType}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, addictionType: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        {Object.entries(ADDICTION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Опрос</label>
                      <select
                        value={bulkFilters.surveyStatus}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, surveyStatus: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        <option value="completed">Пройден</option>
                        <option value="not_completed">Не пройден</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Духовенство</label>
                      <select
                        value={bulkFilters.isClergy}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, isClergy: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        <option value="yes">Да</option>
                        <option value="no">Нет</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Предоплата</label>
                      <select
                        value={bulkFilters.hasPrepayment}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, hasPrepayment: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        <option value="yes">С предоплатой</option>
                        <option value="no">Без предоплаты</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Мини-группа</label>
                      <select
                        value={bulkFilters.miniGroupStatus}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, miniGroupStatus: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      >
                        <option value="">Все</option>
                        <option value="assigned">Распределены</option>
                        <option value="not_assigned">Не распределены</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Дата регистрации от</label>
                      <input
                        type="date"
                        value={bulkFilters.dateFrom}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, dateFrom: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#3d3527]/60 mb-1">Дата регистрации до</label>
                      <input
                        type="date"
                        value={bulkFilters.dateTo}
                        onChange={(e) => setBulkFilters({ ...bulkFilters, dateTo: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#d4c9b0]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a67c52]/50"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    {countingRecipients ? (
                      <span>Подсчёт получателей...</span>
                    ) : recipientCount !== null ? (
                      <span>Получателей: <strong>{recipientCount}</strong> {recipientCount === 1 ? 'ученик' : recipientCount < 5 ? 'ученика' : 'учеников'}</span>
                    ) : (
                      <span>Настройте фильтры для подсчёта получателей</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">Тема письма</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm md:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">Текст письма (HTML)</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-3 md:px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] font-mono text-xs md:text-sm"
                    rows={8}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#f5f3ed]/50 border border-[#d4c9b0]/20 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                    />
                    <Clock className="w-4 h-4 text-[#a67c52]" />
                    <span className="text-sm font-medium text-[#3d3527]">Запланировать отправку</span>
                  </label>
                  {isScheduled && (
                    <div className="flex items-center gap-2 ml-auto">
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        min={toMskString(new Date())}
                        className="px-3 py-1.5 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-[#a67c52]"
                      />
                      <span className="text-xs text-[#3d3527]/60 font-medium">МСК</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 md:gap-3">
                  {isScheduled ? (
                    <button
                      onClick={handleScheduleEmail}
                      disabled={sending || !subject || !body || !scheduledDateTime || recipientCount === null || recipientCount === 0}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-400 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 text-sm md:text-base"
                    >
                      <Clock className="w-4 h-4" />
                      {sending ? 'Планирование...' : `Запланировать (${recipientCount ?? 0})`}
                    </button>
                  ) : (
                    <button
                      onClick={sendFiltered}
                      disabled={sending || !subject || !body || recipientCount === null || recipientCount === 0}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 text-sm md:text-base"
                    >
                      <Send className="w-4 h-4" />
                      {sending ? 'Отправка...' : `Отправить (${recipientCount ?? 0})`}
                    </button>
                  )}
                  <button
                    onClick={() => setShowPreview(true)}
                    disabled={!body}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed] transition-colors disabled:opacity-50 text-sm md:text-base"
                  >
                    <Eye className="w-4 h-4" />
                    Предпросмотр
                  </button>
                  <button
                    onClick={sendTestEmail}
                    disabled={testSending || !subject || !body}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm md:text-base"
                  >
                    <TestTube className="w-4 h-4" />
                    {testSending ? 'Отправка...' : 'Протестировать'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
            </div>
          ) : mailingHistory.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-12 text-center text-[#3d3527]/60">
              История рассылок пуста
            </div>
          ) : (
            <div className="space-y-3">
              {mailingHistory.map((item) => (
                <div key={item.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#3d3527] truncate">{item.subject}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium flex-shrink-0 ${item.type === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.type === 'manual' ? 'Ручная' : 'Рассылка'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                          <Send className="w-3 h-3" />
                          Отправлено: {item.sent}
                        </span>
                        {item.failed > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs">
                            Ошибки: {item.failed}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">
                          <Users className="w-3 h-3" />
                          Всего: {item.recipients}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#3d3527]/50">
                        {new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-[#3d3527]/40 mt-1">{item.adminName}</p>
                    </div>
                  </div>
                  {Object.keys(item.filters).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#d4c9b0]/20">
                      <p className="text-xs text-[#3d3527]/50 mb-1.5">Применённые фильтры:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(item.filters).map(([key, value]) => (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-[#f5f3ed] text-[#3d3527] rounded-lg text-xs">
                            <span className="font-medium">{key}:</span> {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {historyTotal > 20 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    className="px-3 py-1.5 bg-white border border-[#d4c9b0] rounded-lg text-sm disabled:opacity-50 hover:bg-[#f5f3ed]"
                  >
                    Назад
                  </button>
                  <span className="px-3 py-1.5 text-sm text-[#3d3527]/60">
                    Страница {historyPage} из {Math.ceil(historyTotal / 20)}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => p + 1)}
                    disabled={historyPage >= Math.ceil(historyTotal / 20)}
                    className="px-3 py-1.5 bg-white border border-[#d4c9b0] rounded-lg text-sm disabled:opacity-50 hover:bg-[#f5f3ed]"
                  >
                    Вперед
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          {loadingScheduled ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
            </div>
          ) : scheduledEmails.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-12 text-center text-[#3d3527]/60">
              Нет запланированных рассылок
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledEmails.map((item) => (
                <div key={item.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#3d3527] truncate">{item.subject}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium flex-shrink-0 ${
                          item.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                          item.status === 'sent' ? 'bg-green-100 text-green-700' :
                          item.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.status === 'pending' ? 'Ожидает' :
                           item.status === 'sent' ? 'Отправлено' :
                           item.status === 'cancelled' ? 'Отменено' :
                           'Ошибка'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium flex-shrink-0 ${item.sendMode === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.sendMode === 'manual' ? 'Ручная' : 'По фильтрам'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs">
                          <Clock className="w-3 h-3" />
                          {formatMskDateTime(item.scheduledAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
                          <Users className="w-3 h-3" />
                          Получателей: {item.actualRecipients ?? item.recipientCount}
                        </span>
                        {item.status === 'sent' && (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                              <Send className="w-3 h-3" />
                              Отправлено: {item.sent}
                            </span>
                            {(item.failed ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs">
                                Ошибок: {item.failed}
                              </span>
                            )}
                          </>
                        )}
                        {item.error && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs">
                            {item.error}
                          </span>
                        )}
                      </div>

                      {Object.keys(item.filters).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(item.filters).map(([key, value]) => (
                            <span key={key} className="inline-flex items-center px-2 py-0.5 bg-[#f5f3ed] text-[#3d3527]/70 rounded-lg text-[10px]">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-[#3d3527]/50 mt-2">
                        {item.adminName} ({item.adminEmail}) · Создано: {formatMskDateTime(item.createdAt)}
                        {item.sentAt && ` · Отправлено: ${formatMskDateTime(item.sentAt)}`}
                      </div>
                    </div>

                    {item.status === 'pending' && (
                      <button
                        onClick={() => cancelScheduledEmail(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors flex-shrink-0"
                      >
                        <XCircle className="w-4 h-4" />
                        Отменить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prepayment' && (
        <div className="space-y-4">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d3527]/40" />
                  <input
                    type="text"
                    placeholder="Поиск по имени или email..."
                    value={prepaymentFilters.search}
                    onChange={(e) => setPrepaymentFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 overflow-x-auto">
                <select
                  value={prepaymentFilters.tariff}
                  onChange={(e) => setPrepaymentFilters(prev => ({ ...prev, tariff: e.target.value }))}
                  className="px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm"
                >
                  <option value="ALL">Все тарифы</option>
                  <option value="BASIC">Базовый</option>
                  <option value="WITH_MENTOR">Идем с наставником</option>
                  <option value="WITH_PSYCHOLOGIST">Идем с психологом</option>
                  <option value="INDIVIDUAL_PSYCHOLOGIST">Индивидуально с психологом</option>
                  <option value="FAMILY">Семейный</option>
                </select>
                <input
                  type="number"
                  placeholder="Мин. напом."
                  value={prepaymentFilters.minReminders}
                  onChange={(e) => setPrepaymentFilters(prev => ({ ...prev, minReminders: e.target.value }))}
                  className="w-24 px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Макс. напом."
                  value={prepaymentFilters.maxReminders}
                  onChange={(e) => setPrepaymentFilters(prev => ({ ...prev, maxReminders: e.target.value }))}
                  className="w-24 px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm"
                  min="0"
                />
                <input
                  type="date"
                  value={prepaymentFilters.dateFrom}
                  onChange={(e) => setPrepaymentFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm"
                />
                <input
                  type="date"
                  value={prepaymentFilters.dateTo}
                  onChange={(e) => setPrepaymentFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="px-3 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] text-sm"
                />
                <button
                  onClick={loadPrepaymentStudents}
                  className="px-4 py-2 bg-[#a67c52] text-white rounded-xl hover:bg-[#8b6844] transition-colors"
                >
                  <Filter className="w-4 h-4 inline-block mr-1" />
                  Применить
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-[#3d3527]/70">
              Найдено: {prepaymentStudents.length} | Выбрано: {selectedStudents.size}
            </div>
            <button
              onClick={sendPrepaymentReminders}
              disabled={sending || selectedStudents.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Отправка...' : `Отправить напоминания (${selectedStudents.size})`}
            </button>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
            {loadingPrepayment ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
              </div>
            ) : prepaymentStudents.length === 0 ? (
              <div className="text-center py-12 text-[#3d3527]/60">
                Ученики с предоплатой не найдены
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#f5f3ed]">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedStudents.size === prepaymentStudents.length && prepaymentStudents.length > 0}
                            onChange={toggleAllStudents}
                            className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#3d3527]">Имя</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#3d3527]">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#3d3527]">Тариф</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#3d3527]">Напоминаний</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#3d3527]">Сумма доплаты</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#3d3527]">Регистрация</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d4c9b0]/30">
                      {prepaymentStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-[#f5f3ed]/50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-[#3d3527]">{student.name}</td>
                          <td className="px-4 py-3 text-[#3d3527]/70 text-sm">{student.email}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-[#f5f3ed] text-[#3d3527] rounded-lg text-xs">
                              {student.tariffName}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {student.reminderCount > 0 ? (
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                                {student.reminderCount}
                              </span>
                            ) : (
                              <span className="text-[#3d3527]/40 text-sm">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={customAmounts[student.id] || ''}
                              onChange={(e) => handleAmountChange(student.id, e.target.value)}
                              onBlur={(e) => saveAmount(student.id, e.target.value)}
                              className="w-24 px-2 py-1 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-[#a67c52]"
                            />
                            <span className="text-[#3d3527]/60 text-sm ml-1">₽</span>
                          </td>
                          <td className="px-4 py-3 text-[#3d3527]/70 text-sm">
                            {new Date(student.createdAt).toLocaleDateString('ru-RU')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-[#d4c9b0]/30">
                  <div className="px-4 py-3 bg-[#f5f3ed] flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedStudents.size === prepaymentStudents.length && prepaymentStudents.length > 0}
                      onChange={toggleAllStudents}
                      className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                    />
                    <span className="text-sm text-[#3d3527]">Выбрать всех</span>
                  </div>
                  {prepaymentStudents.map((student) => (
                    <div key={student.id} className="p-4 hover:bg-[#f5f3ed]/50">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="w-4 h-4 mt-1 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#3d3527]">{student.name}</span>
                            {student.reminderCount > 0 && (
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                                {student.reminderCount} напом.
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#3d3527]/70">{student.email}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-1 bg-[#f5f3ed] text-[#3d3527] rounded-lg text-xs">
                              {student.tariffName}
                            </span>
                            <span className="text-xs text-[#3d3527]/60">
                              {new Date(student.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#3d3527]/70">Сумма:</span>
                            <input
                              type="text"
                              value={customAmounts[student.id] || ''}
                              onChange={(e) => handleAmountChange(student.id, e.target.value)}
                              onBlur={(e) => saveAmount(student.id, e.target.value)}
                              className="w-24 px-2 py-1 border border-[#d4c9b0] rounded-lg text-sm focus:outline-none focus:border-[#a67c52]"
                            />
                            <span className="text-[#3d3527]/60 text-sm">₽</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow"
            >
              <Plus className="w-5 h-5" /> Новый шаблон
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
              </div>
            ) : templates.length === 0 ? (
              <div className="col-span-full text-center py-12 text-[#3d3527]/60">Шаблоны не найдены</div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-[#3d3527]">{template.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => useTemplate(template)}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg text-[#a67c52]"
                        title="Использовать"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingTemplate(template); setShowTemplateModal(true); }}
                        className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                      >
                        <Edit className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#3d3527]/60">{template.subject}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onSave={saveTemplate}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
        />
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#d4c9b0]/30">
              <h2 className="text-lg font-bold text-[#3d3527]">Предпросмотр письма</h2>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-[#3d3527]" />
              </button>
            </div>
            {subject && (
              <div className="px-4 py-2 bg-[#f5f3ed] border-b border-[#d4c9b0]/20">
                <span className="text-xs text-[#3d3527]/50">Тема:</span>
                <span className="text-sm text-[#3d3527] ml-2 font-medium">{subject}</span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div
                className="bg-white rounded-lg shadow-sm mx-auto max-w-[600px]"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateModal({ template, onSave, onClose }: { template: EmailTemplate | null; onSave: (data: Partial<EmailTemplate>) => void; onClose: () => void }) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#3d3527]">{template ? 'Редактировать шаблон' : 'Новый шаблон'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Закрыть">
            <X className="w-5 h-5 text-[#3d3527]" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название шаблона</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Тема письма</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Текст письма (HTML)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] font-mono text-sm"
              rows={10}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => onSave({ name, subject, body })}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
