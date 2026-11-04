import { getContent } from '@/lib/content';
import { OccupationDetail } from '@/components/OccupationDetail';
export const dynamic = 'force-dynamic';
export default async function DetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ label?: string | string[] }> }) {
  const { locale, id } = await params;
  const selection = await searchParams;
  const c = await getContent(locale);
  return <OccupationDetail locale={locale} id={id} labelId={typeof selection.label === 'string' ? selection.label : undefined} c={c} />;
}
