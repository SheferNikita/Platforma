import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.EXTERNAL_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('EXTERNAL_DATABASE_URL environment variable is required. All data must persist in external TimeWeb database.');
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});
