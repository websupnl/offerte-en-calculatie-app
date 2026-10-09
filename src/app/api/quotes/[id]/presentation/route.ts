import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { optionCopySchema, itemCopySchema, readPresentation, presentationSchema } from "@/lib/quote-presentation";
import { applyCalculationPricing } from "@/lib/quote-with-pricing";
import { modulesToOptions } from "@/lib/quote-modules";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import type { Prisma } from "@/generated/prisma/client";
import { validateArtifactHtml } from "../../../../../../mcp-server/src/artifacts";

const schema = z.object({
  fields: z.object({ title: z.string().trim().min(1).optional(), category: z.string().optional(), tagline: z.string().optional(),
    intro: z.string().optional(), outro: z.string().optional(), itemsHeader: z.string().optional(),
    hiddenSections: z.array(z.enum(["content", "approach", "visuals", "modules", "terms", "sources"])).optional(),
  }).strict().optional(),
  option: z.object({ id: z.string().min(1), changes: optionCopySchema.optional(), reset: z.boolean().optional() }).strict().optional(),
  item: z.object({ id: z.string().min(1), changes: itemCopySchema.optional(), reset: z.boolean().optional() }).strict().optional(),
  deleteBlockId: z.string().min(1).optional(),
  block: z.object({ id: z.string().min(1), changes: z.object({ title: z.string().optional(), body: z.string().optional(), items: z.array(z.unknown()).optional(), tone: z.enum(["info", "warning", "success"]).optional(), imageUrl: z.string().url().optional(), caption: z.string().optional() }).strict() }).strict().optional(),
  sectionOrder: presentationSchema.shape.sectionOrder,
  image: z.object({ url: z.string().url().refine((url) => url.startsWith("https://"), "Gebruik een HTTPS-afbeelding"), title: z.string().optional(), caption: z.string().optional() }).strict().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "Geef wijzigingen op");

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({ where: { id, companyId: session.user.activeCompanyId }, include: {
      items: true, modules: true, contentBlocks: { orderBy: { sortOrder: "asc" } },
      calculations: { where: { archivedAt: null }, include: { items: true } },
    } });
    if (!quote) return { status: 404, error: "Offerte niet gevonden" };
    if (quote.status === "ACCEPTED") return { status: 409, error: "Een geaccepteerde offerte is vergrendeld" };
    const shape = applyCalculationPricing({ ...quote, options: modulesToOptions(quote.modules) });
    const commercial = quote.commercial && typeof quote.commercial === "object" && !Array.isArray(quote.commercial)
      ? quote.commercial as Record<string, Prisma.JsonValue> : {};
    const presentation = readPresentation(commercial);
    const { option, item, deleteBlockId, image, fields } = parsed.data;
    if (parsed.data.sectionOrder) presentation.sectionOrder = parsed.data.sectionOrder;
    if (option) {
      if (!shape.options.some((row) => row.id === option.id)) return { status: 404, error: "Optioneel meerwerk niet gevonden in deze offerte" };
      const overrides = { ...presentation.options };
      if (option.reset) delete overrides[option.id];
      else overrides[option.id] = { ...overrides[option.id], ...option.changes };
      presentation.options = overrides;
    }
    if (item) {
      if (!shape.items.some((row) => row.id === item.id)) return { status: 404, error: "Offertepost niet gevonden in deze offerte" };
      const overrides = { ...presentation.items };
      if (item.reset) delete overrides[item.id];
      else overrides[item.id] = { ...overrides[item.id], ...item.changes };
      presentation.items = overrides;
    }
    if (deleteBlockId && !quote.contentBlocks.some((block) => block.id === deleteBlockId)) return { status: 404, error: "Inhoudsblok niet gevonden in deze offerte" };
    if (parsed.data.block) {
      const current = quote.contentBlocks.find((block) => block.id === parsed.data.block!.id);
      if (!current) return { status: 404, error: "Inhoudsblok niet gevonden in deze offerte" };
      if (current.type === "html" && parsed.data.block.changes.body !== undefined) {
        const errors = validateArtifactHtml(parsed.data.block.changes.body);
        if (errors.length) return { status: 422, error: errors.join("\n") };
      }
    }
    // Geschiedenis van presentatiewijzigingen, zonder calculaties of prijsdata terug te zetten.
    await tx.quoteEvent.create({ data: { quoteId: id, type: "PRESENTATION_VERSION", actor: session.user.id,
      detail: JSON.stringify({ fields: { title: quote.title, category: quote.category, tagline: quote.tagline, intro: quote.intro, outro: quote.outro, itemsHeader: quote.itemsHeader, hiddenSections: quote.hiddenSections }, commercial: quote.commercial, contentBlocks: quote.contentBlocks }),
    } });
    if (deleteBlockId) await tx.quoteContentBlock.delete({ where: { id: deleteBlockId } });
    if (parsed.data.block) {
      const { items, ...changes } = parsed.data.block.changes;
      await tx.quoteContentBlock.update({ where: { id: parsed.data.block.id }, data: { ...changes, ...(items !== undefined ? { items: items as Prisma.InputJsonValue } : {}) } });
    }
    if (image) await tx.quoteContentBlock.create({ data: { quoteId: id, type: "image", imageUrl: image.url, title: image.title, caption: image.caption, sortOrder: Math.max(-1, ...quote.contentBlocks.map((block) => block.sortOrder)) + 1 } });
    await tx.quote.update({ where: { id }, data: { ...fields, commercial: { ...commercial, presentation } as Prisma.InputJsonValue, pdfUrl: null } });
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
