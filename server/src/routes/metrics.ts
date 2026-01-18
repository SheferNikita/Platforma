import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      activeStudents,
      newStudentsThisMonth,
      totalPayments,
      revenueThisMonth,
      completedLessons,
      totalLessons,
      recentPayments
    ] = await Promise.all([
      prisma.student.count(),
      prisma.enrollment.count({ where: { isActive: true } }),
      prisma.student.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.payment.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true }
      }),
      prisma.lessonProgress.count({ where: { isCompleted: true } }),
      prisma.lesson.count({ where: { isPublished: true } }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED' },
        include: {
          student: { include: { user: { select: { name: true } } } },
          product: { select: { name: true } }
        },
        orderBy: { paidAt: 'desc' },
        take: 5
      })
    ]);

    const revenueByDayRaw = await prisma.$queryRaw<Array<{ date: Date; total: bigint | number | null }>>`
      SELECT 
        DATE("paidAt") as date,
        SUM(amount) as total
      FROM "Payment"
      WHERE status = 'COMPLETED'
        AND "paidAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("paidAt")
      ORDER BY date ASC
    `;

    const revenueByDay = revenueByDayRaw.map(row => ({
      date: row.date,
      total: row.total !== null ? Number(row.total) : 0
    }));

    const studentProgressRaw = await prisma.$queryRaw<Array<{ module_name: string; students_completed: bigint | number }>>`
      SELECT 
        m.title as module_name,
        COUNT(DISTINCT lp."studentId") as students_completed
      FROM "Module" m
      LEFT JOIN "Lesson" l ON l."moduleId" = m.id
      LEFT JOIN "LessonProgress" lp ON lp."lessonId" = l.id AND lp."isCompleted" = true
      WHERE m."isPublished" = true
      GROUP BY m.id, m.title, m."order"
      ORDER BY m."order" ASC
    `;

    const studentProgress = studentProgressRaw.map(row => ({
      module_name: row.module_name,
      students_completed: Number(row.students_completed)
    }));

    const avgCompletionRate = totalStudents > 0 && totalLessons > 0
      ? (completedLessons / (totalStudents * totalLessons)) * 100
      : 0;

    res.json({
      overview: {
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        totalPayments,
        revenueThisMonth: revenueThisMonth._sum.amount || 0,
        avgCompletionRate: Math.round(avgCompletionRate * 100) / 100
      },
      revenueChart: revenueByDay,
      studentProgress,
      recentPayments
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/students', async (req: AuthRequest, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
        progress: {
          where: { isCompleted: true }
        },
        enrollments: {
          where: { isActive: true }
        }
      }
    });

    const totalLessons = await prisma.lesson.count({ where: { isPublished: true } });

    const studentMetrics = students.map(student => ({
      id: student.id,
      name: student.user.name,
      email: student.user.email,
      joinedAt: student.user.createdAt,
      completedLessons: student.progress.length,
      totalLessons,
      completionRate: totalLessons > 0 
        ? Math.round((student.progress.length / totalLessons) * 100) 
        : 0,
      activeEnrollments: student.enrollments.length,
      sobrietyDate: student.sobrietyDate,
      sobrietyDays: student.sobrietyDate 
        ? Math.floor((new Date().getTime() - new Date(student.sobrietyDate).getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

    res.json(studentMetrics);
  } catch (error) {
    console.error('Get student metrics error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/financial', async (req: AuthRequest, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalRevenue,
      periodRevenue,
      paymentsByProduct,
      paymentsByStatus
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: startDate }
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.groupBy({
        by: ['productId'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.groupBy({
        by: ['status'],
        _count: true
      })
    ]);

    const products = await prisma.product.findMany({
      select: { id: true, name: true }
    });

    const productMap = new Map(products.map(p => [p.id, p.name]));

    res.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      periodRevenue: periodRevenue._sum.amount || 0,
      periodPayments: periodRevenue._count,
      paymentsByProduct: paymentsByProduct.map(p => ({
        productName: productMap.get(p.productId) || 'Неизвестный продукт',
        revenue: p._sum.amount || 0,
        count: p._count
      })),
      paymentsByStatus: paymentsByStatus.map(s => ({
        status: s.status,
        count: s._count
      }))
    });
  } catch (error) {
    console.error('Get financial metrics error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
