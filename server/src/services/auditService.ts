import { prisma } from '../db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type EntityType = 
  | 'User' | 'Module' | 'Lesson' | 'LibraryItem' | 'ScheduleEvent' 
  | 'Community' | 'Contact' | 'Product' | 'Payment' | 'MiniGroup'
  | 'ModuleAccess' | 'EmailTemplate' | 'PlatformSetting' | 'DiaryEntry'
  | 'PersonalNote' | 'LessonQuestion' | 'Notification';

export interface AuditLogInput {
  userId: string | null;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

function calculateChanges(oldData: Record<string, any> | null | undefined, newData: Record<string, any> | null | undefined): Record<string, { old: any; new: any }> | null {
  if (!oldData || !newData) return null;
  
  const changes: Record<string, { old: any; new: any }> = {};
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    
    const oldVal = oldData[key];
    const newVal = newData[key];
    
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const changes = input.action === 'UPDATE' 
      ? calculateChanges(input.oldData, input.newData)
      : null;

    await prisma.$executeRaw`
      INSERT INTO "AuditLog" ("id", "userId", "action", "entityType", "entityId", "entityName", "oldData", "newData", "changes", "ipAddress", "userAgent", "metadata", "createdAt")
      VALUES (
        gen_random_uuid(),
        ${input.userId},
        ${input.action},
        ${input.entityType},
        ${input.entityId},
        ${input.entityName || null},
        ${input.oldData ? JSON.stringify(input.oldData) : null}::jsonb,
        ${input.newData ? JSON.stringify(input.newData) : null}::jsonb,
        ${changes ? JSON.stringify(changes) : null}::jsonb,
        ${input.ipAddress || null},
        ${input.userAgent || null},
        ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
        NOW()
      )
    `;
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  changes: Record<string, { old: any; new: any }> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  userName?: string;
  userEmail?: string;
}

export async function getAuditLogs(options: {
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { entityType, entityId, action, userId, startDate, endDate, limit = 50, offset = 0 } = options;
  
  let whereClause = 'WHERE 1=1';
  if (entityType) whereClause += ` AND a."entityType" = '${entityType}'`;
  if (entityId) whereClause += ` AND a."entityId" = '${entityId}'`;
  if (action) whereClause += ` AND a."action" = '${action}'`;
  if (userId) whereClause += ` AND a."userId" = '${userId}'`;
  if (startDate) whereClause += ` AND a."createdAt" >= '${startDate.toISOString()}'`;
  if (endDate) whereClause += ` AND a."createdAt" <= '${endDate.toISOString()}'`;
  
  const logs = await prisma.$queryRawUnsafe<AuditLogEntry[]>(`
    SELECT a.*, u.name as "userName", u.email as "userEmail"
    FROM "AuditLog" a
    LEFT JOIN "User" u ON a."userId" = u.id
    ${whereClause}
    ORDER BY a."createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT COUNT(*) as count FROM "AuditLog" a ${whereClause}
  `);
  
  return { logs, total: Number(countResult[0].count) };
}

export const entityTypeLabels: Record<EntityType, string> = {
  User: 'Пользователь',
  Module: 'Модуль',
  Lesson: 'Урок',
  LibraryItem: 'Библиотека',
  ScheduleEvent: 'Расписание',
  Community: 'Сообщество',
  Contact: 'Контакт',
  Product: 'Продукт',
  Payment: 'Платёж',
  MiniGroup: 'Мини-группа',
  ModuleAccess: 'Доступ к модулю',
  EmailTemplate: 'Email-шаблон',
  PlatformSetting: 'Настройка',
  DiaryEntry: 'Запись в дневнике',
  PersonalNote: 'Личная заметка',
  LessonQuestion: 'Вопрос к уроку',
  Notification: 'Уведомление'
};

export const actionLabels: Record<AuditAction, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  DELETE: 'Удаление'
};
