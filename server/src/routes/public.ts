import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import jwt from 'jsonwebtoken';
import ordersRouter from './orders';
import moderationRouter from './moderation';
import auditRouter from './audit';
import distributionRouter from './distribution';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    const now = new Date();

    const result = modules.map(m => {
      const access = accessMap.get(m.id);
      const isExpired = access?.expiresAt && new Date(access.expiresAt) < now;
      const isNotStarted = access?.accessFrom && new Date(access.accessFrom) > now;
      return {
        ...m,
        hasAccess: access?.isActive && !isExpired && !isNotStarted ? true : false,
        accessExpiresAt: access?.expiresAt ?? null,
        accessFrom: access?.accessFrom ?? null
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

    const now = new Date();
    const isExpired = access?.expiresAt && new Date(access.expiresAt) < now;
    const isNotStarted = access?.accessFrom && new Date(access.accessFrom) > now;
    const hasAccess = access?.isActive && !isExpired && !isNotStarted;

    res.json({ ...lesson, hasAccess, accessFrom: access?.accessFrom ?? null });
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
    
    res.json({
      id: group.id,
      title: group.title,
      description: group.description,
      chatLink: group.chatLink,
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
  try {
    const student = await getStudentFromToken(req);
    if (!student) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const lessonId = req.params.lessonId as string;
    const { content, attachments } = req.body;

    console.log('[POST diary] Received attachments:', attachments?.length || 0, 'files');
    if (attachments?.length) {
      console.log('[POST diary] First attachment:', {
        filename: attachments[0].filename,
        mimeType: attachments[0].mimeType,
        size: attachments[0].size,
        dataLength: attachments[0].data?.length || 0
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Текст дневника обязателен' });
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    // Create new diary entry with attachments (chat style)
    const diary = await prisma.diary.create({
      data: {
        content: content.trim(),
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

    res.status(201).json(diary);
  } catch (error: any) {
    console.error('Save diary error:', error);
    console.error('Save diary error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    });
    
    // Check for specific Prisma errors
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
    
    res.status(500).json({ error: 'Ошибка сервера при сохранении дневника' });
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

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Текст конспекта обязателен' });
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    // Create new note entry with attachments (chat style)
    const note = await prisma.studentNote.create({
      data: {
        content: content.trim(),
        noteType: 'personal',
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

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Текст сообщения обязателен' });
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
        content: content.trim(),
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
      modulesAccess: studentData.moduleAccess.length
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

    const { name, phone, city, sobrietyDate } = req.body;

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

    // Update user name if provided
    if (name) {
      await prisma.user.update({
        where: { id: updatedStudent.userId },
        data: { name }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
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

export default router;
