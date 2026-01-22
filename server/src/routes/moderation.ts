import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { notificationService } from '../services/notificationService';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'INTERN', 'MODERATOR'));

interface AttachmentInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface ModerationItem {
  id: string;
  type: 'diary' | 'question' | 'report';
  content: string;
  reply: string | null;
  repliedAt: Date | null;
  repliedBy: { name: string } | null;
  createdAt: Date;
  lesson: { id: string; title: string };
  student: {
    id: string;
    user: { name: string; email: string };
  };
  attachments: AttachmentInfo[];
}

async function getMentorStudentIds(userEmail: string): Promise<string[]> {
  // Find contact matching mentor's email
  const contact = await prisma.contact.findFirst({
    where: { email: userEmail }
  });
  
  if (!contact) {
    return [];
  }
  
  const mentorMiniGroups = await prisma.miniGroup.findMany({
    where: { curatorId: contact.id },
    select: {
      members: {
        select: { studentId: true }
      }
    }
  });

  const studentIds = new Set<string>();
  mentorMiniGroups.forEach(group => {
    group.members.forEach(member => {
      studentIds.add(member.studentId);
    });
  });

  return Array.from(studentIds);
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, type } = req.query;
    const user = req.user!;
    
    let studentFilter: { studentId?: { in: string[] } } = {};
    
    if (user.role === 'MENTOR' || user.role === 'INTERN') {
      const studentIds = await getMentorStudentIds(user.email);
      if (studentIds.length === 0) {
        return res.json([]);
      }
      studentFilter = { studentId: { in: studentIds } };
    }

    const replyFilter = status === 'answered' 
      ? { NOT: { reply: null } }
      : status === 'pending'
      ? { reply: null }
      : {};

    const diaries = (type === 'question' || type === 'report') ? [] :
      await prisma.diary.findMany({
        where: {
          ...studentFilter,
          ...replyFilter
        },
        include: {
          lesson: { select: { id: true, title: true } },
          student: {
            include: {
              user: { select: { name: true, email: true } }
            }
          },
          repliedBy: { select: { name: true } },
          attachments: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              size: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

    const studentNotes = (type === 'diary') ? [] :
      await prisma.studentNote.findMany({
        where: {
          ...studentFilter,
          ...replyFilter,
          ...(type ? { noteType: type as string } : {})
        },
        include: {
          lesson: { select: { id: true, title: true } },
          student: {
            include: {
              user: { select: { name: true, email: true } }
            }
          },
          repliedBy: { select: { name: true } },
          attachments: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              mimeType: true,
              size: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

    const items: ModerationItem[] = [
      ...diaries.map(d => ({
        id: d.id,
        type: 'diary' as const,
        content: d.content,
        reply: d.reply,
        repliedAt: d.repliedAt,
        repliedBy: d.repliedBy,
        createdAt: d.createdAt,
        lesson: d.lesson,
        student: d.student,
        attachments: d.attachments
      })),
      ...studentNotes.map(n => ({
        id: n.id,
        type: n.noteType as 'question' | 'report',
        content: n.content,
        reply: n.reply,
        repliedAt: n.repliedAt,
        repliedBy: n.repliedBy,
        createdAt: n.createdAt,
        lesson: n.lesson,
        student: n.student,
        attachments: n.attachments
      }))
    ];

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(items);
  } catch (error) {
    console.error('Get moderation items error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/count', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    
    let studentFilter: { studentId?: { in: string[] } } = {};
    
    if (user.role === 'MENTOR' || user.role === 'INTERN') {
      const studentIds = await getMentorStudentIds(user.email);
      if (studentIds.length === 0) {
        return res.json({ count: 0 });
      }
      studentFilter = { studentId: { in: studentIds } };
    }

    const [diaryCount, noteCount] = await Promise.all([
      prisma.diary.count({
        where: {
          ...studentFilter,
          reply: null
        }
      }),
      prisma.studentNote.count({
        where: {
          ...studentFilter,
          reply: null
        }
      })
    ]);

    res.json({ count: diaryCount + noteCount });
  } catch (error) {
    console.error('Get moderation count error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const replySchema = z.object({
  reply: z.string().min(1, 'Ответ обязателен')
});

router.post('/diary/:id/reply', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reply } = replySchema.parse(req.body);

    const diary = await prisma.diary.update({
      where: { id },
      data: {
        reply,
        repliedAt: new Date(),
        repliedById: req.user!.id
      },
      include: {
        student: { select: { userId: true } },
        lesson: { select: { id: true, title: true } }
      }
    });

    if (diary.student && diary.lesson) {
      await notificationService.createForMentorReply(
        diary.student.userId,
        diary.lesson.title,
        diary.lesson.id
      );
    }

    res.json(diary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Reply to diary error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/note/:id/reply', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reply } = replySchema.parse(req.body);

    const note = await prisma.studentNote.update({
      where: { id },
      data: {
        reply,
        repliedAt: new Date(),
        repliedById: req.user!.id
      },
      include: {
        student: { select: { userId: true } },
        lesson: { select: { id: true, title: true } }
      }
    });

    if (note.student && note.lesson) {
      await notificationService.createForMentorReply(
        note.student.userId,
        note.lesson.title,
        note.lesson.id
      );
    }

    res.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Reply to note error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Mark diary as viewed (without reply)
router.post('/diary/:id/view', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const diary = await prisma.diary.update({
      where: { id },
      data: {
        reply: '[Просмотрено]',
        repliedAt: new Date(),
        repliedById: req.user!.id
      }
    });

    res.json(diary);
  } catch (error) {
    console.error('Mark diary as viewed error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Mark note as viewed (without reply)
router.post('/note/:id/view', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const note = await prisma.studentNote.update({
      where: { id },
      data: {
        reply: '[Просмотрено]',
        repliedAt: new Date(),
        repliedById: req.user!.id
      }
    });

    res.json(note);
  } catch (error) {
    console.error('Mark note as viewed error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
