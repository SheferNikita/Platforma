import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import ordersRouter from './orders';
import moderationRouter from './moderation';
import auditRouter from './audit';
import distributionRouter from './distribution';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

let modulesCache: { data: any[] | null; timestamp: number } = { data: null, timestamp: 0 };
const MODULES_CACHE_TTL = 2 * 60 * 1000;

async function getCachedModules() {
  const now = Date.now();
  if (modulesCache.data && (now - modulesCache.timestamp) < MODULES_CACHE_TTL) {
    return modulesCache.data;
  }
  const currentDate = new Date();
  const modules = await prisma.module.findMany({
    where: { isPublished: true },
    include: {
      lessons: {
        where: {
          OR: [
            { isPublished: true },
            { 
              isPublished: false,
              publishAt: { gt: currentDate }
            }
          ]
        },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          duration: true,
          order: true,
          isPublished: true,
          publishAt: true
        }
      }
    },
    orderBy: { order: 'asc' }
  });
  modulesCache = { data: modules, timestamp: now };
  return modules;
}

function invalidateModulesCache() {
  modulesCache = { data: null, timestamp: 0 };
}

router.use('/orders', ordersRouter);
router.use('/moderation', moderationRouter);
router.use('/audit', auditRouter);
router.use('/distribution', distributionRouter);

interface DecodedToken {
  id: string;
  email: string;
  name: string;
  role: string;
}

async function getStudentFromToken(req: Request): Promise<{ studentId: string } | null> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.cookies?.token;
    if (!token) {
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { student: true }
    });
    
    if (!user?.student) return null;
    return { studentId: user.student.id };
  } catch (error) {
    console.error('[getStudentFromToken] Error:', error);
    return null;
  }
}

async function getUserRoleFromToken(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.cookies?.token;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded.role || null;
  } catch {
    return null;
  }
}

function isAdminRole(role: string | null): boolean {
  return !!role && role !== 'STUDENT';
}

router.get('/modules', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const student = await getStudentFromToken(req);
    const t1 = Date.now();
    
    const modules = await getCachedModules();
    const t2 = Date.now();

    const userRole = await getUserRoleFromToken(req);

    if (!student) {
      if (isAdminRole(userRole)) {
        const result = modules.map(m => ({
          ...m,
          hasAccess: true,
          accessExpiresAt: null,
          accessFrom: null
        }));
        console.log(`[Perf] GET /modules: auth=${t1-startTime}ms, modules=${t2-t1}ms, total=${Date.now()-startTime}ms (admin)`);
        return res.json(result);
      }
      const result = modules.map(m => ({
        ...m,
        hasAccess: false,
        accessExpiresAt: null
      }));
      console.log(`[Perf] GET /modules: auth=${t1-startTime}ms, modules=${t2-t1}ms, total=${Date.now()-startTime}ms (guest)`);
      return res.json(result);
    }

    const accessList = await prisma.moduleAccess.findMany({
      where: { studentId: student.studentId }
    });
    const t3 = Date.now();
    const accessMap = new Map(accessList.map(a => [a.moduleId, a]));

    const result = modules.map(m => {
      const access = accessMap.get(m.id);
      return {
        ...m,
        hasAccess: true,
        accessExpiresAt: access?.expiresAt ?? null,
        accessFrom: access?.accessFrom ?? null
      };
    });

    console.log(`[Perf] GET /modules: auth=${t1-startTime}ms, modules=${t2-t1}ms, access=${t3-t2}ms, total=${Date.now()-startTime}ms`);
    res.json(result);
  } catch (error) {
    console.error('Get public modules error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/modules-with-progress', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const student = await getStudentFromToken(req);
    const userRole = await getUserRoleFromToken(req);
    const t1 = Date.now();

    const modules = await getCachedModules();
    const t2 = Date.now();

    let completedLessonIds: string[] = [];
    let accessMap = new Map<string, any>();

    if (student) {
      const [accessList, progress] = await Promise.all([
        prisma.moduleAccess.findMany({
          where: { studentId: student.studentId }
        }),
        prisma.lessonProgress.findMany({
          where: { studentId: student.studentId, isCompleted: true },
          select: { lessonId: true }
        })
      ]);
      accessMap = new Map(accessList.map(a => [a.moduleId, a]));
      completedLessonIds = progress.map(p => p.lessonId);
    }
    const t3 = Date.now();

    const isAdmin = isAdminRole(userRole);
    const result = modules.map(m => {
      const access = accessMap.get(m.id);
      return {
        ...m,
        hasAccess: student ? true : isAdmin ? true : false,
        accessExpiresAt: access?.expiresAt ?? null,
        accessFrom: access?.accessFrom ?? null
      };
    });

    console.log(`[Perf] GET /modules-with-progress: auth=${t1-startTime}ms, modules=${t2-t1}ms, access+progress=${t3-t2}ms, total=${Date.now()-startTime}ms`);
    res.json({ modules: result, completedLessonIds });
  } catch (error) {
    console.error('Get modules-with-progress error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/lessons/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
      const userRole = await getUserRoleFromToken(req);
      if (isAdminRole(userRole)) {
        return res.json({ 
          ...lesson, 
          hasAccess: true, 
          accessFrom: null,
          accessExpiresAt: null 
        });
      }
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

    res.json({ 
      ...lesson, 
      hasAccess: true, 
      accessFrom: access?.accessFrom ?? null,
      accessExpiresAt: access?.expiresAt ?? null 
    });
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
    
    const studentInfo = await getStudentFromToken(req);
    if (studentInfo) {
      const student = await prisma.student.findUnique({
        where: { id: studentInfo.studentId },
        select: { tariff: true }
      });
      
      if (student) {
        const filteredItems = items.filter(item => {
          if (!item.allowedTariffs || item.allowedTariffs.length === 0) {
            return true;
          }
          return item.allowedTariffs.includes(student.tariff);
        });
        return res.json(filteredItems);
      }
    }
    
    const publicItems = items.filter(item => !item.allowedTariffs || item.allowedTariffs.length === 0);
    res.json(publicItems);
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
    const contacts: any[] = await prisma.$queryRaw`
      SELECT id, name, role, phone, email, telegram, photo, "order", "isPublished",
             format, address, website, description, city
      FROM "Contact"
      WHERE "isPublished" = true
      ORDER BY "order" ASC
    `;
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
    // Check visibility setting
    const setting = await prisma.setting.findUnique({ where: { key: 'communities_visible' } });
    if (setting?.value === 'false') {
      return res.json({ hidden: true, communities: [] });
    }
    
    const communities = await prisma.$queryRaw`
      SELECT id, name, description, address, city, phone, schedule, "isPublished", "createdAt", "updatedAt",
             format, "communityType", "dayOfWeek", time, leader, "leaderContact", link
      FROM "Community" 
      WHERE "isPublished" = true 
      ORDER BY name ASC
    `;
    res.json({ hidden: false, communities });
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
        currency: true
      },
      orderBy: { price: 'asc' }
    });
    res.json(products);
  } catch (error) {
    console.error('Get public products error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/my-mini-group', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const membership = await prisma.miniGroupMember.findFirst({
      where: { studentId: student.studentId },
      include: {
        miniGroup: {
          include: {
            curator: {
              select: {
                id: true,
                name: true,
                email: true,
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
            },
            members: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!membership) {
      return res.json(null);
    }

    const group = membership.miniGroup;
    
    let chatLink = null;
    try {
      const chatData = JSON.parse(group.chatLink || '{}');
      chatLink = chatData.link || null;
    } catch {
      chatLink = group.chatLink;
    }

    res.json({
      id: group.id,
      title: group.title,
      description: group.description,
      chatLink,
      curator: group.curator,
      events: group.events,
      memberCount: group.members.length,
      createdAt: group.createdAt
    });
  } catch (error) {
    console.error('Get my mini-group error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get student's diary entries for a lesson (chat format)
router.get('/lessons/:lessonId/diary', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const lessonId = req.params.lessonId as string;

    const diaries = await prisma.diary.findMany({
      where: {
        lessonId,
        studentId: student.studentId
      },
      include: {
        repliedBy: { select: { name: true } },
        attachments: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(diaries);
  } catch (error) {
    console.error('Get diary error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Save new student diary entry for a lesson
router.post('/lessons/:lessonId/diary', async (req: Request, res: Response) => {
  console.log('[POST diary] === START ===');
  try {
    console.log('[POST diary] Getting student from token...');
    const student = await getStudentFromToken(req);
    if (!student) {
      console.log('[POST diary] No student found - unauthorized');
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    console.log('[POST diary] Student found:', student.studentId);

    const lessonId = req.params.lessonId as string;
    const { content, attachments } = req.body;
    
    console.log('[POST diary] LessonId:', lessonId);
    console.log('[POST diary] Content length:', content?.length || 0);
    console.log('[POST diary] Attachments count:', attachments?.length || 0);

    if (attachments?.length) {
      console.log('[POST diary] First attachment:', {
        filename: attachments[0].filename,
        mimeType: attachments[0].mimeType,
        size: attachments[0].size,
        dataLength: attachments[0].data?.length || 0
      });
    }

    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      console.log('[POST diary] Error: empty content and no attachments');
      return res.status(400).json({ error: 'Напишите текст или прикрепите файл' });
    }

    // Verify lesson exists
    console.log('[POST diary] Checking if lesson exists...');
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      console.log('[POST diary] Error: lesson not found');
      return res.status(404).json({ error: 'Урок не найден' });
    }
    console.log('[POST diary] Lesson found:', lesson.id);

    // Create diary entry first (without attachments)
    console.log('[POST diary] Creating diary entry...');
    const diary = await prisma.diary.create({
      data: {
        content: content?.trim() || '',
        studentId: student.studentId,
        lessonId
      }
    });
    console.log('[POST diary] Diary entry created:', diary.id);

    console.log('[POST diary] Created diary entry:', diary.id);

    // Create attachments separately if any
    let createdAttachments: any[] = [];
    if (attachments?.length) {
      try {
        for (const att of attachments) {
          console.log('[POST diary] Creating attachment:', att.originalName, 'size:', att.size);
          const attachment = await prisma.diaryAttachment.create({
            data: {
              diaryId: diary.id,
              filename: att.filename,
              originalName: att.originalName,
              mimeType: att.mimeType,
              size: att.size,
              data: att.data
            },
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              size: true,
              createdAt: true
            }
          });
          createdAttachments.push(attachment);
          console.log('[POST diary] Attachment created successfully:', attachment.id);
        }
      } catch (attachmentError: any) {
        console.error('[POST diary] Error creating attachment:', attachmentError);
        // Diary was created successfully, return it without failed attachments
        return res.status(201).json({ 
          ...diary, 
          attachments: createdAttachments,
          warning: 'Дневник сохранен, но не удалось загрузить вложение'
        });
      }
    }

    res.status(201).json({ ...diary, attachments: createdAttachments });
  } catch (error: any) {
    console.error('[POST diary] === ERROR ===');
    console.error('Save diary error:', error);
    console.error('Save diary error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      name: error?.name
    });
    
    // Check for specific Prisma errors
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Запись уже существует' });
    }
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Ошибка связи с уроком или студентом. Проверьте, что вы авторизованы.' });
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Урок или студент не найден' });
    }
    if (error?.message?.includes('timeout') || error?.message?.includes('ETIMEDOUT')) {
      return res.status(504).json({ error: 'Превышено время ожидания подключения к базе данных' });
    }
    if (error?.message?.includes('too large') || error?.message?.includes('size')) {
      return res.status(413).json({ error: 'Файл слишком большой. Максимальный размер: 10 МБ.' });
    }
    if (error?.message?.includes('ECONNREFUSED') || error?.message?.includes('connect')) {
      return res.status(503).json({ error: 'Ошибка подключения к базе данных' });
    }
    
    // Return detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Ошибка сервера при сохранении дневника'
      : `Ошибка: ${error?.message || 'неизвестная ошибка'}`;
    
    res.status(500).json({ error: errorMessage });
  }
});

// Get student's personal notes (конспект) entries for a lesson (chat format)
router.get('/lessons/:lessonId/personal-notes', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const lessonId = req.params.lessonId as string;

    const notes = await prisma.studentNote.findMany({
      where: {
        lessonId,
        studentId: student.studentId,
        noteType: 'personal'
      },
      include: {
        repliedBy: { select: { name: true } },
        attachments: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(notes);
  } catch (error) {
    console.error('Get personal notes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Save new student personal note (конспект) for a lesson
router.post('/lessons/:lessonId/personal-notes', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const lessonId = req.params.lessonId as string;
    const { content, attachments } = req.body;

    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Напишите текст или прикрепите файл' });
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    // Create note entry first (without attachments)
    const note = await prisma.studentNote.create({
      data: {
        content: content?.trim() || '',
        noteType: 'personal',
        studentId: student.studentId,
        lessonId
      }
    });

    console.log('[POST personal-notes] Created note entry:', note.id);

    // Create attachments separately if any
    let createdAttachments: any[] = [];
    if (attachments?.length) {
      try {
        for (const att of attachments) {
          console.log('[POST personal-notes] Creating attachment:', att.originalName, 'size:', att.size);
          const attachment = await prisma.noteAttachment.create({
            data: {
              noteId: note.id,
              filename: att.filename,
              originalName: att.originalName,
              mimeType: att.mimeType,
              size: att.size,
              data: att.data
            },
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              size: true,
              createdAt: true
            }
          });
          createdAttachments.push(attachment);
          console.log('[POST personal-notes] Attachment created successfully:', attachment.id);
        }
      } catch (attachmentError: any) {
        console.error('[POST personal-notes] Error creating attachment:', attachmentError);
        return res.status(201).json({ 
          ...note, 
          attachments: createdAttachments,
          warning: 'Конспект сохранен, но не удалось загрузить вложение'
        });
      }
    }

    res.status(201).json({ ...note, attachments: createdAttachments });
  } catch (error: any) {
    console.error('Save personal notes error:', error);
    console.error('Save personal notes error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    });
    
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Запись уже существует' });
    }
    if (error?.code === 'P2003') {
      return res.status(400).json({ error: 'Ошибка связи с уроком или студентом' });
    }
    if (error?.message?.includes('timeout')) {
      return res.status(504).json({ error: 'Превышено время ожидания. Попробуйте загрузить файл меньшего размера.' });
    }
    if (error?.message?.includes('too large') || error?.message?.includes('size')) {
      return res.status(413).json({ error: 'Файл слишком большой. Максимальный размер: 10 МБ.' });
    }
    
    res.status(500).json({ error: 'Ошибка сервера при сохранении конспекта' });
  }
});

// Get student's notes/questions for a lesson with replies
router.get('/lessons/:lessonId/notes', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    console.log('[GET notes] Student:', student, 'LessonId:', req.params.lessonId);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const lessonId = req.params.lessonId as string;

    const notes = await prisma.studentNote.findMany({
      where: {
        lessonId,
        studentId: student.studentId,
        noteType: { not: 'personal' }
      },
      include: {
        repliedBy: {
          select: { name: true }
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('[GET notes] Found', notes.length, 'notes for student', student.studentId);
    res.json(notes);
  } catch (error) {
    console.error('Get student notes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Submit student question or report for a lesson
router.post('/lessons/:lessonId/notes', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const lessonId = req.params.lessonId as string;
    const { content, noteType, attachments } = req.body;

    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Напишите текст или прикрепите файл' });
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    const note = await prisma.studentNote.create({
      data: {
        content: content?.trim() || '',
        noteType: noteType || 'question',
        studentId: student.studentId,
        lessonId,
        attachments: attachments?.length ? {
          create: attachments.map((att: { filename: string; originalName: string; mimeType: string; size: number; data: string }) => ({
            filename: att.filename,
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.size,
            data: att.data
          }))
        } : undefined
      },
      include: {
        attachments: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true
          }
        }
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Submit student note error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get student profile stats (diaries, notes, lessons)
router.get('/profile/stats', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Count diaries submitted by student
    const diariesCount = await prisma.diary.count({
      where: { studentId: student.studentId }
    });

    // Count notes submitted by student
    const notesCount = await prisma.studentNote.count({
      where: { studentId: student.studentId }
    });

    // Count completed lessons
    const lessonsCompleted = await prisma.lessonProgress.count({
      where: { 
        studentId: student.studentId,
        isCompleted: true
      }
    });

    // Count total published lessons
    const totalLessons = await prisma.lesson.count({
      where: { isPublished: true }
    });

    res.json({
      diariesCount,
      notesCount,
      lessonsCompleted,
      totalLessons
    });
  } catch (error) {
    console.error('Get profile stats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get student profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const studentData = await prisma.student.findUnique({
      where: { id: student.studentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
          }
        },
        progress: {
          where: { isCompleted: true }
        },
        moduleAccess: {
          where: { isActive: true }
        }
      }
    });

    if (!studentData) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }

    // Count total lessons
    const totalLessons = await prisma.lesson.count({
      where: { isPublished: true }
    });

    res.json({
      id: studentData.id,
      name: studentData.user.name,
      email: studentData.user.email,
      phone: studentData.phone,
      city: studentData.city,
      sobrietyDate: studentData.sobrietyDate,
      gender: studentData.gender,
      age: studentData.age,
      addictionType: studentData.addictionType,
      joinDate: studentData.user.createdAt,
      lessonsCompleted: studentData.progress.length,
      totalLessons,
      modulesAccess: studentData.moduleAccess.length,
      tariff: studentData.tariff
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Update student profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const { name, phone, city, sobrietyDate, password } = req.body;

    // Update student data
    const updatedStudent = await prisma.student.update({
      where: { id: student.studentId },
      data: {
        phone: phone || undefined,
        city: city || undefined,
        sobrietyDate: sobrietyDate ? new Date(sobrietyDate) : undefined
      },
      include: {
        user: true
      }
    });

    // Build user update data
    const userUpdateData: { name?: string; password?: string } = {};
    
    if (name) {
      userUpdateData.name = name;
    }
    
    // Update password if provided (hash it first)
    if (password && password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      userUpdateData.password = hashedPassword;
    }
    
    // Update user if there's data to update
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: updatedStudent.userId },
        data: userUpdateData
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get student's lesson progress (completed lessons)
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const progress = await prisma.lessonProgress.findMany({
      where: { 
        studentId: student.studentId,
        isCompleted: true
      },
      select: {
        lessonId: true,
        completedAt: true
      }
    });

    res.json(progress.map(p => p.lessonId));
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Mark lesson as completed
router.post('/lessons/:lessonId/complete', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    const existingProgress = await prisma.lessonProgress.findFirst({
      where: {
        studentId: student.studentId,
        lessonId
      }
    });

    if (existingProgress) {
      await prisma.lessonProgress.update({
        where: { id: existingProgress.id },
        data: {
          isCompleted: true,
          completedAt: new Date()
        }
      });
    } else {
      await prisma.lessonProgress.create({
        data: {
          studentId: student.studentId,
          lessonId,
          isCompleted: true,
          completedAt: new Date()
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark lesson complete error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Unmark lesson as completed
router.delete('/lessons/:lessonId/complete', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const { lessonId } = req.params;

    await prisma.lessonProgress.updateMany({
      where: {
        studentId: student.studentId,
        lessonId
      },
      data: {
        isCompleted: false,
        completedAt: null
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unmark lesson complete error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get student's diaries
router.get('/my-diaries', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const diaries = await prisma.diary.findMany({
      where: { studentId: student.studentId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: { title: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = diaries.map(d => ({
      id: d.id,
      lessonId: d.lesson.id,
      lessonTitle: d.lesson.title,
      moduleName: d.lesson.module.title,
      date: d.createdAt.toISOString(),
      content: d.content,
      reply: d.reply,
      repliedAt: d.repliedAt?.toISOString()
    }));

    res.json(result);
  } catch (error) {
    console.error('Get my diaries error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get student's notes (конспекты)
router.get('/my-notes', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const notes = await prisma.studentNote.findMany({
      where: { 
        studentId: student.studentId,
        noteType: 'note' // Только конспекты, не вопросы
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: { title: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const result = notes.map(n => ({
      id: n.id,
      lessonId: n.lesson.id,
      lessonTitle: n.lesson.title,
      moduleName: n.lesson.module.title,
      date: n.createdAt.toISOString(),
      content: n.content,
      reply: n.reply,
      repliedAt: n.repliedAt?.toISOString()
    }));

    res.json(result);
  } catch (error) {
    console.error('Get my notes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get counts for profile summary
router.get('/my-materials-count', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const diariesCount = await prisma.diary.count({
      where: { studentId: student.studentId }
    });

    const notesCount = await prisma.studentNote.count({
      where: { 
        studentId: student.studentId,
        noteType: 'note'
      }
    });

    res.json({ diariesCount, notesCount });
  } catch (error) {
    console.error('Get materials count error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Download diary attachment
router.get('/attachments/diary/:id', async (req: Request, res: Response) => {
  try {
    const attachmentId = req.params.id as string;
    const attachment = await prisma.diaryAttachment.findUnique({
      where: { id: attachmentId }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    const buffer = Buffer.from(attachment.data, 'base64');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Download diary attachment error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Download note attachment
router.get('/attachments/note/:id', async (req: Request, res: Response) => {
  try {
    const attachmentId = req.params.id as string;
    const attachment = await prisma.noteAttachment.findUnique({
      where: { id: attachmentId }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    const buffer = Buffer.from(attachment.data, 'base64');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Download note attachment error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Public platform settings (without heavy base64 logo/favicon)
router.get('/platform-settings', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSetting.findMany();
    const result: Record<string, string | null> = {};
    settings.forEach(s => {
      if (s.key !== 'logo' && s.key !== 'favicon') {
        result[s.key] = s.value;
      }
    });
    res.json(result);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

let logoCache: { value: string | null; timestamp: number } | null = null;
let faviconCache: { value: string | null; timestamp: number } | null = null;
const MEDIA_CACHE_TTL = 10 * 60 * 1000;

export function invalidateMediaCache(key?: 'logo' | 'favicon') {
  if (!key || key === 'logo') logoCache = null;
  if (!key || key === 'favicon') faviconCache = null;
}

router.get('/platform-logo', async (req: Request, res: Response) => {
  try {
    if (logoCache && Date.now() - logoCache.timestamp < MEDIA_CACHE_TTL) {
      res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
      return res.json({ logo: logoCache.value });
    }
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'logo' } });
    logoCache = { value: setting?.value || null, timestamp: Date.now() };
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    res.json({ logo: setting?.value || null });
  } catch (error) {
    res.json({ logo: null });
  }
});

router.get('/platform-favicon', async (req: Request, res: Response) => {
  try {
    if (faviconCache && Date.now() - faviconCache.timestamp < MEDIA_CACHE_TTL) {
      res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
      return res.json({ favicon: faviconCache.value });
    }
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'favicon' } });
    faviconCache = { value: setting?.value || null, timestamp: Date.now() };
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    res.json({ favicon: setting?.value || null });
  } catch (error) {
    res.json({ favicon: null });
  }
});

// Public chats endpoint with tariff filtering
router.get('/chats', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    let userTariff = 'BASIC';
    
    if (student) {
      const studentData = await prisma.student.findUnique({
        where: { id: student.studentId },
        select: { tariff: true }
      });
      userTariff = studentData?.tariff || 'BASIC';
    }
    
    const chats = await prisma.$queryRaw<any[]>`
      SELECT * FROM "ChatLink" 
      WHERE "isPublished" = true AND ${userTariff} = ANY(tariffs)
      ORDER BY "order" ASC
    `;
    
    res.json(chats);
  } catch (error) {
    console.error('Get public chats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Get all mentor responses for student (grouped by lessons)
router.get('/mentor-responses', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Check tariff - only WITH_MENTOR, WITH_PSYCHOLOGIST, INDIVIDUAL_PSYCHOLOGIST have access
    const studentData = await prisma.student.findUnique({
      where: { id: student.studentId },
      select: { tariff: true }
    });

    const allowedTariffs = ['WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];
    if (!studentData?.tariff || !allowedTariffs.includes(studentData.tariff)) {
      return res.status(403).json({ error: 'Недоступно для вашего тарифа' });
    }

    // Get all diaries with replies
    const diaries = await prisma.diary.findMany({
      where: {
        studentId: student.studentId,
        reply: { not: null }
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            order: true,
            module: { select: { id: true, title: true, order: true } }
          }
        },
        repliedBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get all notes with replies
    const notes = await prisma.studentNote.findMany({
      where: {
        studentId: student.studentId,
        reply: { not: null }
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            order: true,
            module: { select: { id: true, title: true, order: true } }
          }
        },
        repliedBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by lessons
    const lessonMap = new Map<string, {
      lessonId: string;
      lessonTitle: string;
      lessonOrder: number;
      moduleId: string;
      moduleTitle: string;
      moduleOrder: number;
      items: Array<{
        id: string;
        type: 'diary' | 'note';
        noteType?: string;
        content: string;
        reply: any;
        createdAt: string;
        repliedAt: string | null;
        repliedByName: string | null;
      }>;
    }>();

    // Process diaries
    for (const diary of diaries) {
      if (!diary.lesson) continue;
      
      const key = diary.lesson.id;
      if (!lessonMap.has(key)) {
        lessonMap.set(key, {
          lessonId: diary.lesson.id,
          lessonTitle: diary.lesson.title,
          lessonOrder: diary.lesson.order,
          moduleId: diary.lesson.module?.id || '',
          moduleTitle: diary.lesson.module?.title || '',
          moduleOrder: diary.lesson.module?.order || 0,
          items: []
        });
      }

      let replyData = null;
      try {
        replyData = diary.reply ? JSON.parse(diary.reply) : null;
      } catch {
        replyData = diary.reply;
      }

      lessonMap.get(key)!.items.push({
        id: diary.id,
        type: 'diary',
        content: diary.content,
        reply: replyData,
        createdAt: diary.createdAt.toISOString(),
        repliedAt: diary.repliedAt?.toISOString() || null,
        repliedByName: diary.repliedBy?.name || null
      });
    }

    // Process notes
    for (const note of notes) {
      if (!note.lesson) continue;
      
      const key = note.lesson.id;
      if (!lessonMap.has(key)) {
        lessonMap.set(key, {
          lessonId: note.lesson.id,
          lessonTitle: note.lesson.title,
          lessonOrder: note.lesson.order,
          moduleId: note.lesson.module?.id || '',
          moduleTitle: note.lesson.module?.title || '',
          moduleOrder: note.lesson.module?.order || 0,
          items: []
        });
      }

      let replyData = null;
      try {
        replyData = note.reply ? JSON.parse(note.reply) : null;
      } catch {
        replyData = note.reply;
      }

      lessonMap.get(key)!.items.push({
        id: note.id,
        type: 'note',
        noteType: note.noteType || 'personal',
        content: note.content,
        reply: replyData,
        createdAt: note.createdAt.toISOString(),
        repliedAt: note.repliedAt?.toISOString() || null,
        repliedByName: note.repliedBy?.name || null
      });
    }

    // Convert to array and sort by module order, then lesson order
    const result = Array.from(lessonMap.values())
      .sort((a, b) => {
        if (a.moduleOrder !== b.moduleOrder) {
          return a.moduleOrder - b.moduleOrder;
        }
        return a.lessonOrder - b.lessonOrder;
      });

    // Sort items within each lesson by date (newest first)
    for (const lesson of result) {
      lesson.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json(result);
  } catch (error) {
    console.error('Get mentor responses error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Student reply to diary
router.post('/diary/:id/student-reply', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const { id } = req.params;
    const { reply, audioData, audioDuration, attachments } = req.body;

    if (!reply?.trim() && !audioData) {
      return res.status(400).json({ error: 'Необходим текст или голосовое сообщение' });
    }

    // Verify diary belongs to student
    const diary = await prisma.diary.findFirst({
      where: { id, studentId: student.studentId },
      select: { reply: true }
    });

    if (!diary) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    // Get student user data
    const studentData = await prisma.student.findUnique({
      where: { id: student.studentId },
      include: { user: { select: { id: true, name: true } } }
    });

    if (!studentData?.user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Parse existing reply history
    let replyHistory: Array<{ text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; attachments?: any[] }> = [];
    
    if (diary.reply) {
      try {
        const parsed = JSON.parse(diary.reply);
        if (Array.isArray(parsed)) {
          replyHistory = parsed;
        } else {
          replyHistory = [{ 
            text: diary.reply, 
            authorId: 'legacy', 
            authorName: 'Наставник',
            authorRole: 'MENTOR',
            createdAt: new Date().toISOString() 
          }];
        }
      } catch {
        replyHistory = [{ 
          text: diary.reply, 
          authorId: 'legacy', 
          authorName: 'Наставник',
          authorRole: 'MENTOR',
          createdAt: new Date().toISOString() 
        }];
      }
    }

    // Create new message
    const newMessage: { text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; attachments?: any[] } = {
      text: audioData ? '🎤 Голосовое сообщение' : reply,
      authorId: studentData.user.id,
      authorName: studentData.user.name,
      authorRole: 'STUDENT',
      createdAt: new Date().toISOString()
    };

    if (audioData) {
      newMessage.audioData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      newMessage.audioDuration = audioDuration;
    }

    if (attachments && attachments.length > 0) {
      newMessage.attachments = attachments;
    }

    replyHistory.push(newMessage);

    // Update diary
    await prisma.diary.update({
      where: { id },
      data: {
        reply: JSON.stringify(replyHistory)
      }
    });

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Student reply to diary error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Student reply to note
router.post('/note/:id/student-reply', async (req: Request, res: Response) => {
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const { id } = req.params;
    const { reply, audioData, audioDuration, attachments } = req.body;

    if (!reply?.trim() && !audioData) {
      return res.status(400).json({ error: 'Необходим текст или голосовое сообщение' });
    }

    // Verify note belongs to student
    const note = await prisma.studentNote.findFirst({
      where: { id, studentId: student.studentId },
      select: { reply: true }
    });

    if (!note) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    // Get student user data
    const studentData = await prisma.student.findUnique({
      where: { id: student.studentId },
      include: { user: { select: { id: true, name: true } } }
    });

    if (!studentData?.user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Parse existing reply history
    let replyHistory: Array<{ text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; attachments?: any[] }> = [];
    
    if (note.reply) {
      try {
        const parsed = JSON.parse(note.reply);
        if (Array.isArray(parsed)) {
          replyHistory = parsed;
        } else {
          replyHistory = [{ 
            text: note.reply, 
            authorId: 'legacy', 
            authorName: 'Наставник',
            authorRole: 'MENTOR',
            createdAt: new Date().toISOString() 
          }];
        }
      } catch {
        replyHistory = [{ 
          text: note.reply, 
          authorId: 'legacy', 
          authorName: 'Наставник',
          authorRole: 'MENTOR',
          createdAt: new Date().toISOString() 
        }];
      }
    }

    // Create new message
    const newMessage: { text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; attachments?: any[] } = {
      text: audioData ? '🎤 Голосовое сообщение' : reply,
      authorId: studentData.user.id,
      authorName: studentData.user.name,
      authorRole: 'STUDENT',
      createdAt: new Date().toISOString()
    };

    if (audioData) {
      newMessage.audioData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      newMessage.audioDuration = audioDuration;
    }

    if (attachments && attachments.length > 0) {
      newMessage.attachments = attachments;
    }

    replyHistory.push(newMessage);

    // Update note
    await prisma.studentNote.update({
      where: { id },
      data: {
        reply: JSON.stringify(replyHistory)
      }
    });

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Student reply to note error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export { invalidateModulesCache };
export default router;
