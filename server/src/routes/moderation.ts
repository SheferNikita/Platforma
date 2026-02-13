import { Router, Response } from 'express';
import express from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { notificationService } from '../services/notificationService';

const router = Router();

// Увеличенный лимит для голосовых сообщений (50MB)
router.use(express.json({ limit: '50mb' }));

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'MODERATOR'));

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

async function getMentorStudentIds(userId: string, role?: string): Promise<string[]> {
  const allGroups = await prisma.miniGroup.findMany({
    select: { 
      id: true, 
      chatLink: true,
      members: {
        select: { studentId: true }
      }
    }
  });
  
  const userGroups = allGroups.filter(group => {
    if (!group.chatLink) return false;
    try {
      const chatData = JSON.parse(group.chatLink);
      const mentorIds: string[] = chatData.mentorIds || [];
      return mentorIds.includes(userId);
    } catch {
      return false;
    }
  });

  const studentIds = new Set<string>();
  userGroups.forEach(group => {
    group.members.forEach(member => {
      studentIds.add(member.studentId);
    });
  });

  if (role === 'PSYCHOLOGIST') {
    const individualStudents = await prisma.student.findMany({
      where: { assignedPsychologistId: userId },
      select: { id: true }
    });
    individualStudents.forEach(s => studentIds.add(s.id));
  }

  return Array.from(studentIds);
}

async function buildStudentFilter(
  user: { id: string; role: string },
  query: { studentId?: string; miniGroupId?: string; email?: string }
): Promise<{ studentId?: { in: string[] } | string } | null> {
  let studentFilter: { studentId?: { in: string[] } | string } = {};
  let targetStudentIds: string[] | null = null;

  if (query.miniGroupId) {
    const groupMembers = await prisma.miniGroupMember.findMany({
      where: { miniGroupId: query.miniGroupId },
      select: { studentId: true }
    });
    targetStudentIds = groupMembers.map(m => m.studentId);
    if (targetStudentIds.length === 0) return null;
  }

  if (query.email && query.email.trim()) {
    const foundUser = await prisma.user.findFirst({
      where: { email: { equals: query.email.trim(), mode: 'insensitive' } },
      select: { id: true }
    });
    if (!foundUser) return null;
    const foundStudent = await prisma.student.findFirst({
      where: { userId: foundUser.id },
      select: { id: true }
    });
    if (!foundStudent) return null;
    if (targetStudentIds) {
      if (!targetStudentIds.includes(foundStudent.id)) return null;
      targetStudentIds = [foundStudent.id];
    } else {
      targetStudentIds = [foundStudent.id];
    }
  }

  if (user.role === 'MENTOR' || user.role === 'INTERN' || user.role === 'PSYCHOLOGIST') {
    const mentorStudentIds = await getMentorStudentIds(user.id, user.role);
    if (mentorStudentIds.length === 0) return null;
    if (targetStudentIds) {
      const allowed = targetStudentIds.filter(id => mentorStudentIds.includes(id));
      if (allowed.length === 0) return null;
      studentFilter = { studentId: { in: allowed } };
    } else if (query.studentId) {
      if (!mentorStudentIds.includes(query.studentId)) return null;
      studentFilter = { studentId: query.studentId };
    } else {
      studentFilter = { studentId: { in: mentorStudentIds } };
    }
  } else if (targetStudentIds) {
    studentFilter = targetStudentIds.length === 1
      ? { studentId: targetStudentIds[0] }
      : { studentId: { in: targetStudentIds } };
  } else if (query.studentId) {
    studentFilter = { studentId: query.studentId };
  }

  return studentFilter;
}

interface DialogSummary {
  studentId: string;
  lessonId: string;
  type: string;
  student: { id: string; user: { name: string; email: string } };
  lesson: { id: string; title: string };
  totalCount: number;
  unansweredCount: number;
  latestContent: string;
  latestDate: string;
  hasAttachments: boolean;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, studentId, lessonId, miniGroupId, email, limit: limitStr, offset: offsetStr } = req.query;
    const user = req.user!;
    const limit = Math.min(parseInt(limitStr as string) || 50, 100);
    const offset = parseInt(offsetStr as string) || 0;

    const studentFilter = await buildStudentFilter(user, {
      studentId: studentId as string | undefined,
      miniGroupId: miniGroupId as string | undefined,
      email: email as string | undefined
    });
    if (studentFilter === null) {
      return res.json({ dialogs: [], total: 0, hasMore: false });
    }

    const lessonFilter = lessonId && typeof lessonId === 'string'
      ? { lessonId }
      : {};

    const replyFilter = status === 'answered'
      ? { NOT: { reply: null } }
      : status === 'pending'
      ? { reply: null }
      : {};

    const diaries = (type === 'question' || type === 'report') ? [] :
      await prisma.diary.findMany({
        where: { ...studentFilter, ...lessonFilter, ...replyFilter },
        select: {
          id: true,
          studentId: true,
          lessonId: true,
          content: true,
          reply: true,
          createdAt: true,
          lesson: { select: { id: true, title: true } },
          student: { include: { user: { select: { name: true, email: true } } } },
          attachments: { select: { id: true, mimeType: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

    const studentNotes = (type === 'diary') ? [] :
      await prisma.studentNote.findMany({
        where: {
          ...studentFilter,
          ...lessonFilter,
          ...replyFilter,
          ...(type ? { noteType: type as string } : {})
        },
        select: {
          id: true,
          studentId: true,
          lessonId: true,
          noteType: true,
          content: true,
          reply: true,
          createdAt: true,
          lesson: { select: { id: true, title: true } },
          student: { include: { user: { select: { name: true, email: true } } } },
          attachments: { select: { id: true, mimeType: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

    const dialogMap = new Map<string, DialogSummary>();

    for (const d of diaries) {
      const key = `${d.studentId}__${d.lessonId}__diary`;
      const existing = dialogMap.get(key);
      if (!existing) {
        dialogMap.set(key, {
          studentId: d.studentId,
          lessonId: d.lessonId,
          type: 'diary',
          student: d.student,
          lesson: d.lesson,
          totalCount: 1,
          unansweredCount: d.reply ? 0 : 1,
          latestContent: d.content || '',
          latestDate: d.createdAt.toISOString(),
          hasAttachments: d.attachments.length > 0
        });
      } else {
        existing.totalCount++;
        if (!d.reply) existing.unansweredCount++;
        if (new Date(d.createdAt) > new Date(existing.latestDate)) {
          existing.latestDate = d.createdAt.toISOString();
          existing.latestContent = d.content || '';
        }
        if (d.attachments.length > 0) existing.hasAttachments = true;
      }
    }

    for (const n of studentNotes) {
      const noteType = n.noteType || 'question';
      const key = `${n.studentId}__${n.lessonId}__${noteType}`;
      const existing = dialogMap.get(key);
      if (!existing) {
        dialogMap.set(key, {
          studentId: n.studentId,
          lessonId: n.lessonId,
          type: noteType,
          student: n.student,
          lesson: n.lesson,
          totalCount: 1,
          unansweredCount: n.reply ? 0 : 1,
          latestContent: n.content || '',
          latestDate: n.createdAt.toISOString(),
          hasAttachments: n.attachments.length > 0
        });
      } else {
        existing.totalCount++;
        if (!n.reply) existing.unansweredCount++;
        if (new Date(n.createdAt) > new Date(existing.latestDate)) {
          existing.latestDate = n.createdAt.toISOString();
          existing.latestContent = n.content || '';
        }
        if (n.attachments.length > 0) existing.hasAttachments = true;
      }
    }

    const allDialogs = Array.from(dialogMap.values())
      .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

    const total = allDialogs.length;
    const paginated = allDialogs.slice(offset, offset + limit);

    res.json({
      dialogs: paginated,
      total,
      hasMore: offset + limit < total
    });
  } catch (error) {
    console.error('Get moderation dialogs error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/dialog', async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, lessonId, type } = req.query;
    const user = req.user!;

    if (!studentId || !lessonId || !type) {
      return res.status(400).json({ error: 'studentId, lessonId и type обязательны' });
    }

    const studentFilter = await buildStudentFilter(user, {
      studentId: studentId as string
    });
    if (studentFilter === null) {
      return res.json([]);
    }

    if (type === 'diary') {
      const diaries = await prisma.diary.findMany({
        where: {
          studentId: studentId as string,
          lessonId: lessonId as string
        },
        include: {
          lesson: { select: { id: true, title: true } },
          student: { include: { user: { select: { name: true, email: true } } } },
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
        orderBy: { createdAt: 'asc' }
      });

      const items: ModerationItem[] = diaries.map(d => ({
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
      }));

      return res.json(items);
    } else {
      const notes = await prisma.studentNote.findMany({
        where: {
          studentId: studentId as string,
          lessonId: lessonId as string,
          noteType: type as string
        },
        include: {
          lesson: { select: { id: true, title: true } },
          student: { include: { user: { select: { name: true, email: true } } } },
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
        orderBy: { createdAt: 'asc' }
      });

      const items: ModerationItem[] = notes.map(n => ({
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
      }));

      return res.json(items);
    }
  } catch (error) {
    console.error('Get dialog items error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/count', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    
    let studentFilter: { studentId?: { in: string[] } } = {};
    
    if (user.role === 'MENTOR' || user.role === 'INTERN' || user.role === 'PSYCHOLOGIST') {
      const studentIds = await getMentorStudentIds(user.id, user.role);
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

router.get('/mini-groups', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    
    if (user.role === 'MENTOR' || user.role === 'INTERN' || user.role === 'PSYCHOLOGIST') {
      const allGroups = await prisma.miniGroup.findMany({
        select: { id: true, title: true, chatLink: true },
        orderBy: { title: 'asc' }
      });
      const userGroups = allGroups.filter(group => {
        if (!group.chatLink) return false;
        try {
          const chatData = JSON.parse(group.chatLink);
          const mentorIds: string[] = chatData.mentorIds || [];
          return mentorIds.includes(user.id);
        } catch {
          return false;
        }
      });
      res.json(userGroups.map(g => ({ id: g.id, title: g.title })));
    } else {
      const groups = await prisma.miniGroup.findMany({
        select: { id: true, title: true },
        orderBy: { title: 'asc' }
      });
      res.json(groups);
    }
  } catch (error) {
    console.error('Get mini-groups for moderation error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const replySchema = z.object({
  reply: z.string(),
  audioData: z.string().optional(),
  audioDuration: z.number().optional()
});

router.post('/diary/:id/reply', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reply, audioData, audioDuration } = replySchema.parse(req.body);

    if (!reply.trim() && !audioData) {
      return res.status(400).json({ error: 'Необходим текст или голосовое сообщение' });
    }

    const existingDiary = await prisma.diary.findUnique({
      where: { id },
      select: { reply: true }
    });

    let replyHistory: Array<{ text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number }> = [];
    
    if (existingDiary?.reply) {
      try {
        const parsed = JSON.parse(existingDiary.reply);
        if (Array.isArray(parsed)) {
          replyHistory = parsed;
        } else {
          replyHistory = [{ 
            text: existingDiary.reply, 
            authorId: 'legacy', 
            authorName: 'Наставник',
            authorRole: 'MENTOR',
            createdAt: new Date().toISOString() 
          }];
        }
      } catch {
        replyHistory = [{ 
          text: existingDiary.reply, 
          authorId: 'legacy', 
          authorName: 'Наставник',
          authorRole: 'MENTOR',
          createdAt: new Date().toISOString() 
        }];
      }
    }

    const newMessage: { text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number } = {
      text: audioData ? '🎤 Голосовое сообщение' : reply,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      createdAt: new Date().toISOString()
    };

    if (audioData) {
      newMessage.audioData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      newMessage.audioDuration = audioDuration;
    }

    replyHistory.push(newMessage);

    const diary = await prisma.diary.update({
      where: { id },
      data: {
        reply: JSON.stringify(replyHistory),
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
    const { reply, audioData, audioDuration } = replySchema.parse(req.body);

    if (!reply.trim() && !audioData) {
      return res.status(400).json({ error: 'Необходим текст или голосовое сообщение' });
    }

    const existingNote = await prisma.studentNote.findUnique({
      where: { id },
      select: { reply: true }
    });

    let replyHistory: Array<{ text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number }> = [];
    
    if (existingNote?.reply) {
      try {
        const parsed = JSON.parse(existingNote.reply);
        if (Array.isArray(parsed)) {
          replyHistory = parsed;
        } else {
          replyHistory = [{ 
            text: existingNote.reply, 
            authorId: 'legacy', 
            authorName: 'Наставник',
            authorRole: 'MENTOR',
            createdAt: new Date().toISOString() 
          }];
        }
      } catch {
        replyHistory = [{ 
          text: existingNote.reply, 
          authorId: 'legacy', 
          authorName: 'Наставник',
          authorRole: 'MENTOR',
          createdAt: new Date().toISOString() 
        }];
      }
    }

    const newMessage: { text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number } = {
      text: audioData ? '🎤 Голосовое сообщение' : reply,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      createdAt: new Date().toISOString()
    };

    if (audioData) {
      newMessage.audioData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      newMessage.audioDuration = audioDuration;
    }

    replyHistory.push(newMessage);

    const note = await prisma.studentNote.update({
      where: { id },
      data: {
        reply: JSON.stringify(replyHistory),
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
