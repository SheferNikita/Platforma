import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, BookOpen, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  videoUrl: string;
  duration: string;
  order: number;
  isPublished: boolean;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  isPublished: boolean;
  lessons: Lesson[];
}

export function LessonsAdmin() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ lesson: Lesson | null; moduleId: string } | null>(null);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);

  useEffect(() => {
    loadModules();
  }, []);

  async function loadModules() {
    try {
      const data = await api.get<Module[]>('/content/modules');
      setModules(data);
    } catch (error) {
      toast.error('Ошибка загрузки модулей');
    } finally {
      setLoading(false);
    }
  }

  async function saveModule(data: Partial<Module>) {
    try {
      if (editingModule?.id) {
        await api.put(`/content/modules/${editingModule.id}`, data);
        toast.success('Модуль обновлен');
      } else {
        await api.post('/content/modules', data);
        toast.success('Модуль создан');
      }
      loadModules();
      setShowModuleModal(false);
      setEditingModule(null);
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  }

  async function deleteModule(id: string) {
    if (!confirm('Удалить модуль и все его уроки?')) return;
    try {
      await api.delete(`/content/modules/${id}`);
      toast.success('Модуль удален');
      loadModules();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  async function saveLesson(data: Partial<Lesson>) {
    try {
      if (editingLesson?.lesson?.id) {
        await api.put(`/content/lessons/${editingLesson.lesson.id}`, data);
        toast.success('Урок обновлен');
      } else {
        await api.post('/content/lessons', { ...data, moduleId: editingLesson?.moduleId });
        toast.success('Урок создан');
      }
      loadModules();
      setShowLessonModal(false);
      setEditingLesson(null);
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  }

  async function deleteLesson(id: string) {
    if (!confirm('Удалить урок?')) return;
    try {
      await api.delete(`/content/lessons/${id}`);
      toast.success('Урок удален');
      loadModules();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  async function togglePublish(type: 'module' | 'lesson', id: string, isPublished: boolean) {
    try {
      await api.put(`/content/${type}s/${id}`, { isPublished: !isPublished });
      toast.success(isPublished ? 'Скрыто' : 'Опубликовано');
      loadModules();
    } catch (error) {
      toast.error('Ошибка');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Уроки и модули</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление содержанием курса</p>
        </div>
        <button
          onClick={() => { setEditingModule(null); setShowModuleModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow"
        >
          <Plus className="w-5 h-5" /> Добавить модуль
        </button>
      </div>

      <div className="space-y-4">
        {modules.map((module) => (
          <div key={module.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#f5f3ed]/50"
              onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-[#3d3527]">{module.title}</h3>
                  <p className="text-sm text-[#3d3527]/60">{module.lessons.length} уроков</p>
                </div>
                {!module.isPublished && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">Черновик</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePublish('module', module.id, module.isPublished); }}
                  className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  {module.isPublished ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingModule(module); setShowModuleModal(true); }}
                  className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  <Edit className="w-5 h-5 text-[#3d3527]" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteModule(module.id); }}
                  className="p-2 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-5 h-5 text-red-500" />
                </button>
                {expandedModule === module.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>

            {expandedModule === module.id && (
              <div className="border-t border-[#d4c9b0]/30 p-4 space-y-3">
                {module.lessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-[#f5f3ed]/50 rounded-xl">
                    <div>
                      <p className="font-medium text-[#3d3527]">{lesson.title}</p>
                      <p className="text-sm text-[#3d3527]/60">{lesson.duration}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish('lesson', lesson.id, lesson.isPublished)}
                        className="p-2 hover:bg-white rounded-lg"
                      >
                        {lesson.isPublished ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => { setEditingLesson({ lesson, moduleId: module.id }); setShowLessonModal(true); }}
                        className="p-2 hover:bg-white rounded-lg"
                      >
                        <Edit className="w-4 h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => deleteLesson(lesson.id)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => { setEditingLesson({ lesson: null, moduleId: module.id }); setShowLessonModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 text-[#a67c52] hover:bg-[#a67c52]/10 rounded-xl w-full justify-center"
                >
                  <Plus className="w-4 h-4" /> Добавить урок
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModuleModal && (
        <ModuleModal
          module={editingModule}
          onSave={saveModule}
          onClose={() => { setShowModuleModal(false); setEditingModule(null); }}
        />
      )}

      {showLessonModal && editingLesson && (
        <LessonModal
          lesson={editingLesson.lesson}
          onSave={saveLesson}
          onClose={() => { setShowLessonModal(false); setEditingLesson(null); }}
        />
      )}
    </div>
  );
}

function ModuleModal({ module, onSave, onClose }: { module: Module | null; onSave: (data: Partial<Module>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(module?.title || '');
  const [description, setDescription] = useState(module?.description || '');
  const [order, setOrder] = useState(module?.order || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">{module ? 'Редактировать модуль' : 'Новый модуль'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Порядок</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => onSave({ title, description, order })}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonModal({ lesson, onSave, onClose }: { lesson: Lesson | null; onSave: (data: Partial<Lesson>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(lesson?.title || '');
  const [description, setDescription] = useState(lesson?.description || '');
  const [content, setContent] = useState(lesson?.content || '');
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl || '');
  const [duration, setDuration] = useState(lesson?.duration || '');
  const [order, setOrder] = useState(lesson?.order || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">{lesson ? 'Редактировать урок' : 'Новый урок'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Содержание (HTML)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] font-mono text-sm"
              rows={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Ссылка на видео</label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Длительность</label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                placeholder="30 минут"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Порядок</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value))}
              className="w-32 px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => onSave({ title, description, content, videoUrl, duration, order })}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
