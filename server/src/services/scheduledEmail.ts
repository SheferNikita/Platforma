import { sendEmail } from './email';
import { prisma } from '../db';

async function replaceEmailVariables(body: string, recipientEmail: string): Promise<string> {
  if (!body.includes('{{')) return body;

  const user = await prisma.user.findUnique({
    where: { email: recipientEmail },
    select: { name: true, email: true, student: { select: { city: true, tariff: true } } }
  });

  let result = body;
  result = result.replace(/\{\{name\}\}/g, user?.name || '');
  result = result.replace(/\{\{email\}\}/g, recipientEmail);
  result = result.replace(/\{\{city\}\}/g, user?.student?.city || '');
  result = result.replace(/\{\{tariff\}\}/g, user?.student?.tariff || '');
  return result;
}

async function buildStudentFilterQuery(filters: any): Promise<string[]> {
  const userWhere: any = { role: 'STUDENT', isActive: true };
  const studentWhere: any = {};
  let needsStudentJoin = false;
  let miniGroupFilter: string | null = null;
  let hasPrepaymentFilter: string | null = null;

  if (filters.tariff) {
    studentWhere.tariff = filters.tariff;
    needsStudentJoin = true;
  }
  if (filters.gender) {
    studentWhere.gender = filters.gender;
    needsStudentJoin = true;
  }
  if (filters.city) {
    studentWhere.city = filters.city;
    needsStudentJoin = true;
  }
  if (filters.addictionType) {
    studentWhere.addictionType = { contains: filters.addictionType };
    needsStudentJoin = true;
  }
  if (filters.surveyStatus === 'completed') {
    studentWhere.surveyCompleted = true;
    needsStudentJoin = true;
  } else if (filters.surveyStatus === 'not_completed') {
    studentWhere.surveyCompleted = false;
    needsStudentJoin = true;
  }
  if (filters.isClergy === 'yes') {
    studentWhere.isClergy = true;
    needsStudentJoin = true;
  } else if (filters.isClergy === 'no') {
    studentWhere.isClergy = { not: true };
    needsStudentJoin = true;
  }
  if (filters.hasPrepayment) {
    hasPrepaymentFilter = filters.hasPrepayment;
    needsStudentJoin = true;
  }
  if (filters.miniGroupStatus) {
    miniGroupFilter = filters.miniGroupStatus;
    needsStudentJoin = true;
  }
  if (filters.dateFrom) {
    userWhere.createdAt = { ...(userWhere.createdAt || {}), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    userWhere.createdAt = { ...(userWhere.createdAt || {}), lte: dateTo };
  }

  if (needsStudentJoin) {
    userWhere.student = studentWhere;
  }

  let users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      email: true,
      student: {
        select: {
          id: true,
          notes: true,
          miniGroups: { select: { id: true } }
        }
      }
    }
  });

  if (hasPrepaymentFilter === 'yes') {
    users = users.filter(u => u.student?.notes?.includes('[PREPAYMENT]'));
  } else if (hasPrepaymentFilter === 'no') {
    users = users.filter(u => !u.student?.notes?.includes('[PREPAYMENT]'));
  }

  if (miniGroupFilter === 'assigned') {
    users = users.filter(u => u.student?.miniGroups && u.student.miniGroups.length > 0);
  } else if (miniGroupFilter === 'not_assigned') {
    users = users.filter(u => !u.student?.miniGroups || u.student.miniGroups.length === 0);
  }

  return users.map(u => u.email);
}

export async function processScheduledEmails(): Promise<number> {
  const now = new Date();

  const scheduledLogs = await prisma.adminLog.findMany({
    where: {
      action: 'SCHEDULED_EMAIL',
      entity: 'EMAIL'
    },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });

  const pendingEmails = scheduledLogs.filter(log => {
    const details = log.details as any;
    return details?.status === 'pending' && details?.scheduledAt;
  });

  if (pendingEmails.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const scheduledLog of pendingEmails) {
    const details = scheduledLog.details as any;
    const scheduledAt = new Date(details.scheduledAt);

    if (scheduledAt > now) {
      continue;
    }

    console.log(`[ScheduledEmail] Processing scheduled email: "${details.subject}" (scheduled for ${scheduledAt.toISOString()})`);

    try {
      let emails: string[];

      if (details.sendMode === 'manual') {
        emails = details.recipients || [];
      } else {
        emails = await buildStudentFilterQuery(details.rawFilters || {});
      }

      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const personalizedBody = await replaceEmailVariables(details.body, email);

        await prisma.emailJob.create({
          data: {
            to: email,
            subject: details.subject,
            body: personalizedBody,
            status: 'pending'
          }
        });

        try {
          await sendEmail(email, details.subject, personalizedBody);
          await prisma.emailJob.updateMany({
            where: { to: email, subject: details.subject, status: 'pending' },
            data: { status: 'sent', sentAt: new Date() }
          });
          sentCount++;
        } catch (emailError) {
          console.error(`[ScheduledEmail] Failed to send to ${email}:`, emailError);
          await prisma.emailJob.updateMany({
            where: { to: email, subject: details.subject, status: 'pending' },
            data: { status: 'failed', error: String(emailError) }
          });
          failedCount++;
        }

        if (i < emails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      await prisma.adminLog.update({
        where: { id: scheduledLog.id },
        data: {
          details: {
            ...details,
            status: 'sent',
            sentAt: new Date().toISOString(),
            actualRecipients: emails.length,
            sent: sentCount,
            failed: failedCount
          }
        }
      });

      await prisma.adminLog.create({
        data: {
          userId: scheduledLog.userId,
          action: details.sendMode === 'manual' ? 'SEND_EMAIL' : 'SEND_BULK_EMAIL',
          entity: 'EMAIL',
          details: {
            recipients: emails.length,
            sent: sentCount,
            failed: failedCount,
            subject: details.subject,
            filters: details.filters || {},
            rawFilters: details.rawFilters || {},
            scheduledEmailId: scheduledLog.id,
            isScheduled: true
          }
        }
      });

      console.log(`[ScheduledEmail] Sent ${sentCount}/${emails.length} emails for "${details.subject}"`);
      processedCount++;
    } catch (error) {
      console.error(`[ScheduledEmail] Error processing scheduled email ${scheduledLog.id}:`, error);

      await prisma.adminLog.update({
        where: { id: scheduledLog.id },
        data: {
          details: {
            ...details,
            status: 'error',
            error: String(error)
          }
        }
      });
    }
  }

  return processedCount;
}

let emailIntervalId: NodeJS.Timeout | null = null;

export function startScheduledEmailJob(): void {
  if (emailIntervalId) {
    console.log('[ScheduledEmail] Job already running');
    return;
  }

  console.log('[ScheduledEmail] Starting scheduled email job (checks every minute)');

  processScheduledEmails().catch(console.error);

  emailIntervalId = setInterval(async () => {
    try {
      const count = await processScheduledEmails();
      if (count > 0) {
        console.log(`[ScheduledEmail] Processed ${count} scheduled emails`);
      }
    } catch (error) {
      console.error('[ScheduledEmail] Error in scheduled job:', error);
    }
  }, 60 * 1000);
}

export function stopScheduledEmailJob(): void {
  if (emailIntervalId) {
    clearInterval(emailIntervalId);
    emailIntervalId = null;
    console.log('[ScheduledEmail] Stopped scheduled email job');
  }
}
