import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@sobriety.ru' }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await prisma.user.create({
      data: {
        email: 'admin@sobriety.ru',
        password: hashedPassword,
        name: 'Администратор',
        role: 'SUPER_ADMIN',
        isActive: true
      }
    });

    console.log('Created default admin user:');
    console.log('Email: admin@sobriety.ru');
    console.log('Password: admin123');
  } else {
    console.log('Admin user already exists');
  }

  const module1 = await prisma.module.upsert({
    where: { id: 'module-1' },
    update: {},
    create: {
      id: 'module-1',
      title: 'Модуль 1: Основы трезвости',
      description: 'Введение в программу и базовые концепции',
      order: 1,
      isPublished: true
    }
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-1' },
    update: {},
    create: {
      id: 'lesson-1',
      moduleId: module1.id,
      title: 'Введение в курс трезвости',
      description: 'Знакомство с программой, постановка целей и первые шаги на пути к трезвой жизни.',
      content: '<p>Добро пожаловать в курс по трезвости!</p>',
      duration: '30 минут',
      order: 1,
      isPublished: true
    }
  });

  await prisma.lesson.upsert({
    where: { id: 'lesson-2' },
    update: {},
    create: {
      id: 'lesson-2',
      moduleId: module1.id,
      title: 'Понимание зависимости',
      description: 'Что такое зависимость, как она формируется и почему важно понимать её природу.',
      content: '<p>В этом уроке мы рассмотрим природу зависимости.</p>',
      duration: '45 минут',
      order: 2,
      isPublished: true
    }
  });

  await prisma.product.upsert({
    where: { id: 'product-basic' },
    update: {},
    create: {
      id: 'product-basic',
      name: 'Базовый курс',
      description: 'Полный доступ к базовому курсу трезвости',
      price: 4990,
      currency: 'RUB',
      accessType: 'course',
      accessDuration: 365,
      emailSubject: 'Добро пожаловать на курс трезвости!',
      emailTemplate: `
<h1>Здравствуйте, {{name}}!</h1>
<p>Благодарим вас за покупку курса "{{productName}}".</p>
<p>Ваш платеж на сумму {{amount}} руб. успешно обработан.</p>
<p>Теперь вы можете начать обучение. Войдите в личный кабинет, чтобы приступить к урокам.</p>
<p>Желаем вам успехов на пути к трезвой жизни!</p>
      `,
      isActive: true
    }
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
