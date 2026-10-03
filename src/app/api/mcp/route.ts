import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import catalog from '@/lib/mcp-catalog.json';
import { matchMcpRoute, validMcpKey } from '@/lib/mcp-access';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  return validMcpKey(req.headers.get('authorization'), process.env.MCP_APP_KEY);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ version: '2.0.0', routes: catalog });
}

const schema = z.object({
  company_slug: z.string().min(1),
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  body: z.unknown().optional(),
  files: z.array(z.object({ field: z.string().min(1), name: z.string().min(1), mime: z.string(), base64: z.string().max(14_000_000) })).max(10).optional(),
});

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (!matchMcpRoute(input.path, input.method, catalog)) return NextResponse.json({ error: 'Unknown app operation. Refresh get_app_capabilities.' }, { status: 400 });
  const userId = process.env.MCP_USER_ID;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!userId || !secret) return NextResponse.json({ error: 'Configure MCP_USER_ID and AUTH_SECRET on the app.' }, { status: 503 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
  if (!user) return NextResponse.json({ error: 'MCP user not found' }, { status: 403 });
  const memberships = await prisma.companyUser.findMany({ where: { userId }, include: { company: { select: { id: true, name: true, slug: true } } } });
  const membership = memberships.find(m => m.company.slug === input.company_slug);
  if (!membership) return NextResponse.json({ error: 'No access to this company' }, { status: 403 });
  // Native JWT authentication keeps every existing API's company and private scope checks.
  const origin = process.env.MCP_INTERNAL_APP_URL || req.nextUrl.origin;
  const target = new URL(input.path, origin);
  for (const [key, value] of Object.entries(input.query ?? {})) target.searchParams.set(key, String(value));
  const secure = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || target.origin).protocol === 'https:';
  const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const token = await encode({ secret, salt: cookieName, maxAge: 300, token: {
    sub: user.id, id: user.id, name: user.name, email: user.email, role: user.role,
    activeCompanyId: membership.company.id,
    companies: memberships.map(m => ({ ...m.company, role: m.role })),
  } });
  const headers = new Headers({ cookie: `${cookieName}=${token}` });
  let body: BodyInit | undefined;
  if (input.method !== 'GET') {
    if (input.files?.length) {
      const form = new FormData();
      if (input.body && typeof input.body === 'object') for (const [key, value] of Object.entries(input.body)) form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      for (const file of input.files) form.append(file.field, new Blob([new Uint8Array(Buffer.from(file.base64, 'base64'))], { type: file.mime }), file.name);
      body = form;
    } else if (input.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(input.body);
    }
  }
  try {
    const response = await fetch(target, { method: input.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(120_000) });
    const type = response.headers.get('content-type') || '';
    if (response.status >= 300 && response.status < 400) return NextResponse.json({ error: 'App redirected the request. Check authentication and app URL.' }, { status: 502 });
    const data = type.includes('application/json') ? await response.json() : type.startsWith('text/') ? await response.text() : { mime: type, base64: Buffer.from(await response.arrayBuffer()).toString('base64') };
    return NextResponse.json({ status: response.status, data }, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error('[MCP app gateway]', error);
    return NextResponse.json({ error: 'App request failed or timed out' }, { status: 502 });
  }
}
