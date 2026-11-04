import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { return NextResponse.json(await prisma.contentKey.findMany({ include: { localizations: true }, orderBy: { key: 'asc' } }), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { console.error('admin_content_read_failed', e); return NextResponse.json({ error: 'database_unavailable' }, { status: 503 }); }
}
export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.key !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(body.key) || !['ko','en','zh-CN','zh-TW'].includes(body.locale) || typeof body.value !== 'string' || !body.value.trim() || body.value.length > 10000) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    await prisma.$transaction(async tx => {
      const key = await tx.contentKey.upsert({ where: { key: body.key }, create: { key: body.key }, update: {} });
      await tx.contentLocalization.upsert({ where: { contentKeyId_locale: { contentKeyId: key.id, locale: body.locale } }, create: { contentKeyId: key.id, locale: body.locale, value: body.value }, update: { value: body.value } });
      await tx.adminAuditLog.create({ data: { actor: 'admin', action: 'update', entity: 'content_localization', entityId: key.id, details: { key: body.key, locale: body.locale } } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { console.error('admin_content_write_failed', e); return NextResponse.json({ error: 'database_unavailable' }, { status: 503 }); }
}
