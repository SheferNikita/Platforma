import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, BookOpen, ChevronDown, ChevronUp, Eye, EyeOff, ArrowUp, ArrowDown, Move, Check, X, Video, FileText, Upload, File, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { RichTextEditor } from '../../components/RichTextEditor';
import { KinescopePlayer } from '../../components/KinescopePlayer';

interface LessonVideo {
  id?: string;
  title?: string;
  url: string;
  order?: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration: string;
  order: number;
  isPublished: boolean;
  isTextOnly: boolean;
  publishAt: string | null;
  videos: LessonVideo[];
  showDiary: boolean;
  showNotes: boolean;
  diaryDescription: string;
  notesDescription: string;
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
  const [reorderingModules, setReorderingModules] = useState(false);
  const [reorderingLessons, setReorderingLessons] = useState<string | null>(null);
  const [savingModules, setSavingModules] = useState(false);
  const [savingLessons, setSavingLessons] = useState(false);
  const originalModulesRef = useRef<Module[]>([]);
  const originalLessonsRef = useRef<Record<string, Lesson[]>>({});

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
        const { nextOrder } = await api.get<{ nextOrder: number }>('/content/modules/next-order');
        await api.post('/content/modules', { ...data, order: nextOrder });
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
        const { nextOrder } = await api.get<{ nextOrder: number }>(`/content/lessons/next-order/${editingLesson?.moduleId}`);
        await api.post('/content/lessons', { ...data, moduleId: editingLesson?.moduleId, order: nextOrder });
        toast.success('Урок создан');
      }
      loadModules();
      setShowLessonModal(false);
      setEditingLesson(null);
    } catch (error: any) {
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

  function startReorderingModules() {
    originalModulesRef.current = modules.map(m => ({ ...m, lessons: [...m.lessons] }));
    setReorderingModules(true);
  }

  function moveModuleLocal(index: number, direction: 'up' | 'down') {
    const newModules = [...modules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModules.length) return;
    [newModules[index], newModules[targetIndex]] = [newModules[targetIndex], newModules[index]];
    setModules(newModules);
  }

  async function saveModulesReorder() {
    setSavingModules(true);
    try {
      const reorderData = modules.map((module, index) => ({ id: module.id, order: index + 1 }));
      await api.post('/content/modules/reorder-batch', { items: reorderData });
      toast.success('Порядок модулей сохранен');
      setReorderingModules(false);
      loadModules();
    } catch (error) {
      toast.error('Ошибка сохранения порядка');
    } finally {
      setSavingModules(false);
    }
  }

  function cancelModulesReorder() {
    setModules(originalModulesRef.current);
    setReorderingModules(false);
  }

  function startReorderingLessons(moduleId: string) {
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      originalLessonsRef.current[moduleId] = [...module.lessons];
    }
    setReorderingLessons(moduleId);
  }

  function moveLessonLocal(moduleId: string, lessonIndex: number, direction: 'up' | 'down') {
    const newModules = modules.map(m => {
      if (m.id !== moduleId) return m;
      const newLessons = [...m.lessons];
      const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
      if (targetIndex < 0 || targetIndex >= newLessons.length) return m;
      [newLessons[lessonIndex], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[lessonIndex]];
      return { ...m, lessons: newLessons };
    });
    setModules(newModules);
  }

  async function saveLessonsReorder(moduleId: string) {
    setSavingLessons(true);
    try {
      const module = modules.find(m => m.id === moduleId);
      if (!module) return;
      const reorderData = module.lessons.map((lesson, index) => ({ id: lesson.id, order: index + 1 }));
      await api.post('/content/lessons/reorder-batch', { moduleId, items: reorderData });
      toast.success('Порядок уроков сохранен');
      setReorderingLessons(null);
      loadModules();
    } catch (error) {
      toast.error('Ошибка сохранения порядка');
    } finally {
      setSavingLessons(false);
    }
  }

  function cancelLessonsReorder(moduleId: string) {
    const originalLessons = originalLessonsRef.current[moduleId];
    if (originalLessons) {
      const newModules = modules.map(m => {
        if (m.id !== moduleId) return m;
        return { ...m, lessons: originalLessons };
      });
      setModules(newModules);
    }
    setReorderingLessons(null);
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Уроки и модули</h1>
          <p className="text-[#3d3527]/60 mt-1 text-sm md:text-base">Управление содержанием курса</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {reorderingModules ? (
            <>
              <button
                onClick={cancelModulesReorder}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-white border border-[#d4c9b0] text-[#3d3527] rounded-xl hover:bg-[#f5f3ed] text-sm md:text-base"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" /> Отменить
              </button>
              <button
                onClick={saveModulesReorder}
                disabled={savingModules}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg disabled:opacity-50 text-sm md:text-base"
              >
                <Check className="w-4 h-4 md:w-5 md:h-5" /> {savingModules ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startReorderingModules}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-white border border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed] text-sm md:text-base"
              >
                <Move className="w-4 h-4 md:w-5 md:h-5" /> Переместить
              </button>
              <button
                onClick={() => { setEditingModule(null); setShowModuleModal(true); }}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow text-sm md:text-base"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" /> Добавить модуль
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
        {modules.map((module, moduleIndex) => (
          <div key={module.id} className="bg-white/80 backdrop-blur-md rounded-xl md:rounded-2xl border border-[#d4c9b0]/30 overflow-hidden">
            <div
              className="p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-[#f5f3ed]/50"
              onClick={() => !reorderingModules && setExpandedModule(expandedModule === module.id ? null : module.id)}
            >
              <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                {reorderingModules && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveModuleLocal(moduleIndex, 'up'); }}
                      disabled={moduleIndex === 0}
                      className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3 h-3 md:w-4 md:h-4 text-[#a67c52]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveModuleLocal(moduleIndex, 'down'); }}
                      disabled={moduleIndex === modules.length - 1}
                      className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3 h-3 md:w-4 md:h-4 text-[#a67c52]" />
                    </button>
                  </div>
                )}
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[#3d3527] text-sm md:text-base truncate">{module.title}</h3>
                  <p className="text-xs md:text-sm text-[#3d3527]/60">{module.lessons.length} уроков</p>
                </div>
                {!module.isPublished && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full hidden sm:inline-block">Черновик</span>
                )}
              </div>
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePublish('module', module.id, module.isPublished); }}
                  className="p-1.5 md:p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  {module.isPublished ? <Eye className="w-4 h-4 md:w-5 md:h-5 text-green-600" /> : <EyeOff className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingModule(module); setShowModuleModal(true); }}
                  className="p-1.5 md:p-2 hover:bg-[#f5f3ed] rounded-lg"
                >
                  <Edit className="w-4 h-4 md:w-5 md:h-5 text-[#3d3527]" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteModule(module.id); }}
                  className="p-1.5 md:p-2 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                </button>
                {!reorderingModules && (expandedModule === module.id ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />)}
              </div>
            </div>

            {expandedModule === module.id && (
              <div className="border-t border-[#d4c9b0]/30 p-3 md:p-4 space-y-2 md:space-y-3">
                <div className="flex flex-col sm:flex-row justify-end mb-2 gap-2">
                  {reorderingLessons === module.id ? (
                    <>
                      <button
                        onClick={() => cancelLessonsReorder(module.id)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs md:text-sm rounded-lg bg-white border border-[#d4c9b0] text-[#3d3527] hover:bg-[#f5f3ed]"
                      >
                        <X className="w-3 h-3 md:w-4 md:h-4" /> Отменить
                      </button>
                      <button
                        onClick={() => saveLessonsReorder(module.id)}
                        disabled={savingLessons}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs md:text-sm rounded-lg bg-[#a67c52] text-white hover:bg-[#8a6542] disabled:opacity-50"
                      >
                        <Check className="w-3 h-3 md:w-4 md:h-4" /> {savingLessons ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startReorderingLessons(module.id)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs md:text-sm rounded-lg bg-[#f5f3ed] text-[#3d3527] hover:bg-[#e8e4d9]"
                    >
                      <Move className="w-3 h-3 md:w-4 md:h-4" /> Переместить
                    </button>
                  )}
                </div>
                {module.lessons.map((lesson, lessonIndex) => (
                  <div key={lesson.id} className="flex items-center justify-between p-2 md:p-3 bg-[#f5f3ed]/50 rounded-lg md:rounded-xl">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      {reorderingLessons === module.id && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveLessonLocal(module.id, lessonIndex, 'up')}
                            disabled={lessonIndex === 0}
                            className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#a67c52]" />
                          </button>
                          <button
                            onClick={() => moveLessonLocal(module.id, lessonIndex, 'down')}
                            disabled={lessonIndex === module.lessons.length - 1}
                            className="p-1 hover:bg-[#a67c52]/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#a67c52]" />
                          </button>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#3d3527] text-sm md:text-base truncate">{lesson.title}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs md:text-sm text-[#3d3527]/60">{lesson.duration}</p>
                          {lesson.publishAt && new Date(lesson.publishAt) > new Date() && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                              <Clock className="w-3 h-3" />
                              {new Date(new Date(lesson.publishAt).getTime() + 3 * 60 * 60 * 1000).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} МСК
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                      <button
                        onClick={() => togglePublish('lesson', lesson.id, lesson.isPublished)}
                        className="p-1.5 md:p-2 hover:bg-white rounded-lg"
                        title={lesson.publishAt && new Date(lesson.publishAt) > new Date() ? 'Запланирована публикация' : (lesson.isPublished ? 'Опубликован' : 'Скрыт')}
                      >
                        {lesson.publishAt && new Date(lesson.publishAt) > new Date() ? (
                          <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                        ) : lesson.isPublished ? (
                          <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => { setEditingLesson({ lesson, moduleId: module.id }); setShowLessonModal(true); }}
                        className="p-1.5 md:p-2 hover:bg-white rounded-lg"
                      >
                        <Edit className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#3d3527]" />
                      </button>
                      <button
                        onClick={() => deleteLesson(lesson.id)}
                        className="p-1.5 md:p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => { setEditingLesson({ lesson: null, moduleId: module.id }); setShowLessonModal(true); }}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 text-[#a67c52] hover:bg-[#a67c52]/10 rounded-lg md:rounded-xl w-full justify-center text-sm md:text-base"
                >
                  <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> Добавить урок
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
  const [isPublished, setIsPublished] = useState(module?.isPublished ?? true);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold text-[#3d3527] mb-4">{module ? 'Редактировать модуль' : 'Новый модуль'}</h2>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-[#d4c9b0] rounded-lg sm:rounded-xl focus:outline-none focus:border-[#a67c52] text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-[#d4c9b0] rounded-lg sm:rounded-xl focus:outline-none focus:border-[#a67c52] text-sm sm:text-base"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
              />
              <span className="flex items-center gap-2 text-[#3d3527] text-sm sm:text-base">
                <Eye className="w-4 h-4" />
                Опубликован (виден ученикам)
              </span>
            </label>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-lg sm:rounded-xl text-sm sm:text-base">Отмена</button>
          <button
            onClick={() => onSave({ title, description, isPublished })}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-lg sm:rounded-xl text-sm sm:text-base"
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
  const [duration, setDuration] = useState(lesson?.duration || '');
  const [isTextOnly, setIsTextOnly] = useState(lesson?.isTextOnly || false);
  const [isPublished, setIsPublished] = useState(lesson?.isPublished ?? true);
  const [videos, setVideos] = useState<LessonVideo[]>(lesson?.videos || []);
  const [schedulePublish, setSchedulePublish] = useState(!!lesson?.publishAt);
  const [publishDate, setPublishDate] = useState(() => {
    if (lesson?.publishAt) {
      // Convert UTC to Moscow time (UTC+3) for display
      const utcDate = new Date(lesson.publishAt);
      const moscowDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
      return moscowDate.toISOString().split('T')[0];
    }
    return '';
  });
  const [publishTime, setPublishTime] = useState(() => {
    if (lesson?.publishAt) {
      // Convert UTC to Moscow time (UTC+3) for display
      const utcDate = new Date(lesson.publishAt);
      const moscowDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
      return moscowDate.toISOString().slice(11, 16);
    }
    return '09:00';
  });
  
  // Diary and Notes settings
  const [showDiary, setShowDiary] = useState(lesson?.showDiary ?? true);
  const [showNotes, setShowNotes] = useState(lesson?.showNotes ?? true);
  const [diaryDescription, setDiaryDescription] = useState(lesson?.diaryDescription || 'Запишите свои мысли, эмоции и впечатления от пройденного урока');
  const [notesDescription, setNotesDescription] = useState(lesson?.notesDescription || 'Запишите основные моменты урока, важные понятия и выводы');

  const addVideo = () => {
    setVideos([...videos, { url: '', title: '', order: videos.length }]);
  };

  const updateVideo = (index: number, field: keyof LessonVideo, value: string) => {
    const newVideos = [...videos];
    newVideos[index] = { ...newVideos[index], [field]: value };
    setVideos(newVideos);
  };

  const removeVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const moveVideo = (index: number, direction: 'up' | 'down') => {
    const newVideos = [...videos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newVideos.length) return;
    [newVideos[index], newVideos[targetIndex]] = [newVideos[targetIndex], newVideos[index]];
    setVideos(newVideos);
  };

  const handleSave = () => {
    const videosToSave = isTextOnly ? [] : videos.filter(v => v.url.trim()).map((v, i) => ({
      ...v,
      order: i
    }));
    
    let publishAt: string | null = null;
    if (schedulePublish && publishDate) {
      // Interpret time as Moscow time (UTC+3) and convert to UTC
      const moscowDateStr = `${publishDate}T${publishTime || '09:00'}:00+03:00`;
      publishAt = new Date(moscowDateStr).toISOString();
    }
    
    onSave({ 
      title, 
      description, 
      content, 
      duration, 
      isTextOnly, 
      isPublished: schedulePublish ? false : isPublished, 
      publishAt,
      videos: videosToSave,
      showDiary,
      showNotes,
      diaryDescription,
      notesDescription
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-4xl h-full sm:h-auto sm:my-8 sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold text-[#3d3527] mb-4">{lesson ? 'Редактировать урок' : 'Новый урок'}</h2>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-[#d4c9b0] rounded-lg sm:rounded-xl focus:outline-none focus:border-[#a67c52] text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-[#d4c9b0] rounded-lg sm:rounded-xl focus:outline-none focus:border-[#a67c52] text-sm sm:text-base"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Содержание урока</label>
            <RichTextEditor
              content={content}
              onChange={setContent}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-6 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isTextOnly}
                onChange={(e) => setIsTextOnly(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
              />
              <span className="flex items-center gap-2 text-[#3d3527] text-sm sm:text-base">
                <FileText className="w-4 h-4" />
                Текстовый урок (без видео)
              </span>
            </label>
            {!schedulePublish && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                />
                <span className="flex items-center gap-2 text-[#3d3527] text-sm sm:text-base">
                  <Eye className="w-4 h-4" />
                  Опубликован (виден ученикам)
                </span>
              </label>
            )}
          </div>

          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => {
                setSchedulePublish(!schedulePublish);
                if (!schedulePublish && !publishDate) {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setPublishDate(tomorrow.toISOString().split('T')[0]);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                schedulePublish 
                  ? 'bg-[#a67c52] text-white' 
                  : 'bg-[#f5f3ed] text-[#3d3527] hover:bg-[#e8e4d9]'
              }`}
            >
              <Clock className="w-4 h-4" />
              {schedulePublish ? 'Отложенная публикация активна' : 'Открыть урок позже'}
            </button>
            
            {schedulePublish && (
              <div className="flex flex-col sm:flex-row gap-3 p-4 bg-[#f5f3ed] rounded-xl">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Дата публикации
                  </label>
                  <input
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg focus:outline-none focus:border-[#a67c52]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#3d3527] mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Время публикации (МСК)
                  </label>
                  <input
                    type="time"
                    value={publishTime}
                    onChange={(e) => setPublishTime(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg focus:outline-none focus:border-[#a67c52]"
                  />
                </div>
              </div>
            )}
          </div>

          {!isTextOnly && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#3d3527]">
                  <Video className="w-4 h-4" />
                  Видео Kinescope
                </label>
                <button
                  type="button"
                  onClick={addVideo}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs sm:text-sm bg-[#a67c52]/10 text-[#a67c52] rounded-lg hover:bg-[#a67c52]/20"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Добавить видео
                </button>
              </div>
              
              {videos.length === 0 && (
                <div className="text-center py-4 sm:py-6 bg-[#f5f3ed] rounded-lg sm:rounded-xl text-[#3d3527]/60 text-sm">
                  Нет добавленных видео. Нажмите "Добавить видео" чтобы добавить.
                </div>
              )}

              {videos.map((video, index) => (
                <div key={index} className="p-3 sm:p-4 bg-[#f5f3ed] rounded-lg sm:rounded-xl space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-[#3d3527]">Видео {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveVideo(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-white rounded disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3d3527]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVideo(index, 'down')}
                        disabled={index === videos.length - 1}
                        className="p-1 hover:bg-white rounded disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3d3527]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        className="p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#3d3527]/60 mb-1">Название видео (опционально)</label>
                    <input
                      value={video.title || ''}
                      onChange={(e) => updateVideo(index, 'title', e.target.value)}
                      placeholder="Часть 1"
                      className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg focus:outline-none focus:border-[#a67c52] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#3d3527]/60 mb-1">Ссылка на Kinescope видео</label>
                    <input
                      value={video.url}
                      onChange={(e) => updateVideo(index, 'url', e.target.value)}
                      placeholder="https://kinescope.io/embed/123456789 или ID видео"
                      className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg focus:outline-none focus:border-[#a67c52] text-sm"
                    />
                  </div>
                  {video.url && (
                    <div className="mt-2">
                      <p className="text-xs text-[#3d3527]/60 mb-2">Предпросмотр:</p>
                      <div className="max-w-full sm:max-w-md">
                        <KinescopePlayer url={video.url} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Длительность</label>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-[#d4c9b0] rounded-lg sm:rounded-xl focus:outline-none focus:border-[#a67c52] text-sm sm:text-base"
              placeholder="30 минут"
            />
          </div>

          {/* Diary and Notes settings */}
          <div className="p-4 bg-[#f5f3ed] rounded-xl space-y-4">
            <h3 className="font-medium text-[#3d3527] flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Настройки дневника и конспекта
            </h3>
            
            {/* Diary settings */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDiary}
                  onChange={(e) => setShowDiary(e.target.checked)}
                  className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                />
                <span className="text-sm text-[#3d3527]">Показывать блок "Дневник к уроку"</span>
              </label>
              {showDiary && (
                <div className="ml-6">
                  <label className="block text-xs text-[#3d3527]/60 mb-1">Описание/подсказка для дневника</label>
                  <textarea
                    value={diaryDescription}
                    onChange={(e) => setDiaryDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg focus:outline-none focus:border-[#a67c52] text-sm"
                    rows={2}
                    placeholder="Запишите свои мысли, эмоции и впечатления от пройденного урока"
                  />
                </div>
              )}
            </div>
            
            {/* Notes settings */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNotes}
                  onChange={(e) => setShowNotes(e.target.checked)}
                  className="w-4 h-4 rounded border-[#d4c9b0] text-[#a67c52] focus:ring-[#a67c52]"
                />
                <span className="text-sm text-[#3d3527]">Показывать блок "Конспект к уроку"</span>
              </label>
              {showNotes && (
                <div className="ml-6">
                  <label className="block text-xs text-[#3d3527]/60 mb-1">Описание/подсказка для конспекта</label>
                  <textarea
                    value={notesDescription}
                    onChange={(e) => setNotesDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-[#d4c9b0] rounded-lg focus:outline-none focus:border-[#a67c52] text-sm"
                    rows={2}
                    placeholder="Запишите основные моменты урока, важные понятия и выводы"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-lg sm:rounded-xl text-sm sm:text-base">Отмена</button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-lg sm:rounded-xl text-sm sm:text-base"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
