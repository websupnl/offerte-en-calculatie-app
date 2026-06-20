import { z } from "zod";

export const selectableLineSchema = z.object({
  description: z.string().trim().min(1),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(21),
  indent: z.coerce.number().int().min(0).max(1).default(0),
});

export const quoteChoiceSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().optional(),
  title: z.string().trim().min(1),
  summary: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  items: z.array(selectableLineSchema).min(1),
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
  details: z.array(z.string().trim().min(1)).optional().default([]),
  technicalCondition: z.string().trim().optional(),
});

export type QuoteChoice = z.infer<typeof quoteChoiceSchema>;
export type QuoteChoiceGroup = z.infer<typeof quoteChoiceGroupSchema>;
export type QuoteOption = z.infer<typeof quoteOptionSchema>;

export type BaseQuoteLine = {
  id?: string;
  description: string;
  qty: string | number;
  unitPrice: string | number;
  vatRate: string | number;
  total?: string | number;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    if (option.price == null) continue; // "Op aanvraag" — geen vaste prijs, telt niet mee
    optionsExVat += option.price;
    totalVat += option.price * (option.vatRate / 100);
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
