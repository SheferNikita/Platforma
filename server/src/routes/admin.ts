import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { sendEmail } from '../services/email';
import { emailTemplateService } from '../services/emailTemplateService';
import { runEmailTemplatesMigration } from '../migrations/updateEmailTemplates';
import { invalidateMediaCache } from './public';
import { invalidateNotificationSettingsCache } from '../services/notificationService';

const PLATFORM_URL = 'https://schkola-trezvosti.ru';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR'));

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR', 'ADMIN_ASSISTANT'] as const;
const curatorAllowedRoles = ['MENTOR', 'PSYCHOLOGIST', 'INTERN'] as const;

const createAdminSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  role: z.enum(adminRoles)
});

const updateAdminSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(adminRoles).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional()
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isCurator = req.user!.role === 'CURATOR';
    const admins = await prisma.user.findMany({
      where: {
        role: { in: isCurator ? [...curatorAllowedRoles] : ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR', 'ADMIN_ASSISTANT'] }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/mentors', async (req: AuthRequest, res: Response) => {
  try {
    const mentors = await prisma.user.findMany({
      where: {
        role: { in: ['MENTOR', 'PSYCHOLOGIST', 'INTERN'] },
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(mentors);
  } catch (error) {
    console.error('Get mentors error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/export-staff', async (req: AuthRequest, res: Response) => {
  try {
    const staffUsers = await prisma.user.findMany({
      where: {
        role: { in: ['MENTOR', 'PSYCHOLOGIST', 'INTERN'] },
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }]
    });

    const allGroups = await prisma.miniGroup.findMany({
      select: {
        id: true,
        chatLink: true,
        members: {
          select: {
            student: {
              select: {
                id: true,
                phone: true,
                user: { select: { name: true, email: true } }
              }
            }
          }
        }
      }
    });

    const psychStudents = await prisma.student.findMany({
      where: { assignedPsychologistId: { not: null } },
      select: {
        id: true,
        phone: true,
        assignedPsychologistId: true,
        user: { select: { name: true, email: true } }
      }
    });

    const roleLabels: Record<string, string> = {
      MENTOR: 'Наставник',
      PSYCHOLOGIST: 'Психолог',
      INTERN: 'Помощник'
    };

    const csvRows: string[] = [];
    const header = ['Роль', 'Имя сотрудника', 'Email сотрудника', 'Имя ученика', 'Email ученика', 'Телефон ученика'];
    csvRows.push(header.join(';'));

    for (const staff of staffUsers) {
      const students: { name: string; email: string; phone: string }[] = [];
      const seen = new Set<string>();

      const mentorGroups = allGroups.filter(g => {
        if (!g.chatLink) return false;
        try {
          const data = JSON.parse(g.chatLink);
          return (data.mentorIds || []).includes(staff.id);
        } catch { return false; }
      });
      for (const group of mentorGroups) {
        for (const member of group.members) {
          if (!member.student || !member.student.user) continue;
          if (!seen.has(member.student.id)) {
            seen.add(member.student.id);
            students.push({
              name: member.student.user.name || '',
              email: member.student.user.email || '',
              phone: member.student.phone || ''
            });
          }
        }
      }

      for (const s of psychStudents) {
        if (!s.user) continue;
        if (s.assignedPsychologistId === staff.id && !seen.has(s.id)) {
          seen.add(s.id);
          students.push({
            name: s.user.name || '',
            email: s.user.email || '',
            phone: s.phone || ''
          });
        }
      }

      if (students.length === 0) {
        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        csvRows.push([
          escape(roleLabels[staff.role] || staff.role),
          escape(staff.name),
          escape(staff.email),
          '', '', ''
        ].join(';'));
      } else {
        students.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        for (let i = 0; i < students.length; i++) {
          const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
          csvRows.push([
            i === 0 ? escape(roleLabels[staff.role] || staff.role) : '',
            i === 0 ? escape(staff.name) : '',
            i === 0 ? escape(staff.email) : '',
            escape(students[i].name),
            escape(students[i].email),
            escape(students[i].phone)
          ].join(';'));
        }
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=staff-export.csv');
    res.send('\uFEFF' + csvRows.join('\n'));
  } catch (error) {
    console.error('Export staff error:', error);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createAdminSchema.parse(req.body);

    if (req.user!.role !== 'SUPER_ADMIN' && data.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Только супер-админ может создавать супер-админов' });
    }
    
    if (req.user!.role === 'CURATOR' && !curatorAllowedRoles.includes(data.role as any)) {
      return res.status(403).json({ error: 'Вы можете создавать только наставников, психологов и помощников' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const admin = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entity: 'ADMIN',
        entityId: admin.id,
        details: { email: admin.email, role: admin.role }
      }
    });

    try {
      const emailData = await emailTemplateService.getTeamInviteEmail({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        loginUrl: `${PLATFORM_URL}/admin`
      });

      await sendEmail(
        data.email,
        emailData.subject,
        emailData.body
      );
    } catch (emailError) {
      console.error('Failed to send team invite email:', emailError);
    }

    res.status(201).json(admin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateAdminSchema.parse(req.body);

    const targetAdmin = await prisma.user.findUnique({ where: { id } });
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    if (req.user!.role !== 'SUPER_ADMIN') {
      if (targetAdmin.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Недостаточно прав для редактирования супер-админа' });
      }
      if (data.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Только супер-админ может назначать роль супер-админа' });
      }
    }
    
    if (req.user!.role === 'CURATOR') {
      if (!curatorAllowedRoles.includes(targetAdmin.role as any)) {
        return res.status(403).json({ error: 'Вы можете редактировать только наставников, психологов и помощников' });
      }
      if (data.role && !curatorAllowedRoles.includes(data.role as any)) {
        return res.status(403).json({ error: 'Вы можете назначать только роли наставника, психолога или помощника' });
      }
    }

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const admin = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entity: 'ADMIN',
        entityId: admin.id,
        details: data
      }
    });

    res.json(admin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
    }

    const targetAdmin = await prisma.user.findUnique({ where: { id } });
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    if (req.user!.role !== 'SUPER_ADMIN' && targetAdmin.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Недостаточно прав для удаления супер-админа' });
    }
    
    if (req.user!.role === 'CURATOR' && !curatorAllowedRoles.includes(targetAdmin.role as any)) {
      return res.status(403).json({ error: 'Вы можете удалять только наставников, психологов и помощников' });
    }

    // Clear related records before deleting admin
    // 1. Delete admin logs created by this user
    await prisma.adminLog.deleteMany({
      where: { userId: id }
    });

    // 2. Set repliedById to null in diaries where this admin replied
    await prisma.diary.updateMany({
      where: { repliedById: id },
      data: { repliedById: null }
    });

    // 3. Set repliedById to null in student notes where this admin replied
    await prisma.studentNote.updateMany({
      where: { repliedById: id },
      data: { repliedById: null }
    });

    await prisma.user.delete({
      where: { id }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entity: 'ADMIN',
        entityId: id
      }
    });

    res.json({ message: 'Администратор удален' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.adminLog.findMany({
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(logs);
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const DEFAULT_SETTINGS: Array<{
  key: string;
  label: string;
  category: string;
  type: 'TEXT' | 'TEXTAREA' | 'URL' | 'FILE' | 'IMAGE';
  value: string;
}> = [
  { key: 'platformName', label: 'Название платформы', category: 'general', type: 'TEXT', value: 'Платформа трезвости' },
  { key: 'supportLink', label: 'Ссылка поддержки', category: 'general', type: 'URL', value: '' },
  { key: 'loginText', label: 'Текст на странице входа', category: 'general', type: 'TEXTAREA', value: '' },
  { key: 'logo', label: 'Логотип', category: 'general', type: 'IMAGE', value: '' },
  { key: 'favicon', label: 'Фавикон', category: 'general', type: 'IMAGE', value: '' },
  { key: 'sosChatLink', label: 'Ссылка на чат поддержки (SOS)', category: 'sos', type: 'URL', value: '' },
  { key: 'sosAudioFile', label: 'Голосовой файл (SOS)', category: 'sos', type: 'FILE', value: '' },
  { key: 'visibility_lessons', label: 'Уроки', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_mentor_responses', label: 'Ответы наставника', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_chats', label: 'Чаты', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_library', label: 'Библиотека', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_schedule', label: 'Расписание', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_mini_group', label: 'Мини-группа', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_contacts', label: 'Контакты', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_communities', label: 'Общины', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_sos', label: 'SOS', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
  { key: 'visibility_profile', label: 'Профиль', category: 'visibility', type: 'TEXT', value: '{"enabled":true,"tariffs":["ALL"]}' },
];

async function ensureDefaultSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    const existing = await prisma.platformSetting.findUnique({ where: { key: setting.key } });
    if (!existing) {
      await prisma.platformSetting.create({ data: setting });
    }
  }
}

const settingsRoles = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/settings', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaultSettings();
    const settings = await prisma.platformSetting.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const updateSettingSchema = z.object({
  value: z.string().nullable()
});

router.put('/settings/:key', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = updateSettingSchema.parse(req.body);
    
    const setting = await prisma.platformSetting.findUnique({ where: { key } });
    if (!setting) {
      return res.status(404).json({ error: 'Настройка не найдена' });
    }
    
    await prisma.platformSettingHistory.create({
      data: {
        settingId: setting.id,
        oldValue: setting.value,
        newValue: value,
        changedBy: req.user!.name || req.user!.email
      }
    });
    
    const updated = await prisma.platformSetting.update({
      where: { key },
      data: { value }
    });
    
    if (key === 'logo' || key === 'favicon') {
      invalidateMediaCache(key);
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/settings/history', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const history = await prisma.platformSettingHistory.findMany({
      include: {
        setting: { select: { key: true, label: true } }
      },
      orderBy: { changedAt: 'desc' },
      take: 100
    });
    res.json(history);
  } catch (error) {
    console.error('Get settings history error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/settings/rollback/:historyId', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { historyId } = req.params;
    
    const historyEntry = await prisma.platformSettingHistory.findUnique({
      where: { id: historyId },
      include: { setting: true }
    });
    
    if (!historyEntry) {
      return res.status(404).json({ error: 'Запись истории не найдена' });
    }
    
    await prisma.platformSettingHistory.create({
      data: {
        settingId: historyEntry.settingId,
        oldValue: historyEntry.setting.value,
        newValue: historyEntry.oldValue,
        changedBy: `${req.user!.name || req.user!.email} (откат)`
      }
    });
    
    const updated = await prisma.platformSetting.update({
      where: { id: historyEntry.settingId },
      data: { value: historyEntry.oldValue }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Rollback setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const NOTIFICATION_TYPES = [
  { key: 'notif_MENTOR_REPLY', label: 'Ответ от наставника', group: 'mentoring' },
  { key: 'notif_NEW_LESSON', label: 'Новый урок', group: 'learning' },
  { key: 'notif_INCOMPLETE_LESSON', label: 'Напоминание об уроке', group: 'learning' },
  { key: 'notif_PROGRESS_25', label: 'Прогресс 25%', group: 'learning' },
  { key: 'notif_PROGRESS_50', label: 'Прогресс 50%', group: 'learning' },
  { key: 'notif_PROGRESS_75', label: 'Прогресс 75%', group: 'learning' },
  { key: 'notif_PROGRESS_100', label: 'Прогресс 100%', group: 'learning' },
  { key: 'notif_NEW_MODULE_ACCESS', label: 'Открытие доступа к модулю', group: 'access' },
  { key: 'notif_ACCESS_EXPIRES_14D', label: 'Истекает доступ (14 дней)', group: 'access' },
  { key: 'notif_ACCESS_EXPIRES_7D', label: 'Истекает доступ (7 дней)', group: 'access' },
  { key: 'notif_ACCESS_EXPIRES_1D', label: 'Истекает доступ (1 день)', group: 'access' },
  { key: 'notif_NEW_EVENT', label: 'Новое мероприятие', group: 'schedule' },
  { key: 'notif_EVENT_CHANGED', label: 'Изменение в расписании', group: 'schedule' },
  { key: 'notif_EVENT_REMINDER_24H', label: 'Напоминание за 24 часа', group: 'schedule' },
  { key: 'notif_EVENT_REMINDER_1H', label: 'Напоминание за 1 час', group: 'schedule' },
  { key: 'notif_ADDED_TO_GROUP', label: 'Добавление в мини-группу', group: 'groups' },
  { key: 'notif_MENTOR_CHANGED', label: 'Изменение наставника', group: 'groups' },
  { key: 'notif_SOBRIETY_WEEK', label: 'Юбилей: неделя трезвости', group: 'sobriety' },
  { key: 'notif_SOBRIETY_MONTH', label: 'Юбилей: месяц трезвости', group: 'sobriety' },
  { key: 'notif_SOBRIETY_YEAR', label: 'Юбилей: год трезвости', group: 'sobriety' },
  { key: 'notif_WELCOME', label: 'Приветствие', group: 'other' },
  { key: 'notif_NEW_LIBRARY_ITEM', label: 'Новый материал в библиотеке', group: 'other' },
];

async function ensureNotificationSettings() {
  for (const nt of NOTIFICATION_TYPES) {
    const existing = await prisma.platformSetting.findUnique({ where: { key: nt.key } });
    if (!existing) {
      await prisma.platformSetting.create({
        data: {
          key: nt.key,
          label: nt.label,
          category: 'notifications',
          type: 'TEXT',
          value: 'true',
        },
      });
    }
  }
}

router.get('/notification-settings', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    await ensureNotificationSettings();
    const settings = await prisma.platformSetting.findMany({
      where: { category: 'notifications' },
    });
    const result: Record<string, boolean> = {};
    for (const s of settings) {
      result[s.key] = s.value !== 'false';
    }
    res.json(result);
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/notification-settings', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body as Record<string, boolean>;
    for (const [key, enabled] of Object.entries(updates)) {
      if (!key.startsWith('notif_')) continue;

      const setting = await prisma.platformSetting.findUnique({ where: { key } });
      if (setting) {
        const oldValue = setting.value;
        const newValue = String(enabled);

        await prisma.platformSettingHistory.create({
          data: {
            settingId: setting.id,
            oldValue,
            newValue,
            changedBy: (req as any).user?.email || 'admin',
          },
        });

        await prisma.platformSetting.update({
          where: { key },
          data: { value: newValue },
        });
      }
    }

    invalidateNotificationSettingsCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const DEFAULT_EMAIL_TEMPLATES = [
  {
    code: 'welcome_email',
    name: 'Приветственное письмо',
    subject: 'Добро пожаловать на платформу',
    description: 'Отправляется при создании аккаунта ученика',
    variables: ['name', 'email', 'password', 'loginUrl'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Добро пожаловать на платформу</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Добро пожаловать!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Ваш личный кабинет на обучающей платформе создан. Ниже вы найдёте данные для входа.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Ваши данные для входа</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Логин (email):</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{email}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Пароль:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #fff; padding: 4px 8px; border-radius: 4px;">{{password}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(166, 124, 82, 0.3);">Войти в личный кабинет</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0; color: #3d3527; opacity: 0.7; font-size: 14px; line-height: 1.6; text-align: center;">Рекомендуем сменить пароль после первого входа в настройках профиля.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center; border-top: 1px solid #d4c9b0;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 13px;">Если у вас возникли вопросы, свяжитесь с нами.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  },
  {
    code: 'new_lesson',
    name: 'Новый урок',
    subject: 'Открыт новый урок: {{lessonTitle}}',
    description: 'Отправляется при публикации нового урока',
    variables: ['studentName', 'lessonTitle', 'moduleName', 'lessonUrl'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Открыт новый урок</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">📚</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Открыт новый урок!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{studentName}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Для вас открыт новый урок. Не пропустите новый материал!</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Модуль:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{moduleName}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Урок:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #a67c52; font-size: 16px; font-weight: 600;">{{lessonTitle}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{lessonUrl}}" style="display: inline-block; background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(166, 124, 82, 0.3);">Перейти к уроку</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  },
  {
    code: 'team_invite',
    name: 'Приглашение в команду',
    subject: 'Приглашение в команду администраторов',
    description: 'Отправляется при создании нового администратора',
    variables: ['name', 'email', 'password', 'role', 'loginUrl'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Приглашение в команду</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #3d3527 0%, #5a4d3a 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Добро пожаловать в команду!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Вы приглашены в команду платформы обучения трезвости с ролью <strong>{{role}}</strong>. Ниже вы найдёте данные для входа в панель администрирования.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Ваши данные для входа</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Роль:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #a67c52; font-size: 16px; font-weight: 600;">{{role}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Логин (email):</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{email}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Пароль:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #fff; padding: 4px 8px; border-radius: 4px;">{{password}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #3d3527 0%, #5a4d3a 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(61, 53, 39, 0.3);">Войти в админ-панель</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0; color: #3d3527; opacity: 0.7; font-size: 14px; line-height: 1.6; text-align: center;">Рекомендуем сменить пароль после первого входа в настройках профиля.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center; border-top: 1px solid #d4c9b0;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 13px;">Если у вас возникли вопросы, свяжитесь с руководством.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  },
  {
    code: 'payment_confirmation',
    name: 'Подтверждение оплаты',
    subject: 'Подтверждение оплаты',
    description: 'Отправляется после успешной оплаты продукта',
    variables: ['name', 'productName', 'amount'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение оплаты</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #38a169 0%, #48bb78 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Оплата прошла успешно!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Благодарим вас за покупку. Ваш платёж успешно обработан.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Продукт:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{productName}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Сумма:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #38a169; font-size: 16px; font-weight: 600;">{{amount}} ₽</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #3d3527; font-size: 16px; line-height: 1.6;">Доступ к материалам уже открыт в вашем личном кабинете.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  },
  {
    code: 'module_access',
    name: 'Доступ к модулю',
    subject: 'Вам открыт доступ к модулю: {{moduleName}}',
    description: 'Отправляется при выдаче доступа к модулю',
    variables: ['name', 'moduleName', 'expiresAt', 'loginUrl'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Доступ к модулю открыт</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔓</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Доступ к модулю открыт!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Вам открыт доступ к новому учебному модулю. Можете приступать к обучению!</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Модуль:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #667eea; font-size: 16px; font-weight: 600;">{{moduleName}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Доступ до:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{expiresAt}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Перейти к обучению</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  },
  {
    code: 'mentor_reply',
    name: 'Ответ наставника',
    subject: 'Наставник ответил на вашу запись',
    description: 'Отправляется когда наставник отвечает на дневник или заметку',
    variables: ['name', 'mentorName', 'entryType', 'replyPreview', 'viewUrl'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ответ наставника</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #ed8936 0%, #f6ad55 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Наставник ответил!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;"><strong>{{mentorName}}</strong> ответил на вашу запись в разделе «{{entryType}}».</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 12px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Превью ответа</p>
                    <p style="margin: 0; color: #3d3527; font-size: 16px; line-height: 1.6; font-style: italic;">«{{replyPreview}}»</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{viewUrl}}" style="display: inline-block; background: linear-gradient(135deg, #ed8936 0%, #f6ad55 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(237, 137, 54, 0.3);">Прочитать ответ</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  },
  {
    code: 'password_reset',
    name: 'Сброс пароля',
    subject: 'Ваш новый пароль',
    description: 'Отправляется при сбросе пароля пользователя',
    variables: ['name', 'email', 'newPassword', 'loginUrl'],
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сброс пароля</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #e53e3e 0%, #fc8181 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Пароль сброшен</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Ваш пароль был сброшен. Ниже вы найдёте новые данные для входа.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Новые данные для входа</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Логин (email):</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{email}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Новый пароль:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #e53e3e; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #fff; padding: 4px 8px; border-radius: 4px;">{{newPassword}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(166, 124, 82, 0.3);">Войти в личный кабинет</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0; color: #3d3527; opacity: 0.7; font-size: 14px; line-height: 1.6; text-align: center;">Рекомендуем сменить пароль после входа в настройках профиля.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center; border-top: 1px solid #d4c9b0;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 13px;">Если вы не запрашивали сброс пароля, свяжитесь с нами.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    isEnabled: true
  }
];

async function ensureDefaultEmailTemplates() {
  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({ where: { code: template.code } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: template });
    }
  }
}

router.get('/email-templates', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaultEmailTemplates();
    await runEmailTemplatesMigration();
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(templates);
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const emailTemplateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  description: z.string().optional(),
  variables: z.array(z.string()).optional(),
  isEnabled: z.boolean().optional()
});

router.post('/email-templates', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const data = emailTemplateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({ data });
    res.json(template);
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/email-templates/:id', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = emailTemplateSchema.partial().parse(req.body);
    
    const oldTemplate = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!oldTemplate) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    
    const changedBy = req.user!.name || req.user!.email;
    const historyEntries: { templateId: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string }[] = [];
    
    if (data.name !== undefined && data.name !== oldTemplate.name) {
      historyEntries.push({ templateId: id, field: 'name', oldValue: oldTemplate.name, newValue: data.name, changedBy });
    }
    if (data.subject !== undefined && data.subject !== oldTemplate.subject) {
      historyEntries.push({ templateId: id, field: 'subject', oldValue: oldTemplate.subject, newValue: data.subject, changedBy });
    }
    if (data.body !== undefined && data.body !== oldTemplate.body) {
      historyEntries.push({ templateId: id, field: 'body', oldValue: oldTemplate.body, newValue: data.body, changedBy });
    }
    if (data.description !== undefined && data.description !== oldTemplate.description) {
      historyEntries.push({ templateId: id, field: 'description', oldValue: oldTemplate.description || null, newValue: data.description || null, changedBy });
    }
    if (data.isEnabled !== undefined && data.isEnabled !== oldTemplate.isEnabled) {
      historyEntries.push({ templateId: id, field: 'isEnabled', oldValue: String(oldTemplate.isEnabled), newValue: String(data.isEnabled), changedBy });
    }
    
    for (const entry of historyEntries) {
      await prisma.$executeRaw`INSERT INTO "EmailTemplateHistory" ("id", "templateId", "field", "oldValue", "newValue", "changedBy", "changedAt") VALUES (gen_random_uuid(), ${entry.templateId}, ${entry.field}, ${entry.oldValue}, ${entry.newValue}, ${entry.changedBy}, NOW())`;
    }
    
    const template = await prisma.emailTemplate.update({
      where: { id },
      data
    });
    res.json(template);
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/email-templates/:id', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.emailTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/email-templates/history', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const history = await prisma.$queryRaw<Array<{
      id: string;
      templateId: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: string;
      changedAt: Date;
      templateName: string;
      templateCode: string;
    }>>`
      SELECT h.*, t.name as "templateName", t.code as "templateCode"
      FROM "EmailTemplateHistory" h
      LEFT JOIN "EmailTemplate" t ON h."templateId" = t.id
      ORDER BY h."changedAt" DESC
      LIMIT 100
    `;
    res.json(history);
  } catch (error) {
    console.error('Get email template history error:', error);
    res.json([]);
  }
});

router.post('/email-templates/rollback/:historyId', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { historyId } = req.params;
    
    const historyEntry = await prisma.$queryRaw<Array<{
      id: string;
      templateId: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: string;
    }>>`SELECT * FROM "EmailTemplateHistory" WHERE id = ${historyId}`;
    
    if (!historyEntry || historyEntry.length === 0) {
      return res.status(404).json({ error: 'Запись истории не найдена' });
    }
    
    const entry = historyEntry[0];
    const changedBy = `${req.user!.name || req.user!.email} (откат)`;
    
    if (entry.field === 'name') {
      await prisma.emailTemplate.update({ where: { id: entry.templateId }, data: { name: entry.oldValue || '' } });
    } else if (entry.field === 'subject') {
      await prisma.emailTemplate.update({ where: { id: entry.templateId }, data: { subject: entry.oldValue || '' } });
    } else if (entry.field === 'body') {
      await prisma.emailTemplate.update({ where: { id: entry.templateId }, data: { body: entry.oldValue || '' } });
    } else if (entry.field === 'description') {
      await prisma.emailTemplate.update({ where: { id: entry.templateId }, data: { description: entry.oldValue } });
    } else if (entry.field === 'isEnabled') {
      await prisma.emailTemplate.update({ where: { id: entry.templateId }, data: { isEnabled: entry.oldValue === 'true' } });
    }
    
    await prisma.$executeRaw`INSERT INTO "EmailTemplateHistory" ("id", "templateId", "field", "oldValue", "newValue", "changedBy", "changedAt") VALUES (gen_random_uuid(), ${entry.templateId}, ${entry.field}, ${entry.newValue}, ${entry.oldValue}, ${changedBy}, NOW())`;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Rollback email template error:', error);
    res.status(500).json({ error: 'Ошибка отката' });
  }
});

// Audit Log endpoints
const auditRoles = requireRole('SUPER_ADMIN', 'ADMIN');

const entityLabels: Record<string, string> = {
  LESSON: 'Урок',
  MODULE: 'Модуль',
  LIBRARY: 'Библиотека',
  SCHEDULE: 'Расписание',
  COMMUNITY: 'Сообщество',
  CONTACT: 'Контакт',
  PRODUCT: 'Продукт',
  PAYMENT: 'Платёж',
  USER: 'Пользователь',
  STUDENT: 'Студент',
  ADMIN: 'Администратор',
  MINI_GROUP: 'Мини-группа',
  MODULE_ACCESS: 'Доступ к модулю',
  EMAIL_TEMPLATE: 'Email-шаблон',
  SETTING: 'Настройка',
  DIARY: 'Дневник',
  NOTE: 'Заметка',
  QUESTION: 'Вопрос',
  CHAT: 'Чат'
};

const actionLabelsMap: Record<string, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  DELETE: 'Удаление',
  PUBLISH: 'Публикация',
  UNPUBLISH: 'Снятие с публикации',
  REPLY: 'Ответ',
  GRANT_ACCESS: 'Выдача доступа',
  REVOKE_ACCESS: 'Отзыв доступа',
  ADD_MEMBER: 'Добавление участника',
  REMOVE_MEMBER: 'Удаление участника'
};

router.get('/audit-logs', auditRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, action, limit = '50', offset = '0' } = req.query;
    
    const where: any = {};
    if (entityType) where.entity = entityType;
    if (action) where.action = action;
    
    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.adminLog.count({ where })
    ]);
    
    const logsWithData = await Promise.all(logs.map(async (log) => {
      const extra = await prisma.$queryRaw<Array<{ oldData: any; newData: any }>>`
        SELECT "oldData", "newData" FROM "AdminLog" WHERE id = ${log.id}
      `;
      return {
        ...log,
        oldData: extra[0]?.oldData || null,
        newData: extra[0]?.newData || null,
        userName: log.user?.name,
        userEmail: log.user?.email
      };
    }));
    
    res.json({ logs: logsWithData, total });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Ошибка получения журнала' });
  }
});

router.get('/audit-logs/meta', auditRoles, async (req: AuthRequest, res: Response) => {
  res.json({ entityTypes: entityLabels, actions: actionLabelsMap });
});

router.post('/audit-logs/rollback/:id', auditRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const logEntry = await prisma.$queryRaw<Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string | null;
      details: Record<string, any> | null;
      oldData: Record<string, any> | null;
      newData: Record<string, any> | null;
    }>>`SELECT id, action, entity, "entityId", details, "oldData", "newData" FROM "AdminLog" WHERE id = ${id}`;
    
    if (!logEntry || logEntry.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    const entry = logEntry[0];
    
    if (!entry.oldData) {
      return res.status(400).json({ error: 'Нет данных для отката. Откат доступен только для записей с сохранёнными данными.' });
    }
    
    if (entry.action === 'UPDATE' && entry.entityId) {
      const entityHandlers: Record<string, () => Promise<void>> = {
        'LESSON': async () => {
          const { id: _, createdAt, updatedAt, moduleId, ...data } = entry.oldData!;
          await prisma.lesson.update({ where: { id: entry.entityId! }, data });
        },
        'MODULE': async () => {
          const { id: _, createdAt, updatedAt, ...data } = entry.oldData!;
          await prisma.module.update({ where: { id: entry.entityId! }, data });
        },
        'LIBRARY': async () => {
          const { id: _, createdAt, updatedAt, ...data } = entry.oldData!;
          await prisma.libraryItem.update({ where: { id: entry.entityId! }, data });
        },
        'SCHEDULE': async () => {
          const { id: _, createdAt, updatedAt, allowedTariffs, ...data } = entry.oldData! as any;
          await prisma.scheduleEvent.update({ where: { id: entry.entityId! }, data });
          if (allowedTariffs) {
            const tariffs = Array.isArray(allowedTariffs) ? allowedTariffs : [];
            await prisma.$executeRaw`UPDATE "ScheduleEvent" SET "allowedTariffs" = ${tariffs}::TEXT[] WHERE id = ${entry.entityId!}`;
          }
        },
        'COMMUNITY': async () => {
          const { id: _, createdAt, updatedAt, ...data } = entry.oldData!;
          await prisma.community.update({ where: { id: entry.entityId! }, data });
        },
        'CONTACT': async () => {
          const { id: _, createdAt, updatedAt, ...data } = entry.oldData!;
          await prisma.contact.update({ where: { id: entry.entityId! }, data });
        },
        'PRODUCT': async () => {
          const { id: _, createdAt, updatedAt, ...data } = entry.oldData!;
          await prisma.product.update({ where: { id: entry.entityId! }, data });
        },
        'MINI_GROUP': async () => {
          const { id: _, createdAt, updatedAt, ...data } = entry.oldData!;
          await prisma.miniGroup.update({ where: { id: entry.entityId! }, data });
        }
      };
      
      const handler = entityHandlers[entry.entity];
      if (handler) {
        await handler();
        
        await prisma.adminLog.create({
          data: {
            userId: req.user!.id,
            action: 'UPDATE',
            entity: entry.entity,
            entityId: entry.entityId,
            details: { rollbackFrom: id, title: entry.details?.title + ' (откат)' }
          }
        });
        
        return res.json({ success: true });
      }
    }
    
    if (entry.action === 'DELETE' && entry.entityId && entry.oldData) {
      const createHandlers: Record<string, () => Promise<void>> = {
        'LESSON': async () => {
          await prisma.lesson.create({ data: entry.oldData! as any });
        },
        'LIBRARY': async () => {
          await prisma.libraryItem.create({ data: entry.oldData! as any });
        },
        'SCHEDULE': async () => {
          const { allowedTariffs, ...rest } = entry.oldData! as any;
          await prisma.scheduleEvent.create({ data: rest as any });
          if (allowedTariffs && Array.isArray(allowedTariffs) && allowedTariffs.length > 0) {
            await prisma.$executeRaw`UPDATE "ScheduleEvent" SET "allowedTariffs" = ${allowedTariffs}::TEXT[] WHERE id = ${rest.id}`;
          }
        },
        'COMMUNITY': async () => {
          await prisma.community.create({ data: entry.oldData! as any });
        },
        'CONTACT': async () => {
          await prisma.contact.create({ data: entry.oldData! as any });
        },
        'PRODUCT': async () => {
          await prisma.product.create({ data: entry.oldData! as any });
        }
      };
      
      const handler = createHandlers[entry.entity];
      if (handler) {
        await handler();
        
        await prisma.adminLog.create({
          data: {
            userId: req.user!.id,
            action: 'CREATE',
            entity: entry.entity,
            entityId: entry.entityId,
            details: { restoredFrom: id, title: entry.details?.title + ' (восстановлено)' }
          }
        });
        
        return res.json({ success: true });
      }
    }
    
    res.status(400).json({ error: 'Откат для этого типа действия недоступен' });
  } catch (error) {
    console.error('Rollback audit error:', error);
    res.status(500).json({ error: 'Ошибка отката' });
  }
});

export default router;
