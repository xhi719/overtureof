import { getContent } from '@/lib/content';
import ScenarioMethod from '@/components/ScenarioMethod';
export const dynamic = 'force-dynamic';
export default async function MethodPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return <ScenarioMethod locale={locale} id={id} c={await getContent(locale)} />;
}
