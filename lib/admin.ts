import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
export function isAdmin(request: NextRequest): boolean {
  const configured = process.env.ADMIN_TOKEN;
  const header = request.headers.get('authorization');
  if (!configured || configured.length < 32 || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(configured); const b = Buffer.from(header.slice(7));
  return a.length === b.length && timingSafeEqual(a, b);
}
