import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { sendEmail } from '../services/email';
import { getTeamInviteEmailTemplate } from '../templates/teamInviteEmail';

const PLATFORM_URL = 'https://schkola-trezvosti.ru';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR'));

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'] as const;
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
        role: { in: isCurator ? [...curatorAllowedRoles] : ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'] }
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
      const emailHtml = getTeamInviteEmailTemplate({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        loginUrl: `${PLATFORM_URL}/admin`
      });

      await sendEmail(
        data.email,
        'Приглашение в команду платформы обучения трезвости',
        emailHtml
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
  type: 'TEXT' | 'TEXTAREA' | 'URL' | 'FILE' | 'IMAGE' | 'AUDIO';
  value: string;
}> = [
  { key: 'platformName', label: 'Название платформы', category: 'general', type: 'TEXT', value: 'Платформа трезвости' },
  { key: 'supportLink', label: 'Ссылка поддержки', category: 'general', type: 'URL', value: '' },
  { key: 'loginText', label: 'Текст на странице входа', category: 'general', type: 'TEXTAREA', value: '' },
  { key: 'logo', label: 'Логотип', category: 'general', type: 'IMAGE', value: '' },
  { key: 'favicon', label: 'Фавикон', category: 'general', type: 'IMAGE', value: '' },
  { key: 'sosChatLink', label: 'Ссылка на чат поддержки (SOS)', category: 'sos', type: 'URL', value: '' },
  { key: 'sosAudioFile', label: 'Голосовой файл (SOS)', category: 'sos', type: 'AUDIO', value: '' },
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

router.get('/email-templates', settingsRoles, async (req: AuthRequest, res: Response) => {
  try {
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

export default router;
