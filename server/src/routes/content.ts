import { Router, Response, Request } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { startScheduledPublishJob } from '../services/scheduledPublish';
import { startScheduledEmailJob } from '../services/scheduledEmail';
import { notificationService } from '../services/notificationService';
import { invalidateModulesCache } from './public';

startScheduledPublishJob();
startScheduledEmailJob();

(async () => {
  try {
    const commVisible = await prisma.setting.findUnique({ where: { key: 'communities_visible' } });
    if (commVisible) {
      const isEnabled = commVisible.value !== 'false';
      const existing = await prisma.platformSetting.findUnique({ where: { key: 'visibility_communities' } });
      if (existing?.value) {
        const parsed = JSON.parse(existing.value);
        if (parsed.enabled !== isEnabled) {
          parsed.enabled = isEnabled;
          await prisma.platformSetting.update({
            where: { key: 'visibility_communities' },
            data: { value: JSON.stringify(parsed) }
          });
          console.log(`[Sync] visibility_communities.enabled synced to ${isEnabled}`);
        }
      }
    }

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Community"
      ADD COLUMN IF NOT EXISTS "leaders" TEXT,
      ADD COLUMN IF NOT EXISTS "contactButtonLabel" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "joinButtonLabel" VARCHAR(100)
    `);

    const offlineKey = 'communities_offline_visible';
    const onlineKey = 'communities_online_visible';
    const offlineSetting = await prisma.setting.findUnique({ where: { key: offlineKey } });
    if (!offlineSetting) {
      await prisma.setting.create({ data: { key: offlineKey, value: 'true' } });
      console.log(`[Init] Created setting ${offlineKey} = true`);
    }
    const onlineSetting = await prisma.setting.findUnique({ where: { key: onlineKey } });
    if (!onlineSetting) {
      await prisma.setting.create({ data: { key: onlineKey, value: 'true' } });
      console.log(`[Init] Created setting ${onlineKey} = true`);
    }
  } catch (err) {
    console.error('[Sync] communities visibility sync error:', err);
  }
})();

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

const adminOnly = requireRole('SUPER_ADMIN', 'ADMIN');
const contentRoles = requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR');
const moderatorRoles = requireRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR');
const groupRoles = requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN');

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
  publishAt: z.string().nullable().optional(),
  showDiary: z.boolean().optional(),
  showNotes: z.boolean().optional(),
  diaryDescription: z.string().optional(),
  notesDescription: z.string().optional(),
  showTask: z.boolean().optional(),
  taskContent: z.string().optional(),
  taskAllowedTariffs: z.array(z.string()).optional(),
  allowedTariffs: z.array(z.string()).optional(),
  videos: z.array(z.object({
    id: z.string().optional(),
    title: z.string().nullable().optional(),
    url: z.string(),
    order: z.number().optional()
  })).optional()
});

router.get('/modules', contentRoles, async (req: AuthRequest, res: Response) => {
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

router.post('/modules', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const data = moduleSchema.parse(req.body);
    const module = await prisma.module.create({ data });
    invalidateModulesCache();
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'MODULE', ${module.id}, ${JSON.stringify({ title: module.title })}::jsonb, ${JSON.stringify(module)}::jsonb, NOW())
    `;
    
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

router.put('/modules/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const data = moduleSchema.partial().parse(req.body);
    const oldModule = await prisma.module.findUnique({ where: { id } });
    const module = await prisma.module.update({ where: { id }, data });
    invalidateModulesCache();
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'MODULE', ${module.id}, ${JSON.stringify({ title: module.title })}::jsonb, ${JSON.stringify(oldModule)}::jsonb, ${JSON.stringify(module)}::jsonb, NOW())
    `;
    
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Update module error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/modules/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const oldModule = await prisma.module.findUnique({ where: { id } });
    await prisma.module.delete({ where: { id } });
    invalidateModulesCache();
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'MODULE', ${id}, ${JSON.stringify({ title: oldModule?.title })}::jsonb, ${JSON.stringify(oldModule)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Модуль удален' });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons', contentRoles, async (req: AuthRequest, res: Response) => {
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

router.get('/lessons/:id', contentRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
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

router.post('/lessons', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const data = lessonSchema.parse(req.body);
    const { videos, publishAt, ...lessonData } = data;
    
    const lesson = await prisma.lesson.create({ 
      data: {
        ...lessonData,
        publishAt: publishAt ? new Date(publishAt) : null,
        ...(lessonData.isPublished && { publishedAt: new Date() }),
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
    invalidateModulesCache();
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'LESSON', ${lesson.id}, ${JSON.stringify({ title: lesson.title })}::jsonb, ${JSON.stringify(lesson)}::jsonb, NOW())
    `;
    
    res.status(201).json(lesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Create lesson error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/lessons/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const data = lessonSchema.partial().parse(req.body);
    const { videos, publishAt, ...lessonData } = data;
    
    const oldLesson = await prisma.lesson.findUnique({ where: { id } });
    
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
    
    const isBeingPublished = lessonData.isPublished === true && oldLesson && !oldLesson.isPublished;

    const lesson = await prisma.lesson.update({ 
      where: { id }, 
      data: {
        ...lessonData,
        ...(publishAt !== undefined && { publishAt: publishAt ? new Date(publishAt) : null }),
        ...(isBeingPublished && !oldLesson.publishedAt && { publishedAt: new Date() })
      },
      include: {
        videos: {
          orderBy: { order: 'asc' }
        }
      }
    });
    invalidateModulesCache();
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'LESSON', ${lesson.id}, ${JSON.stringify({ title: lesson.title })}::jsonb, ${JSON.stringify(oldLesson)}::jsonb, ${JSON.stringify(lesson)}::jsonb, NOW())
    `;
    
    res.json(lesson);
  } catch (error: any) {
    console.error('Error updating lesson:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

router.delete('/lessons/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    
    const oldLesson = await prisma.lesson.findUnique({ where: { id } });
    
    await prisma.lesson.delete({ where: { id } });
    invalidateModulesCache();
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'LESSON', ${id}, ${JSON.stringify({ title: oldLesson?.title })}::jsonb, ${JSON.stringify(oldLesson)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Урок удален' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/lessons/:id/copy', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const { id } = req.params;
    const { targetModuleId } = req.body;

    if (!targetModuleId) {
      return res.status(400).json({ error: 'Не указан целевой модуль' });
    }

    const targetModule = await prisma.module.findUnique({ where: { id: targetModuleId } });
    if (!targetModule) {
      return res.status(404).json({ error: 'Целевой модуль не найден' });
    }

    const original = await prisma.lesson.findUnique({
      where: { id },
      include: {
        videos: { orderBy: { order: 'asc' } },
        attachments: true
      }
    });

    if (!original) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    const maxOrder = await prisma.lesson.aggregate({
      where: { moduleId: targetModuleId },
      _max: { order: true }
    });
    const newOrder = (maxOrder._max.order ?? 0) + 1;

    const copy = await prisma.lesson.create({
      data: {
        moduleId: targetModuleId,
        title: original.title + ' (копия)',
        description: original.description,
        content: original.content,
        duration: original.duration,
        order: newOrder,
        isPublished: false,
        isTextOnly: original.isTextOnly,
        showDiary: original.showDiary,
        showNotes: original.showNotes,
        diaryDescription: original.diaryDescription,
        notesDescription: original.notesDescription,
        showTask: original.showTask,
        taskContent: original.taskContent,
        taskAllowedTariffs: original.taskAllowedTariffs,
        allowedTariffs: original.allowedTariffs,
        videos: original.videos.length > 0 ? {
          create: original.videos.map((v, i) => ({
            title: v.title || null,
            url: v.url,
            order: v.order ?? i
          }))
        } : undefined,
        attachments: original.attachments.length > 0 ? {
          create: original.attachments.map(a => ({
            filename: a.filename,
            originalName: a.originalName,
            mimeType: a.mimeType,
            size: a.size,
            url: a.url
          }))
        } : undefined
      },
      include: {
        videos: { orderBy: { order: 'asc' } },
        attachments: true
      }
    });

    invalidateModulesCache();

    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'LESSON', ${copy.id}, ${JSON.stringify({ title: copy.title, copiedFrom: original.id })}::jsonb, ${JSON.stringify(copy)}::jsonb, NOW())
    `;

    res.status(201).json(copy);
  } catch (error) {
    console.error('Copy lesson error:', error);
    res.status(500).json({ error: 'Ошибка копирования урока' });
  }
});

router.get('/library', moderatorRoles, async (req: AuthRequest, res: Response) => {
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

router.post('/library', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.libraryItem.create({ data: req.body });

    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'LIBRARY', ${item.id}, ${JSON.stringify({ title: item.title })}::jsonb, ${JSON.stringify(item)}::jsonb, NOW())
    `;

    if (item.isPublished) {
      const activeStudents = await prisma.student.findMany({
        where: { user: { isActive: true } },
        select: { userId: true }
      });
      await Promise.all(
        activeStudents.map(s => 
          notificationService.createForNewLibraryItem(s.userId, item.title, item.id)
        )
      );
    }

    res.status(201).json(item);
  } catch (error) {
    console.error('Create library item error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/library/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const oldItem = await prisma.libraryItem.findUnique({ where: { id } });
    const item = await prisma.libraryItem.update({ where: { id }, data: req.body });
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'LIBRARY', ${id}, ${JSON.stringify({ title: item.title })}::jsonb, ${JSON.stringify(oldItem)}::jsonb, ${JSON.stringify(item)}::jsonb, NOW())
    `;

    if (!oldItem?.isPublished && item.isPublished) {
      const activeStudents = await prisma.student.findMany({
        where: { user: { isActive: true } },
        select: { userId: true }
      });
      await Promise.all(
        activeStudents.map(s => 
          notificationService.createForNewLibraryItem(s.userId, item.title, item.id)
        )
      );
    }
    
    res.json(item);
  } catch (error) {
    console.error('Update library item error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/library/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const oldItem = await prisma.libraryItem.findUnique({ where: { id } });
    await prisma.libraryItem.delete({ where: { id } });
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'LIBRARY', ${id}, ${JSON.stringify({ title: oldItem?.title })}::jsonb, ${JSON.stringify(oldItem)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Элемент удален' });
  } catch (error) {
    console.error('Delete library item error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/schedule', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.$queryRaw`
      SELECT se.*, mg.id as "miniGroupId_ref", mg.title as "miniGroupTitle",
             COALESCE(se."allowedTariffs", '{}') as "allowedTariffs"
      FROM "ScheduleEvent" se
      LEFT JOIN "MiniGroup" mg ON se."miniGroupId" = mg.id
      ORDER BY se.date ASC
    `;
    const result = (events as any[]).map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.date,
      time: e.time,
      location: e.location,
      isOnline: e.isOnline,
      link: e.link,
      miniGroupId: e.miniGroupId,
      isPublished: e.isPublished,
      allowedTariffs: e.allowedTariffs || [],
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      miniGroup: e.miniGroupId_ref ? { id: e.miniGroupId_ref, title: e.miniGroupTitle } : null
    }));
    res.json(result);
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/schedule', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { date, allowedTariffs, isPublished, ...rest } = req.body;
    const isoDate = date ? new Date(date).toISOString() : new Date().toISOString();
    const tariffs = Array.isArray(allowedTariffs) ? allowedTariffs : [];
    const published = isPublished !== undefined ? isPublished : true;
    const event = await prisma.scheduleEvent.create({ 
      data: { ...rest, date: isoDate, isPublished: published },
      include: { miniGroup: true }
    });

    if (tariffs.length > 0) {
      await prisma.$executeRaw`UPDATE "ScheduleEvent" SET "allowedTariffs" = ${tariffs}::TEXT[] WHERE id = ${event.id}`;
    }

    const eventWithTariffs = { ...event, allowedTariffs: tariffs };

    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'SCHEDULE', ${event.id}, ${JSON.stringify({ title: event.title })}::jsonb, ${JSON.stringify(eventWithTariffs)}::jsonb, NOW())
    `;

    res.status(201).json(eventWithTariffs);

    if (event.isPublished) {
      prisma.student.findMany({
        where: { user: { isActive: true } },
        select: { userId: true }
      }).then(activeStudents => 
        Promise.all(
          activeStudents.map(s => 
            notificationService.createForNewEvent(s.userId, event.title, event.id)
          )
        )
      ).catch(err => console.error('Background notifications error (create schedule):', err));
    }
  } catch (error) {
    console.error('Create schedule event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/schedule/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const prismaOldEvent = await prisma.scheduleEvent.findUnique({ where: { id } });
    const [oldTariffRow] = await prisma.$queryRaw<any[]>`SELECT "allowedTariffs" FROM "ScheduleEvent" WHERE id = ${id}`;
    const oldEvent = { ...prismaOldEvent, allowedTariffs: oldTariffRow?.allowedTariffs || [] };
    const { date, allowedTariffs, ...rest } = req.body;
    const data = date ? { ...rest, date: new Date(date).toISOString() } : rest;
    const event = await prisma.scheduleEvent.update({ 
      where: { id }, 
      data,
      include: { miniGroup: true }
    });

    if (allowedTariffs !== undefined) {
      const tariffs = Array.isArray(allowedTariffs) ? allowedTariffs : [];
      await prisma.$executeRaw`UPDATE "ScheduleEvent" SET "allowedTariffs" = ${tariffs}::TEXT[] WHERE id = ${id}`;
    }

    const [updated] = await prisma.$queryRaw<any[]>`SELECT "allowedTariffs" FROM "ScheduleEvent" WHERE id = ${id}`;
    const eventWithTariffs = { ...event, allowedTariffs: updated?.allowedTariffs || [] };
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'SCHEDULE', ${id}, ${JSON.stringify({ title: event.title })}::jsonb, ${JSON.stringify(oldEvent)}::jsonb, ${JSON.stringify(eventWithTariffs)}::jsonb, NOW())
    `;

    res.json(eventWithTariffs);

    if (!prismaOldEvent?.isPublished && event.isPublished) {
      prisma.student.findMany({
        where: { user: { isActive: true } },
        select: { userId: true }
      }).then(activeStudents => 
        Promise.all(
          activeStudents.map(s => 
            notificationService.createForNewEvent(s.userId, event.title, event.id)
          )
        )
      ).catch(err => console.error('Background notifications error (update schedule):', err));
    }
  } catch (error) {
    console.error('Update schedule event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/schedule/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const oldEvent = await prisma.scheduleEvent.findUnique({ where: { id } });
    await prisma.scheduleEvent.delete({ where: { id } });
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'SCHEDULE', ${id}, ${JSON.stringify({ title: oldEvent?.title })}::jsonb, ${JSON.stringify(oldEvent)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Событие удалено' });
  } catch (error) {
    console.error('Delete schedule event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/contacts', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const contacts: any[] = await prisma.$queryRaw`
      SELECT id, name, role, phone, email, telegram, photo, "order", "isPublished", "createdAt", "updatedAt",
             format, address, website, description, city
      FROM "Contact"
      ORDER BY "order" ASC
    `;
    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/contacts', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { format, address, website, description, city, ...prismaData } = req.body;
    const contact = await prisma.contact.create({ data: { ...prismaData, isPublished: true } });
    
    await prisma.$executeRaw`
      UPDATE "Contact" SET format = ${format || null}, address = ${address || null}, website = ${website || null}, description = ${description || null}, city = ${city || null}
      WHERE id = ${contact.id}
    `;
    
    const fullContact = { ...contact, format: format || null, address: address || null, website: website || null, description: description || null, city: city || null };
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'CONTACT', ${contact.id}, ${JSON.stringify({ name: contact.name })}::jsonb, ${JSON.stringify(fullContact)}::jsonb, NOW())
    `;
    
    res.status(201).json(fullContact);
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/contacts/:id', adminOnly, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const oldRows: any[] = await prisma.$queryRaw`
      SELECT id, name, role, phone, email, telegram, photo, "order", "isPublished", format, address, website, description, city
      FROM "Contact" WHERE id = ${id}
    `;
    const oldContact = oldRows[0] || null;
    
    const { format, address, website, description, city, ...prismaData } = req.body;
    
    if (Object.keys(prismaData).length > 0) {
      await prisma.contact.update({ where: { id }, data: prismaData });
    }
    
    const extFields: Record<string, string | null> = {};
    if (format !== undefined) extFields.format = format || null;
    if (address !== undefined) extFields.address = address || null;
    if (website !== undefined) extFields.website = website || null;
    if (description !== undefined) extFields.description = description || null;
    if (city !== undefined) extFields.city = city || null;
    
    if (Object.keys(extFields).length > 0) {
      const setClauses = Object.keys(extFields).map((key, i) => `"${key}" = $${i + 2}`).join(', ');
      const values = Object.values(extFields);
      await prisma.$executeRawUnsafe(
        `UPDATE "Contact" SET ${setClauses} WHERE id = $1`,
        id,
        ...values
      );
    }
    
    const updatedRows: any[] = await prisma.$queryRaw`
      SELECT id, name, role, phone, email, telegram, photo, "order", "isPublished", "createdAt", "updatedAt", format, address, website, description, city
      FROM "Contact" WHERE id = ${id}
    `;
    const contact = updatedRows[0];
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'CONTACT', ${id}, ${JSON.stringify({ name: contact?.name })}::jsonb, ${JSON.stringify(oldContact)}::jsonb, ${JSON.stringify(contact)}::jsonb, NOW())
    `;
    
    res.json(contact);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/contacts/:id', adminOnly, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const oldContact = await prisma.contact.findUnique({ where: { id } });
    await prisma.contact.delete({ where: { id } });
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'CONTACT', ${id}, ${JSON.stringify({ name: oldContact?.name })}::jsonb, ${JSON.stringify(oldContact)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Контакт удален' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Temporary migration endpoint for adding new Community columns
router.post('/migrate-communities', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Community" 
      ADD COLUMN IF NOT EXISTS "format" VARCHAR(20) DEFAULT 'offline',
      ADD COLUMN IF NOT EXISTS "communityType" VARCHAR(30) DEFAULT 'mixed',
      ADD COLUMN IF NOT EXISTS "dayOfWeek" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "time" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "leader" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "leaderContact" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "link" VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "allowedTariffs" TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "shortDescription" TEXT,
      ADD COLUMN IF NOT EXISTS "leaders" TEXT,
      ADD COLUMN IF NOT EXISTS "contactButtonLabel" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "joinButtonLabel" VARCHAR(100)
    `);
    res.json({ message: 'Migration completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});

router.get('/communities', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const communities = await prisma.$queryRaw`
      SELECT id, name, description, "shortDescription", address, city, phone, schedule, "isPublished", "createdAt", "updatedAt",
             format, "communityType", "dayOfWeek", time, leader, "leaderContact", link, "allowedTariffs",
             leaders, "contactButtonLabel", "joinButtonLabel"
      FROM "Community" ORDER BY name ASC
    `;
    res.json(communities);
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/communities', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { name, format, communityType, dayOfWeek, time, city, address, link, leader, leaderContact, allowedTariffs, shortDescription, leaders, contactButtonLabel, joinButtonLabel } = req.body;
    const id = crypto.randomUUID();
    const tariffs = allowedTariffs || [];
    const leadersJson = leaders ? JSON.stringify(leaders) : null;
    await prisma.$executeRaw`
      INSERT INTO "Community" (id, name, format, "communityType", "dayOfWeek", time, city, address, link, leader, "leaderContact", "isPublished", "allowedTariffs", "shortDescription", leaders, "contactButtonLabel", "joinButtonLabel", "createdAt", "updatedAt")
      VALUES (${id}, ${name}, ${format || 'offline'}, ${communityType || 'mixed'}, ${dayOfWeek || null}, ${time || null}, ${city || null}, ${address || null}, ${link || null}, ${leader || null}, ${leaderContact || null}, true, ${tariffs}, ${shortDescription || null}, ${leadersJson}, ${contactButtonLabel || null}, ${joinButtonLabel || null}, NOW(), NOW())
    `;
    const [community] = await prisma.$queryRaw<any[]>`SELECT * FROM "Community" WHERE id = ${id}`;
    res.status(201).json(community);
  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/communities/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const { name, format, communityType, dayOfWeek, time, city, address, link, leader, leaderContact, isPublished, allowedTariffs, shortDescription, leaders, contactButtonLabel, joinButtonLabel } = req.body;
    
    const [oldCommunity] = await prisma.$queryRaw<any[]>`SELECT * FROM "Community" WHERE id = ${id}`;
    
    const tariffsValue = allowedTariffs !== undefined ? allowedTariffs : null;
    const leadersJson = leaders !== undefined ? (leaders ? JSON.stringify(leaders) : null) : undefined;
    const contactBtnVal = contactButtonLabel !== undefined ? (contactButtonLabel || null) : (oldCommunity?.contactButtonLabel || null);
    const joinBtnVal = joinButtonLabel !== undefined ? (joinButtonLabel || null) : (oldCommunity?.joinButtonLabel || null);
    const leadersVal = leadersJson !== undefined ? leadersJson : (oldCommunity?.leaders || null);
    await prisma.$executeRaw`
      UPDATE "Community" SET
        name = COALESCE(${name}, name),
        format = COALESCE(${format}, format),
        "communityType" = COALESCE(${communityType}, "communityType"),
        "dayOfWeek" = ${dayOfWeek},
        time = ${time},
        city = ${city},
        address = ${address},
        link = ${link},
        leader = ${leader},
        "leaderContact" = ${leaderContact},
        "isPublished" = COALESCE(${isPublished}, "isPublished"),
        "allowedTariffs" = COALESCE(${tariffsValue}, "allowedTariffs"),
        "shortDescription" = COALESCE(${shortDescription !== undefined ? shortDescription : null}, "shortDescription"),
        leaders = ${leadersVal},
        "contactButtonLabel" = ${contactBtnVal},
        "joinButtonLabel" = ${joinBtnVal},
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;
    const [community] = await prisma.$queryRaw<any[]>`SELECT * FROM "Community" WHERE id = ${id}`;
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'COMMUNITY', ${id}, ${JSON.stringify({ name: community?.name })}::jsonb, ${JSON.stringify(oldCommunity)}::jsonb, ${JSON.stringify(community)}::jsonb, NOW())
    `;
    
    res.json(community);
  } catch (error) {
    console.error('Update community error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/communities/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    const [oldCommunity] = await prisma.$queryRaw<any[]>`SELECT * FROM "Community" WHERE id = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Community" WHERE id = ${id}`;
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'COMMUNITY', ${id}, ${JSON.stringify({ name: oldCommunity?.name })}::jsonb, ${JSON.stringify(oldCommunity)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Община удалена' });
  } catch (error) {
    console.error('Delete community error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Settings endpoints
router.get('/settings/:key', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: req.params.key } });
    res.json({ value: setting?.value || null });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/settings/:key', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { value } = req.body;
    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value }
    });

    if (req.params.key === 'communities_visible') {
      const isEnabled = value === 'true';
      const existing = await prisma.platformSetting.findUnique({ where: { key: 'visibility_communities' } });
      let currentTariffs = ['ALL'];
      if (existing?.value) {
        try {
          const parsed = JSON.parse(existing.value);
          if (parsed.tariffs && Array.isArray(parsed.tariffs)) {
            currentTariffs = parsed.tariffs;
          }
        } catch {}
      }
      const newVisibility = JSON.stringify({ enabled: isEnabled, tariffs: currentTariffs });
      await prisma.platformSetting.upsert({
        where: { key: 'visibility_communities' },
        update: { value: newVisibility },
        create: { key: 'visibility_communities', label: 'Общины', category: 'visibility', type: 'TEXT', value: newVisibility }
      });
    }

    res.json(setting);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Helper to parse chatLink JSON and extract mentorIds
function parseMiniGroupData(group: any) {
  let chatLink = null;
  let mentorIds: string[] = [];
  try {
    const chatData = JSON.parse(group.chatLink || '{}');
    chatLink = chatData.link || null;
    mentorIds = chatData.mentorIds || [];
  } catch {
    // If not JSON, treat as plain link (legacy data)
    chatLink = group.chatLink;
  }
  return { ...group, chatLink, mentorIds };
}

router.get('/mini-groups', groupRoles, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    const groups = await prisma.miniGroup.findMany({
      orderBy: { title: 'asc' },
      include: { 
        curator: true,
        events: true,
        _count: { select: { members: true } }
      }
    });
    
    // Transform chatLink JSON to separate fields
    let transformedGroups = groups.map(parseMiniGroupData);
    
    // MENTOR/INTERN/PSYCHOLOGIST can only see groups where they are one of the mentors
    if (userRole === 'MENTOR' || userRole === 'INTERN' || userRole === 'PSYCHOLOGIST') {
      transformedGroups = transformedGroups.filter(g => g.mentorIds.includes(userId));
    }
    
    res.json(transformedGroups);
  } catch (error) {
    console.error('Get mini-groups error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/mini-groups', groupRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { chatLink, curatorId, title, description } = req.body;
    const mentorIds = curatorId ? curatorId.split(',').filter(Boolean) : [];
    // Store mentorIds in chatLink as JSON: {"link": "...", "mentorIds": [...]}
    const chatLinkData = JSON.stringify({
      link: chatLink ? normalizeTelegramLink(chatLink) : null,
      mentorIds
    });
    const group = await prisma.miniGroup.create({ 
      data: {
        title,
        description,
        chatLink: chatLinkData,
        curatorId: null,
        isPublished: true
      },
      include: { curator: true, events: true }
    });
    // Return with parsed chatLink and mentorIds
    res.status(201).json({
      ...group,
      chatLink: chatLink ? normalizeTelegramLink(chatLink) : null,
      mentorIds
    });
  } catch (error) {
    console.error('Create mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/mini-groups/:id', groupRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    
    // MENTOR/INTERN/PSYCHOLOGIST can only edit their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN' || req.user!.role === 'PSYCHOLOGIST') {
      const group = await prisma.miniGroup.findUnique({ where: { id } });
      if (!group) {
        return res.status(404).json({ error: 'Мини-группа не найдена' });
      }
      // Check if user is one of the mentors
      let mentorIds: string[] = [];
      try {
        const chatData = JSON.parse(group.chatLink || '{}');
        mentorIds = chatData.mentorIds || [];
      } catch {}
      if (!mentorIds.includes(req.user!.id)) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
    const { chatLink, curatorId, title, description } = req.body;
    const mentorIds = curatorId ? curatorId.split(',').filter(Boolean) : [];
    // Store mentorIds in chatLink as JSON
    const chatLinkData = JSON.stringify({
      link: chatLink ? normalizeTelegramLink(chatLink) : null,
      mentorIds
    });
    const group = await prisma.miniGroup.update({ 
      where: { id }, 
      data: {
        title,
        description,
        chatLink: chatLinkData,
        curatorId: null
      },
      include: { curator: true, events: true }
    });
    // Return with parsed chatLink and mentorIds
    res.json({
      ...group,
      chatLink: chatLink ? normalizeTelegramLink(chatLink) : null,
      mentorIds
    });
  } catch (error) {
    console.error('Update mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/mini-groups/:id', groupRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const id = req.params.id;
    
    // MENTOR/INTERN/PSYCHOLOGIST can only delete their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN' || req.user!.role === 'PSYCHOLOGIST') {
      const group = await prisma.miniGroup.findUnique({ where: { id } });
      if (!group) {
        return res.status(404).json({ error: 'Мини-группа не найдена' });
      }
      // Check if user is one of the mentors
      let mentorIds: string[] = [];
      try {
        const chatData = JSON.parse(group.chatLink || '{}');
        mentorIds = chatData.mentorIds || [];
      } catch {}
      if (!mentorIds.includes(req.user!.id)) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
    await prisma.miniGroup.delete({ where: { id } });
    res.json({ message: 'Мини-группа удалена' });
  } catch (error) {
    console.error('Delete mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

async function verifyMentorGroupAccess(groupId: string, userEmail: string): Promise<boolean> {
  const group = await prisma.miniGroup.findUnique({
    where: { id: groupId },
    include: { curator: true }
  });
  return group?.curator?.email === userEmail;
}

router.get('/mini-groups/:groupId/events', groupRoles, async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // MENTOR can only access their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
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

router.post('/mini-groups/:groupId/events', groupRoles, async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // MENTOR can only add events to their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
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

router.put('/mini-groups/:groupId/events/:eventId', groupRoles, async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId, eventId } = req.params;
    
    // MENTOR can only update events in their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
    // Verify event belongs to the specified group
    const existingEvent = await prisma.scheduleEvent.findFirst({
      where: { id: eventId, miniGroupId: groupId }
    });
    if (!existingEvent) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    
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

router.delete('/mini-groups/:groupId/events/:eventId', groupRoles, async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId, eventId } = req.params;
    
    // MENTOR/PSYCHOLOGIST can only delete events in their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN' || req.user!.role === 'PSYCHOLOGIST') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
    // Verify event belongs to the specified group
    const existingEvent = await prisma.scheduleEvent.findFirst({
      where: { id: eventId, miniGroupId: groupId }
    });
    if (!existingEvent) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    
    await prisma.scheduleEvent.delete({ where: { id: eventId } });
    res.json({ message: 'Событие удалено' });
  } catch (error) {
    console.error('Delete mini-group event error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Mini-group members management
router.get('/mini-groups/:groupId/members', groupRoles, async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // MENTOR can only access their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
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

router.post('/mini-groups/:groupId/members', groupRoles, async (req: AuthRequest & Request<GroupEventParams>, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // MENTOR can only add members to their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
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

router.delete('/mini-groups/:groupId/members/:memberId', groupRoles, async (req: AuthRequest & Request<{groupId: string, memberId: string}>, res: Response) => {
  try {
    const { groupId, memberId } = req.params;
    
    // MENTOR can only remove members from their own groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const hasAccess = await verifyMentorGroupAccess(groupId, req.user!.email);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Нет доступа к этой мини-группе' });
      }
    }
    
    // Verify member belongs to the specified group
    const existingMember = await prisma.miniGroupMember.findFirst({
      where: { id: memberId, miniGroupId: groupId }
    });
    if (!existingMember) {
      return res.status(404).json({ error: 'Участник не найден' });
    }
    
    await prisma.miniGroupMember.delete({ where: { id: memberId } });
    res.json({ message: 'Участник удален из группы' });
  } catch (error) {
    console.error('Remove mini-group member error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Search students for adding to mini-group
router.get('/students/search', groupRoles, async (req: AuthRequest, res: Response) => {
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

router.post('/modules/reorder', moderatorRoles, async (req: AuthRequest, res: Response) => {
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
    invalidateModulesCache();
    
    res.json({ message: 'Порядок изменен' });
  } catch (error) {
    console.error('Reorder modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/lessons/reorder', moderatorRoles, async (req: AuthRequest, res: Response) => {
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
    invalidateModulesCache();
    
    res.json({ message: 'Порядок изменен' });
  } catch (error) {
    console.error('Reorder lessons error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/library/reorder', adminOnly, async (req: AuthRequest, res: Response) => {
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

router.post('/contacts/reorder', adminOnly, async (req: AuthRequest, res: Response) => {
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

router.post('/modules/reorder-batch', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.module.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    invalidateModulesCache();
    res.json({ message: 'Порядок сохранен' });
  } catch (error) {
    console.error('Batch reorder modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/lessons/reorder-batch', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.lesson.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    invalidateModulesCache();
    res.json({ message: 'Порядок сохранен' });
  } catch (error) {
    console.error('Batch reorder lessons error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/library/reorder-batch', adminOnly, async (req: AuthRequest, res: Response) => {
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

router.post('/contacts/reorder-batch', adminOnly, async (req: AuthRequest, res: Response) => {
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

router.get('/modules/next-order', contentRoles, async (req: AuthRequest, res: Response) => {
  try {
    const maxModule = await prisma.module.findFirst({ orderBy: { order: 'desc' } });
    res.json({ nextOrder: (maxModule?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons/next-order/:moduleId', contentRoles, async (req: AuthRequest & Request<{ moduleId: string }>, res: Response) => {
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

router.get('/library/next-order', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const maxItem = await prisma.libraryItem.findFirst({ orderBy: { order: 'desc' } });
    res.json({ nextOrder: (maxItem?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/contacts/next-order', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const maxContact = await prisma.contact.findFirst({ orderBy: { order: 'desc' } });
    res.json({ nextOrder: (maxContact?.order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Chat Links endpoints
router.get('/chats', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const chats = await prisma.$queryRaw<any[]>`
      SELECT * FROM "ChatLink" ORDER BY "order" ASC
    `;
    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/chats', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, platform, icon, link, members, isSchedule, tariffs, isPublished, order } = req.body;
    const tariffsArray = tariffs || ['BASIC', 'FAMILY', 'WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];
    
    const [chat] = await prisma.$queryRaw<any[]>`
      INSERT INTO "ChatLink" (name, description, platform, icon, link, members, "isSchedule", tariffs, "isPublished", "order")
      VALUES (${name}, ${description || null}, ${platform || 'Telegram'}, ${icon || 'message'}, ${link}, ${members || null}, ${isSchedule || false}, ${tariffsArray}::TEXT[], ${isPublished !== false}, ${order || 0})
      RETURNING *
    `;
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'CREATE', 'CHAT', ${chat.id}, ${JSON.stringify({ name: chat.name })}::jsonb, ${JSON.stringify(chat)}::jsonb, NOW())
    `;
    
    res.status(201).json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/chats/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, platform, icon, link, members, isSchedule, tariffs, isPublished, order } = req.body;
    
    const [oldChat] = await prisma.$queryRaw<any[]>`SELECT * FROM "ChatLink" WHERE id = ${id}::uuid`;
    
    const [chat] = await prisma.$queryRaw<any[]>`
      UPDATE "ChatLink" SET
        name = COALESCE(${name}, name),
        description = ${description},
        platform = COALESCE(${platform}, platform),
        icon = COALESCE(${icon}, icon),
        link = COALESCE(${link}, link),
        members = ${members || null},
        "isSchedule" = COALESCE(${isSchedule}, "isSchedule"),
        tariffs = COALESCE(${tariffs}::TEXT[], tariffs),
        "isPublished" = COALESCE(${isPublished}, "isPublished"),
        "order" = COALESCE(${order}, "order"),
        "updatedAt" = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "newData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'UPDATE', 'CHAT', ${id}, ${JSON.stringify({ name: chat?.name })}::jsonb, ${JSON.stringify(oldChat)}::jsonb, ${JSON.stringify(chat)}::jsonb, NOW())
    `;
    
    res.json(chat);
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/chats/:id', moderatorRoles, async (req: AuthRequest & Request<IdParams>, res: Response) => {
  try {
    const { id } = req.params;
    
    const [oldChat] = await prisma.$queryRaw<any[]>`SELECT * FROM "ChatLink" WHERE id = ${id}::uuid`;
    
    await prisma.$executeRaw`DELETE FROM "ChatLink" WHERE id = ${id}::uuid`;
    
    await prisma.$executeRaw`
      INSERT INTO "AdminLog" (id, "userId", action, entity, "entityId", details, "oldData", "createdAt")
      VALUES (gen_random_uuid(), ${req.user!.id}, 'DELETE', 'CHAT', ${id}, ${JSON.stringify({ name: oldChat?.name })}::jsonb, ${JSON.stringify(oldChat)}::jsonb, NOW())
    `;
    
    res.json({ message: 'Чат удален' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/chats/next-order', moderatorRoles, async (req: AuthRequest, res: Response) => {
  try {
    const [result] = await prisma.$queryRaw<any[]>`SELECT MAX("order") as max_order FROM "ChatLink"`;
    res.json({ nextOrder: (result?.max_order || 0) + 1 });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
