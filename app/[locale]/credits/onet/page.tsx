import Link from 'next/link';
import { getContent } from '@/lib/content';
export const dynamic = 'force-dynamic';
export default async function OnetCredits({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);
  return <main className="inner-page"><div className="container">
    <Link href={`/${locale}`} className="text-link">← {c['detail.back']}</Link>
    <section className="panel"><p>{c['detail.onetAttribution']}</p><p>{c['search.onetMachineTranslation']} <a className="text-link" href="https://github.com/Helsinki-NLP/Opus-MT" target="_blank" rel="noreferrer">{c['credits.translationModel']}</a></p><a className="text-link" href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer">{c['detail.onetDatabase']}</a>{' · '}<a className="text-link" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{c['detail.onetLicense']}</a></section>
  </div></main>;
}
