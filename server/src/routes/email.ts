import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/email';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

async function replaceEmailVariables(body: string, recipientEmail: string): Promise<string> {
  if (!body.includes('{{')) return body;

  const user = await prisma.user.findUnique({
    where: { email: recipientEmail },
    select: { name: true, email: true, student: { select: { city: true, tariff: true } } }
  });

  let result = body;
  result = result.replace(/\{\{name\}\}/g, user?.name || '');
  result = result.replace(/\{\{email\}\}/g, recipientEmail);
  result = result.replace(/\{\{city\}\}/g, user?.student?.city || '');
  result = result.replace(/\{\{tariff\}\}/g, user?.student?.tariff || '');
  return result;
}

const templateSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  subject: z.string().min(1, 'Тема обязательна'),
  body: z.string().min(1, 'Текст письма обязателен'),
  variables: z.array(z.string()).optional()
});

const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  body: z.string().min(1)
});

async function buildStudentFilterQuery(filters: any) {
  const userWhere: any = { role: 'STUDENT', isActive: true };
  const studentWhere: any = {};
  let needsStudentJoin = false;
  let miniGroupFilter: string | null = null;
  let hasPrepaymentFilter: string | null = null;

  if (filters.tariff) {
    studentWhere.tariff = filters.tariff;
    needsStudentJoin = true;
  }
  if (filters.gender) {
    studentWhere.gender = filters.gender;
    needsStudentJoin = true;
  }
  if (filters.city) {
    studentWhere.city = filters.city;
    needsStudentJoin = true;
  }
  if (filters.addictionType) {
    studentWhere.addictionType = { contains: filters.addictionType };
    needsStudentJoin = true;
  }
  if (filters.surveyStatus === 'completed') {
    studentWhere.surveyCompleted = true;
    needsStudentJoin = true;
  } else if (filters.surveyStatus === 'not_completed') {
    studentWhere.surveyCompleted = false;
    needsStudentJoin = true;
  }
  if (filters.isClergy === 'yes') {
    studentWhere.isClergy = true;
    needsStudentJoin = true;
  } else if (filters.isClergy === 'no') {
    studentWhere.isClergy = { not: true };
    needsStudentJoin = true;
  }
  if (filters.hasPrepayment) {
    hasPrepaymentFilter = filters.hasPrepayment;
    needsStudentJoin = true;
  }
  if (filters.miniGroupStatus) {
    miniGroupFilter = filters.miniGroupStatus;
    needsStudentJoin = true;
  }
  if (filters.dateFrom) {
    userWhere.createdAt = { ...(userWhere.createdAt || {}), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    userWhere.createdAt = { ...(userWhere.createdAt || {}), lte: dateTo };
  }

  if (needsStudentJoin) {
    userWhere.student = studentWhere;
  }

  let users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      email: true,
      student: {
        select: {
          id: true,
          notes: true,
          miniGroups: { select: { id: true } }
        }
      }
    }
  });

  if (hasPrepaymentFilter === 'yes') {
    users = users.filter(u => u.student?.notes?.includes('[PREPAYMENT]'));
  } else if (hasPrepaymentFilter === 'no') {
    users = users.filter(u => !u.student?.notes?.includes('[PREPAYMENT]'));
  }

  if (miniGroupFilter === 'assigned') {
    users = users.filter(u => u.student?.miniGroups && u.student.miniGroups.length > 0);
  } else if (miniGroupFilter === 'not_assigned') {
    users = users.filter(u => !u.student?.miniGroups || u.student.miniGroups.length === 0);
  }

  return users.map(u => u.email);
}

router.post('/count-recipients', async (req: AuthRequest, res: Response) => {
  try {
    const { filters } = req.body;
    const emails = await buildStudentFilterQuery(filters || {});
    res.json({ count: emails.length });
  } catch (error) {
    console.error('Count recipients error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/filter-options', async (req: AuthRequest, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      where: { user: { isActive: true } },
      select: { city: true }
    });
    const cities = [...new Set(students.map(s => s.city).filter(Boolean))].sort();
    res.json({ cities });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const data = templateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({
      data: {
        ...data,
        variables: data.variables || []
      }
    });
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = templateSchema.partial().parse(req.body);
    const template = await prisma.emailTemplate.update({
      where: { id },
      data
    });
    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.emailTemplate.delete({ where: { id } });
    res.json({ message: 'Шаблон удален' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    let rawTo = req.body.to;
    if (typeof rawTo === 'string' && rawTo.includes(',')) {
      rawTo = rawTo.split(',').map((e: string) => e.trim()).filter((e: string) => e);
    }
    const { to, subject, body } = sendEmailSchema.parse({ ...req.body, to: rawTo });

    const recipients = Array.isArray(to) ? to : [to];

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      const personalizedBody = await replaceEmailVariables(body, recipient);

      await prisma.emailJob.create({
        data: {
          to: recipient,
          subject,
          body: personalizedBody,
          status: 'pending'
        }
      });

      try {
        await sendEmail(recipient, subject, personalizedBody);
        await prisma.emailJob.updateMany({
          where: { to: recipient, subject, status: 'pending' },
          data: { status: 'sent', sentAt: new Date() }
        });
        sentCount++;
      } catch (emailError) {
        await prisma.emailJob.updateMany({
          where: { to: recipient, subject, status: 'pending' },
          data: { status: 'failed', error: String(emailError) }
        });
        failedCount++;
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_EMAIL',
        entity: 'EMAIL',
        details: {
          recipients: recipients.length,
          sent: sentCount,
          failed: failedCount,
          subject,
          filters: { 'Тип': 'Ручная отправка', 'Получатели': recipients.join(', ') },
          rawFilters: {}
        }
      }
    });

    res.json({ message: `Email отправлен ${sentCount} из ${recipients.length} получателям` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || 'Ошибка валидации' });
    }
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/send-to-all', async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body, filters } = req.body;

    const emails = await buildStudentFilterQuery(filters || {});

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const personalizedBody = await replaceEmailVariables(body, email);

      await prisma.emailJob.create({
        data: {
          to: email,
          subject,
          body: personalizedBody,
          status: 'pending'
        }
      });

      try {
        await sendEmail(email, subject, personalizedBody);
        await prisma.emailJob.updateMany({
          where: { to: email, subject, status: 'pending' },
          data: { status: 'sent', sentAt: new Date() }
        });
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
        await prisma.emailJob.updateMany({
          where: { to: email, subject, status: 'pending' },
          data: { status: 'failed', error: String(emailError) }
        });
        failedCount++;
      }

      if (i < emails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const filterLabels: Record<string, string> = {
      tariff: 'Тариф',
      gender: 'Пол',
      city: 'Город',
      addictionType: 'Зависимость',
      surveyStatus: 'Опрос',
      isClergy: 'Духовенство',
      hasPrepayment: 'Предоплата',
      miniGroupStatus: 'Мини-группа',
      dateFrom: 'Дата от',
      dateTo: 'Дата до'
    };

    const appliedFilters: Record<string, string> = {};
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value && filterLabels[key]) {
          appliedFilters[filterLabels[key]] = String(value);
        }
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_BULK_EMAIL',
        entity: 'EMAIL',
        details: {
          recipients: emails.length,
          sent: sentCount,
          failed: failedCount,
          subject,
          filters: appliedFilters,
          rawFilters: filters || {}
        }
      }
    });

    res.json({ message: `Email отправлен ${sentCount} из ${emails.length} ученикам`, sent: sentCount, total: emails.length, failed: failedCount });
  } catch (error) {
    console.error('Send bulk email error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/send-test', async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Тема и текст письма обязательны' });
    }

    const adminEmail = req.user!.email;
    const personalizedBody = await replaceEmailVariables(body, adminEmail);

    try {
      await sendEmail(adminEmail, `[ТЕСТ] ${subject}`, personalizedBody);
      res.json({ message: `Тестовое письмо отправлено на ${adminEmail}` });
    } catch (emailError) {
      res.status(500).json({ error: `Ошибка отправки: ${String(emailError)}` });
    }
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/mailing-history', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const historyWhere = { action: { in: ['SEND_BULK_EMAIL', 'SEND_EMAIL'] }, entity: 'EMAIL' };
    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where: historyWhere,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.adminLog.count({ where: historyWhere })
    ]);

    res.json({
      history: logs.map(log => ({
        id: log.id,
        type: log.action === 'SEND_EMAIL' ? 'manual' : 'bulk',
        subject: (log.details as any)?.subject || '',
        recipients: (log.details as any)?.recipients || 0,
        sent: (log.details as any)?.sent || (log.details as any)?.recipients || 0,
        failed: (log.details as any)?.failed || 0,
        filters: (log.details as any)?.filters || {},
        adminName: log.user.name,
        adminEmail: log.user.email,
        createdAt: log.createdAt
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get mailing history error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.emailJob.count({ where })
    ]);

    res.json({
      jobs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get email jobs error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/schedule', async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body, scheduledAt, sendMode, to, filters } = req.body;

    if (!subject || !body || !scheduledAt) {
      return res.status(400).json({ error: 'Тема, текст и время отправки обязательны' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Неверный формат даты' });
    }

    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: 'Время отправки должно быть в будущем' });
    }

    const filterLabels: Record<string, string> = {
      tariff: 'Тариф', gender: 'Пол', city: 'Город', addictionType: 'Зависимость',
      surveyStatus: 'Опрос', isClergy: 'Духовенство', hasPrepayment: 'Предоплата',
      miniGroupStatus: 'Мини-группа', dateFrom: 'Дата от', dateTo: 'Дата до'
    };

    const appliedFilters: Record<string, string> = {};
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value && filterLabels[key]) {
          appliedFilters[filterLabels[key]] = String(value);
        }
      }
    }

    let recipientCount = 0;
    let recipientEmails: string[] = [];
    if (sendMode === 'manual') {
      if (!to) {
        return res.status(400).json({ error: 'Укажите получателей' });
      }
      recipientEmails = typeof to === 'string'
        ? to.split(',').map((e: string) => e.trim()).filter((e: string) => e)
        : Array.isArray(to) ? to : [to];
      recipientCount = recipientEmails.length;
    } else {
      const emails = await buildStudentFilterQuery(filters || {});
      recipientCount = emails.length;
    }

    const log = await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'SCHEDULED_EMAIL',
        entity: 'EMAIL',
        details: {
          status: 'pending',
          subject,
          body,
          scheduledAt: scheduledDate.toISOString(),
          sendMode: sendMode || 'filtered',
          recipients: sendMode === 'manual' ? recipientEmails : undefined,
          recipientCount,
          filters: appliedFilters,
          rawFilters: filters || {},
          createdBy: req.user!.name || req.user!.email
        }
      }
    });

    res.status(201).json({
      message: `Рассылка запланирована на ${scheduledDate.toISOString()}`,
      id: log.id,
      recipientCount
    });
  } catch (error) {
    console.error('Schedule email error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/scheduled', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.adminLog.findMany({
      where: {
        action: 'SCHEDULED_EMAIL',
        entity: 'EMAIL'
      },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } }
    });

    const scheduled = logs.map(log => {
      const details = log.details as any;
      return {
        id: log.id,
        subject: details?.subject || '',
        body: details?.body || '',
        scheduledAt: details?.scheduledAt || '',
        status: details?.status || 'pending',
        sendMode: details?.sendMode || 'filtered',
        recipientCount: details?.recipientCount || 0,
        actualRecipients: details?.actualRecipients,
        sent: details?.sent,
        failed: details?.failed,
        sentAt: details?.sentAt,
        error: details?.error,
        filters: details?.filters || {},
        adminName: log.user.name,
        adminEmail: log.user.email,
        createdAt: log.createdAt
      };
    });

    res.json({ scheduled });
  } catch (error) {
    console.error('Get scheduled emails error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/scheduled/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const log = await prisma.adminLog.findUnique({ where: { id } });
    if (!log || log.action !== 'SCHEDULED_EMAIL') {
      return res.status(404).json({ error: 'Запланированная рассылка не найдена' });
    }

    const details = log.details as any;
    if (details?.status !== 'pending') {
      return res.status(400).json({ error: 'Можно отменить только ожидающие рассылки' });
    }

    await prisma.adminLog.update({
      where: { id },
      data: {
        details: {
          ...details,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          cancelledBy: req.user!.name || req.user!.email
        }
      }
    });

    res.json({ message: 'Рассылка отменена' });
  } catch (error) {
    console.error('Cancel scheduled email error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
