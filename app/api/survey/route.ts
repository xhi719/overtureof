import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { questionIsVisible } from "@/lib/survey-conditions";
import { readBoundedJson, surveyRequestLimiter } from "@/lib/request-guards";

export const dynamic = "force-dynamic";
const MAX_BODY = 30000;
export async function POST(request: NextRequest) {
  if(!surveyRequestLimiter.allow())return NextResponse.json({code:"UNAVAILABLE"},{status:429,headers:{"Cache-Control":"no-store","Retry-After":"60"}});
  try {
    const parsed=await readBoundedJson(request,MAX_BODY);
    if(!parsed.ok)return NextResponse.json({code:"INVALID"},{status:parsed.status,headers:{"Cache-Control":"no-store"}});
    const body=parsed.value as Record<string, any> | null;
    if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({code:"INVALID"},{status:400});
    if (body.consent !== true || typeof body.occupationId !== "string" || typeof body.questionnaireId !== "string" || typeof body.policyVersion !== "string" || typeof body.policyLocale !== "string" || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return NextResponse.json({ code: "CONSENT_REQUIRED" }, { status: 400 });
    const policy = await prisma.legalDocument.findFirst({ where: { key: "research-consent", locale: body.policyLocale, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } });
    if (!policy || policy.version !== body.policyVersion) return NextResponse.json({ code: "POLICY_REQUIRED" }, { status: 400 });
    const form = await prisma.questionnaire.findFirst({ where: { id: body.questionnaireId, status: "published", OR: [{ occupationId: body.occupationId }, { occupationId: null }] }, include: { questions: { include: { options: true } } } });
    if (!form || !(await prisma.occupation.findUnique({ where: { id: body.occupationId }, select: { id: true } }))) return NextResponse.json({ code: "INVALID" }, { status: 400 });
    const ids = new Set(form.questions.map(q => q.id));
    if (Object.keys(body.answers).some(id => !ids.has(id))) return NextResponse.json({ code: "INVALID" }, { status: 400 });
    const byKey = Object.fromEntries(form.questions.map(q => [q.key, q.id]));
    const rows: { questionId: string; value: string | string[] | number }[] = [];
    for (const q of form.questions) {
      const shown = questionIsVisible(q.condition, body.answers, byKey);
      const value = body.answers[q.id];
      if (!shown) { if (value !== undefined) return NextResponse.json({ code: "INVALID" }, { status: 400 }); continue; }
      if (value === undefined || (Array.isArray(value) && value.length === 0)) { if (q.required) return NextResponse.json({ code: "INVALID" }, { status: 400 }); continue; }
      const allowed = new Set(q.options.map(o => o.value));
      const type = q.type.toLowerCase();
      const valid = type === "range" ? typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 : type === "multiple" ? Array.isArray(value) && value.length <= allowed.size && new Set(value).size === value.length && value.every(v => typeof v === "string" && allowed.has(v)) : type === "single" && typeof value === "string" && allowed.has(value);
      if (!valid) return NextResponse.json({ code: "INVALID" }, { status: 400 });
      rows.push({ questionId: q.id, value });
    }
    const deletionToken = randomBytes(32).toString("base64url");
    const deletionTokenHash = createHash("sha256").update(deletionToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.$transaction(async tx => {
      const consent = await tx.consentRecord.create({ data: { purpose: "research", policyVersion: body.policyVersion, policyLocale: body.policyLocale, deletionTokenHash } });
      await tx.surveySession.create({ data: { occupationId: body.occupationId, questionnaireId: form.id, consentRecordId: consent.id, expiresAt, responses: { create: rows } } });
    });
    return NextResponse.json({ deletionToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { console.error("survey_save_failed"); return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 }); }
}



