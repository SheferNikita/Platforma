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
      return res.status(400).json({ error: error.errors[0].message });
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
        product: { select: { id: true, name: true } }
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
              miniGroupMemberships: {
                include: {
                  miniGroup: {
                    include: {
                      mentors: { include: { user: { select: { id: true, name: true } } } }
                    }
                  }
                }
              }
            }
          }
        }
      });

      return {
        ...order,
        student: user?.student ? {
          id: user.student.id,
          tariff: user.student.tariff,
          lastLoginAt: user.lastLoginAt,
          completedLessons: user.student.progress.length,
          miniGroup: user.student.miniGroupMemberships[0]?.miniGroup ? {
            id: user.student.miniGroupMemberships[0].miniGroup.id,
            name: user.student.miniGroupMemberships[0].miniGroup.name,
            mentors: user.student.miniGroupMemberships[0].miniGroup.mentors.map(m => ({
              id: m.user.id,
              name: m.user.name
            }))
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
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { 
        status,
        paidAt: status === 'PAID' ? new Date() : undefined
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

      await sendEmail({
        to: order.email,
        subject: 'Добро пожаловать на платформу!',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
  }
}

// Export orders to CSV
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
    const orderId = req.params.id;
    
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
    const orderId = req.params.id;
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

// CRM Statistics
router.get('/admin/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [totalOrders, paidOrders, totalRevenue, tariffStats] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.student.groupBy({
        by: ['tariff'],
        _count: { tariff: true }
      })
    ]);

    const avgCheck = paidOrders > 0 ? (totalRevenue._sum.amount || 0) / paidOrders : 0;

    res.json({
      totalOrders,
      paidOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
      avgCheck: Math.round(avgCheck * 100) / 100,
      tariffDistribution: tariffStats.map(t => ({
        tariff: t.tariff,
        count: t._count.tariff
      }))
    });
  } catch (error) {
    console.error('Get CRM stats error:', error);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

export { processSuccessfulPayment };
export default router;
