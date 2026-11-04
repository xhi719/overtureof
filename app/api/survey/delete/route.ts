import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { readBoundedJson, surveyDeleteLimiter } from "@/lib/request-guards";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if(!surveyDeleteLimiter.allow())return NextResponse.json({code:"UNAVAILABLE"},{status:429,headers:{"Cache-Control":"no-store","Retry-After":"60"}});
  try {
    const parsed=await readBoundedJson(request,2048);
    if(!parsed.ok)return NextResponse.json({code:"INVALID"},{status:parsed.status,headers:{"Cache-Control":"no-store"}});
    if(!parsed.value||typeof parsed.value!=="object"||Array.isArray(parsed.value))return NextResponse.json({code:"INVALID"},{status:400});
    const { token }=parsed.value as {token?:unknown};
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({ code: "INVALID" }, { status: 400 });
    const deletionTokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.$transaction(async tx => {
      const record = await tx.consentRecord.findUnique({ where: { deletionTokenHash }, select: { id: true } });
      if (record) {
        await tx.surveySession.deleteMany({ where: { consentRecordId: record.id } });
        await tx.consentRecord.delete({ where: { id: record.id } });
      }
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { console.error("survey_delete_failed"); return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 }); }
}
