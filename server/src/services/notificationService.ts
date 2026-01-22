import { prisma } from '../db';
import { NotificationType } from '@prisma/client';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
}

export const notificationService = {
  async create(params: CreateNotificationParams) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        relatedId: params.relatedId,
      },
    });
  },

  async createForMentorReply(studentUserId: string, lessonTitle: string, lessonId: string) {
    return this.create({
      userId: studentUserId,
      type: 'MENTOR_REPLY',
      title: 'Новый ответ от наставника',
      message: `Наставник ответил на ваш вопрос к уроку "${lessonTitle}"`,
      link: `/lessons/${lessonId}`,
      relatedId: lessonId,
    });
  },

  async createForNewLesson(studentUserId: string, lessonTitle: string, lessonId: string, moduleTitle: string) {
    return this.create({
      userId: studentUserId,
      type: 'NEW_LESSON',
      title: 'Новый урок доступен',
      message: `Урок "${lessonTitle}" в модуле "${moduleTitle}" теперь открыт для изучения`,
      link: `/lessons/${lessonId}`,
      relatedId: lessonId,
    });
  },

  async createForNewModuleAccess(studentUserId: string, moduleTitle: string, moduleId: string) {
    return this.create({
      userId: studentUserId,
      type: 'NEW_MODULE_ACCESS',
      title: 'Открыт доступ к модулю',
      message: `Вам открыт доступ к модулю "${moduleTitle}"`,
      link: `/modules/${moduleId}`,
      relatedId: moduleId,
    });
  },

  async createForEventReminder24h(studentUserId: string, eventTitle: string, eventId: string) {
    return this.create({
      userId: studentUserId,
      type: 'EVENT_REMINDER_24H',
      title: 'Напоминание о мероприятии',
      message: `Мероприятие "${eventTitle}" начнется через 24 часа`,
      link: '/schedule',
      relatedId: eventId,
    });
  },

  async createForEventReminder1h(studentUserId: string, eventTitle: string, eventId: string) {
    return this.create({
      userId: studentUserId,
      type: 'EVENT_REMINDER_1H',
      title: 'Скоро начнется мероприятие',
      message: `Мероприятие "${eventTitle}" начнется через 1 час`,
      link: '/schedule',
      relatedId: eventId,
    });
  },

  async createForEventChanged(studentUserId: string, eventTitle: string, eventId: string) {
    return this.create({
      userId: studentUserId,
      type: 'EVENT_CHANGED',
      title: 'Изменение в расписании',
      message: `Время или дата мероприятия "${eventTitle}" изменились`,
      link: '/schedule',
      relatedId: eventId,
    });
  },

  async createForNewEvent(studentUserId: string, eventTitle: string, eventId: string) {
    return this.create({
      userId: studentUserId,
      type: 'NEW_EVENT',
      title: 'Новое мероприятие',
      message: `В расписание добавлено новое мероприятие "${eventTitle}"`,
      link: '/schedule',
      relatedId: eventId,
    });
  },

  async createForAccessExpires(studentUserId: string, moduleTitle: string, moduleId: string, daysLeft: number) {
    const typeMap: Record<number, NotificationType> = {
      14: 'ACCESS_EXPIRES_14D',
      7: 'ACCESS_EXPIRES_7D',
      1: 'ACCESS_EXPIRES_1D',
    };
    const type = typeMap[daysLeft] || 'ACCESS_EXPIRES_7D';
    
    return this.create({
      userId: studentUserId,
      type,
      title: 'Истекает доступ к модулю',
      message: `Доступ к модулю "${moduleTitle}" истекает через ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`,
      link: `/modules/${moduleId}`,
      relatedId: moduleId,
    });
  },

  async createForAddedToGroup(studentUserId: string, groupName: string, groupId: string) {
    return this.create({
      userId: studentUserId,
      type: 'ADDED_TO_GROUP',
      title: 'Добавление в мини-группу',
      message: `Вы добавлены в мини-группу "${groupName}"`,
      link: '/mini-groups',
      relatedId: groupId,
    });
  },

  async createForMentorChanged(studentUserId: string, groupName: string, mentorName: string, groupId: string) {
    return this.create({
      userId: studentUserId,
      type: 'MENTOR_CHANGED',
      title: 'Изменение наставника',
      message: `В группе "${groupName}" изменился наставник: ${mentorName}`,
      link: '/mini-groups',
      relatedId: groupId,
    });
  },

  async createForProgress(studentUserId: string, percentage: number, moduleTitle: string, moduleId: string) {
    const typeMap: Record<number, NotificationType> = {
      25: 'PROGRESS_25',
      50: 'PROGRESS_50',
      75: 'PROGRESS_75',
      100: 'PROGRESS_100',
    };
    const type = typeMap[percentage];
    if (!type) return null;

    const messages: Record<number, string> = {
      25: `Отличное начало! Вы прошли 25% модуля "${moduleTitle}"`,
      50: `Половина пути пройдена! 50% модуля "${moduleTitle}" завершено`,
      75: `Почти у цели! 75% модуля "${moduleTitle}" пройдено`,
      100: `Поздравляем! Вы полностью прошли модуль "${moduleTitle}"`,
    };

    return this.create({
      userId: studentUserId,
      type,
      title: percentage === 100 ? 'Поздравляем!' : 'Ваш прогресс',
      message: messages[percentage],
      link: `/modules/${moduleId}`,
      relatedId: moduleId,
    });
  },

  async createForSobrietyAnniversary(studentUserId: string, period: 'week' | 'month' | 'year', days: number) {
    const typeMap = {
      week: 'SOBRIETY_WEEK' as NotificationType,
      month: 'SOBRIETY_MONTH' as NotificationType,
      year: 'SOBRIETY_YEAR' as NotificationType,
    };
    
    const messages = {
      week: `Поздравляем с неделей трезвости! ${days} дней — отличный результат!`,
      month: `Поздравляем с месяцем трезвости! ${days} дней — вы молодец!`,
      year: `Поздравляем с годом трезвости! ${days} дней — это огромное достижение!`,
    };

    return this.create({
      userId: studentUserId,
      type: typeMap[period],
      title: 'Поздравляем!',
      message: messages[period],
      link: '/profile',
    });
  },

  async createForWelcome(studentUserId: string, name: string) {
    return this.create({
      userId: studentUserId,
      type: 'WELCOME',
      title: 'Добро пожаловать!',
      message: `Здравствуйте, ${name}! Рады приветствовать вас на платформе. Желаем успехов в обучении!`,
      link: '/',
    });
  },

  async createForNewLibraryItem(studentUserId: string, itemTitle: string, itemId: string) {
    return this.create({
      userId: studentUserId,
      type: 'NEW_LIBRARY_ITEM',
      title: 'Новый материал в библиотеке',
      message: `В библиотеку добавлен новый материал: "${itemTitle}"`,
      link: '/library',
      relatedId: itemId,
    });
  },

  async createForIncompleteLesson(studentUserId: string, lessonTitle: string, lessonId: string) {
    return this.create({
      userId: studentUserId,
      type: 'INCOMPLETE_LESSON',
      title: 'Напоминание об уроке',
      message: `Вы начали урок "${lessonTitle}", но ещё не завершили его`,
      link: `/lessons/${lessonId}`,
      relatedId: lessonId,
    });
  },

  async createBulkForAllStudents(
    createFn: (userId: string) => Promise<any>
  ) {
    const students = await prisma.student.findMany({
      select: { userId: true },
    });

    const notifications = await Promise.all(
      students.map(s => createFn(s.userId))
    );

    return notifications;
  },

  async createBulkForStudentsWithModuleAccess(
    moduleId: string,
    createFn: (userId: string) => Promise<any>
  ) {
    const accesses = await prisma.moduleAccess.findMany({
      where: { moduleId },
      select: { student: { select: { userId: true } } },
    });

    const notifications = await Promise.all(
      accesses.map(a => createFn(a.student.userId))
    );

    return notifications;
  },
};
