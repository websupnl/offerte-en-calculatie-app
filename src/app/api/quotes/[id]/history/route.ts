import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import type { Prisma } from "@/generated/prisma/client";

const restoreSchema = z.object({ versionId: z.string().min(1) }).strict();
const snapshotSchema = z.object({
  fields: z.object({ title: z.string().nullable(), category: z.string().nullable(), tagline: z.string().nullable(), intro: z.string().nullable(), outro: z.string().nullable(), itemsHeader: z.string().nullable(), hiddenSections: z.array(z.string()) }),
  commercial: z.unknown(),
  contentBlocks: z.array(z.object({ id: z.string(), type: z.string(), title: z.string().nullable(), body: z.string().nullable(), items: z.unknown(), tone: z.string().nullable(), imageUrl: z.string().nullable(), caption: z.string().nullable(), sortOrder: z.number().int() })),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await prisma.quote.findFirst({ where: { id, companyId: session.user.activeCompanyId }, select: { id: true } })) return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  const events = await prisma.quoteEvent.findMany({ where: { quoteId: id, type: "PRESENTATION_VERSION" }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ scope: "Presentatieversies vastgelegd via patch_quote en de nieuwe gerichte presentatieacties. Prijzen en calculaties worden niet teruggezet.", versions: events.map((event) => ({ id: event.id, createdAt: event.createdAt, actor: event.actor, snapshot: event.detail ? JSON.parse(event.detail) : null })) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const input = restoreSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: input.error.flatten() }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({ where: { id, companyId: session.user.activeCompanyId }, include: { contentBlocks: true } });
    if (!quote) return { status: 404, error: "Offerte niet gevonden" };
    if (quote.status === "ACCEPTED") return { status: 409, error: "Een geaccepteerde offerte is vergrendeld" };
    const version = await tx.quoteEvent.findFirst({ where: { id: input.data.versionId, quoteId: id, type: "PRESENTATION_VERSION" } });
    if (!version?.detail) return { status: 404, error: "Presentatieversie niet gevonden" };
    let raw: unknown;
    try { raw = JSON.parse(version.detail); } catch { return { status: 422, error: "Deze versie is beschadigd" }; }
    const parsed = snapshotSchema.safeParse(raw);
    if (!parsed.success) return { status: 422, error: "Deze versie kan niet worden hersteld" };
    await tx.quoteEvent.create({ data: { quoteId: id, type: "PRESENTATION_VERSION", actor: session.user.id, detail: JSON.stringify({ fields: { title: quote.title, category: quote.category, tagline: quote.tagline, intro: quote.intro, outro: quote.outro, itemsHeader: quote.itemsHeader, hiddenSections: quote.hiddenSections }, commercial: quote.commercial, contentBlocks: quote.contentBlocks }) } });
    await tx.quoteContentBlock.deleteMany({ where: { quoteId: id } });
    for (const block of parsed.data.contentBlocks) await tx.quoteContentBlock.create({ data: { ...block, quoteId: id, items: (block.items ?? []) as Prisma.InputJsonValue } });
    await tx.quote.update({ where: { id }, data: { ...parsed.data.fields, commercial: (parsed.data.commercial ?? {}) as Prisma.InputJsonValue, pdfUrl: null } });
    await tx.quoteShare.updateMany({ where: { quoteId: id }, data: { portalPdfUrl: null } });
    return { status: 200, ok: true };
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return { status: 409, error: "De offerte is ondertussen gewijzigd. Lees haar opnieuw en probeer nogmaals." };
    throw error;
  });
  if (result.status === 200) {
    const host = req.headers.get("host") ?? "localhost:3001";
    const cookie = req.headers.get("cookie") ?? "";
    after(async () => { await generateAndStorePdf(id, host, cookie); });
  }
  return NextResponse.json(result, { status: result.status });
}
