import { getContent } from '@/lib/content';
import Admin from '@/components/admin/Admin';
export const dynamic = 'force-dynamic';
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <main className="inner-page"><Admin copy={await getContent(locale)} /></main>;
}
