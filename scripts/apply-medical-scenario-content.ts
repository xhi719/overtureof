import { PrismaClient } from '@prisma/client';
import ko from '../content/ko.json';
import en from '../content/en.json';
import zhCN from '../content/zh-CN.json';
import zhTW from '../content/zh-TW.json';

const db = new PrismaClient();
const translations = { ko, en, 'zh-CN': zhCN, 'zh-TW': zhTW };

async function main() {
  await db.$transaction(async tx => {
    const key = await tx.contentKey.upsert({ where: { key: 'method.medicalAcceleration' }, create: { key: 'method.medicalAcceleration' }, update: {} });
    for (const [locale, content] of Object.entries(translations)) {
      const previous = await tx.contentLocalization.findUnique({ where: { contentKeyId_locale: { contentKeyId: key.id, locale } } });
      const value = content['method.medicalAcceleration'];
      if (previous?.value === value) continue;
      const updated = await tx.contentLocalization.upsert({ where: { contentKeyId_locale: { contentKeyId: key.id, locale } }, create: { contentKeyId: key.id, locale, value }, update: { value } });
      await tx.adminAuditLog.create({ data: { actor: 'local-edit', action: 'update', entity: 'content_localization', entityId: updated.id, details: { key: key.key, locale, previous: previous?.value ?? null, current: value } } });
    }
  });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
