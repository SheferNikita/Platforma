import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.json({
      notifications,
      total,
      unreadCount,
      hasMore: offset + notifications.length < total,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Ошибка получения уведомлений' });
  }
});

router.get('/count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    res.json({ unreadCount });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ error: 'Ошибка получения счетчика уведомлений' });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Ошибка обновления уведомления' });
  }
});

router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Ошибка обновления уведомлений' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Ошибка удаления уведомления' });
  }
});

router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.deleteMany({
      where: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ error: 'Ошибка удаления уведомлений' });
  }
});

export default router;
