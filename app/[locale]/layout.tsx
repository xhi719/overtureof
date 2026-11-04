import type { Metadata } from 'next';
import { getContent } from '@/lib/content';
import { SiteHeader } from '@/components/SiteHeader';
import { FrontierWatermark } from '@/components/FrontierWatermark';

export const dynamic = 'force-dynamic';
type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = await getContent(locale);
  return { title: c['site.name'], description: c['site.description'] };
}
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const c = await getContent(locale);
  return <><SiteHeader locale={locale} c={c} />{children}<FrontierWatermark /></>;
}
