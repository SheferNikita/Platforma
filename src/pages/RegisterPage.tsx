import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Lock, Mail, Eye, EyeOff, Heart, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      toast.error('Пароль должен быть минимум 6 символов');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', { name, email, password });
      await login(email, password);
      toast.success('Добро пожаловать на платформу!');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-8">
      <div className="fixed inset-0 bg-gradient-to-br from-[#fdfbf7] via-[#e3ebf1] to-[#f5f3ed]"></div>
      
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#7d9db5]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-[#b5cad9]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-[#a67c52]/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative w-full max-w-md mx-4 z-10">
        <div className="bg-gradient-to-br from-[#fdfbf7]/95 via-[#e3ebf1]/90 to-[#f5f3ed]/95 backdrop-blur-md rounded-3xl border-2 border-[#b5cad9]/30 shadow-[0_8px_32px_rgba(77,107,133,0.15)] p-8">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-3xl" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`
          }}></div>
          
          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform -rotate-3">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#3d3527]">Начните путь к трезвости</h1>
              <p className="text-[#3d3527]/60 mt-2">Создайте аккаунт на платформе</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-2">Ваше имя</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7d9db5]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-[#b5cad9]/50 bg-white/60 focus:border-[var(--button-lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/20 transition-all"
                    placeholder="Как вас зовут?"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7d9db5]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-[#b5cad9]/50 bg-white/60 focus:border-[var(--button-lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/20 transition-all"
                    placeholder="ваш@email.ru"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-2">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7d9db5]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-[#b5cad9]/50 bg-white/60 focus:border-[var(--button-lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/20 transition-all"
                    placeholder="Минимум 6 символов"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7d9db5] hover:text-[#3d3527] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3d3527] mb-2">Подтвердите пароль</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7d9db5]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-[#b5cad9]/50 bg-white/60 focus:border-[var(--button-lavender)] focus:outline-none focus:ring-2 focus:ring-[var(--button-lavender)]/20 transition-all"
                    placeholder="Повторите пароль"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] mt-6"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Регистрация...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    <span>Создать аккаунт</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[#b5cad9]/30 text-center space-y-3">
              <p className="text-sm text-[#3d3527]/60">
                Уже есть аккаунт?
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-[var(--button-lavender)]/50 text-[var(--button-lavender-dark)] rounded-xl hover:bg-[var(--button-lavender)]/10 transition-all font-medium"
              >
                Войти
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-[#7d9db5] hover:text-[#3d3527] text-sm transition-colors">
            Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  );
}
