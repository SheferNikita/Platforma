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
        progress: {
          where: { isCompleted: true },
          select: { id: true }
        },
        diaries: {
          select: {
            id: true,
            reply: true,
            repliedById: true
          }
        },
        miniGroups: {
          select: {
            miniGroup: {
              select: { id: true, title: true }
            }
          }
        },
        studentNotes: {
          select: {
            id: true,
            reply: true,
            repliedById: true
          }
        }
      }
    });

    let mentorNames: Record<string, string> = {};
    if (isAdmin) {
      const replierIds = new Set<string>();
      students.forEach(s => {
        s.diaries.forEach(d => { if (d.repliedById) replierIds.add(d.repliedById); });
        s.studentNotes.forEach(n => { if (n.repliedById) replierIds.add(n.repliedById); });
      });
      if (replierIds.size > 0) {
        const repliers = await prisma.user.findMany({
          where: { id: { in: Array.from(replierIds) } },
          select: { id: true, name: true }
        });
        repliers.forEach(r => { mentorNames[r.id] = r.name; });
      }
    }

    const formattedStudents = students.map(s => {
      const lessonsCompleted = s.progress.length;
      const diariesSubmitted = s.diaries.length;
      const notesSubmitted = s.studentNotes.length;
      const uncheckedDiaries = s.diaries.filter(d => !d.reply).length;
      const uncheckedNotes = s.studentNotes.filter(n => !n.reply).length;
      const pendingReview = uncheckedDiaries + uncheckedNotes;

      let mentorBreakdown: { mentorId: string; mentorName: string; count: number }[] = [];
      if (isAdmin) {
        const mentorCounts: Record<string, number> = {};
        s.diaries.forEach(d => {
          if (d.repliedById) {
            mentorCounts[d.repliedById] = (mentorCounts[d.repliedById] || 0) + 1;
          }
        });
        s.studentNotes.forEach(n => {
          if (n.repliedById) {
            mentorCounts[n.repliedById] = (mentorCounts[n.repliedById] || 0) + 1;
          }
        });
        mentorBreakdown = Object.entries(mentorCounts).map(([mentorId, count]) => ({
          mentorId,
          mentorName: mentorNames[mentorId] || 'Неизвестный',
          count
        })).sort((a, b) => b.count - a.count);
      }

      const checkedByMentor = s.diaries.filter(d => d.reply).length + s.studentNotes.filter(n => n.reply).length;

      return {
        id: s.id,
        userId: s.user.id,
        name: s.user.name,
        email: s.user.email,
        tariff: s.tariff,
        groups: s.miniGroups.map(mg => ({ id: mg.miniGroup.id, title: mg.miniGroup.title })),
        lessonsCompleted,
        diariesSubmitted,
        pendingReview,
        checkedByMentor,
        mentorBreakdown
      };
    });

    let tariffStats: any[] = [];
    if (isAdmin) {
      const totalLessons = await prisma.lesson.count({
        where: { isPublished: true }
      });

      const tariffs = ['BASIC', 'FAMILY', 'RELATIVE', 'WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];
      const tariffLabels: Record<string, string> = {
        BASIC: 'Базовый',
        FAMILY: 'Семейный',
        RELATIVE: 'Родственник',
        WITH_MENTOR: 'С наставником',
        WITH_PSYCHOLOGIST: 'С психологом',
        INDIVIDUAL_PSYCHOLOGIST: 'Индивидуальный психолог'
      };

      for (const tariff of tariffs) {
        const studentsInTariff = await prisma.student.findMany({
          where: { tariff: tariff as any, user: { role: 'STUDENT' } },
          select: {
            id: true,
            progress: {
              where: { isCompleted: true },
              select: { id: true }
            }
          }
        });

        const studentCount = studentsInTariff.length;
        if (studentCount === 0) continue;

        const totalCompleted = studentsInTariff.reduce((sum, s) => sum + s.progress.length, 0);
        const maxPossible = studentCount * totalLessons;
        const percentage = maxPossible > 0 ? Math.round((totalCompleted / maxPossible) * 100) : 0;

        tariffStats.push({
          tariff,
          label: tariffLabels[tariff] || tariff,
          studentCount,
          totalLessons,
          avgCompleted: studentCount > 0 ? Math.round(totalCompleted / studentCount) : 0,
          percentage
        });
      }
    }

    const groups = isAdmin ? await prisma.miniGroup.findMany({
      where: { isPublished: true },
      select: { id: true, title: true },
      orderBy: { title: 'asc' }
    }) : [];

    res.json({
      students: formattedStudents,
      tariffStats,
      groups,
      role: isAdmin ? 'admin' : 'mentor'
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

export default router;
