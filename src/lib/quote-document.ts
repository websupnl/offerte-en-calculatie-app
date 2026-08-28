import { z } from "zod";

const httpUrlSchema = z.string().url().refine(
  (value) => value.startsWith("https://") || value.startsWith("http://"),
  "Gebruik een http- of https-link",
);

export const quoteSourceSchema = z.object({
  id: z.string().min(1),
  url: httpUrlSchema,
  label: z.string().trim().min(1).max(80),
});

const blockBase = {
  id: z.string().min(1),
};

export const calculationSnapshotSchema = z.object({
  calculationId: z.string().min(1),
  number: z.string(),
  title: z.string(),
  syncedAt: z.string(),
  totalSalesPrice: z.number().nonnegative(),
  vatRate: z.number().nonnegative(),
  items: z.array(z.object({
    id: z.string(),
    description: z.string(),
    qty: z.number(),
    unit: z.string(),
    unitPrice: z.number().nonnegative(),
    vatRate: z.number().nonnegative(),
    optional: z.boolean(),
    hiddenOnQuote: z.boolean(),
  })),
});

export const quoteDocumentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    ...blockBase,
    type: z.literal("hero"),
    eyebrow: z.string().max(120),
    title: z.string().max(200),
    text: z.string().max(12_000),
  }),
  z.object({
    ...blockBase,
    type: z.literal("text"),
    title: z.string().max(200).optional(),
    text: z.string().max(20_000),
    tone: z.enum(["plain", "accent", "note"]).default("plain"),
    sources: z.array(quoteSourceSchema).default([]),
  }),
  z.object({
    ...blockBase,
    type: z.literal("list"),
    title: z.string().max(200),
    items: z.array(z.string().max(2_000)).max(50),
    tone: z.enum(["check", "info", "warning"]).default("check"),
  }),
  z.object({
    ...blockBase,
    type: z.literal("quoteItems"),
    title: z.string().max(200),
    showPrices: z.boolean().default(true),
  }),
  z.object({
    ...blockBase,
    type: z.literal("choices"),
    title: z.string().max(200),
  }),
  z.object({
    ...blockBase,
    type: z.literal("calculation"),
    title: z.string().max(200),
    description: z.string().max(4_000),
    snapshot: calculationSnapshotSchema,
    showItems: z.boolean().default(true),
  }),
  z.object({
    ...blockBase,
    type: z.literal("image"),
    url: z.string().min(1).max(4_000),
    alt: z.string().max(240),
    caption: z.string().max(1_000),
  }),
  z.object({
    ...blockBase,
    type: z.literal("signature"),
    title: z.string().max(200),
    text: z.string().max(4_000),
  }),
  z.object({
    ...blockBase,
    type: z.literal("pageBreak"),
  }),
]);

export const quoteDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(quoteDocumentBlockSchema).max(150),
});

export type QuoteSource = z.infer<typeof quoteSourceSchema>;
export type CalculationSnapshot = z.infer<typeof calculationSnapshotSchema>;
export type QuoteDocumentBlock = z.infer<typeof quoteDocumentBlockSchema>;
export type QuoteDocument = z.infer<typeof quoteDocumentSchema>;

export const quoteDocumentCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("insert"), index: z.number().int().nonnegative(), block: quoteDocumentBlockSchema }),
  z.object({ action: z.literal("replace"), blockId: z.string(), block: quoteDocumentBlockSchema }),
  z.object({ action: z.literal("move"), blockId: z.string(), index: z.number().int().nonnegative() }),
  z.object({ action: z.literal("remove"), blockId: z.string() }),
  z.object({ action: z.literal("duplicate"), blockId: z.string() }),
]);

export type QuoteDocumentCommand = z.infer<typeof quoteDocumentCommandSchema>;

export function createBlockId(prefix = "block") {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function parseQuoteDocument(value: unknown): QuoteDocument | null {
  const parsed = quoteDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createBlankQuoteDocument(title = "Persoonlijk voorstel"): QuoteDocument {
  return {
    schemaVersion: 1,
    blocks: [
      { id: createBlockId("hero"), type: "hero", eyebrow: "Persoonlijk voorstel", title, text: "" },
      { id: createBlockId("items"), type: "quoteItems", title: "Levering en werkzaamheden", showPrices: true },
      { id: createBlockId("sign"), type: "signature", title: "Klaar om te starten?", text: "Vragen of aanpassingen zijn altijd welkom." },
    ],
  };
}

type LegacyQuote = {
  title?: string | null;
  category?: string | null;
  intro?: string | null;
  outro?: string | null;
  assumptions?: unknown;
  technicalNotes?: unknown;
  customerResponsibilities?: unknown;
  exclusions?: unknown;
  choiceGroups?: unknown;
  options?: unknown;
  items?: unknown[];
  attachments?: Array<{ imageUrl?: string | null; title?: string | null; caption?: string | null }>;
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function legacyQuoteToDocument(quote: LegacyQuote): QuoteDocument {
  const blocks: QuoteDocumentBlock[] = [];
  blocks.push({
    id: createBlockId("hero"),
    type: "hero",
    eyebrow: quote.category?.trim() || "Persoonlijk voorstel",
    title: quote.title?.trim() || "Persoonlijk voorstel",
    text: quote.intro?.trim() || "",
  });

  if ((quote.items?.length ?? 0) > 0) {
    blocks.push({ id: createBlockId("items"), type: "quoteItems", title: "Levering en werkzaamheden", showPrices: true });
  }
  if (Array.isArray(quote.choiceGroups) && quote.choiceGroups.length > 0) {
    blocks.push({ id: createBlockId("choices"), type: "choices", title: "Kies de uitvoering die bij u past" });
  }

  const assumptions = [...stringList(quote.assumptions), ...stringList(quote.technicalNotes)];
  if (assumptions.length > 0) {
    blocks.push({ id: createBlockId("terms"), type: "list", title: "Technische uitgangspunten", items: assumptions, tone: "info" });
  }
  const responsibilities = stringList(quote.customerResponsibilities);
  if (responsibilities.length > 0) {
    blocks.push({ id: createBlockId("prep"), type: "list", title: "Voorbereiding", items: responsibilities, tone: "check" });
  }
  const exclusions = stringList(quote.exclusions);
  if (exclusions.length > 0) {
    blocks.push({ id: createBlockId("exclude"), type: "list", title: "Niet inbegrepen", items: exclusions, tone: "warning" });
  }

  const firstImage = quote.attachments?.find((attachment) => attachment.imageUrl?.trim());
  if (firstImage?.imageUrl) {
    blocks.push({
      id: createBlockId("image"),
      type: "image",
      url: firstImage.imageUrl,
      alt: firstImage.title || "Afbeelding bij de offerte",
      caption: firstImage.caption || "",
    });
  }

  blocks.push({
    id: createBlockId("sign"),
    type: "signature",
    title: "Klaar om te starten?",
    text: quote.outro?.trim() || "Hebt u vragen of wilt u iets aanpassen? Neem gerust contact op.",
  });

  return { schemaVersion: 1, blocks };
}

export function duplicateDocumentBlock(block: QuoteDocumentBlock): QuoteDocumentBlock {
  return { ...structuredClone(block), id: createBlockId(block.type) };
}

export function applyQuoteDocumentCommand(document: QuoteDocument, command: QuoteDocumentCommand): QuoteDocument {
  const blocks = [...document.blocks];
  if (command.action === "insert") {
    blocks.splice(Math.min(command.index, blocks.length), 0, command.block);
  } else if (command.action === "replace") {
    const index = blocks.findIndex((block) => block.id === command.blockId);
    if (index >= 0) blocks[index] = { ...command.block, id: command.blockId };
  } else if (command.action === "move") {
    const index = blocks.findIndex((block) => block.id === command.blockId);
    if (index >= 0) {
      const [block] = blocks.splice(index, 1);
      blocks.splice(Math.min(command.index, blocks.length), 0, block);
    }
  } else if (command.action === "remove") {
    return { ...document, blocks: blocks.filter((block) => block.id !== command.blockId) };
  } else if (command.action === "duplicate") {
    const index = blocks.findIndex((block) => block.id === command.blockId);
    if (index >= 0) blocks.splice(index + 1, 0, duplicateDocumentBlock(blocks[index]));
  }
  return quoteDocumentSchema.parse({ ...document, blocks });
}

export function sanitizeDocumentForTemplate(document: QuoteDocument): QuoteDocument {
  return {
    ...document,
    blocks: document.blocks.filter((block) => block.type !== "calculation").map(duplicateDocumentBlock),
  };
}
