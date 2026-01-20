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
  { value: 'codependency', label: 'Созависимость' },
  { value: 'other', label: 'Другая' }
];

export function OnboardingSurvey() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    city: '',
    gender: '',
    age: '',
    addictionType: ''
  });

  // Redirect if not logged in
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect if survey already completed
  if (!authLoading && user?.surveyCompleted) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.city || !form.gender || !form.age || !form.addictionType) {
      toast.error('Пожалуйста, заполните все поля');
      return;
    }

    const age = parseInt(form.age);
    if (isNaN(age) || age < 1 || age > 120) {
      toast.error('Укажите корректный возраст');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/survey', {
        city: form.city,
        gender: form.gender,
        age: age,
        addictionType: form.addictionType
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
          Пожалуйста, ответьте на несколько вопросов, чтобы мы могли лучше вам помочь
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
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="Введите возраст"
              className="w-full px-4 py-3 rounded-xl border border-[#d4c8b8] bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#a67c52]/30 text-[#5b4a3f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5b4a3f] mb-2">
              Какая у вас зависимость?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ADDICTION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    form.addictionType === option.value
                      ? 'border-[#a67c52] bg-[#a67c52]/10 text-[#5b4a3f]'
                      : 'border-[#d4c8b8] bg-white/70 text-[#8b7355] hover:border-[#a67c52]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="addictionType"
                    value={option.value}
                    checked={form.addictionType === option.value}
                    onChange={(e) => setForm({ ...form, addictionType: e.target.value })}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    form.addictionType === option.value ? 'border-[#a67c52]' : 'border-[#d4c8b8]'
                  }`}>
                    {form.addictionType === option.value && (
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
