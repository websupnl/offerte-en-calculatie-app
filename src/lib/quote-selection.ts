import { z } from "zod";

export const selectableLineSchema = z.object({
  productId: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().min(1),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(21),
  indent: z.coerce.number().int().min(0).max(1).default(0),
  hiddenOnQuote: z.boolean().optional(),
});

export const quoteChoiceSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().optional(),
  title: z.string().trim().min(1),
  summary: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  // Foto per keuze (bijv. productafbeelding). Opgeslagen als storage-ref
  // (s3://bucket/key) of externe URL. `imageUrl` is een tijdelijke, resolvede
  // weergave-URL die nooit persistent wordt opgeslagen — hij wordt bij elke
  // render opnieuw afgeleid uit `image`.
  image: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  items: z.array(selectableLineSchema).min(1),
  // Koppeling naar een Calculation (los record, geen DB-relatie): als gezet,
  // is de Calculatie de bron van de prijzen en worden `items` vanuit daar
  // gesynchroniseerd i.p.v. handmatig bewerkt.
  calculationId: z.string().trim().optional(),
});

export const quoteChoiceGroupSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  type: z.literal("SINGLE_SELECT").default("SINGLE_SELECT"),
  description: z.string().trim().optional(),
  recommendedChoiceId: z.string().trim().optional(),
  choices: z.array(quoteChoiceSchema).min(2),
});

export const quoteOptionSchema = z.object({
  id: z.string().trim().min(1),
  t: z.string().trim().min(1),
  d: z.string().trim().min(1),
  tag: z.string().trim().min(1).default("Optioneel"),
  // Prijs is altijd EXCL. btw. null = "Op aanvraag" (geen vaste prijs, telt niet mee in de totalen).
  price: z.coerce.number().min(0).nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(21),
  required: z.boolean().optional(),
  details: z.array(z.string().trim().min(1)).optional().default([]),
  technicalCondition: z.string().trim().optional(),
});

export type QuoteChoice = z.infer<typeof quoteChoiceSchema>;
export type QuoteChoiceGroup = z.infer<typeof quoteChoiceGroupSchema>;
export type QuoteOption = z.infer<typeof quoteOptionSchema>;

export type BaseQuoteLine = {
  id?: string;
  productId?: string | null;
  description: string;
  qty: string | number;
  unitPrice: string | number;
  vatRate: string | number;
  total?: string | number;
  hiddenOnQuote?: boolean;
};

export type QuoteSelection = {
  selectedChoiceIds: Record<string, string>;
  selectedOptionIds: string[];
};

export type QuoteSelectionTotals = {
  totalExVat: number;
  totalVat: number;
  totalIncVat: number;
  baseExVat: number;
  choicesExVat: number;
  optionsExVat: number;
};

export type QuotePriceSummary = {
  hasChoices: boolean;
  minimum: QuoteSelectionTotals;
  maximum: QuoteSelectionTotals;
  recommended: QuoteSelectionTotals;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDutchMoney(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function getQuoteOptionRecurringInterval(option: Pick<QuoteOption, "tag"> & { d?: string }) {
  const text = `${option.tag ?? ""} ${option.d ?? ""}`;
  if (/per\s+maand|\/\s*maand|p\/m|maandelijks/i.test(text)) return "per maand";
  if (/per\s+jaar|\/\s*jaar|p\/j|jaarlijks/i.test(text)) return "per jaar";
  return null;
}

export function getQuoteOptionRecurringPrice(option: Pick<QuoteOption, "price" | "tag"> & { d?: string }) {
  const interval = getQuoteOptionRecurringInterval(option);
  if (!interval) return null;

  const tag = option.tag?.trim() ?? "";
  const matches = [...tag.matchAll(/€\s*([\d.,]+)/g)];
  for (const [matchIndex, match] of matches.entries()) {
    const index = match.index ?? 0;
    const nextIndex = matches[matchIndex + 1]?.index;
    const context = tag.slice(index, nextIndex ?? index + match[0].length + 40);
    if (/per\s+(maand|jaar)|\/\s*(maand|jaar)|p\/m|p\/j|maandelijks|jaarlijks/i.test(context)) {
      const price = parseDutchMoney(match[1]);
      if (price != null) return price;
    }
  }

  if (option.price != null && !/eenmalig/i.test(tag)) return Number(option.price);
  return null;
}

export function getQuoteOptionPrice(option: Pick<QuoteOption, "price" | "tag"> & { d?: string }) {
  const recurringInterval = getQuoteOptionRecurringInterval(option);
  if (option.price != null) {
    if (recurringInterval && !/eenmalig/i.test(option.tag ?? "")) return null;
    return Number(option.price);
  }

  const tag = option.tag?.trim() ?? "";
  if (!tag || /op aanvraag/i.test(tag)) return null;

  const matches = [...tag.matchAll(/€\s*([\d.,]+)/g)];
  if (matches.length === 0) return null;

  for (const match of matches) {
    const context = tag.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 24);
    if (/eenmalig/i.test(context)) return parseDutchMoney(match[1]);
  }

  if (recurringInterval) return null;
  return parseDutchMoney(matches[0][1]);
}

function lineAmounts(line: { qty: string | number; unitPrice: string | number; vatRate: string | number }) {
  const exVat = Number(line.qty) * Number(line.unitPrice);
  return { exVat, vat: exVat * (Number(line.vatRate) / 100) };
}

export function calculateQuoteSelectionTotals(
  items: BaseQuoteLine[],
  choiceGroups: QuoteChoiceGroup[],
  options: QuoteOption[],
  selection: QuoteSelection,
): QuoteSelectionTotals {
  let baseExVat = 0;
  let choicesExVat = 0;
  let optionsExVat = 0;
  let totalVat = 0;

  for (const item of items) {
    const amount = lineAmounts(item);
    baseExVat += amount.exVat;
    totalVat += amount.vat;
  }

  for (const group of choiceGroups) {
    const choice = group.choices.find((candidate) => candidate.id === selection.selectedChoiceIds[group.id]);
    if (!choice) continue;
    for (const item of choice.items) {
      const amount = lineAmounts(item);
      choicesExVat += amount.exVat;
      totalVat += amount.vat;
    }
  }

  for (const option of options) {
    if (!selection.selectedOptionIds.includes(option.id)) continue;
    const optionPrice = getQuoteOptionPrice(option);
    if (optionPrice == null) continue;
    optionsExVat += optionPrice;
    totalVat += optionPrice * (option.vatRate / 100);
  }

  const totalExVat = baseExVat + choicesExVat + optionsExVat;
  return {
    baseExVat: roundMoney(baseExVat),
    choicesExVat: roundMoney(choicesExVat),
    optionsExVat: roundMoney(optionsExVat),
    totalExVat: roundMoney(totalExVat),
    totalVat: roundMoney(totalVat),
    totalIncVat: roundMoney(totalExVat + totalVat),
  };
}

export function calculateQuotePriceSummary(
  items: BaseQuoteLine[],
  choiceGroups: QuoteChoiceGroup[],
): QuotePriceSummary {
  const minimumChoiceIds: Record<string, string> = {};
  const maximumChoiceIds: Record<string, string> = {};
  const recommendedChoiceIds: Record<string, string> = {};

  for (const group of choiceGroups) {
    const choicesByPrice = group.choices
      .map((choice) => ({
        id: choice.id,
        total: choice.items.reduce(
          (sum, item) => {
            const exVat = Number(item.qty) * Number(item.unitPrice);
            return sum + exVat + exVat * (Number(item.vatRate) / 100);
          },
          0,
        ),
      }))
      .sort((a, b) => a.total - b.total);

    const minimum = choicesByPrice[0];
    const maximum = choicesByPrice.at(-1);
    if (!minimum || !maximum) continue;

    minimumChoiceIds[group.id] = minimum.id;
    maximumChoiceIds[group.id] = maximum.id;
    recommendedChoiceIds[group.id] =
      group.choices.some((choice) => choice.id === group.recommendedChoiceId)
        ? group.recommendedChoiceId!
        : minimum.id;
  }

  const totalsFor = (selectedChoiceIds: Record<string, string>) =>
    calculateQuoteSelectionTotals(items, choiceGroups, [], {
      selectedChoiceIds,
      selectedOptionIds: [],
    });

  return {
    hasChoices: choiceGroups.length > 0,
    minimum: totalsFor(minimumChoiceIds),
    maximum: totalsFor(maximumChoiceIds),
    recommended: totalsFor(recommendedChoiceIds),
  };
}

export function validateQuoteSelection(
  choiceGroups: QuoteChoiceGroup[],
  options: QuoteOption[],
  selection: QuoteSelection,
) {
  const errors: string[] = [];
  for (const group of choiceGroups) {
    const selectedId = selection.selectedChoiceIds[group.id];
    if (!selectedId || !group.choices.some((choice) => choice.id === selectedId)) {
      errors.push(`Maak een keuze bij '${group.title}'.`);
    }
  }

  const optionIds = new Set(options.map((option) => option.id));
  if (selection.selectedOptionIds.some((id) => !optionIds.has(id))) {
    errors.push("Een geselecteerde meerwerkoptie bestaat niet meer.");
  }
  for (const option of options) {
    if (option.required && !selection.selectedOptionIds.includes(option.id)) {
      errors.push(`De verplichte optie '${option.t}' ontbreekt.`);
    }
  }
  return errors;
}

export function getRecommendedSelection(choiceGroups: QuoteChoiceGroup[]): QuoteSelection {
  const selectedChoiceIds: Record<string, string> = {};
  for (const group of choiceGroups) {
    const recommended = group.choices.find((choice) => choice.id === group.recommendedChoiceId);
    if (recommended) selectedChoiceIds[group.id] = recommended.id;
  }
  return { selectedChoiceIds, selectedOptionIds: [] };
}
