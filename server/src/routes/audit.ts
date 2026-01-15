import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50', action, entity, userId, startDate, endDate } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (action) {
      where.action = { contains: action as string, mode: 'insensitive' };
    }
    if (entity) {
      where.entity = { contains: entity as string, mode: 'insensitive' };
    }
    if (userId) {
      where.userId = userId as string;
    }
    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) };
    }
    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate as string) };
    }

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.adminLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, uniqueAdmins, actionTypes] = await Promise.all([
      prisma.adminLog.count(),
      prisma.adminLog.count({ where: { createdAt: { gte: today } } }),
      prisma.adminLog.groupBy({ by: ['userId'], _count: true }),
      prisma.adminLog.groupBy({ by: ['action'], _count: { action: true }, orderBy: { _count: { action: 'desc' } }, take: 10 })
    ]);

    res.json({
      totalLogs,
      todayLogs,
      uniqueAdmins: uniqueAdmins.length,
      topActions: actionTypes.map(a => ({ action: a.action, count: a._count.action }))
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/admins', async (req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'MODERATOR', 'CONTENT_MANAGER', 'SUPPORT', 'FINANCE'] }
      },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;

export async function logAdminAction(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: any
) {
  try {
    await prisma.adminLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details
      }
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
