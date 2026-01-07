import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Award, BookOpen, Target, Settings, Camera, CheckCircle, Trophy, Star, FileText, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
}

export function ProfileTab() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [userInfo, setUserInfo] = useState({
    name: 'Александр Иванов',
    email: 'alexander.ivanov@example.com',
    phone: '+7 (999) 123-45-67',
    city: 'Москва',
    joinDate: '2025-11-15',
    sobrietyStartDate: '2025-11-20',
    avatar: '',
  });

  const [achievements] = useState<Achievement[]>([
    {
      id: 1,
      title: 'Первый шаг',
      description: 'Начали свой путь к трезвости',
      icon: '🌟',
      earned: true,
      earnedDate: '2025-11-20',
    },
    {
      id: 2,
      title: 'Неделя трезвости',
      description: '7 дней без алкоголя',
      icon: '⭐',
      earned: true,
      earnedDate: '2025-11-27',
    },
    {
      id: 3,
      title: 'Прилежный ученик',
      description: 'Пройдено 3 урока',
      icon: '📚',
      earned: true,
      earnedDate: '2025-12-05',
    },
    {
      id: 4,
      title: 'Месяц трезвости',
      description: '30 дней без алкоголя',
      icon: '🏆',
      earned: false,
    },
    {
      id: 5,
      title: 'Активный участник',
      description: 'Посещено 5 групповых встреч',
      icon: '👥',
      earned: false,
    },
    {
      id: 6,
      title: 'Знаток курса',
      description: 'Пройдены все уроки',
      icon: '🎓',
      earned: false,
    },
  ]);

  const calculateSobrietyDays = () => {
    const start = new Date(userInfo.sobrietyStartDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const calculateMembershipDays = () => {
    const start = new Date(userInfo.joinDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const lessonsCompleted = 3;
  const totalLessons = 8;
  const progressPercentage = (lessonsCompleted / totalLessons) * 100;

  return (
    <div className="animate-fade-in">
      {/* Password Update Success Message */}
      {passwordUpdateSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-[var(--success-green)] text-white px-6 py-3 rounded-xl shadow-[0_8px_24px_rgba(34,197,94,0.4)] flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Пароль успешно обновлен</span>
          </div>
        </div>
      )}

      {/* Profile Update Success Message */}
      {profileUpdateSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-[var(--success-green)] text-white px-6 py-3 rounded-xl shadow-[0_8px_24px_rgba(34,197,94,0.4)] flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Профиль успешно обновлен</span>
          </div>
        </div>
      )}

      {/* Motivational Card - Mobile Only (at top) */}
      <div className="lg:hidden mb-6 border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/80 rounded-xl p-4 shadow-[0_8px_24px_var(--ethereal-shadow)]">
        <div className="text-center">
          <div className="text-2xl mb-2">✨</div>
          <p className="text-xs italic opacity-80 leading-relaxed">
            "Каждый день трезвости — это победа. Вы делаете большое дело!"
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8 border-b-2 border-[var(--book-border)]/30 pb-8 relative">
        <div className="absolute -top-2 left-0 w-20 h-1 bg-gradient-to-r from-[var(--button-lavender-dark)] via-[var(--button-lavender-light)] to-transparent rounded-full"></div>
        
        <h2 className="text-[#3a3a3a] mb-3">Мой профиль</h2>
        <p className="opacity-70 leading-relaxed">
          Личная информация, прогресс обучения и достижения на пути к трезвости.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden group">
            {/* Dove background */}
            <div className="absolute top-4 right-4 opacity-[0.04] pointer-events-none text-[120px]">
              🕊️
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="relative group/avatar">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-[var(--button-lavender-light)] to-[var(--button-lavender-dark)] p-1 shadow-[0_4px_16px_rgba(122,132,171,0.3)]">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-white to-[var(--sky-soft)] flex items-center justify-center overflow-hidden">
                      {userInfo.avatar ? (
                        <img src={userInfo.avatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 md:w-14 md:h-14 text-[var(--icon-lavender)]" />
                      )}
                    </div>
                  </div>
                  <button className="absolute bottom-0 right-0 w-10 h-10 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110">
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {!isEditing ? (
                      <h3 className="text-xl md:text-2xl mb-2">{userInfo.name}</h3>
                    ) : (
                      <input
                        type="text"
                        value={editableName}
                        onChange={(e) => setEditableName(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-[var(--button-lavender)]/60 rounded-xl focus:outline-none focus:border-[var(--button-lavender-dark)] transition-colors duration-200 text-xl md:text-2xl mb-2"
                        autoFocus
                      />
                    )}
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => {
                        setEditableName(userInfo.name);
                        setIsEditing(true);
                      }}
                      className="px-4 py-2 border-2 border-[var(--button-lavender)]/60 rounded-xl hover:bg-[var(--button-lavender)]/10 transition-all duration-300 text-sm flex items-center gap-2 transform hover:scale-105"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden md:inline">Редактировать</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setUserInfo({ ...userInfo, name: editableName });
                        setIsEditing(false);
                        setProfileUpdateSuccess(true);
                        setTimeout(() => {
                          setProfileUpdateSuccess(false);
                        }, 3000);
                      }}
                      className="w-10 h-10 bg-[var(--success-green)] hover:bg-[var(--success-green)]/80 rounded-xl flex items-center justify-center transition-all duration-200 transform hover:scale-105 shadow-md"
                    >
                      <CheckCircle className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 opacity-70">
                    <Mail className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0" />
                    <span className="truncate">{userInfo.email}</span>
                  </div>
                  <div>
                    {!isEditingPassword ? (
                      <>
                        <div className="flex items-center gap-2 opacity-70 mb-1">
                          <Lock className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0" />
                          <span>••••••••</span>
                        </div>
                        <button 
                          onClick={() => setIsEditingPassword(true)}
                          className="ml-6 text-xs text-[var(--button-lavender-dark)] hover:text-[var(--button-lavender)] transition-colors duration-200 underline"
                        >
                          сменить пароль
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <Lock className="w-4 h-4 text-[var(--icon-lavender)] flex-shrink-0 opacity-70" />
                          <input
                            type="text"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Введите новый пароль"
                            className="flex-1 px-3 py-2 border border-[var(--button-lavender)]/30 rounded-lg focus:outline-none focus:border-[var(--button-lavender-dark)] transition-colors duration-200 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              // Здесь логика сохранения пароля
                              console.log('Новый пароль:', newPassword);
                              setIsEditingPassword(false);
                              setNewPassword('');
                              setPasswordUpdateSuccess(true);
                              // Автоматически скрыть уведомление через 3 секунды
                              setTimeout(() => {
                                setPasswordUpdateSuccess(false);
                              }, 3000);
                            }}
                            className="w-8 h-8 bg-[var(--success-green)] hover:bg-[var(--success-green)]/80 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 shadow-md"
                          >
                            <CheckCircle className="w-5 h-5 text-white" />
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                            setIsEditingPassword(false);
                            setNewPassword('');
                          }}
                          className="ml-6 text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
                        >
                          отменить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Card */}
          <div className="border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-white/90 to-[var(--sky-soft)]/20 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-lg">Прогресс обучения</h4>
                <p className="text-sm opacity-60">Ваши успехи в прохождении курса</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="opacity-70">Пройдено уроков</span>
                  <span className="font-medium">{lessonsCompleted} из {totalLessons}</span>
                </div>
                <div className="w-full h-3 bg-gray-200/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(122,132,171,0.5)]"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-[var(--sky-light)]/30">
                <div className="text-center p-3 bg-white/60 rounded-xl">
                  <div className="text-2xl mb-1 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                    {lessonsCompleted}
                  </div>
                  <div className="text-xs opacity-60">Уроков пройдено</div>
                </div>
                <div className="text-center p-3 bg-white/60 rounded-xl">
                  <div className="text-2xl mb-1 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                    {achievements.filter(a => a.earned).length}
                  </div>
                  <div className="text-xs opacity-60">Достижений</div>
                </div>
                <div className="text-center p-3 bg-white/60 rounded-xl col-span-2 md:col-span-1">
                  <div className="text-2xl mb-1 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                    {calculateSobrietyDays()}
                  </div>
                  <div className="text-xs opacity-60">Дней трезвости</div>
                </div>
              </div>
            </div>
          </div>

          {/* My Content - Diaries & Notes */}
          <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-lg">Мои материалы</h4>
                <p className="text-sm opacity-60">Дневники и конспекты уроков</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/my-diaries')}
                className="group relative overflow-hidden p-6 rounded-xl border-2 border-[var(--button-lavender)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 hover:shadow-[0_8px_20px_rgba(139,149,188,0.3)] transition-all duration-300 transform hover:-translate-y-1 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 mb-4 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-[var(--button-lavender-dark)]" />
                  </div>
                  <h5 className="text-base mb-2">Мои дневники</h5>
                  <p className="text-xs opacity-70 leading-relaxed">Все заполненные дневники к урокам</p>
                  <div className="mt-4 text-sm opacity-60 flex items-center gap-1">
                    <span>3 записи</span>
                    <span className="ml-auto">→</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('/my-notes')}
                className="group relative overflow-hidden p-6 rounded-xl border-2 border-[var(--button-lavender)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-white/80 hover:shadow-[0_8px_20px_rgba(139,149,188,0.3)] transition-all duration-300 transform hover:-translate-y-1 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 mb-4 bg-gradient-to-br from-[var(--button-lavender-dark)]/20 to-[var(--button-lavender-light)]/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[var(--button-lavender-dark)]" />
                  </div>
                  <h5 className="text-base mb-2">Мои конспекты</h5>
                  <p className="text-xs opacity-70 leading-relaxed">Все заполненные конспекты к урокам</p>
                  <div className="mt-4 text-sm opacity-60 flex items-center gap-1">
                    <span>2 записи</span>
                    <span className="ml-auto">→</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Achievements */}
          <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 md:p-8 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-xl flex items-center justify-center shadow-lg">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-lg">Достижения</h4>
                <p className="text-sm opacity-60">Ваши награды на пути к трезвости</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    achievement.earned
                      ? 'bg-gradient-to-br from-[var(--button-lavender-light)]/10 to-[var(--button-lavender-dark)]/5 border-[var(--button-lavender-dark)]/30 shadow-sm'
                      : 'bg-gray-50/50 border-gray-200/50 opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-3xl ${achievement.earned ? '' : 'grayscale opacity-40'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-medium">{achievement.title}</h5>
                        {achievement.earned && (
                          <CheckCircle className="w-4 h-4 text-[var(--success-green)] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs opacity-70 mb-1">{achievement.description}</p>
                      {achievement.earned && achievement.earnedDate && (
                        <p className="text-xs opacity-50 italic">
                          Получено: {new Date(achievement.earnedDate).toLocaleDateString('ru-RU')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Stats & Quick Info */}
        <div className="space-y-6">
          {/* Motivational Card */}
          <div className="hidden lg:block border-2 border-[var(--button-lavender-dark)]/30 bg-gradient-to-br from-[var(--button-lavender-light)]/15 to-white/80 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow)]">
            <div className="text-center">
              <div className="text-4xl mb-3">✨</div>
              <p className="text-sm italic opacity-80 leading-relaxed">
                "Каждый день трезвости — это победа. Вы делаете большое дело!"
              </p>
            </div>
          </div>

          {/* Sobriety Tracker */}
          <div className="border-2 border-[var(--button-lavender-dark)]/40 bg-gradient-to-br from-white/90 to-[var(--button-lavender-light)]/10 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)] relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-[0.06] text-[100px] pointer-events-none">
              🕊️
            </div>
            <div className="text-center relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] rounded-full flex items-center justify-center shadow-lg">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div className="text-5xl mb-2 bg-gradient-to-br from-[var(--button-lavender-dark)] to-[var(--button-lavender-light)] bg-clip-text text-transparent">
                {calculateSobrietyDays()}
              </div>
              <p className="text-sm opacity-70 mb-1">
                {calculateSobrietyDays() === 1 ? 'день' : calculateSobrietyDays() < 5 ? 'дня' : 'дней'} трезвости
              </p>
              <p className="text-xs opacity-50 italic">
                С {new Date(userInfo.sobrietyStartDate).toLocaleDateString('ru-RU')}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="border-2 border-[var(--sky-light)]/40 bg-gradient-to-br from-white/90 to-white/50 rounded-2xl p-6 shadow-[0_8px_24px_var(--ethereal-shadow),0_2px_8px_var(--book-shadow)]">
            <h4 className="text-base mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-[var(--icon-lavender)]" />
              Быстрая статистика
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                <span className="text-sm opacity-70">Уроков пройдено</span>
                <span className="font-medium text-[var(--button-lavender-dark)]">{lessonsCompleted}/{totalLessons}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                <span className="text-sm opacity-70">Встреч посещено</span>
                <span className="font-medium text-[var(--button-lavender-dark)]">2</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--sky-soft)]/20 rounded-lg">
                <span className="text-sm opacity-70">Достижений</span>
                <span className="font-medium text-[var(--button-lavender-dark)]">{achievements.filter(a => a.earned).length}/{achievements.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}