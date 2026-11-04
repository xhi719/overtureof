import { PrismaClient } from '@prisma/client';
const globalDb = globalThis as unknown as { frontierPrisma?: PrismaClient };
export const prisma = globalDb.frontierPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.frontierPrisma = prisma;
