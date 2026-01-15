import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';
import ordersRouter from './orders';
import moderationRouter from './moderation';

const router = Router();

router.use('/orders', ordersRouter);
router.use('/moderation', moderationRouter);

interface DecodedToken {
  userId: string;
}

async function getStudentFromToken(req: Request): Promise<{ studentId: string } | null> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.cookies?.token;
    if (!token) return null;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as DecodedToken;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { student: true }
    });
    
    if (!user?.student) return null;
    return { studentId: user.student.id };
  } catch {
    return null;
  }
}

router.get('/modules', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    const modules = await prisma.module.findMany({
      where: { isPublished: true },
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            order: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    if (!student) {
      const result = modules.map(m => ({
        ...m,
        hasAccess: false,
        accessExpiresAt: null
      }));
      return res.json(result);
    }

    const accessList = await prisma.moduleAccess.findMany({
      where: { studentId: student.studentId }
    });
    const accessMap = new Map(accessList.map(a => [a.moduleId, a]));

    const result = modules.map(m => {
      const access = accessMap.get(m.id);
      const isExpired = access?.expiresAt && new Date(access.expiresAt) < new Date();
      return {
        ...m,
        hasAccess: access?.isActive && !isExpired ? true : false,
        accessExpiresAt: access?.expiresAt ?? null
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get public modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findFirst({
      where: { id, isPublished: true },
      include: {
        module: {
          select: { id: true, title: true }
        },
        videos: {
          orderBy: { order: 'asc' }
        },
        attachments: true
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.json({ ...lesson, hasAccess: false });
    }

    const access = await prisma.moduleAccess.findUnique({
      where: {
        studentId_moduleId: {
          studentId: student.studentId,
          moduleId: lesson.moduleId
        }
      }
    });

    const isExpired = access?.expiresAt && new Date(access.expiresAt) < new Date();
    const hasAccess = access?.isActive && !isExpired;

    res.json({ ...lesson, hasAccess });
  } catch (error) {
    console.error('Get public lesson error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/library', async (req, res) => {
  try {
    const items = await prisma.libraryItem.findMany({
      where: { isPublished: true },
      orderBy: { order: 'asc' }
    });
    res.json(items);
  } catch (error) {
    console.error('Get public library error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/schedule', async (req, res) => {
  try {
    const events = await prisma.scheduleEvent.findMany({
      where: {
        isPublished: true,
        date: { gte: new Date() },
        miniGroupId: null
      },
      orderBy: { date: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Get public schedule error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/contacts', async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { isPublished: true },
      orderBy: { order: 'asc' }
    });
    const result = contacts.map(c => ({
      ...c,
      photoUrl: c.photo
    }));
    res.json(result);
  } catch (error) {
    console.error('Get public contacts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/communities', async (req, res) => {
  try {
    const communities = await prisma.community.findMany({
      where: { isPublished: true },
      orderBy: { name: 'asc' }
    });
    res.json(communities);
  } catch (error) {
    console.error('Get public communities error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/mini-groups', async (req, res) => {
  try {
    const groups = await prisma.miniGroup.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      include: {
        curator: {
          select: {
            id: true,
            name: true,
            role: true,
            phone: true,
            telegram: true,
            photo: true
          }
        },
        events: {
          where: {
            isPublished: true,
            date: { gte: new Date() }
          },
          orderBy: { date: 'asc' }
        }
      }
    });
    res.json(groups);
  } catch (error) {
    console.error('Get public mini-groups error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        accessType: true
      },
      orderBy: { price: 'asc' }
    });
    res.json(products);
  } catch (error) {
    console.error('Get public products error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
