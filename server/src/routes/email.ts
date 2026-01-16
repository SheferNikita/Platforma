import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../services/email';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

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
      return res.status(400).json({ error: error.errors[0].message });
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
      return res.status(400).json({ error: error.errors[0].message });
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
    const { to, subject, body } = sendEmailSchema.parse(req.body);

    const recipients = Array.isArray(to) ? to : [to];

    for (const recipient of recipients) {
      await prisma.emailJob.create({
        data: {
          to: recipient,
          subject,
          body,
          status: 'pending'
        }
      });

      try {
        await sendEmail(recipient, subject, body);
        await prisma.emailJob.updateMany({
          where: { to: recipient, subject, status: 'pending' },
          data: { status: 'sent', sentAt: new Date() }
        });
      } catch (emailError) {
        await prisma.emailJob.updateMany({
          where: { to: recipient, subject, status: 'pending' },
          data: { status: 'failed', error: String(emailError) }
        });
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_EMAIL',
        entity: 'EMAIL',
        details: { recipients: recipients.length, subject }
      }
    });

    res.json({ message: `Email отправлен ${recipients.length} получателям` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/send-to-all', async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body, filter } = req.body;

    let where: any = { role: 'STUDENT', isActive: true };

    const students = await prisma.user.findMany({
      where,
      select: { email: true }
    });

    const emails = students.map(s => s.email);

    for (const email of emails) {
      await prisma.emailJob.create({
        data: {
          to: email,
          subject,
          body,
          status: 'pending'
        }
      });

      try {
        await sendEmail(email, subject, body);
        await prisma.emailJob.updateMany({
          where: { to: email, subject, status: 'pending' },
          data: { status: 'sent', sentAt: new Date() }
        });
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_BULK_EMAIL',
        entity: 'EMAIL',
        details: { recipients: emails.length, subject }
      }
    });

    res.json({ message: `Email отправлен ${emails.length} ученикам` });
  } catch (error) {
    console.error('Send bulk email error:', error);
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

export default router;
