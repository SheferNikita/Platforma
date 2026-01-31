import { Router, Response, Request } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const updateSettingSchema = z.object({
  value: z.string().nullable(),
  changeReason: z.string().optional()
});

router.get('/public', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSetting.findMany({
      where: { isActive: true },
      select: {
        key: true,
        value: true,
        category: true,
        type: true
      }
    });
    
    const settingsMap: Record<string, string | null> = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json(settingsMap);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    
    const where: any = {};
    if (category && category !== 'all') {
      where.category = category;
    }
    
    const settings = await prisma.platformSetting.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { createdAt: 'asc' }
      ]
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.platformSetting.groupBy({
      by: ['category'],
      _count: { id: true }
    });
    
    const categoryLabels: Record<string, string> = {
      'contacts': 'Контактная информация',
      'sos': 'SOS-страница',
      'texts': 'Тексты и сообщения',
      'platform': 'Платформа'
    };
    
    res.json(categories.map(c => ({
      key: c.category,
      label: categoryLabels[c.category] || c.category,
      count: c._count.id
    })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { id: req.params.id }
    });
    
    if (!setting) {
      return res.status(404).json({ error: 'Настройка не найдена' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    
    const setting = await prisma.platformSetting.findUnique({
      where: { id: req.params.id }
    });
    
    if (!setting) {
      return res.status(404).json({ error: 'Настройка не найдена' });
    }
    
    const previousValue = setting.value;
    
    const updatedSetting = await prisma.platformSetting.update({
      where: { id: req.params.id },
      data: {
        value: parsed.data.value,
        updatedAt: new Date()
      }
    });
    
    await prisma.platformSettingHistory.create({
      data: {
        settingId: setting.id,
        previousValue,
        newValue: parsed.data.value,
        changedById: req.user!.id,
        changeReason: parsed.data.changeReason || null
      }
    });
    
    res.json(updatedSetting);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/history', async (req: AuthRequest, res: Response) => {
  try {
    const history = await prisma.platformSettingHistory.findMany({
      where: { settingId: req.params.id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(history);
  } catch (error) {
    console.error('Get setting history error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/history/all', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    
    const history = await prisma.platformSettingHistory.findMany({
      include: {
        PlatformSetting: {
          select: {
            key: true,
            label: true,
            category: true
          }
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    res.json(history);
  } catch (error) {
    console.error('Get all history error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:historyId/rollback', async (req: AuthRequest, res: Response) => {
  try {
    const historyRecord = await prisma.platformSettingHistory.findUnique({
      where: { id: req.params.historyId },
      include: { PlatformSetting: true }
    });
    
    if (!historyRecord) {
      return res.status(404).json({ error: 'Запись истории не найдена' });
    }
    
    const currentValue = historyRecord.PlatformSetting.value;
    
    const updatedSetting = await prisma.platformSetting.update({
      where: { id: historyRecord.settingId },
      data: {
        value: historyRecord.previousValue,
        updatedAt: new Date()
      }
    });
    
    await prisma.platformSettingHistory.create({
      data: {
        settingId: historyRecord.settingId,
        previousValue: currentValue,
        newValue: historyRecord.previousValue,
        changedById: req.user!.id,
        changeReason: `Откат к версии от ${new Date(historyRecord.createdAt).toLocaleString('ru-RU')}`
      }
    });
    
    res.json(updatedSetting);
  } catch (error) {
    console.error('Rollback setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/email-templates', async (req: AuthRequest, res: Response) => {
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

router.get('/email-templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: req.params.id }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Get email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const emailTemplateSchema = z.object({
  key: z.string().min(1, 'Ключ обязателен'),
  name: z.string().min(1, 'Название обязательно'),
  subject: z.string().min(1, 'Тема обязательна'),
  body: z.string().min(1, 'Тело письма обязательно'),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  variables: z.array(z.string()).optional()
});

router.post('/email-templates', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = emailTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    
    const template = await prisma.emailTemplate.create({
      data: {
        key: parsed.data.key,
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: parsed.data.body,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive ?? true,
        variables: parsed.data.variables || []
      }
    });
    
    res.status(201).json(template);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Шаблон с таким ключом уже существует' });
    }
    console.error('Create email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/email-templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = emailTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    
    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    
    res.json(template);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/email-templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.emailTemplate.delete({
      where: { id: req.params.id }
    });
    
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    console.error('Delete email template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
