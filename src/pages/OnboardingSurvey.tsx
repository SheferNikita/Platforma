import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' }
];

const ADDICTION_OPTIONS = [
  { value: 'alcohol', label: 'Алкогольная' },
  { value: 'drugs', label: 'Наркотическая' },
  { value: 'gambling', label: 'Игровая' },
  { value: 'food', label: 'Пищевая' },
  { value: 'codependency', label: 'Зависимость у родственника' },
  { value: 'other', label: 'Другая' }
];

const AGE_OPTIONS = [
  { value: '18-25', label: '18-25' },
  { value: '26-35', label: '26-35' },
  { value: '36-45', label: '36-45' },
  { value: '46-55', label: '46-55' },
  { value: '56+', label: '56+' }
];

export function OnboardingSurvey() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    city: '',
    gender: '',
    age: '',
    addictionTypes: [] as string[],
    isClergy: ''
  });

  // Redirect if not logged in
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect if survey already completed or tariff is BASIC/FAMILY (no survey needed)
  if (!authLoading && user?.surveyCompleted) {
    return <Navigate to="/" replace />;
  }
  
  // Skip survey for BASIC and FAMILY tariffs
  if (!authLoading && user && (user.tariff === 'BASIC' || user.tariff === 'FAMILY')) {
    return <Navigate to="/" replace />;
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--button-lavender)]"></div>
      </div>
    );
  }

  const handleAddictionToggle = (value: string) => {
    setForm(prev => {
      const types = prev.addictionTypes.includes(value)
        ? prev.addictionTypes.filter(t => t !== value)
        : [...prev.addictionTypes, value];
      return { ...prev, addictionTypes: types };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.city || !form.gender || !form.age || form.addictionTypes.length === 0 || !form.isClergy) {
      toast.error('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/survey', {
        city: form.city,
        gender: form.gender,
        age: form.age,
        addictionType: form.addictionTypes.join(','),
        isClergy: form.isClergy === 'yes'
      });
      toast.success('Спасибо за ответы!');
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-[#5b4a3f] mb-2 text-center">
          Добро пожаловать!
        </h1>
        <p className="text-[#8b7355] text-center mb-6">
          После ответа на эти вопросы, мы найдем для вас наставника и к началу курса откроем доступ ко всем материалам
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#5b4a3f] mb-2">
              Ваш город проживания (часовой пояс)
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Например: Москва (МСК)"
              className="w-full px-4 py-3 rounded-xl border border-[#d4c8b8] bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#a67c52]/30 text-[#5b4a3f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5b4a3f] mb-2">
              Ваш пол
            </label>
            <div className="flex gap-4">
              {GENDER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    form.gender === option.value
                      ? 'border-[#a67c52] bg-[#a67c52]/10 text-[#5b4a3f]'
                      : 'border-[#d4c8b8] bg-white/70 text-[#8b7355] hover:border-[#a67c52]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={option.value}
                    checked={form.gender === option.value}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    form.gender === option.value ? 'border-[#a67c52]' : 'border-[#d4c8b8]'
                  }`}>
                    {form.gender === option.value && (
                      <span className="w-2 h-2 rounded-full bg-[#a67c52]" />
                    )}
                  </span>
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5b4a3f] mb-2">
              Ваш возраст
            </label>
            <div className="grid grid-cols-5 gap-2">
              {AGE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center justify-center px-2 py-3 rounded-xl border cursor-pointer transition-all text-sm ${
                    form.age === option.value
                      ? 'border-[#a67c52] bg-[#a67c52]/10 text-[#5b4a3f]'
                      : 'border-[#d4c8b8] bg-white/70 text-[#8b7355] hover:border-[#a67c52]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="age"
                    value={option.value}
                    checked={form.age === option.value}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5b4a3f] mb-2">
              Какая у вас зависимость? (можно выбрать несколько)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ADDICTION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    form.addictionTypes.includes(option.value)
                      ? 'border-[#a67c52] bg-[#a67c52]/10 text-[#5b4a3f]'
                      : 'border-[#d4c8b8] bg-white/70 text-[#8b7355] hover:border-[#a67c52]/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={form.addictionTypes.includes(option.value)}
                    onChange={() => handleAddictionToggle(option.value)}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    form.addictionTypes.includes(option.value) ? 'border-[#a67c52] bg-[#a67c52]' : 'border-[#d4c8b8]'
                  }`}>
                    {form.addictionTypes.includes(option.value) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5b4a3f] mb-2">
              Являетесь ли Вы представителем духовенства (или членом семьи духовенства)?
            </label>
            <div className="flex gap-4">
              {[
                { value: 'yes', label: 'Да' },
                { value: 'no', label: 'Нет' }
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    form.isClergy === option.value
                      ? 'border-[#a67c52] bg-[#a67c52]/10 text-[#5b4a3f]'
                      : 'border-[#d4c8b8] bg-white/70 text-[#8b7355] hover:border-[#a67c52]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="isClergy"
                    value={option.value}
                    checked={form.isClergy === option.value}
                    onChange={(e) => setForm({ ...form, isClergy: e.target.value })}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    form.isClergy === option.value ? 'border-[#a67c52]' : 'border-[#d4c8b8]'
                  }`}>
                    {form.isClergy === option.value && (
                      <span className="w-2 h-2 rounded-full bg-[#a67c52]" />
                    )}
                  </span>
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#a67c52] hover:bg-[#8b6744] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Сохранение...' : 'Продолжить'}
          </button>
        </form>
      </div>
    </div>
  );
}
