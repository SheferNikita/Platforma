import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Send, Users, FileText, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export function EmailAdmin() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'send' | 'templates'>('send');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#3d3527]">Email рассылки</h1>
        <p className="text-[#3d3527]/60 mt-1">Отправка писем ученикам</p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 rounded-xl transition-colors ${activeTab === 'send' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <Send className="w-4 h-4 inline-block mr-2" />
          Отправить письмо
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl transition-colors ${activeTab === 'templates' ? 'bg-[#a67c52] text-white' : 'bg-white text-[#3d3527] hover:bg-[#f5f3ed]'}`}
        >
          <FileText className="w-4 h-4 inline-block mr-2" />
          Шаблоны
        </button>
      </div>

      {activeTab === 'send' && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-6">
          <form onSubmit={sendEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">
                Получатель (email или несколько через запятую)
              </label>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                placeholder="email@example.com"
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
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={sending || !to || !subject || !body}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
              <button
                type="button"
                onClick={sendToAll}
                disabled={sending || !subject || !body}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:shadow-lg transition-shadow disabled:opacity-50"
              >
                <Users className="w-4 h-4" />
                Всем ученикам
              </button>
            </div>
          </form>
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
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
