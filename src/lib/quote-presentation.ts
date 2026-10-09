import { z } from "zod";

export const optionCopySchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  details: z.array(z.string()).optional(),
  tag: z.string().trim().min(1).optional(),
}).strict();
export const itemCopySchema = z.object({
  description: z.string().trim().min(1).optional(),
  hiddenOnQuote: z.boolean().optional(),
}).strict();
export const presentationSchema = z.object({
  options: z.record(z.string(), optionCopySchema).optional(),
  items: z.record(z.string(), itemCopySchema).optional(),
  sectionOrder: z.array(z.enum(["intro", "content", "approach", "visuals", "pricing", "modules", "terms", "sources"])).length(8).refine((value) => new Set(value).size === 8, "Elke sectie moet precies eenmaal voorkomen").optional(),
}).strict();

export function readPresentation(commercial: unknown) {
  const object = commercial && typeof commercial === "object" && !Array.isArray(commercial)
    ? commercial as Record<string, unknown> : {};
  const parsed = presentationSchema.safeParse(object.presentation);
  return parsed.success ? parsed.data : {};
}

/** Commerciële teksten overschrijven alleen de presentatie, nooit bronprijzen. */
export function applyOptionCopy<T extends { id: string; t: string; d: string; details?: string[]; tag?: string }>(
  options: T[], commercial: unknown,
): T[] {
  const copy = readPresentation(commercial).options ?? {};
  return options.map((option) => {
    const override = copy[option.id];
    if (!override) return option;
    return { ...option,
      ...(override.title !== undefined ? { t: override.title } : {}),
      ...(override.description !== undefined ? { d: override.description } : {}),
      ...(override.details !== undefined ? { details: override.details } : {}),
      ...(override.tag !== undefined ? { tag: override.tag } : {}),
    };
});
}

export function applyItemCopy<T extends { id?: string; description: string; qty: unknown; unitPrice: unknown; vatRate: unknown }>(
  items: T[], commercial: unknown,
): T[] {
  const copy = readPresentation(commercial).items ?? {};
  return items.map((item) => {
    const override = item.id ? copy[item.id] : undefined;
    if (!override) return item;
    // Verbergen van details is geen korting: de prijs blijft als neutrale post zichtbaar.
    if (override.hiddenOnQuote) return { ...item, description: "Inbegrepen materialen en werkzaamheden", qty: 1, unitPrice: Number(item.qty) * Number(item.unitPrice) };
    return { ...item, ...(override.description !== undefined ? { description: override.description } : {}) };
  });
}
