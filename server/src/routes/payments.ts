import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendPaymentConfirmationEmail } from '../services/email';

const router = Router();

const ROBOKASSA_MERCHANT_LOGIN = process.env.ROBOKASSA_MERCHANT_LOGIN || '';
const ROBOKASSA_PASSWORD1 = process.env.ROBOKASSA_PASSWORD1 || '';
const ROBOKASSA_PASSWORD2 = process.env.ROBOKASSA_PASSWORD2 || '';
const ROBOKASSA_TEST_MODE = process.env.ROBOKASSA_TEST_MODE === 'true';

function generateSignature(params: string[], password: string): string {
  const signatureString = params.join(':');
  return crypto.createHash('md5').update(signatureString).digest('hex');
}

router.post('/create', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, email } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }

    let student = await prisma.student.findFirst({
      where: { user: { email } }
    });

    if (!student) {
      return res.status(400).json({ error: 'Студент не найден' });
    }

    const invId = Math.floor(Math.random() * 900000000) + 100000000;

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        productId: product.id,
        amount: product.price,
        currency: product.currency,
        robokassaInvId: invId,
        status: 'PENDING'
      }
    });

    const signatureParams = [
      ROBOKASSA_MERCHANT_LOGIN,
      product.price.toFixed(2),
      invId.toString(),
      ROBOKASSA_PASSWORD1
    ];
    const signature = generateSignature(signatureParams, ROBOKASSA_PASSWORD1);

    const baseUrl = ROBOKASSA_TEST_MODE 
      ? 'https://auth.robokassa.ru/Merchant/Index.aspx'
      : 'https://auth.robokassa.ru/Merchant/Index.aspx';

    const paymentUrl = `${baseUrl}?MerchantLogin=${ROBOKASSA_MERCHANT_LOGIN}&OutSum=${product.price.toFixed(2)}&InvId=${invId}&Description=${encodeURIComponent(product.name)}&SignatureValue=${signature}&Email=${encodeURIComponent(email)}${ROBOKASSA_TEST_MODE ? '&IsTest=1' : ''}`;

    res.json({
      paymentId: payment.id,
      paymentUrl
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/result', async (req, res) => {
  try {
    const { OutSum, InvId, SignatureValue } = req.body;

    const signatureParams = [OutSum, InvId, ROBOKASSA_PASSWORD2];
    const expectedSignature = generateSignature(signatureParams, ROBOKASSA_PASSWORD2);

    if (SignatureValue.toLowerCase() !== expectedSignature.toLowerCase()) {
      console.error('Invalid Robokassa signature');
      return res.status(400).send('bad sign');
    }

    const invIdNum = parseInt(InvId);

    const order = await prisma.order.findUnique({
      where: { robokassaInvId: invIdNum }
    });

    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() }
      });

      const { processSuccessfulPayment } = await import('./orders');
      await processSuccessfulPayment(order.id);

      res.send(`OK${InvId}`);
      return;
    }

    const payment = await prisma.payment.findUnique({
      where: { robokassaInvId: invIdNum },
      include: {
        product: true,
        student: {
          include: { user: true }
        }
      }
    });

    if (!payment) {
      console.error('Payment/Order not found:', InvId);
      return res.status(404).send('not found');
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        robokassaData: req.body
      }
    });

    await prisma.enrollment.upsert({
      where: {
        studentId_productId: {
          studentId: payment.studentId,
          productId: payment.productId
        }
      },
      update: {
        isActive: true,
        expiresAt: payment.product.accessDuration
          ? new Date(Date.now() + payment.product.accessDuration * 24 * 60 * 60 * 1000)
          : null
      },
      create: {
        studentId: payment.studentId,
        productId: payment.productId,
        isActive: true,
        expiresAt: payment.product.accessDuration
          ? new Date(Date.now() + payment.product.accessDuration * 24 * 60 * 60 * 1000)
          : null
      }
    });

    if (payment.product.emailTemplate && payment.student.user.email) {
      await sendPaymentConfirmationEmail(
        payment.student.user.email,
        payment.product.emailSubject || 'Подтверждение оплаты',
        payment.product.emailTemplate,
        {
          name: payment.student.user.name,
          productName: payment.product.name,
          amount: payment.amount.toString()
        }
      );
    }

    res.send(`OK${InvId}`);
  } catch (error) {
    console.error('Payment result error:', error);
    res.status(500).send('error');
  }
});

router.get('/success', (req, res) => {
  res.redirect('/?payment=success');
});

router.get('/fail', (req, res) => {
  res.redirect('/?payment=failed');
});

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { name: true, email: true } } }
          },
          product: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.payment.count({ where })
    ]);

    const stats = await prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true
    });

    res.json({
      payments,
      stats: {
        totalRevenue: stats._sum.amount || 0,
        totalPayments: stats._count
      },
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true, email: true } } }
        },
        product: true
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Платеж не найден' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
