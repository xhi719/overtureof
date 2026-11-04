import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { return NextResponse.json(await prisma.researchSource.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })); }
  catch (e) { console.error('admin_research_read_failed', e); return NextResponse.json({ error: 'database_unavailable' }, { status: 503 }); }
}
export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.id !== 'string' || !['approved','rejected'].includes(body.status)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    await prisma.$transaction(async tx => {
      await tx.researchSource.update({ where: { id: body.id }, data: { status: body.status, reviewedAt: new Date() } });
      await tx.adminAuditLog.create({ data: { actor: 'admin', action: body.status, entity: 'research_source', entityId: body.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { console.error('admin_research_review_failed', e); return NextResponse.json({ error: 'operation_failed' }, { status: 500 }); }
}
