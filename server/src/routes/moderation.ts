import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'MODERATOR'));

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
}

async function getMentorStudentIds(userId: string): Promise<string[]> {
  const mentorMiniGroups = await prisma.miniGroup.findMany({
    where: { curatorId: userId },
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
    
    if (user.role === 'MENTOR') {
      const studentIds = await getMentorStudentIds(user.id);
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

    const [diaries, studentNotes] = await Promise.all([
      type === 'question' || type === 'report' ? Promise.resolve([]) :
      prisma.diary.findMany({
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
          repliedBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      type === 'diary' ? Promise.resolve([]) :
      prisma.studentNote.findMany({
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
          repliedBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

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
        student: d.student
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
        student: n.student
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
    
    if (user.role === 'MENTOR') {
      const studentIds = await getMentorStudentIds(user.id);
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
    const { id } = req.params;
    const { reply } = replySchema.parse(req.body);

    const diary = await prisma.diary.update({
      where: { id },
      data: {
        reply,
        repliedAt: new Date(),
        repliedById: req.user!.id
      }
    });

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
    const { id } = req.params;
    const { reply } = replySchema.parse(req.body);

    const note = await prisma.studentNote.update({
      where: { id },
      data: {
        reply,
        repliedAt: new Date(),
        repliedById: req.user!.id
      }
    });

    res.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Reply to note error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
