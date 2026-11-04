import ko from '@/content/ko.json';
import en from '@/content/en.json';
import zhCN from '@/content/zh-CN.json';
import zhTW from '@/content/zh-TW.json';
import { prisma } from '@/lib/db';

export type Content = Record<string, string>;
const resources: Record<string, Content> = { ko, en, 'zh-CN': zhCN, 'zh-TW': zhTW };
export async function getContent(locale: string): Promise<Content> {
  const language = resources[locale] ? locale : 'ko';
  const content: Content = { ...ko, ...resources[language] };
  try {
    const keys = await prisma.contentKey.findMany({ include: { localizations: true } });
    for (const item of keys) {
      const translation = item.localizations.find((entry: { locale: string }) => entry.locale === language)
        ?? item.localizations.find((entry: { locale: string }) => entry.locale === 'ko');
      if (translation) content[item.key] = translation.value;
      else console.error(`Missing content localization: ${item.key}`);
    }
  } catch (error) {
    console.error('Unable to load database content:', error);
  }
  return content;
}
