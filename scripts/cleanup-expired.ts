import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  await db.$transaction(async tx => {
    const expired = await tx.surveySession.findMany({ where: { expiresAt: { lte: new Date() } }, select: { consentRecordId: true } });
    await tx.surveySession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const ids = expired.flatMap(row => row.consentRecordId ? [row.consentRecordId] : []);
    await tx.consentRecord.deleteMany({ where: { id: { in: ids }, sessions: { none: {} } } });
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
