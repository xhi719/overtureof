import { PrismaClient } from '@prisma/client';
import ko from '../content/ko.json';
import en from '../content/en.json';
import zhCN from '../content/zh-CN.json';
import zhTW from '../content/zh-TW.json';

const db = new PrismaClient();
const translations: Record<string, Record<string, string>> = { ko, en, 'zh-CN': zhCN, 'zh-TW': zhTW };
async function main() {
  await db.$transaction(async tx => {
    for (const name of ['scenario.countdown', 'method.time']) {
      const key = await tx.contentKey.findUniqueOrThrow({ where: { key: name } });
      for (const [locale, content] of Object.entries(translations)) {
        const previous = await tx.contentLocalization.findUniqueOrThrow({ where: { contentKeyId_locale: { contentKeyId: key.id, locale } } });
        const value = content[name];
        if (previous.value === value) continue;
        await tx.contentLocalization.update({ where: { id: previous.id }, data: { value } });
        await tx.adminAuditLog.create({ data: { actor: 'local-edit', action: 'update', entity: 'content_localization', entityId: previous.id, details: { key: name, locale, previous: previous.value, current: value } } });
      }
    }
  });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
