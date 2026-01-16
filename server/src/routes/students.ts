import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { sendEmail } from '../services/email';
import { getWelcomeEmailTemplate } from '../templates/welcomeEmail';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR'));

const createStudentSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  phone: z.string().optional(),
  sobrietyDate: z.string().optional(),
  notes: z.string().optional(),
  sendCredentials: z.boolean().optional()
});

const updateStudentSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  sobrietyDate: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      role: 'STUDENT'
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          student: {
            include: {
              progress: true,
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1
              },
              enrollments: {
                include: { product: true }
              },
              miniGroups: {
                include: { miniGroup: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      students,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        student: {
          include: {
            progress: {
              include: { lesson: { include: { module: true } } }
            },
            payments: {
              include: { product: true },
              orderBy: { createdAt: 'desc' }
            },
            enrollments: {
              include: { product: true }
            },
            diaries: {
              include: { lesson: true },
              orderBy: { createdAt: 'desc' }
            },
            studentNotes: {
              include: { lesson: true },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createStudentSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: 'STUDENT',
        student: {
          create: {
            phone: data.phone,
            sobrietyDate: data.sobrietyDate ? new Date(data.sobrietyDate) : undefined,
            notes: data.notes
          }
        }
      },
      include: { student: true }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: user.id,
        details: { email: user.email, name: user.name }
      }
    });

    if (data.sendCredentials) {
      try {
        const appUrl = process.env.APP_URL || 'https://your-platform.com';
        const loginUrl = `${appUrl}/login`;
        
        const emailHtml = getWelcomeEmailTemplate({
          name: data.name,
          email: data.email,
          password: data.password,
          loginUrl
        });
        
        await sendEmail(
          data.email,
          'Добро пожаловать на платформу обучения трезвости',
          emailHtml
        );
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateStudentSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        student: {
          update: {
            phone: data.phone,
            sobrietyDate: data.sobrietyDate ? new Date(data.sobrietyDate) : undefined,
            notes: data.notes
          }
        }
      },
      include: { student: true }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entity: 'STUDENT',
        entityId: user.id,
        details: data
      }
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entity: 'STUDENT',
        entityId: id
      }
    });

    res.json({ message: 'Ученик удален' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId/access', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });
    
    if (!user?.student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    const [modules, accessList] = await Promise.all([
      prisma.module.findMany({ orderBy: { order: 'asc' } }),
      prisma.moduleAccess.findMany({
        where: { studentId: user.student.id },
        include: { module: true }
      })
    ]);

    const accessMap = new Map(accessList.map(a => [a.moduleId, a]));

    const result = modules.map(m => {
      const access = accessMap.get(m.id);
      const isExpired = access?.expiresAt && new Date(access.expiresAt) < new Date();
      const effectiveAccess = access?.isActive && !isExpired;
      
      return {
        moduleId: m.id,
        moduleTitle: m.title,
        hasAccess: effectiveAccess ?? false,
        isActive: access?.isActive ?? false,
        isExpired: isExpired ?? false,
        expiresAt: access?.expiresAt ?? null,
        accessId: access?.id ?? null
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get student access error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:userId/access', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { moduleId, expiresAt, isActive } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });
    
    if (!user?.student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    const access = await prisma.moduleAccess.upsert({
      where: {
        studentId_moduleId: {
          studentId: user.student.id,
          moduleId
        }
      },
      create: {
        studentId: user.student.id,
        moduleId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive ?? true
      },
      update: {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive ?? true
      }
    });

    res.json(access);
  } catch (error) {
    console.error('Update student access error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:userId/access/:moduleId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, moduleId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });
    
    if (!user?.student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    await prisma.moduleAccess.delete({
      where: {
        studentId_moduleId: {
          studentId: user.student.id,
          moduleId
        }
      }
    });

    res.json({ message: 'Доступ удален' });
  } catch (error) {
    console.error('Delete student access error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
