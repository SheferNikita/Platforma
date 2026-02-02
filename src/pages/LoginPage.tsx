import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';
import { Lock, Mail, Eye, EyeOff, Heart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Добро пожаловать!');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
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
              {settings.logo ? (
                <img 
                  src={settings.logo} 
                  alt={settings.platformName || 'Платформа'} 
                  className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform rotate-3">
                  <Heart className="w-10 h-10 text-white" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-[#3d3527]">Вход на платформу</h1>
              <p className="text-[#3d3527]/60 mt-2">{settings.platformName || 'Платформа трезвости'}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    placeholder="••••••••"
                    required
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Вход...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Войти</span>
                  </>
                )}
              </button>
            </form>

            {settings.loginText ? (
              <div 
                className="mt-8 pt-6 border-t border-[#b5cad9]/30 text-center text-sm text-[#3d3527]/60"
                dangerouslySetInnerHTML={{ __html: settings.loginText.replace(/\n/g, '<br />') }}
              />
            ) : (
              <div className="mt-8 pt-6 border-t border-[#b5cad9]/30 text-center">
                <p className="text-sm text-[#3d3527]/60">
                  Доступ на платформу предоставляется после оплаты курса.
                  <br />
                  По вопросам обращайтесь к администратору.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
