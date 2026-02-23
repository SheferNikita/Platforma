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
    const searchTerm = query.email.trim();
    const isEmailSearch = searchTerm.includes('@');
    let foundStudentIds: string[] = [];

    if (isEmailSearch) {
      const foundUser = await prisma.user.findFirst({
        where: { email: { equals: searchTerm, mode: 'insensitive' } },
        select: { id: true }
      });
      if (foundUser) {
        const foundStudent = await prisma.student.findFirst({
          where: { userId: foundUser.id },
          select: { id: true }
        });
        if (foundStudent) foundStudentIds = [foundStudent.id];
      }
    } else {
      const foundUsers = await prisma.user.findMany({
        where: { name: { contains: searchTerm, mode: 'insensitive' } },
        select: { id: true }
      });
      if (foundUsers.length > 0) {
        const foundStudents = await prisma.student.findMany({
          where: { userId: { in: foundUsers.map(u => u.id) } },
          select: { id: true }
        });
        foundStudentIds = foundStudents.map(s => s.id);
      }
    }

    if (foundStudentIds.length === 0) return null;
    if (targetStudentIds) {
      const filtered = targetStudentIds.filter(id => foundStudentIds.includes(id));
      if (filtered.length === 0) return null;
      targetStudentIds = filtered;
    } else {
      targetStudentIds = foundStudentIds;
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
  lastActivityDate: string;
  hasAttachments: boolean;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, studentId, lessonId, miniGroupId, email, sortBy, limit: limitStr, offset: offsetStr } = req.query;
    const user = req.user!;
    const limit = Math.max(1, Math.min(parseInt(limitStr as string) || 50, 100));
    const offset = Math.max(0, parseInt(offsetStr as string) || 0);

    const studentFilter = await buildStudentFilter(user, {
      studentId: studentId as string | undefined,
      miniGroupId: miniGroupId as string | undefined,
      email: email as string | undefined
    });
    if (studentFilter === null) {
      return res.json({ dialogs: [], total: 0, hasMore: false });
    }

    const allowedStudentIds: string[] | null =
      studentFilter.studentId
        ? typeof studentFilter.studentId === 'string'
          ? [studentFilter.studentId]
          : (studentFilter.studentId as { in: string[] }).in
        : null;

    const params: any[] = [];
    let paramIdx = 1;

    const diaryWhere: string[] = [];
    const noteWhere: string[] = ['1=1'];

    if (allowedStudentIds) {
      diaryWhere.push(`d."studentId" = ANY($${paramIdx})`);
      noteWhere.push(`sn."studentId" = ANY($${paramIdx})`);
      params.push(allowedStudentIds);
      paramIdx++;
    }
    if (lessonId && typeof lessonId === 'string') {
      diaryWhere.push(`d."lessonId" = $${paramIdx}`);
      noteWhere.push(`sn."lessonId" = $${paramIdx}`);
      params.push(lessonId);
      paramIdx++;
    }
    if (status === 'answered') {
      diaryWhere.push(`d.reply IS NOT NULL`);
      noteWhere.push(`sn.reply IS NOT NULL`);
    } else if (status === 'pending') {
      diaryWhere.push(`d.reply IS NULL`);
      noteWhere.push(`sn.reply IS NULL`);
    }

    const includeDiary = type !== 'question' && type !== 'report';
    const includeNotes = type !== 'diary';

    if (type && type !== 'all' && type !== 'diary' && includeNotes) {
      noteWhere.push(`sn."noteType" = $${paramIdx}`);
      params.push(type);
      paramIdx++;
    }

    const unions: string[] = [];
    if (includeDiary) {
      const dWhere = diaryWhere.length > 0 ? `WHERE ${diaryWhere.join(' AND ')}` : '';
      unions.push(`
        SELECT d."studentId", d."lessonId", 'diary'::text as type, d.content, d.reply, d."createdAt", d."repliedAt",
               EXISTS(SELECT 1 FROM "DiaryAttachment" da WHERE da."diaryId" = d.id) as "hasAtt"
        FROM "Diary" d ${dWhere}
      `);
    }
    if (includeNotes) {
      unions.push(`
        SELECT sn."studentId", sn."lessonId", COALESCE(sn."noteType", 'question')::text as type, sn.content, sn.reply, sn."createdAt", sn."repliedAt",
               EXISTS(SELECT 1 FROM "NoteAttachment" na WHERE na."noteId" = sn.id) as "hasAtt"
        FROM "StudentNote" sn WHERE ${noteWhere.join(' AND ')}
      `);
    }

    if (unions.length === 0) {
      return res.json({ dialogs: [], total: 0, hasMore: false });
    }

    const combinedCte = `combined AS (${unions.join(' UNION ALL ')})`;

    const sql = `
      WITH ${combinedCte},
      grouped AS (
        SELECT
          c."studentId",
          c."lessonId",
          c.type,
          COUNT(*)::int as "totalCount",
          COUNT(*) FILTER (WHERE c.reply IS NULL)::int as "unansweredCount",
          MAX(c."createdAt") as "latestDate",
          GREATEST(MAX(c."createdAt"), MAX(c."repliedAt")) as "lastActivityDate",
          BOOL_OR(c."hasAtt") as "hasAttachments"
        FROM combined c
        GROUP BY c."studentId", c."lessonId", c.type
      ),
      total_count AS (
        SELECT COUNT(*)::int as cnt FROM grouped
      )
      SELECT
        g."studentId",
        g."lessonId",
        g.type,
        g."totalCount",
        g."unansweredCount",
        g."latestDate",
        g."lastActivityDate",
        g."hasAttachments",
        u.name as "studentName",
        u.email as "studentEmail",
        l.title as "lessonTitle",
        tc.cnt as "totalDialogs",
        COALESCE(
          CASE WHEN g.type = 'diary' THEN
            (SELECT d2.content FROM "Diary" d2 WHERE d2."studentId" = g."studentId" AND d2."lessonId" = g."lessonId"${status === 'pending' ? ' AND d2.reply IS NULL' : status === 'answered' ? ' AND d2.reply IS NOT NULL' : ''} ORDER BY d2."createdAt" DESC LIMIT 1)
          ELSE
            (SELECT sn2.content FROM "StudentNote" sn2 WHERE sn2."studentId" = g."studentId" AND sn2."lessonId" = g."lessonId" AND COALESCE(sn2."noteType",'question') = g.type${status === 'pending' ? ' AND sn2.reply IS NULL' : status === 'answered' ? ' AND sn2.reply IS NOT NULL' : ''} ORDER BY sn2."createdAt" DESC LIMIT 1)
          END,
          ''
        ) as "latestContent"
      FROM grouped g
      JOIN "Student" s ON s.id = g."studentId"
      JOIN "User" u ON u.id = s."userId"
      JOIN "Lesson" l ON l.id = g."lessonId"
      CROSS JOIN total_count tc
      ORDER BY ${sortBy === 'lastActivity' ? 'g."lastActivityDate"' : 'g."latestDate"'} DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const dialogRows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

    const total = dialogRows.length > 0 ? dialogRows[0].totalDialogs : 0;

    const dialogs: DialogSummary[] = dialogRows.map(row => ({
      studentId: row.studentId,
      lessonId: row.lessonId,
      type: row.type,
      student: {
        id: row.studentId,
        user: { name: row.studentName, email: row.studentEmail }
      },
      lesson: { id: row.lessonId, title: row.lessonTitle },
      totalCount: row.totalCount,
      unansweredCount: row.unansweredCount,
      latestContent: row.latestContent || '',
      latestDate: row.latestDate instanceof Date ? row.latestDate.toISOString() : String(row.latestDate),
      lastActivityDate: row.lastActivityDate instanceof Date ? row.lastActivityDate.toISOString() : String(row.lastActivityDate || row.latestDate),
      hasAttachments: row.hasAttachments || false
    }));

    res.json({
      dialogs,
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

const attachmentSchema = z.object({
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  data: z.string()
});

const replySchema = z.object({
  reply: z.string(),
  audioData: z.string().optional(),
  audioDuration: z.number().optional(),
  audioMimeType: z.string().optional(),
  attachments: z.array(attachmentSchema).optional()
});

router.post('/diary/:id/reply', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reply, audioData, audioDuration, audioMimeType, attachments } = replySchema.parse(req.body);

    if (!reply.trim() && !audioData && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Необходим текст, голосовое сообщение или файл' });
    }

    const existingDiary = await prisma.diary.findUnique({
      where: { id },
      select: { reply: true }
    });

    let replyHistory: Array<{ text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; audioMimeType?: string; audioAttachmentId?: string; fileAttachmentIds?: string[]; fileAttachments?: Array<{id: string; originalName: string; mimeType: string}> }> = [];
    
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

    const newMessage: { text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; audioMimeType?: string; audioAttachmentId?: string; fileAttachmentIds?: string[]; fileAttachments?: Array<{id: string; originalName: string; mimeType: string}> } = {
      text: audioData ? '🎤 Голосовое сообщение' : reply,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      createdAt: new Date().toISOString()
    };

    if (audioData) {
      const cleanAudioData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      const mime = audioMimeType || 'audio/webm';
      const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
      const attachment = await prisma.diaryAttachment.create({
        data: {
          diaryId: id,
          filename: `voice_reply_${Date.now()}.${ext}`,
          originalName: `Голосовое сообщение.${ext}`,
          mimeType: mime,
          size: Math.ceil(cleanAudioData.length * 0.75),
          data: cleanAudioData,
        }
      });
      newMessage.audioAttachmentId = attachment.id;
      newMessage.audioDuration = audioDuration;
      newMessage.audioMimeType = mime;
    }

    if (attachments && attachments.length > 0) {
      const fileAttachmentIds: string[] = [];
      const fileAttachments: Array<{id: string; originalName: string; mimeType: string}> = [];
      for (const att of attachments) {
        const cleanData = att.data.includes(',') ? att.data.split(',')[1] : att.data;
        const created = await prisma.diaryAttachment.create({
          data: {
            diaryId: id,
            filename: att.filename,
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.size,
            data: cleanData,
          }
        });
        fileAttachmentIds.push(created.id);
        fileAttachments.push({ id: created.id, originalName: att.originalName, mimeType: att.mimeType });
      }
      newMessage.fileAttachmentIds = fileAttachmentIds;
      newMessage.fileAttachments = fileAttachments;
      if (!audioData && !reply.trim()) {
        newMessage.text = `📎 ${attachments.length > 1 ? `${attachments.length} файлов` : attachments[0].originalName}`;
      }
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
    const { reply, audioData, audioDuration, audioMimeType, attachments } = replySchema.parse(req.body);

    if (!reply.trim() && !audioData && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Необходим текст, голосовое сообщение или файл' });
    }

    const existingNote = await prisma.studentNote.findUnique({
      where: { id },
      select: { reply: true }
    });

    let replyHistory: Array<{ text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; audioMimeType?: string; audioAttachmentId?: string; fileAttachmentIds?: string[]; fileAttachments?: Array<{id: string; originalName: string; mimeType: string}> }> = [];
    
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

    const newMessage: { text: string; authorId: string; authorName: string; authorRole: string; createdAt: string; audioData?: string; audioDuration?: number; audioMimeType?: string; audioAttachmentId?: string; fileAttachmentIds?: string[]; fileAttachments?: Array<{id: string; originalName: string; mimeType: string}> } = {
      text: audioData ? '🎤 Голосовое сообщение' : reply,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      createdAt: new Date().toISOString()
    };

    if (audioData) {
      const cleanAudioData = audioData.includes(',') ? audioData.split(',')[1] : audioData;
      const mime = audioMimeType || 'audio/webm';
      const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
      const attachment = await prisma.noteAttachment.create({
        data: {
          noteId: id,
          filename: `voice_reply_${Date.now()}.${ext}`,
          originalName: `Голосовое сообщение.${ext}`,
          mimeType: mime,
          size: Math.ceil(cleanAudioData.length * 0.75),
          data: cleanAudioData,
        }
      });
      newMessage.audioAttachmentId = attachment.id;
      newMessage.audioDuration = audioDuration;
      newMessage.audioMimeType = mime;
    }

    if (attachments && attachments.length > 0) {
      const fileAttachmentIds: string[] = [];
      const fileAttachments: Array<{id: string; originalName: string; mimeType: string}> = [];
      for (const att of attachments) {
        const cleanData = att.data.includes(',') ? att.data.split(',')[1] : att.data;
        const created = await prisma.noteAttachment.create({
          data: {
            noteId: id,
            filename: att.filename,
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.size,
            data: cleanData,
          }
        });
        fileAttachmentIds.push(created.id);
        fileAttachments.push({ id: created.id, originalName: att.originalName, mimeType: att.mimeType });
      }
      newMessage.fileAttachmentIds = fileAttachmentIds;
      newMessage.fileAttachments = fileAttachments;
      if (!audioData && !reply.trim()) {
        newMessage.text = `📎 ${attachments.length > 1 ? `${attachments.length} файлов` : attachments[0].originalName}`;
      }
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
