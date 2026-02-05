import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { sendEmail } from '../services/email';
import { emailTemplateService } from '../services/emailTemplateService';
import { notificationService } from '../services/notificationService';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CURATOR', 'MENTOR', 'PSYCHOLOGIST', 'INTERN', 'ADMIN_ASSISTANT'));

const studentTariffs = ['BASIC', 'FAMILY', 'RELATIVE', 'WITH_MENTOR', 'WITH_PSYCHOLOGIST', 'INDIVIDUAL_PSYCHOLOGIST'];

const TARIFF_NAMES: Record<string, string> = {
  BASIC: 'Базовый',
  FAMILY: 'Семейный',
  RELATIVE: 'Родственник участника',
  WITH_MENTOR: 'Идем с наставником',
  WITH_PSYCHOLOGIST: 'Идем с психологом',
  INDIVIDUAL_PSYCHOLOGIST: 'Индивидуально с психологом'
};

const TARIFF_PAYMENT_LINKS: Record<string, string> = {
  BASIC: 'https://ioannklimenko.ru/bazoviy',
  WITH_MENTOR: 'https://ioannklimenko.ru/idem_s_nastavnikom',
  WITH_PSYCHOLOGIST: 'https://ioannklimenko.ru/idem_s_psihologom',
  INDIVIDUAL_PSYCHOLOGIST: 'https://ioannklimenko.ru/individualno_s_psihologom',
  FAMILY: 'https://ioannklimenko.ru/dlya_rodstvennikov'
};

function getReminderCount(notes: string | null | undefined): number {
  if (!notes) return 0;
  const match = notes.match(/\[REMINDER:(\d+)\]/);
  return match ? parseInt(match[1], 10) : 0;
}

function incrementReminderCount(notes: string | null | undefined): string {
  const currentCount = getReminderCount(notes);
  const newCount = currentCount + 1;
  const cleanNotes = notes ? notes.replace(/\[REMINDER:\d+\]/, '').trim() : '';
  return cleanNotes ? `[REMINDER:${newCount}] ${cleanNotes}` : `[REMINDER:${newCount}]`;
}

function hasPrepaymentTag(notes: string | null | undefined): boolean {
  return notes?.includes('[PREPAYMENT]') || false;
}

const createStudentSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  phone: z.string().optional(),
  sobrietyDate: z.string().optional(),
  notes: z.string().optional(),
  sendCredentials: z.boolean().optional(),
  tariff: z.enum(studentTariffs).optional(),
  assignedPsychologistId: z.string().optional()
});

const updateStudentSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  sobrietyDate: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  tariff: z.enum(studentTariffs).optional(),
  assignedPsychologistId: z.string().nullable().optional()
});

async function getMentorStudentIds(userId: string): Promise<string[]> {
  // Get all mini-groups and filter by mentorIds in chatLink JSON
  const allGroups = await prisma.miniGroup.findMany({
    select: { 
      id: true, 
      chatLink: true,
      members: {
        select: { studentId: true }
      }
    }
  });
  
  // Filter groups where user is in mentorIds
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

  return Array.from(studentIds);
}

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const students = await prisma.student.findMany({
      where: {
        user: { role: 'STUDENT' }
      },
      include: {
        user: { select: { isActive: true } },
        progress: true,
        miniGroups: {
          include: { miniGroup: { select: { id: true, title: true } } }
        }
      }
    });

    const totalLessons = await prisma.lesson.count({ where: { isPublished: true } });

    const tariffCounts: Record<string, number> = {
      BASIC: 0,
      FAMILY: 0,
      RELATIVE: 0,
      WITH_MENTOR: 0,
      WITH_PSYCHOLOGIST: 0,
      INDIVIDUAL_PSYCHOLOGIST: 0
    };

    let totalProgress = 0;
    let studentsWithProgress = 0;
    let withoutMiniGroup = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    students.forEach(student => {
      const tariff = student.tariff || 'WITH_MENTOR';
      if (tariffCounts[tariff] !== undefined) {
        tariffCounts[tariff]++;
      }

      if (student.user.isActive) {
        activeCount++;
      } else {
        inactiveCount++;
      }

      if (student.progress.length > 0 && totalLessons > 0) {
        totalProgress += (student.progress.length / totalLessons) * 100;
        studentsWithProgress++;
      }

      if (student.miniGroups.length === 0) {
        withoutMiniGroup++;
      }
    });

    const miniGroups = await prisma.miniGroup.findMany({
      include: {
        _count: { select: { members: true } }
      },
      orderBy: { title: 'asc' }
    });

    const miniGroupStats = miniGroups.map(g => ({
      id: g.id,
      title: g.title,
      memberCount: g._count.members
    }));

    res.json({
      total: students.length,
      active: activeCount,
      inactive: inactiveCount,
      withoutMiniGroup,
      averageProgress: studentsWithProgress > 0 ? Math.round(totalProgress / studentsWithProgress) : 0,
      tariffCounts,
      miniGroupStats
    });
  } catch (error) {
    console.error('Get students stats error:', error);
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
        email: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(psychologists);
  } catch (error) {
    console.error('Get psychologists error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      role: 'STUDENT'
    };

    // MENTOR/PSYCHOLOGIST/INTERN can only see students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN' || req.user!.role === 'PSYCHOLOGIST') {
      const userId = req.user!.id;
      
      // Get all mini-groups and filter by mentorIds in chatLink JSON
      const allGroups = await prisma.miniGroup.findMany({
        select: { id: true, chatLink: true }
      });
      
      // Filter groups where user is in mentorIds
      const userGroupIds = allGroups
        .filter(group => {
          if (!group.chatLink) return false;
          try {
            const chatData = JSON.parse(group.chatLink);
            const mentorIds: string[] = chatData.mentorIds || [];
            return mentorIds.includes(userId);
          } catch {
            return false;
          }
        })
        .map(g => g.id);
      
      if (userGroupIds.length === 0) {
        return res.json({
          students: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        });
      }
      
      // Get student IDs that belong to user's groups
      const memberStudentIds = await prisma.miniGroupMember.findMany({
        where: { miniGroupId: { in: userGroupIds } },
        select: { studentId: true }
      });
      const studentIds = memberStudentIds.map(m => m.studentId);
      
      if (studentIds.length === 0) {
        return res.json({
          students: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        });
      }
      
      where.student = { id: { in: studentIds } };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              phone: true,
              sobrietyDate: true,
              notes: true,
              tariff: true,
              assignedPsychologistId: true,
              progress: true,
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1
              },
              enrollments: {
                include: { product: true }
              },
              miniGroups: {
                include: { miniGroup: true }
              },
              assignedPsychologist: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      students,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Prepayment endpoints - MUST be before /:id route to avoid matching as ID
router.get('/prepayment-students', async (req: AuthRequest, res: Response) => {
  try {
    console.log('[prepayment-students] Request received, user:', req.user?.email);
    
    const { 
      tariff, 
      minReminders, 
      maxReminders, 
      dateFrom, 
      dateTo,
      search 
    } = req.query;

    const where: any = {
      notes: { contains: '[PREPAYMENT]' }
    };
    
    // Filter by specific tariff if selected (RELATIVE doesn't exist in DB schema)
    if (tariff && tariff !== 'ALL') {
      where.tariff = tariff as string;
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true, createdAt: true }
        }
      },
      orderBy: { user: { createdAt: 'desc' } }
    }) as any[];

    let filtered = students;

    if (minReminders !== undefined) {
      filtered = filtered.filter(s => getReminderCount(s.notes) >= parseInt(minReminders as string, 10));
    }
    if (maxReminders !== undefined) {
      filtered = filtered.filter(s => getReminderCount(s.notes) <= parseInt(maxReminders as string, 10));
    }
    if (dateFrom) {
      const from = new Date(dateFrom as string);
      filtered = filtered.filter(s => s.user.createdAt >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo as string);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => s.user.createdAt <= to);
    }

    const result = filtered.map(s => ({
      id: s.id,
      userId: s.user.id,
      email: s.user.email,
      name: s.user.name,
      tariff: s.tariff,
      tariffName: TARIFF_NAMES[s.tariff || 'BASIC'] || s.tariff,
      reminderCount: getReminderCount(s.notes),
      createdAt: s.user.createdAt,
      paymentLink: TARIFF_PAYMENT_LINKS[s.tariff || 'BASIC'] || ''
    }));

    res.json(result);
  } catch (error) {
    console.error('Get prepayment students error:', error);
    res.status(500).json({ error: 'Ошибка при получении списка учеников' });
  }
});

router.post('/send-prepayment-reminders', async (req: AuthRequest, res: Response) => {
  try {
    const { studentIds, remainingAmounts } = req.body;

    if (!studentIds?.length) {
      return res.status(400).json({ error: 'Выберите учеников для отправки напоминаний' });
    }

    const students = await prisma.student.findMany({
      where: { 
        id: { in: studentIds }
        // Note: RELATIVE tariff doesn't exist in DB schema, no need to filter
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    }) as any[];

    const supportSetting = await prisma.platformSetting.findFirst({
      where: { key: 'supportLink' }
    });
    const supportLink = supportSetting?.value || 'https://t.me/schkola_trezvosti';

    let sent = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        const tariff = student.tariff || 'BASIC';
        const tariffName = TARIFF_NAMES[tariff] || tariff;
        const paymentLink = TARIFF_PAYMENT_LINKS[tariff] || '';
        const remainingAmount = remainingAmounts?.[student.id] || '0';

        if (!paymentLink) {
          errors.push(`${student.user.email}: нет ссылки для оплаты`);
          continue;
        }

        const emailContent = await emailTemplateService.getRenderedTemplate('prepayment_reminder', {
          tariffName,
          remainingAmount,
          paymentLink,
          supportLink
        });

        if (!emailContent) {
          errors.push(`${student.user.email}: шаблон не найден`);
          continue;
        }

        await sendEmail(
          student.user.email,
          emailContent.subject,
          emailContent.body
        );

        const newNotes = incrementReminderCount(student.notes);
        await prisma.student.update({
          where: { id: student.id },
          data: { notes: newNotes }
        });

        sent++;
      } catch (e) {
        console.error(`Failed to send reminder to ${student.user.email}:`, e);
        errors.push(`${student.user.email}: ошибка отправки`);
      }
    }

    res.json({ 
      success: true, 
      sent, 
      total: students.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Send prepayment reminders error:', error);
    res.status(500).json({ error: 'Ошибка при отправке напоминаний' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // MENTOR can only access students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const studentRecord = await prisma.student.findFirst({
        where: { userId: id }
      });
      if (!studentRecord) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(studentRecord.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    const student = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        student: {
          include: {
            progress: {
              include: { lesson: { include: { module: true } } }
            },
            payments: {
              include: { product: true },
              orderBy: { createdAt: 'desc' }
            },
            enrollments: {
              include: { product: true }
            },
            diaries: {
              include: { lesson: true },
              orderBy: { createdAt: 'desc' }
            },
            studentNotes: {
              include: { lesson: true },
              orderBy: { createdAt: 'desc' }
            },
            assignedPsychologist: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createStudentSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: 'STUDENT',
        student: {
          create: {
            phone: data.phone,
            sobrietyDate: data.sobrietyDate ? new Date(data.sobrietyDate) : undefined,
            notes: data.notes,
            tariff: data.tariff || 'WITH_MENTOR',
            assignedPsychologistId: data.tariff === 'INDIVIDUAL_PSYCHOLOGIST' ? data.assignedPsychologistId : undefined
          }
        }
      },
      include: { 
        student: {
          include: {
            assignedPsychologist: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: user.id,
        details: { email: user.email, name: user.name }
      }
    });

    if (data.sendCredentials) {
      try {
        const appUrl = process.env.APP_URL || 'https://your-platform.com';
        const loginUrl = `${appUrl}/login`;
        
        const emailData = await emailTemplateService.getWelcomeEmail({
          name: data.name,
          email: data.email,
          password: data.password,
          loginUrl
        });
        
        await sendEmail(
          data.email,
          emailData.subject,
          emailData.body
        );
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateStudentSchema.parse(req.body);

    // MENTOR can only update students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const studentRecord = await prisma.student.findFirst({
        where: { userId: id }
      });
      if (!studentRecord) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(studentRecord.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        student: {
          update: {
            phone: data.phone,
            sobrietyDate: data.sobrietyDate ? new Date(data.sobrietyDate) : undefined,
            notes: data.notes,
            tariff: data.tariff,
            assignedPsychologistId: data.tariff === 'INDIVIDUAL_PSYCHOLOGIST' 
              ? data.assignedPsychologistId 
              : (data.tariff ? null : undefined)
          }
        }
      },
      include: { 
        student: {
          include: {
            assignedPsychologist: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        entity: 'STUDENT',
        entityId: user.id,
        details: data
      }
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // MENTOR can only delete students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const studentRecord = await prisma.student.findFirst({
        where: { userId: id }
      });
      if (!studentRecord) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(studentRecord.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    await prisma.user.delete({
      where: { id }
    });

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        entity: 'STUDENT',
        entityId: id
      }
    });

    res.json({ message: 'Ученик удален' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:userId/access', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });
    
    if (!user?.student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }
    
    // MENTOR can only access students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(user.student.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    const [modules, accessList] = await Promise.all([
      prisma.module.findMany({ orderBy: { order: 'asc' } }),
      prisma.moduleAccess.findMany({
        where: { studentId: user.student.id },
        include: { module: true }
      })
    ]);

    const accessMap = new Map(accessList.map(a => [a.moduleId, a]));

    const result = modules.map(m => {
      const access = accessMap.get(m.id);
      const isExpired = access?.expiresAt && new Date(access.expiresAt) < new Date();
      const effectiveAccess = access?.isActive && !isExpired;
      
      return {
        moduleId: m.id,
        moduleTitle: m.title,
        hasAccess: effectiveAccess ?? false,
        isActive: access?.isActive ?? false,
        isExpired: isExpired ?? false,
        expiresAt: access?.expiresAt ?? null,
        accessId: access?.id ?? null
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get student access error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:userId/access', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { moduleId, expiresAt, isActive } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });
    
    if (!user?.student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }
    
    // MENTOR can only modify access for students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(user.student.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    const existingAccess = await prisma.moduleAccess.findUnique({
      where: {
        studentId_moduleId: {
          studentId: user.student.id,
          moduleId
        }
      }
    });

    const access = await prisma.moduleAccess.upsert({
      where: {
        studentId_moduleId: {
          studentId: user.student.id,
          moduleId
        }
      },
      create: {
        studentId: user.student.id,
        moduleId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive ?? true
      },
      update: {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive ?? true
      },
      include: { module: true }
    });

    if (!existingAccess && isActive !== false) {
      await notificationService.createForNewModuleAccess(
        userId,
        access.module.title,
        moduleId
      );
    }

    res.json(access);
  } catch (error) {
    console.error('Update student access error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:userId/access/:moduleId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, moduleId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });
    
    if (!user?.student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }
    
    // MENTOR can only delete access for students from their mini-groups
    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(user.student.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    await prisma.moduleAccess.delete({
      where: {
        studentId_moduleId: {
          studentId: user.student.id,
          moduleId
        }
      }
    });

    res.json({ message: 'Доступ удален' });
  } catch (error) {
    console.error('Delete student access error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/password', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(student.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: student.userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('Change student password error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

function generatePassword(length: number = 10): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

router.post('/:id/send-credentials', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Ученик не найден' });
    }

    if (req.user!.role === 'MENTOR' || req.user!.role === 'INTERN') {
      const allowedStudentIds = await getMentorStudentIds(req.user!.id);
      if (!allowedStudentIds.includes(student.id)) {
        return res.status(403).json({ error: 'Нет доступа к этому ученику' });
      }
    }

    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: student.userId },
      data: { password: hashedPassword }
    });

    const appUrl = process.env.APP_URL || 'https://your-platform.com';
    const loginUrl = `${appUrl}/login`;

    const emailContent = await emailTemplateService.getWelcomeEmail({
      name: student.user.name,
      email: student.user.email,
      password: newPassword,
      loginUrl
    });

    await sendEmail(
      student.user.email,
      emailContent.subject,
      emailContent.body
    );

    res.json({ message: 'Данные для входа отправлены на почту ученика' });
  } catch (error) {
    console.error('Send credentials error:', error);
    res.status(500).json({ error: 'Ошибка при отправке данных' });
  }
});

export default router;
