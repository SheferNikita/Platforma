import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Send, Users, FileText, Plus, Edit, Trash2, CreditCard, Search, Filter, Check } from 'lucide-react';
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
}

const TARIFF_REMAINING_AMOUNTS: Record<string, string> = {
  BASIC: '4000',
  WITH_MENTOR: '14000',
  WITH_PSYCHOLOGIST: '23000',
  INDIVIDUAL_PSYCHOLOGIST: '42000',
  FAMILY: '4000'
};

export function EmailAdmin() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'prepayment'>('send');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

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
    loadTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === 'prepayment') {
      loadPrepaymentStudents();
    }
  }, [activeTab]);

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

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
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

  async function sendToAll() {
    if (!confirm('Отправить email всем активным ученикам?')) return;
    setSending(true);
    try {
      await api.post('/email/send-to-all', { subject, body });
      toast.success('Email отправлен всем ученикам');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отправки');
    } finally {
      setSending(false);
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
        amounts[s.id] = TARIFF_REMAINING_AMOUNTS[s.tariff] || '0';
      });
      setCustomAmounts(amounts);
    } catch (error: any) {
      console.error('Failed to load prepayment students:', error?.message || error);
      toast.error(error?.message || 'Ошибка загрузки списка');
    } finally {
      setLoadingPrepayment(false);
    }
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
          onClick={() => setActiveTab('templates')}
          className={`px-3 md:px-4 py-2 text-sm md:text-base rounded-xl transition-colors ${activeTab === 'templates' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <FileText className="w-4 h-4 inline-block mr-1 md:mr-2" />
          Шаблоны
        </button>
      </div>

      {activeTab === 'send' && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6">
          <form onSubmit={sendEmail} className="space-y-3 md:space-y-4">
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
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
              <button
                type="submit"
                disabled={sending || !to || !subject || !body}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 text-sm md:text-base"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
              <button
                type="button"
                onClick={sendToAll}
                disabled={sending || !subject || !body}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50 text-sm md:text-base"
              >
                <Users className="w-4 h-4" />
                Всем ученикам
              </button>
            </div>
          </form>
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
              <div className="flex flex-wrap gap-2">
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
                              onChange={(e) => setCustomAmounts(prev => ({ ...prev, [student.id]: e.target.value }))}
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
                              onChange={(e) => setCustomAmounts(prev => ({ ...prev, [student.id]: e.target.value }))}
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
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">{template ? 'Редактировать шаблон' : 'Новый шаблон'}</h2>
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
