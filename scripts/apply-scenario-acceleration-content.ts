import { PrismaClient } from '@prisma/client';
import ko from '../content/ko.json';
import en from '../content/en.json';
import zhCN from '../content/zh-CN.json';
import zhTW from '../content/zh-TW.json';

const db = new PrismaClient();
const translations = { ko, en, 'zh-CN': zhCN, 'zh-TW': zhTW };

async function main() {
  await db.$transaction(async tx => {
    const key = await tx.contentKey.findUniqueOrThrow({ where: { key: 'scenario.modelTime' } });
    for (const [locale, content] of Object.entries(translations)) {
      const previous = await tx.contentLocalization.findUniqueOrThrow({ where: { contentKeyId_locale: { contentKeyId: key.id, locale } } });
      const value = content['scenario.modelTime'];
      if (previous.value === value) continue;
      await tx.contentLocalization.update({ where: { id: previous.id }, data: { value } });
      await tx.adminAuditLog.create({ data: { actor: 'local-edit', action: 'update', entity: 'content_localization', entityId: previous.id, details: { key: key.key, locale, previous: previous.value, current: value } } });
    }
  });
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
