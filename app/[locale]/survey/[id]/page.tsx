import Survey from "@/components/survey/Survey";
import { getContent } from "@/lib/content";
export const dynamic = "force-dynamic";
export default async function SurveyPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const copy = await getContent(locale);
  return <Survey occupationId={id} locale={locale} copy={copy} />;
}
