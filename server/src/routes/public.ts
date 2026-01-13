import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/modules', async (req, res) => {
  try {
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
    res.json(modules);
  } catch (error) {
    console.error('Get public modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons/:id', async (req, res) => {
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

    res.json(lesson);
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
