import { Router, Response, Request } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

interface IdParams {
  id: string;
}

interface GroupEventParams {
  groupId: string;
  eventId?: string;
}

function normalizeTelegramLink(input: string): string {
  if (!input) return '';
  let value = input.trim();
  
  if (value.startsWith('https://') || value.startsWith('http://')) {
    return value;
  }
  
  if (value.includes('t.me/') || value.includes('telegram.me/')) {
    let username = value.split('t.me/').pop() || value.split('telegram.me/').pop() || '';
    username = username.split('?')[0];
    return `https://t.me/${username}`;
  }
  
  let username = value.replace(/^@/, '');
  username = username.split('?')[0];
  return `https://t.me/${username}`;
}

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'CONTENT_MANAGER'));

const moduleSchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  order: z.number().optional(),
  isPublished: z.boolean().optional()
});

const lessonSchema = z.object({
  moduleId: z.string().min(1, 'ID модуля обязателен'),
  title: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  content: z.string().optional(),
  duration: z.string().optional(),
  order: z.number().optional(),
  isPublished: z.boolean().optional(),
  isTextOnly: z.boolean().optional(),
  videos: z.array(z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    url: z.string(),
    order: z.number().optional()
  })).optional()
});

router.get('/modules', async (req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.module.findMany({
      include: {
        lessons: {
          include: {
            videos: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    });
    res.json(modules);
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/modules', async (req: AuthRequest, res: Response) => {
  try {
    const data = moduleSchema.parse(req.body);
    const module = await prisma.module.create({ data });
    
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entity: 'MODULE',
        entityId: module.id,
        details: { title: module.title }
      }
    });
    
    res.status(201).json(module);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Create module error:', error?.message || error);
    console.error('Stack:', error?.stack);
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

router.put('/modules/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const data = moduleSchema.partial().parse(req.body);
    const module = await prisma.module.update({ where: { id }, data });
    
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entity: 'MODULE',
        entityId: module.id,
        details: data
      }
    });
    
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Update module error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/modules/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.module.delete({ where: { id } });
    
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entity: 'MODULE',
        entityId: id
      }
    });
    
    res.json({ message: 'Модуль удален' });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons', async (req: AuthRequest, res: Response) => {
  try {
    const lessons = await prisma.lesson.findMany({
      include: { module: true },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }]
    });
    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { 
        module: true,
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
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/lessons', async (req: AuthRequest, res: Response) => {
  try {
    const data = lessonSchema.parse(req.body);
    const { videos, ...lessonData } = data;
    
    const lesson = await prisma.lesson.create({ 
      data: {
        ...lessonData,
        videos: videos && videos.length > 0 ? {
          create: videos.map((v, i) => ({
            title: v.title || null,
            url: v.url,
            order: v.order ?? i
          }))
        } : undefined
      },
      include: {
        videos: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entity: 'LESSON',
        entityId: lesson.id,
        details: { title: lesson.title }
      }
    });
    
    res.status(201).json(lesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Create lesson error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/lessons/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const data = lessonSchema.partial().parse(req.body);
    const { videos, ...lessonData } = data;
    
    if (videos !== undefined) {
      await prisma.lessonVideo.deleteMany({ where: { lessonId: id } });
      
      if (videos.length > 0) {
        await prisma.lessonVideo.createMany({
          data: videos.map((v, i) => ({
            lessonId: id,
            title: v.title || null,
            url: v.url,
            order: v.order ?? i
          }))
        });
      }
    }
    
    const lesson = await prisma.lesson.update({ 
      where: { id }, 
      data: lessonData,
      include: {
        videos: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entity: 'LESSON',
        entityId: lesson.id,
        details: data
      }
    });
    
    res.json(lesson);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

router.delete('/lessons/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.lesson.delete({ where: { id } });
    
    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entity: 'LESSON',
        entityId: id
      }
    });
    
    res.json({ message: 'Урок удален' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/library', async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.libraryItem.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(items);
  } catch (error) {
    console.error('Get library error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/library', async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.libraryItem.create({ data: req.body });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create library item error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/library/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const item = await prisma.libraryItem.update({ where: { id }, data: req.body });
    res.json(item);
  } catch (error) {
    console.error('Update library item error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/library/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.libraryItem.delete({ where: { id } });
    res.json({ message: 'Элемент удален' });
  } catch (error) {
    console.error('Delete library item error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/schedule', async (req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.scheduleEvent.findMany({
      orderBy: { date: 'asc' },
      include: { miniGroup: true }
    });
    res.json(events);
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/schedule', async (req: AuthRequest, res: Response) => {
  try {
    const { date, ...rest } = req.body;
    const isoDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const event = await prisma.scheduleEvent.create({ 
      data: { ...rest, date: isoDate, isPublished: true },
      include: { miniGroup: true }
    });
    res.status(201).json(event);
  } catch (error) {
    console.error('Create schedule event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/schedule/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const { date, ...rest } = req.body;
    const data = date ? { ...rest, date: new Date(date).toISOString() } : rest;
    const event = await prisma.scheduleEvent.update({ 
      where: { id }, 
      data,
      include: { miniGroup: true }
    });
    res.json(event);
  } catch (error) {
    console.error('Update schedule event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/schedule/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.scheduleEvent.delete({ where: { id } });
    res.json({ message: 'Событие удалено' });
  } catch (error) {
    console.error('Delete schedule event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const contacts = await prisma.contact.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const contact = await prisma.contact.create({ data: { ...req.body, isPublished: true } });
    res.status(201).json(contact);
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/contacts/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const contact = await prisma.contact.update({ where: { id }, data: req.body });
    res.json(contact);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/contacts/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.contact.delete({ where: { id } });
    res.json({ message: 'Контакт удален' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/communities', async (req: AuthRequest, res: Response) => {
  try {
    const communities = await prisma.community.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(communities);
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/communities', async (req: AuthRequest, res: Response) => {
  try {
    const community = await prisma.community.create({ 
      data: { 
        ...req.body,
        isPublished: true 
      } 
    });
    res.status(201).json(community);
  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/communities/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const community = await prisma.community.update({ where: { id }, data: req.body });
    res.json(community);
  } catch (error) {
    console.error('Update community error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/communities/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.community.delete({ where: { id } });
    res.json({ message: 'Община удалена' });
  } catch (error) {
    console.error('Delete community error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/mini-groups', async (req: AuthRequest, res: Response) => {
  try {
    const groups = await prisma.miniGroup.findMany({
      orderBy: { title: 'asc' },
      include: { 
        curator: true,
        events: true
      }
    });
    res.json(groups);
  } catch (error) {
    console.error('Get mini-groups error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/mini-groups', async (req: AuthRequest, res: Response) => {
  try {
    const { chatLink, ...rest } = req.body;
    const group = await prisma.miniGroup.create({ 
      data: {
        ...rest,
        chatLink: chatLink ? normalizeTelegramLink(chatLink) : null,
        isPublished: true
      },
      include: { curator: true, events: true }
    });
    res.status(201).json(group);
  } catch (error) {
    console.error('Create mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/mini-groups/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const { chatLink, ...rest } = req.body;
    const data = chatLink !== undefined 
      ? { ...rest, chatLink: chatLink ? normalizeTelegramLink(chatLink) : null }
      : rest;
    const group = await prisma.miniGroup.update({ 
      where: { id }, 
      data,
      include: { curator: true, events: true }
    });
    res.json(group);
  } catch (error) {
    console.error('Update mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/mini-groups/:id', async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    await prisma.miniGroup.delete({ where: { id } });
    res.json({ message: 'Мини-группа удалена' });
  } catch (error) {
    console.error('Delete mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/mini-groups/:groupId/events', async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    const events = await prisma.scheduleEvent.findMany({
      where: { miniGroupId: groupId },
      orderBy: { date: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Get mini-group events error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/mini-groups/:groupId/events', async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    const { date, ...rest } = req.body;
    const event = await prisma.scheduleEvent.create({
      data: {
        ...rest,
        date: new Date(date),
        miniGroupId: groupId,
        isPublished: true
      }
    });
    res.status(201).json(event);
  } catch (error) {
    console.error('Create mini-group event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/mini-groups/:groupId/events/:eventId', async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { eventId } = req.params;
    const { date, ...rest } = req.body;
    const event = await prisma.scheduleEvent.update({
      where: { id: eventId },
      data: {
        ...rest,
        ...(date && { date: new Date(date) })
      }
    });
    res.json(event);
  } catch (error) {
    console.error('Update mini-group event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/mini-groups/:groupId/events/:eventId', async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { eventId } = req.params;
    await prisma.scheduleEvent.delete({ where: { id: eventId } });
    res.json({ message: 'Событие удалено' });
  } catch (error) {
    console.error('Delete mini-group event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Mini-group members management
router.get('/mini-groups/:groupId/members', async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    const members = await prisma.miniGroupMember.findMany({
      where: { miniGroupId: groupId },
      include: {
        student: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });
    res.json(members);
  } catch (error) {
    console.error('Get mini-group members error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/mini-groups/:groupId/members', async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    const { studentId } = req.body;
    const member = await prisma.miniGroupMember.create({
      data: { miniGroupId: groupId, studentId },
      include: {
        student: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });
    res.status(201).json(member);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Участник уже в группе' });
    }
    console.error('Add mini-group member error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/mini-groups/:groupId/members/:memberId', async (req: AuthRequest & Request<{groupId: string, memberId: string}>, res: Response) => {
  try {
    const { memberId } = req.params;
    await prisma.miniGroupMember.delete({ where: { id: memberId } });
    res.json({ message: 'Участник удален из группы' });
  } catch (error) {
    console.error('Remove mini-group member error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Search students for adding to mini-group
router.get('/students/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, excludeGroupId } = req.query as { q?: string; excludeGroupId?: string };
    const students = await prisma.student.findMany({
      where: {
        user: {
          role: 'STUDENT',
          ...(q && { 
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } }
            ]
          })
        },
        ...(excludeGroupId && {
          miniGroups: { none: { miniGroupId: excludeGroupId } }
        })
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 20
    });
    res.json(students);
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/modules/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { id, direction } = req.body;
    const currentModule = await prisma.module.findUnique({ where: { id } });
    if (!currentModule) return res.status(404).json({ error: 'Модуль не найден' });
    
    const modules = await prisma.module.findMany({ orderBy: { order: 'asc' } });
    const currentIndex = modules.findIndex(m => m.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= modules.length) {
      return res.status(400).json({ error: 'Невозможно переместить' });
    }
    
    const targetModule = modules[targetIndex];
    await prisma.$transaction([
      prisma.module.update({ where: { id }, data: { order: targetModule.order } }),
      prisma.module.update({ where: { id: targetModule.id }, data: { order: currentModule.order } })
    ]);
    
    res.json({ message: 'Порядок изменен' });
  } catch (error) {
    console.error('Reorder modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/lessons/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { id, direction, moduleId } = req.body;
    const currentLesson = await prisma.lesson.findUnique({ where: { id } });
    if (!currentLesson) return res.status(404).json({ error: 'Урок не найден' });
    
    const lessons = await prisma.lesson.findMany({ 
      where: { moduleId },
      orderBy: { order: 'asc' } 
    });
    const currentIndex = lessons.findIndex(l => l.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= lessons.length) {
      return res.status(400).json({ error: 'Невозможно переместить' });
    }
    
    const targetLesson = lessons[targetIndex];
    await prisma.$transaction([
      prisma.lesson.update({ where: { id }, data: { order: targetLesson.order } }),
      prisma.lesson.update({ where: { id: targetLesson.id }, data: { order: currentLesson.order } })
    ]);
    
    res.json({ message: 'Порядок изменен' });
  } catch (error) {
    console.error('Reorder lessons error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/library/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { id, direction } = req.body;
    const currentItem = await prisma.libraryItem.findUnique({ where: { id } });
    if (!currentItem) return res.status(404).json({ error: 'Элемент не найден' });
    
    const items = await prisma.libraryItem.findMany({ orderBy: { order: 'asc' } });
    const currentIndex = items.findIndex(i => i.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= items.length) {
      return res.status(400).json({ error: 'Невозможно переместить' });
    }
    
    const targetItem = items[targetIndex];
    await prisma.$transaction([
      prisma.libraryItem.update({ where: { id }, data: { order: targetItem.order } }),
      prisma.libraryItem.update({ where: { id: targetItem.id }, data: { order: currentItem.order } })
    ]);
    
    res.json({ message: 'Порядок изменен' });
  } catch (error) {
    console.error('Reorder library error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/contacts/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { id, direction } = req.body;
    const currentContact = await prisma.contact.findUnique({ where: { id } });
    if (!currentContact) return res.status(404).json({ error: 'Контакт не найден' });
    
    const contacts = await prisma.contact.findMany({ orderBy: { order: 'asc' } });
    const currentIndex = contacts.findIndex(c => c.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= contacts.length) {
      return res.status(400).json({ error: 'Невозможно переместить' });
    }
    
    const targetContact = contacts[targetIndex];
    await prisma.$transaction([
      prisma.contact.update({ where: { id }, data: { order: targetContact.order } }),
      prisma.contact.update({ where: { id: targetContact.id }, data: { order: currentContact.order } })
    ]);
    
    res.json({ message: 'Порядок изменен' });
  } catch (error) {
    console.error('Reorder contacts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/modules/reorder-batch', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.module.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    res.json({ message: 'Порядок сохранен' });
  } catch (error) {
    console.error('Batch reorder modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/lessons/reorder-batch', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.lesson.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    res.json({ message: 'Порядок сохранен' });
  } catch (error) {
    console.error('Batch reorder lessons error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/library/reorder-batch', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.libraryItem.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    res.json({ message: 'Порядок сохранен' });
  } catch (error) {
    console.error('Batch reorder library error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/contacts/reorder-batch', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.contact.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    res.json({ message: 'Порядок сохранен' });
  } catch (error) {
    console.error('Batch reorder contacts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/modules/next-order', async (req: AuthRequest, res: Response) => {
  try {
    const maxModule = await prisma.module.findFirst({ orderBy: { order: 'desc' } });
    res.json({ nextOrder: (maxModule?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons/next-order/:moduleId', async (req: AuthRequest & Request<{ moduleId: string }>, res: Response) => {
  try {
    const moduleId = req.params.moduleId;
    const maxLesson = await prisma.lesson.findFirst({ 
      where: { moduleId },
      orderBy: { order: 'desc' } 
    });
    res.json({ nextOrder: (maxLesson?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/library/next-order', async (req: AuthRequest, res: Response) => {
  try {
    const maxItem = await prisma.libraryItem.findFirst({ orderBy: { order: 'desc' } });
    res.json({ nextOrder: (maxItem?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/contacts/next-order', async (req: AuthRequest, res: Response) => {
  try {
    const maxContact = await prisma.contact.findFirst({ orderBy: { order: 'desc' } });
    res.json({ nextOrder: (maxContact?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
