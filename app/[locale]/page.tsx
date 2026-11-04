import { getContent } from '@/lib/content';
import { Intro } from '@/components/Intro';
import './intro.css';

export const dynamic = 'force-dynamic';
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <Intro locale={locale} c={await getContent(locale)} />;
}
