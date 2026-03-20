import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.EXTERNAL_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('EXTERNAL_DATABASE_URL environment variable is required. All data must persist in external TimeWeb database.');
}

const pooledUrl = new URL(databaseUrl);
pooledUrl.searchParams.set('connection_limit', '20');
pooledUrl.searchParams.set('pool_timeout', '30');

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: pooledUrl.toString(),
    },
  },
});

async function runMigrations() {
  try {
    await prisma.$executeRaw`ALTER TABLE "ScheduleEvent" ADD COLUMN IF NOT EXISTS "allowedTariffs" TEXT[] DEFAULT '{}'`;
  } catch (e) {
  }
}
runMigrations();

setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
  }
}, 60000);
