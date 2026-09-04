import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { QuoteOption } from "@/lib/quote-selection";

/**
 * Modules en optioneel meerwerk staan sinds september 2026 in de tabel QuoteModule
 * in plaats van in de `Quote.options` JSON. Als blob werd bij elke schrijfactie de
 * hele array vervangen, waardoor een schrijver die een veld niet kende het wiste.
 *
 * De rest van de app (preview, PDF, portaal) leest nog steeds een `options`-array,
 * dus die vorm houden we hier in stand.
 */

export type QuoteModuleRow = {
  key: string;
  title: string;
  summary: string;
  tag: string;
  price: Prisma.Decimal | number | null;
  recurringPrice: Prisma.Decimal | number | null;
  recurringInterval: string | null;
  vatRate: Prisma.Decimal | number;
  required: boolean;
  defaultSelected: boolean;
  details: unknown;
  technicalCondition: string | null;
};

const num = (value: Prisma.Decimal | number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/** Zet databaserijen om naar de `options`-vorm die de rest van de app verwacht. */
export function modulesToOptions(modules: QuoteModuleRow[]): QuoteOption[] {
  return modules.map((m) => ({
    id: m.key,
    t: m.title,
    d: m.summary,
    tag: m.tag,
    price: num(m.price),
    recurringPrice: num(m.recurringPrice),
    recurringInterval: (m.recurringInterval as "maand" | "jaar" | null) ?? null,
    vatRate: Number(m.vatRate) || 21,
    required: m.required,
    defaultSelected: m.defaultSelected,
    details: Array.isArray(m.details) ? (m.details as string[]) : [],
    technicalCondition: m.technicalCondition ?? undefined,
  }));
}

/**
 * Slaat de modules van één offerte op. Bestaande modules worden per `key` bijgewerkt
 * en modules die niet meer in de lijst staan verdwijnen, zodat verwijderen blijft werken.
 * Velden die de aanroeper niet meestuurt blijven staan: dat is precies het verschil
 * met de oude blob, waar een onbekend veld stilzwijgend werd gewist.
 */
export async function saveQuoteModules(quoteId: string, options: QuoteOption[]): Promise<void> {
  const keys = options.map((option) => option.id).filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.quoteModule.deleteMany({
      where: { quoteId, ...(keys.length ? { key: { notIn: keys } } : {}) },
    });

    for (const [index, option] of options.entries()) {
      const data = {
        title: option.t,
        summary: option.d,
        tag: option.tag,
        price: option.price ?? null,
        recurringPrice: option.recurringPrice ?? null,
        recurringInterval: option.recurringInterval ?? null,
        vatRate: option.vatRate ?? 21,
        required: option.required ?? false,
        defaultSelected: option.defaultSelected ?? false,
        details: option.details ?? [],
        technicalCondition: option.technicalCondition ?? null,
        sortOrder: index,
      };
      await tx.quoteModule.upsert({
        where: { quoteId_key: { quoteId, key: option.id } },
        create: { quoteId, key: option.id, ...data },
        update: data,
      });
    }
  });
}

/** Prisma-include om modules in de juiste volgorde mee te laden. */
export const quoteModulesInclude = {
  orderBy: { sortOrder: "asc" },
} as const;
