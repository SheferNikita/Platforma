import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT'));

const createStudentSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  phone: z.string().optional(),
  sobrietyDate: z.string().optional(),
  notes: z.string().optional()
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

export default router;
