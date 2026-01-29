import { Router, Response, Request } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../services/email';
import { getWelcomeEmailTemplate } from '../templates/welcomeEmail';
import crypto from 'crypto';

const router = Router();

const createOrderSchema = z.object({
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'),
  phone: z.string().min(1, 'Телефон обязателен'),
  email: z.string().email('Некорректный email'),
  productId: z.string().uuid()
});

router.post('/create', async (req: Request, res: Response) => {
  try {
    const data = createOrderSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: data.productId }
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }

    const order = await prisma.order.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email.toLowerCase(),
        productId: data.productId,
        amount: product.price
      },
      include: {
        product: { select: { name: true, price: true } }
      }
    });

    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;

    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        offerUrl: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:orderId/payment-url', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN;
    const password1 = process.env.ROBOKASSA_PASSWORD1;
    const isTest = process.env.ROBOKASSA_TEST_MODE === 'true';

    if (!merchantLogin || !password1) {
      return res.json({ 
        paymentUrl: null, 
        message: 'Платежная система не настроена' 
      });
    }

    const invId = Date.now() % 2147483647;

    await prisma.order.update({
      where: { id: orderId },
      data: { robokassaInvId: invId }
    });

    const amount = order.amount.toFixed(2);
    const signatureString = `${merchantLogin}:${amount}:${invId}:${password1}`;
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');

    const params = new URLSearchParams({
      MerchantLogin: merchantLogin,
      OutSum: amount,
      InvId: invId.toString(),
      Description: `Оплата: ${order.product.name}`,
      SignatureValue: signature,
      Email: order.email,
      IsTest: isTest ? '1' : '0'
    });

    const paymentUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;

    res.json({ paymentUrl });
  } catch (error) {
    console.error('Get payment URL error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.use('/admin', authenticate);
router.use('/admin', requireRole('SUPER_ADMIN', 'ADMIN'));

// Export orders to CSV - MUST be before :id routes
router.get('/admin/export', async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        product: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const csvHeader = 'ID,Имя,Фамилия,Email,Телефон,Продукт,Сумма,Статус,Источник,Tilda ID,Дата создания,Дата оплаты,UTM Source,UTM Medium,UTM Campaign,Комментарий\n';
    const csvRows = orders.map(order => {
      return [
        order.id,
        order.firstName,
        order.lastName,
        order.email,
        order.phone,
        order.product?.name || '',
        order.amount,
        order.status,
        order.source || 'MANUAL',
        order.tildaTranId || '',
        order.createdAt.toISOString(),
        order.paidAt?.toISOString() || '',
        order.utmSource || '',
        order.utmMedium || '',
        order.utmCampaign || '',
        order.comment || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send('\uFEFF' + csvHeader + csvRows);
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

// CRM Statistics - MUST be before :id routes
router.get('/admin/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [totalOrders, paidOrders, cancelledOrders, totalRevenue, tariffCounts] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.student.groupBy({
        by: ['tariff'],
        _count: { tariff: true }
      })
    ]);

    const newOrders = totalOrders - paidOrders - cancelledOrders;
    const avgCheck = paidOrders > 0 ? (totalRevenue._sum.amount || 0) / paidOrders : 0;

    const tariffDistribution = tariffCounts.map(t => ({
      tariff: t.tariff,
      count: t._count.tariff
    }));

    res.json({
      totalOrders,
      newOrders,
      paidOrders,
      cancelledOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
      avgCheck: Math.round(avgCheck * 100) / 100,
      tariffDistribution
    });
  } catch (error) {
    console.error('Get CRM stats error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

router.get('/admin/list', async (req: AuthRequest, res: Response) => {
  try {
    const { 
      status, 
      search,
      orderId,
      transactionId,
      productId,
      amountMin,
      amountMax,
      orderDateFrom,
      orderDateTo,
      paidDateFrom,
      paidDateTo,
      source
    } = req.query;

    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } }
      ];
    }
    
    if (orderId) {
      where.id = { contains: orderId as string, mode: 'insensitive' };
    }
    
    if (transactionId) {
      where.robokassaInvId = parseInt(transactionId as string) || undefined;
    }
    
    if (productId) {
      where.productId = productId as string;
    }
    
    if (source && source !== 'all') {
      where.source = source as string;
    }
    
    if (amountMin || amountMax) {
      where.amount = {};
      if (amountMin) where.amount.gte = parseFloat(amountMin as string);
      if (amountMax) where.amount.lte = parseFloat(amountMax as string);
    }
    
    if (orderDateFrom || orderDateTo) {
      where.createdAt = {};
      if (orderDateFrom) where.createdAt.gte = new Date(orderDateFrom as string);
      if (orderDateTo) {
        const endDate = new Date(orderDateTo as string);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }
    
    if (paidDateFrom || paidDateTo) {
      where.paidAt = {};
      if (paidDateFrom) where.paidAt.gte = new Date(paidDateFrom as string);
      if (paidDateTo) {
        const endDate = new Date(paidDateTo as string);
        endDate.setHours(23, 59, 59, 999);
        where.paidAt.lte = endDate;
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, defaultTariff: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const ordersWithStudentData = await Promise.all(orders.map(async (order) => {
      const user = await prisma.user.findUnique({
        where: { email: order.email },
        include: {
          student: {
            include: {
              progress: { where: { isCompleted: true } },
              miniGroups: {
                include: {
                  miniGroup: {
                    include: {
                      curator: true
                    }
                  }
                }
              }
            }
          },
          sessions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }) as any;

      // Calculate student status based on last login and progress
      let studentStatus: 'new' | 'active' | 'inactive' = 'new';
      if (user?.student) {
        const lastSession = user.sessions?.[0];
        const completedLessons = user.student.progress?.length || 0;
        const daysSinceLastLogin = lastSession 
          ? Math.floor((Date.now() - new Date(lastSession.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        if (completedLessons > 0 && daysSinceLastLogin <= 14) {
          studentStatus = 'active';
        } else if (completedLessons > 0 || daysSinceLastLogin <= 7) {
          studentStatus = 'active';
        } else if (daysSinceLastLogin > 30) {
          studentStatus = 'inactive';
        }
      }

      return {
        ...order,
        productTariff: (order.product as any)?.defaultTariff || null,
        student: user?.student ? {
          id: user.student.id,
          tariff: user.student.tariff,
          status: studentStatus,
          lastLoginAt: user.sessions?.[0]?.createdAt || null,
          completedLessons: user.student.progress?.length || 0,
          miniGroup: user.student.miniGroups?.[0]?.miniGroup ? {
            id: user.student.miniGroups[0].miniGroup.id,
            name: user.student.miniGroups[0].miniGroup.title,
            mentors: user.student.miniGroups[0].miniGroup.curator ? [{
              id: user.student.miniGroups[0].miniGroup.curator.id,
              name: user.student.miniGroups[0].miniGroup.curator.name
            }] : []
          } : null
        } : null
      };
    }));

    res.json(ordersWithStudentData);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/admin/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            modules: { include: { module: { select: { id: true, title: true } } } }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/admin/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, comment } = req.body;

    // Get current order to record status history
    const currentOrder = await prisma.order.findUnique({ where: { id } });
    if (!currentOrder) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { 
        status,
        paidAt: status === 'PAID' ? new Date() : undefined
      }
    });

    // Record status change in history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: currentOrder.status,
        toStatus: status,
        changedBy: req.user?.id || null,
        comment: comment || null
      }
    });

    if (status === 'PAID') {
      await processSuccessfulPayment(order.id);
    }

    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Send email to order contact
router.post('/admin/:id/send-email', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Укажите тему и текст письма' });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f5f3ed 0%, #e8e4dc 100%); padding: 30px; border-radius: 16px;">
          <h2 style="color: #3d3527; margin-bottom: 20px;">${subject}</h2>
          <div style="color: #3d3527; line-height: 1.6;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <hr style="border: none; border-top: 1px solid #d4c9b0; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">С уважением,<br>Платформа школы трезвости</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail(order.email, subject, emailHtml);
    res.json({ success: true, message: 'Письмо отправлено' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Ошибка отправки письма' });
  }
});

// Bulk send email
router.post('/admin/bulk/send-email', async (req: AuthRequest, res: Response) => {
  try {
    const { orderIds, subject, message } = req.body;

    if (!orderIds?.length || !subject || !message) {
      return res.status(400).json({ error: 'Укажите заказы, тему и текст письма' });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { email: true }
    });

    const emails = [...new Set(orders.map(o => o.email))];

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f5f3ed 0%, #e8e4dc 100%); padding: 30px; border-radius: 16px;">
          <h2 style="color: #3d3527; margin-bottom: 20px;">${subject}</h2>
          <div style="color: #3d3527; line-height: 1.6;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <hr style="border: none; border-top: 1px solid #d4c9b0; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">С уважением,<br>Платформа школы трезвости</p>
        </div>
      </body>
      </html>
    `;

    let sent = 0;
    for (const email of emails) {
      try {
        await sendEmail(email, subject, emailHtml);
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${email}:`, e);
      }
    }

    res.json({ success: true, sent, total: emails.length });
  } catch (error) {
    console.error('Bulk send email error:', error);
    res.status(500).json({ error: 'Ошибка массовой отправки' });
  }
});

async function processSuccessfulPayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: {
        include: {
          modules: { include: { module: true } }
        }
      }
    }
  });

  if (!order) return;

  let existingUser = await prisma.user.findUnique({
    where: { email: order.email.toLowerCase() }
  });

  const password = Math.random().toString(36).slice(-8);
  let isNewUser = false;

  if (!existingUser) {
    isNewUser = true;
    const hashedPassword = await bcrypt.hash(password, 10);

    existingUser = await prisma.user.create({
      data: {
        email: order.email.toLowerCase(),
        password: hashedPassword,
        name: `${order.firstName} ${order.lastName}`,
        role: 'STUDENT',
        student: {
          create: {
            phone: order.phone
          }
        }
      }
    });
  }

  const student = await prisma.student.findUnique({
    where: { userId: existingUser.id }
  });

  if (student && order.product.modules.length > 0) {
    let expiresAt: Date | null = null;
    let accessFrom: Date | null = null;

    if (order.product.accessDurationType === 'days' && order.product.accessDuration) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + order.product.accessDuration);
    } else if (order.product.accessDurationType === 'date' && order.product.accessExpiresAt) {
      expiresAt = new Date(order.product.accessExpiresAt);
    }

    if ((order.product as any).startDate) {
      accessFrom = new Date((order.product as any).startDate);
    }

    for (const pm of order.product.modules) {
      await prisma.moduleAccess.upsert({
        where: {
          studentId_moduleId: {
            studentId: student.id,
            moduleId: pm.moduleId
          }
        },
        update: {
          isActive: true,
          expiresAt,
          accessFrom
        },
        create: {
          studentId: student.id,
          moduleId: pm.moduleId,
          isActive: true,
          expiresAt,
          accessFrom
        }
      });
    }
  }

  if (isNewUser) {
    try {
      const appUrl = process.env.APP_URL || 'https://your-platform.com';
      const emailHtml = getWelcomeEmailTemplate({
        name: order.firstName,
        email: order.email,
        password,
        loginUrl: `${appUrl}/login`
      });

      await sendEmail(
        order.email,
        'Добро пожаловать на платформу!',
        emailHtml
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
  }
}

// Bulk update tariff for multiple students
router.post('/admin/bulk/tariff', async (req: AuthRequest, res: Response) => {
  try {
    const { orderIds, tariff } = req.body;
    
    if (!orderIds?.length || !tariff) {
      return res.status(400).json({ error: 'Укажите заказы и тариф' });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { email: true }
    });

    const emails = [...new Set(orders.map(o => o.email))];
    
    const updated = await prisma.student.updateMany({
      where: {
        user: { email: { in: emails } }
      },
      data: { tariff }
    });

    res.json({ success: true, updated: updated.count });
  } catch (error) {
    console.error('Bulk tariff update error:', error);
    res.status(500).json({ error: 'Ошибка массового обновления' });
  }
});

// Bulk grant module access
router.post('/admin/bulk/module-access', async (req: AuthRequest, res: Response) => {
  try {
    const { orderIds, moduleId, expiresAt } = req.body;
    
    if (!orderIds?.length || !moduleId) {
      return res.status(400).json({ error: 'Укажите заказы и модуль' });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { email: true }
    });

    const emails = [...new Set(orders.map(o => o.email))];
    
    const students = await prisma.student.findMany({
      where: {
        user: { email: { in: emails } }
      }
    });

    let granted = 0;
    for (const student of students) {
      await prisma.moduleAccess.upsert({
        where: {
          studentId_moduleId: {
            studentId: student.id,
            moduleId
          }
        },
        update: {
          isActive: true,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        },
        create: {
          studentId: student.id,
          moduleId,
          isActive: true,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });
      granted++;
    }

    res.json({ success: true, granted });
  } catch (error) {
    console.error('Bulk module access error:', error);
    res.status(500).json({ error: 'Ошибка массового открытия доступа' });
  }
});

// Get order status history
router.get('/admin/:id/history', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({ error: 'Ошибка загрузки истории' });
  }
});

// Update order comment
router.put('/admin/:id/comment', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const { comment } = req.body;
    
    await prisma.order.update({
      where: { id: orderId },
      data: { comment }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update order comment error:', error);
    res.status(500).json({ error: 'Ошибка обновления комментария' });
  }
});

export { processSuccessfulPayment };
export default router;
