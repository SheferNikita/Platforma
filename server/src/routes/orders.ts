import { Router, Response, Request } from 'express';
import { prisma } from '../index';
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
      paidDateTo
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

    res.json(orders);
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

    if (order.product.accessDurationType === 'days' && order.product.accessDuration) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + order.product.accessDuration);
    } else if (order.product.accessDurationType === 'date' && order.product.accessExpiresAt) {
      expiresAt = new Date(order.product.accessExpiresAt);
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
          expiresAt
        },
        create: {
          studentId: student.id,
          moduleId: pm.moduleId,
          isActive: true,
          expiresAt
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

export { processSuccessfulPayment };
export default router;
