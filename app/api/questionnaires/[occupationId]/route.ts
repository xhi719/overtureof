import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ occupationId: string }> }) {
  const { occupationId } = await params;
  const locale = request.nextUrl.searchParams.get("locale") || "ko";
  try {
    const include = { questions: { orderBy: { order: "asc" as const }, include: { translations: true, options: { orderBy: { order: "asc" as const }, include: { translations: true } } } } };
    const occupation = await prisma.occupation.findUnique({ where: { id: occupationId }, select: { id: true } });
    if (!occupation) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    const questionnaire = await prisma.questionnaire.findFirst({ where: { occupationId, status: "published" }, include }) || await prisma.questionnaire.findFirst({ where: { occupationId: null, status: "published" }, include });
    if (!questionnaire) return NextResponse.json(null);
    const translate = (items: { locale: string; text: string; optionId: string | null }[], optionId: string | null) => {
      const list = items.filter(t => t.optionId === optionId);
      const found = list.find(t => t.locale === locale) || list.find(t => t.locale === "ko");
      if (!found?.text) throw new Error("MISSING_QUESTION_TRANSLATION");
      return found.text;
    };
    const policy = await prisma.legalDocument.findFirst({ where: { key: "research-consent", locale, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } }) || await prisma.legalDocument.findFirst({ where: { key: "research-consent", locale: "ko", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } });
    return NextResponse.json({ id: questionnaire.id, policy: policy ? { version: policy.version, locale: policy.locale, content: policy.content } : null, questions: questionnaire.questions.map(q => ({ id: q.id, key: q.key, type: q.type, required: q.required, condition: q.condition, text: translate(q.translations, null), options: q.options.map(o => ({ id: o.id, value: o.value, text: translate(o.translations, o.id) })) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("questionnaire_load_failed", error); return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 }); }
}

