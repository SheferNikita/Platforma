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
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'] as const;

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
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'] }
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

export default router;
