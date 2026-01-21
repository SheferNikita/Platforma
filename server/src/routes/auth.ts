import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticate, generateToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов')
});

const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа')
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Аккаунт деактивирован' });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Get surveyCompleted for students
    let surveyCompleted = true;
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: user.id },
        select: { surveyCompleted: true }
      });
      surveyCompleted = student?.surveyCompleted || false;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        surveyCompleted
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'STUDENT',
        student: {
          create: {}
        }
      }
    });

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        surveyCompleted: false
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { surveyCompleted: true }
      });
      return res.json({ 
        user: { 
          ...req.user, 
          surveyCompleted: student?.surveyCompleted || false 
        } 
      });
    }
    res.json({ user: { ...req.user, surveyCompleted: true } });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const surveySchema = z.object({
  city: z.string().min(1, 'Укажите город'),
  gender: z.string().min(1, 'Укажите пол'),
  age: z.number().min(1, 'Укажите возраст').max(120, 'Некорректный возраст'),
  addictionType: z.string().min(1, 'Укажите тип зависимости'),
  isClergy: z.boolean().optional()
});

router.post('/survey', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Опрос доступен только для учеников' });
    }

    const data = surveySchema.parse(req.body);

    const student = await prisma.student.update({
      where: { userId: req.user.id },
      data: {
        city: data.city,
        gender: data.gender,
        age: data.age,
        addictionType: data.addictionType,
        isClergy: data.isClergy ?? false,
        surveyCompleted: true
      }
    });

    res.json({ success: true, student });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Survey error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Успешный выход' });
});

export default router;
