import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'FINANCE'));

const productSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  price: z.number().min(0, 'Цена должна быть неотрицательной'),
  currency: z.string().default('RUB'),
  accessDurationType: z.enum(['unlimited', 'days', 'date']).default('unlimited'),
  accessDuration: z.number().optional().nullable(),
  accessExpiresAt: z.string().optional().nullable(),
  emailSubject: z.string().optional(),
  emailTemplate: z.string().optional(),
  offerUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  moduleIds: z.array(z.string()).optional()
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        modules: {
          include: { module: { select: { id: true, title: true } } }
        },
        _count: {
          select: { payments: true, enrollments: true, orders: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        modules: {
          include: { module: { select: { id: true, title: true } } }
        },
        payments: {
          include: {
            student: {
              include: { user: { select: { name: true, email: true } } }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { payments: true, enrollments: true, orders: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { moduleIds, accessExpiresAt, ...data } = productSchema.parse(req.body);

    const product = await prisma.product.create({ 
      data: {
        ...data,
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
        modules: moduleIds?.length ? {
          create: moduleIds.map(moduleId => ({ moduleId }))
        } : undefined
      },
      include: {
        modules: { include: { module: { select: { id: true, title: true } } } }
      }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entity: 'PRODUCT',
        entityId: product.id,
        details: { name: product.name, price: product.price }
      }
    });

    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { moduleIds, accessExpiresAt, ...data } = productSchema.partial().parse(req.body);

    if (moduleIds !== undefined) {
      await prisma.productModule.deleteMany({ where: { productId: id } });
      if (moduleIds.length > 0) {
        await prisma.productModule.createMany({
          data: moduleIds.map(moduleId => ({ productId: id, moduleId }))
        });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : accessExpiresAt === null ? null : undefined
      },
      include: {
        modules: { include: { module: { select: { id: true, title: true } } } }
      }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entity: 'PRODUCT',
        entityId: product.id,
        details: data
      }
    });

    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.product.delete({
      where: { id }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entity: 'PRODUCT',
        entityId: id
      }
    });

    res.json({ message: 'Продукт удален' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
