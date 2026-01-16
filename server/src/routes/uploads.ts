import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../index';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'video/webm',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'));
    }
  }
});

const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'));
    }
  }
});

router.post('/avatar', authenticate, avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    const url = `/uploads/avatars/${file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.post('/lesson/:lessonId', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const lessonId = req.params.lessonId as string;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Урок не найден' });
    }
    
    const attachment = await prisma.lessonAttachment.create({
      data: {
        lessonId: lessonId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/attachments/${file.filename}`
      }
    });
    
    res.status(201).json(attachment);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const attachment = await prisma.lessonAttachment.findUnique({ where: { id: id } });
    if (!attachment) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const filePath = path.join(uploadDir, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    await prisma.lessonAttachment.delete({ where: { id: id } });
    
    res.json({ message: 'Файл удален' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

router.get('/lesson/:lessonId', async (req: AuthRequest, res: Response) => {
  try {
    const lessonId = req.params.lessonId as string;
    
    const attachments = await prisma.lessonAttachment.findMany({
      where: { lessonId: lessonId },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json(attachments);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Ошибка получения файлов' });
  }
});

export default router;
