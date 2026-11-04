import Compare from "@/components/compare/Compare";
import { getContent } from "@/lib/content";
export const dynamic = "force-dynamic";
export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <Compare locale={locale} copy={await getContent(locale)} />;
}
