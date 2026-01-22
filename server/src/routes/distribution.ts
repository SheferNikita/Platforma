import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR'));

router.get('/unassigned', async (req: AuthRequest, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        miniGroups: { none: {} },
        tariff: { not: 'INDIVIDUAL_PSYCHOLOGIST' }
      },
      select: {
        id: true,
        city: true,
        gender: true,
        age: true,
        addictionType: true,
        isClergy: true,
        surveyCompleted: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        payments: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { product: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(students);
  } catch (error) {
    console.error('Get unassigned students error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/unassigned/count', async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.student.count({
      where: {
        miniGroups: { none: {} },
        tariff: { not: 'INDIVIDUAL_PSYCHOLOGIST' }
      }
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unassigned count error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/mini-groups', async (req: AuthRequest, res: Response) => {
  try {
    const groups = await prisma.miniGroup.findMany({
      where: { isPublished: true },
      orderBy: { title: 'asc' },
      include: {
        curator: { select: { id: true, name: true } },
        _count: { select: { members: true } }
      }
    });

    res.json(groups);
  } catch (error) {
    console.error('Get mini-groups error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/assign', async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, miniGroupId } = req.body;

    if (!studentId || !miniGroupId) {
      return res.status(400).json({ error: 'Требуется ID ученика и мини-группы' });
    }

    const existing = await prisma.miniGroupMember.findFirst({
      where: { studentId, miniGroupId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ученик уже состоит в этой группе' });
    }

    const member = await prisma.miniGroupMember.create({
      data: { studentId, miniGroupId },
      include: {
        student: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        miniGroup: { select: { title: true } }
      }
    });

    res.status(201).json(member);
  } catch (error) {
    console.error('Assign student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/assign-multiple', async (req: AuthRequest, res: Response) => {
  try {
    const { studentIds, miniGroupId } = req.body;

    if (!studentIds?.length || !miniGroupId) {
      return res.status(400).json({ error: 'Требуются ID учеников и мини-группы' });
    }

    const existingMembers = await prisma.miniGroupMember.findMany({
      where: {
        miniGroupId,
        studentId: { in: studentIds }
      },
      select: { studentId: true }
    });

    const existingStudentIds = new Set(existingMembers.map(m => m.studentId));
    const newStudentIds = studentIds.filter((id: string) => !existingStudentIds.has(id));

    if (newStudentIds.length === 0) {
      return res.status(400).json({ error: 'Все выбранные ученики уже состоят в этой группе' });
    }

    await prisma.miniGroupMember.createMany({
      data: newStudentIds.map((studentId: string) => ({ studentId, miniGroupId }))
    });

    res.status(201).json({ 
      message: `Добавлено ${newStudentIds.length} учеников в группу`,
      count: newStudentIds.length
    });
  } catch (error) {
    console.error('Assign multiple students error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/individual', async (req: AuthRequest, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        tariff: 'INDIVIDUAL_PSYCHOLOGIST'
      },
      select: {
        id: true,
        tariff: true,
        city: true,
        gender: true,
        age: true,
        addictionType: true,
        isClergy: true,
        surveyCompleted: true,
        createdAt: true,
        assignedPsychologistId: true,
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        assignedPsychologist: { select: { id: true, name: true, email: true } },
        payments: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { product: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(students);
  } catch (error) {
    console.error('Get individual students error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/assign-psychologist', async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, psychologistId } = req.body;

    if (!studentId || !psychologistId) {
      return res.status(400).json({ error: 'ID ученика и психолога обязательны' });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    const psychologist = await prisma.user.findFirst({
      where: { id: psychologistId, role: 'PSYCHOLOGIST', isActive: true }
    });
    if (!psychologist) {
      return res.status(404).json({ error: 'Психолог не найден' });
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { assignedPsychologistId: psychologistId }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'ASSIGN_PSYCHOLOGIST',
        entity: 'STUDENT',
        entityId: studentId,
        details: { psychologistId, psychologistName: psychologist.name }
      }
    });

    res.json({ success: true, message: 'Психолог назначен' });
  } catch (error) {
    console.error('Assign psychologist error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/psychologists', async (req: AuthRequest, res: Response) => {
  try {
    const psychologists = await prisma.user.findMany({
      where: {
        role: 'PSYCHOLOGIST',
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { assignedStudents: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(psychologists);
  } catch (error) {
    console.error('Get psychologists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
