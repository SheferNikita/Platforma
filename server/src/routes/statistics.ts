import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'ADMIN_ASSISTANT'));

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

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const startTime = Date.now();
    const user = req.user!;
    const role = user.role;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'CURATOR', 'ADMIN_ASSISTANT'].includes(role);
    const isMentor = ['MENTOR', 'PSYCHOLOGIST', 'INTERN'].includes(role);

    if (!isAdmin && !isMentor) {
      return res.status(403).json({ error: 'Нет доступа' });
    }

    const { miniGroupId, search } = req.query as { miniGroupId?: string; search?: string };

    let studentFilter: any = { user: { role: 'STUDENT' } };

    if (isMentor) {
      const myStudentIds = await getMentorStudentIds(user.id, role);
      if (myStudentIds.length === 0) {
        return res.json({ students: [], tariffStats: [], groups: [], role: 'mentor' });
      }
      studentFilter.id = { in: myStudentIds };
    }

    if (miniGroupId && isAdmin) {
      const groupMembers = await prisma.miniGroupMember.findMany({
        where: { miniGroupId },
        select: { studentId: true }
      });
      const groupStudentIds = groupMembers.map(m => m.studentId);
      if (studentFilter.id) {
        const existing = studentFilter.id.in as string[];
        studentFilter.id = { in: existing.filter((id: string) => groupStudentIds.includes(id)) };
      } else {
        studentFilter.id = { in: groupStudentIds };
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      const isEmail = term.includes('@');
      let foundUserIds: string[] = [];
      if (isEmail) {
        const found = await prisma.user.findFirst({
          where: { email: { equals: term, mode: 'insensitive' } },
          select: { id: true }
        });
        if (found) foundUserIds = [found.id];
      } else {
        const found = await prisma.user.findMany({
          where: { name: { contains: term, mode: 'insensitive' } },
          select: { id: true }
        });
        foundUserIds = found.map(u => u.id);
      }
      if (foundUserIds.length === 0) {
        return res.json({ students: [], tariffStats: [], groups: [], role: isAdmin ? 'admin' : 'mentor' });
      }
      studentFilter.userId = { in: foundUserIds };
    }

    const students = await prisma.student.findMany({
      where: studentFilter,
      select: {
        id: true,
        tariff: true,
        user: { select: { id: true, name: true, email: true } },
        miniGroups: {
          select: {
            miniGroup: {
              select: { id: true, title: true }
            }
          }
        },
        _count: {
          select: {
            progress: { where: { isCompleted: true } },
            diaries: true,
            studentNotes: true
          }
        }
      }
    });

    const studentIds = students.map(s => s.id);

    const noReplyFilter = { OR: [{ reply: null }, { reply: '' }] };
    const hasReplyFilter = { reply: { not: null }, NOT: { reply: '' } };

    const [uncheckedDiariesCounts, uncheckedNotesCounts] = await Promise.all([
      prisma.diary.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, ...noReplyFilter },
        _count: { id: true }
      }),
      prisma.studentNote.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, ...noReplyFilter },
        _count: { id: true }
      })
    ]);

    const uncheckedDiariesMap: Record<string, number> = {};
    uncheckedDiariesCounts.forEach(d => { uncheckedDiariesMap[d.studentId] = d._count.id; });
    const uncheckedNotesMap: Record<string, number> = {};
    uncheckedNotesCounts.forEach(n => { uncheckedNotesMap[n.studentId] = n._count.id; });

    let mentorBreakdownMap: Record<string, { mentorId: string; mentorName: string; count: number }[]> = {};
    let checkedMap: Record<string, number> = {};
    
    if (isAdmin && studentIds.length > 0) {
      const [diaryReplies, noteReplies] = await Promise.all([
        prisma.diary.groupBy({
          by: ['studentId', 'repliedById'],
          where: { studentId: { in: studentIds }, ...hasReplyFilter, repliedById: { not: null } },
          _count: { id: true }
        }),
        prisma.studentNote.groupBy({
          by: ['studentId', 'repliedById'],
          where: { studentId: { in: studentIds }, ...hasReplyFilter, repliedById: { not: null } },
          _count: { id: true }
        })
      ]);

      const [checkedDiaries, checkedNotes] = await Promise.all([
        prisma.diary.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds }, ...hasReplyFilter },
          _count: { id: true }
        }),
        prisma.studentNote.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds }, ...hasReplyFilter },
          _count: { id: true }
        })
      ]);

      checkedDiaries.forEach(d => { checkedMap[d.studentId] = (checkedMap[d.studentId] || 0) + d._count.id; });
      checkedNotes.forEach(n => { checkedMap[n.studentId] = (checkedMap[n.studentId] || 0) + n._count.id; });

      const replierIds = new Set<string>();
      diaryReplies.forEach(d => { if (d.repliedById) replierIds.add(d.repliedById); });
      noteReplies.forEach(n => { if (n.repliedById) replierIds.add(n.repliedById); });

      let mentorNames: Record<string, string> = {};
      if (replierIds.size > 0) {
        const repliers = await prisma.user.findMany({
          where: { id: { in: Array.from(replierIds) } },
          select: { id: true, name: true }
        });
        repliers.forEach(r => { mentorNames[r.id] = r.name; });
      }

      const mentorCountsPerStudent: Record<string, Record<string, number>> = {};
      diaryReplies.forEach(d => {
        if (!d.repliedById) return;
        if (!mentorCountsPerStudent[d.studentId]) mentorCountsPerStudent[d.studentId] = {};
        mentorCountsPerStudent[d.studentId][d.repliedById] = (mentorCountsPerStudent[d.studentId][d.repliedById] || 0) + d._count.id;
      });
      noteReplies.forEach(n => {
        if (!n.repliedById) return;
        if (!mentorCountsPerStudent[n.studentId]) mentorCountsPerStudent[n.studentId] = {};
        mentorCountsPerStudent[n.studentId][n.repliedById] = (mentorCountsPerStudent[n.studentId][n.repliedById] || 0) + n._count.id;
      });

      for (const [sid, counts] of Object.entries(mentorCountsPerStudent)) {
        mentorBreakdownMap[sid] = Object.entries(counts)
          .map(([mentorId, count]) => ({
            mentorId,
            mentorName: mentorNames[mentorId] || 'Неизвестный',
            count
          }))
          .sort((a, b) => b.count - a.count);
      }
    }

    const formattedStudents = students.map(s => {
      const uncheckedDiaries = uncheckedDiariesMap[s.id] || 0;
      const uncheckedNotes = uncheckedNotesMap[s.id] || 0;

      return {
        id: s.id,
        userId: s.user.id,
        name: s.user.name,
        email: s.user.email,
        tariff: s.tariff,
        groups: s.miniGroups.map(mg => ({ id: mg.miniGroup.id, title: mg.miniGroup.title })),
        lessonsCompleted: s._count.progress,
        diariesSubmitted: s._count.diaries,
        pendingReview: uncheckedDiaries + uncheckedNotes,
        checkedByMentor: checkedMap[s.id] || 0,
        mentorBreakdown: mentorBreakdownMap[s.id] || []
      };
    });

    let tariffStats: any[] = [];
    if (isAdmin) {
      const [totalLessons, tariffCounts, tariffProgress] = await Promise.all([
        prisma.lesson.count({ where: { isPublished: true } }),
        prisma.student.groupBy({
          by: ['tariff'],
          where: { user: { role: 'STUDENT' } },
          _count: { id: true }
        }),
        prisma.student.findMany({
          where: { user: { role: 'STUDENT' } },
          select: {
            tariff: true,
            _count: { select: { progress: { where: { isCompleted: true } } } }
          }
        })
      ]);

      const tariffLabels: Record<string, string> = {
        BASIC: 'Базовый',
        FAMILY: 'Семейный',
        RELATIVE: 'Родственник',
        WITH_MENTOR: 'С наставником',
        WITH_PSYCHOLOGIST: 'С психологом',
        INDIVIDUAL_PSYCHOLOGIST: 'Индивидуальный психолог'
      };

      const tariffProgressMap: Record<string, { count: number; totalCompleted: number }> = {};
      tariffCounts.forEach(tc => {
        tariffProgressMap[tc.tariff] = { count: tc._count.id, totalCompleted: 0 };
      });
      tariffProgress.forEach(tp => {
        if (tariffProgressMap[tp.tariff]) {
          tariffProgressMap[tp.tariff].totalCompleted += tp._count.progress;
        }
      });

      const tariffs = ['BASIC', 'FAMILY', 'RELATIVE', 'WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];
      for (const tariff of tariffs) {
        const data = tariffProgressMap[tariff];
        if (!data || data.count === 0) continue;
        const maxPossible = data.count * totalLessons;
        const percentage = maxPossible > 0 ? Math.round((data.totalCompleted / maxPossible) * 100) : 0;

        tariffStats.push({
          tariff,
          label: tariffLabels[tariff] || tariff,
          studentCount: data.count,
          totalLessons,
          avgCompleted: Math.round(data.totalCompleted / data.count),
          percentage
        });
      }
    }

    const groups = isAdmin ? await prisma.miniGroup.findMany({
      where: { isPublished: true },
      select: { id: true, title: true },
      orderBy: { title: 'asc' }
    }) : [];

    console.log(`[Perf] GET /statistics: total=${Date.now() - startTime}ms, students=${students.length}`);

    res.json({
      students: formattedStudents,
      tariffStats,
      groups,
      role: isAdmin ? 'admin' : 'mentor'
    });
  } catch (error) {
    console.error('[Statistics] Error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

export default router;
