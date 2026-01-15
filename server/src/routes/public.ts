import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';
import ordersRouter from './orders';
import moderationRouter from './moderation';
import auditRouter from './audit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

router.use('/orders', ordersRouter);
router.use('/moderation', moderationRouter);
router.use('/audit', auditRouter);

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
        repliedBy: { select: { name: true } }
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
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Текст дневника обязателен' });
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    // Create new diary entry (chat style)
    const diary = await prisma.diary.create({
      data: {
        content: content.trim(),
        studentId: student.studentId,
        lessonId
      }
    });

    res.status(201).json(diary);
  } catch (error) {
    console.error('Save diary error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
        repliedBy: { select: { name: true } }
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
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Текст конспекта обязателен' });
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return res.status(404).json({ error: 'Урок не найден' });
    }

    // Create new note entry (chat style)
    const note = await prisma.studentNote.create({
      data: {
        content: content.trim(),
        noteType: 'personal',
        studentId: student.studentId,
        lessonId
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Save personal notes error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    const { content, noteType } = req.body;

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
        lessonId
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Submit student note error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
