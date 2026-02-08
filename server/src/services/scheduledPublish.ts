import { sendEmail } from './email';
import { emailTemplateService } from './emailTemplateService';
import { notificationService } from './notificationService';
import { prisma } from '../db';
const PLATFORM_URL = 'https://schkola-trezvosti.ru';

export async function publishScheduledLessons(): Promise<number> {
  const now = new Date();
  
  const lessonsToPublish = await prisma.lesson.findMany({
    where: {
      publishAt: {
        lte: now
      },
      isPublished: false
    },
    include: {
      module: true
    }
  });

  if (lessonsToPublish.length === 0) {
    return 0;
  }

  console.log(`[ScheduledPublish] Found ${lessonsToPublish.length} lessons to publish`);

  for (const lesson of lessonsToPublish) {
    try {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          isPublished: true,
          publishAt: null
        }
      });

      console.log(`[ScheduledPublish] Published lesson: ${lesson.title}`);

      const studentsWithAccess = await prisma.student.findMany({
        where: {
          moduleAccess: {
            some: {
              moduleId: lesson.moduleId,
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } }
              ]
            }
          },
          user: {
            isActive: true
          }
        },
        include: {
          user: true
        }
      });

      console.log(`[ScheduledPublish] Sending notifications to ${studentsWithAccess.length} students`);

      for (const student of studentsWithAccess) {
        try {
          const emailData = await emailTemplateService.getNewLessonEmail({
            studentName: student.user.name,
            lessonTitle: lesson.title,
            moduleName: lesson.module.title,
            lessonUrl: `${PLATFORM_URL}/lessons/${lesson.id}`
          });

          await sendEmail(
            student.user.email,
            emailData.subject,
            emailData.body
          );

          await notificationService.createForNewLesson(
            student.userId,
            lesson.title,
            lesson.id,
            lesson.module.title
          );
        } catch (emailError) {
          console.error(`[ScheduledPublish] Failed to send email to ${student.user.email}:`, emailError);
        }
      }
    } catch (error) {
      console.error(`[ScheduledPublish] Error publishing lesson ${lesson.id}:`, error);
    }
  }

  return lessonsToPublish.length;
}

let intervalId: NodeJS.Timeout | null = null;

export function startScheduledPublishJob(): void {
  if (intervalId) {
    console.log('[ScheduledPublish] Job already running');
    return;
  }

  console.log('[ScheduledPublish] Starting scheduled publish job (checks every minute)');
  
  publishScheduledLessons().catch(console.error);
  
  intervalId = setInterval(async () => {
    try {
      const count = await publishScheduledLessons();
      if (count > 0) {
        console.log(`[ScheduledPublish] Published ${count} lessons`);
      }
    } catch (error) {
      console.error('[ScheduledPublish] Error in scheduled job:', error);
    }
  }, 60 * 1000);
}

export function stopScheduledPublishJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[ScheduledPublish] Stopped scheduled publish job');
  }
}
