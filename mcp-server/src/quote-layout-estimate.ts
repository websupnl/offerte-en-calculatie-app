/**
 * Schat of een offerte over de rand van een A4 loopt, zonder te renderen.
 * Kopie van `src/lib/quote-layout-estimate.ts` in de hoofdapp — houd ze gelijk.
 * De preview meet de echte DOM; deze schatting geeft een AI/MCP dezelfde seinen.
 */

export type LayoutWarning = {
  section: "approach" | "sources";
  label: string;
  overflowLines: number;
  hint: string;
};

type ApproachStep = { t?: string | null; d?: string | null };
type Source = { label?: string | null; description?: string | null };

const PAGE_LINE_BUDGET = 40;

function approachStepLines(step: ApproachStep): number {
  const titleLines = Math.max(1, Math.ceil((step.t?.length ?? 0) / 34));
  const bodyLines = Math.max(1, Math.ceil((step.d?.length ?? 0) / 58));
  return titleLines + bodyLines + 1;
}

function sourceLines(source: Source): number {
  const labelLines = Math.max(1, Math.ceil((source.label?.length ?? 0) / 40));
  const descLines = source.description ? Math.max(1, Math.ceil(source.description.length / 64)) : 0;
  return labelLines + descLines + 1;
}

function worstOverflow(lineCounts: number[], budget: number): number {
  let page = 0;
  let worst = 0;
  for (const lines of lineCounts) {
    if (page > 0 && page + lines > budget) {
      worst = Math.max(worst, page - budget);
      page = 0;
    }
    page += lines;
  }
  worst = Math.max(worst, page - budget);
  return Math.max(0, Math.round(worst));
}

export function estimateQuoteLayout(input: {
  approach?: ApproachStep[] | null;
  sources?: Source[] | null;
}): LayoutWarning[] {
  const warnings: LayoutWarning[] = [];

  const approach = (input.approach ?? []).filter((s) => s && (s.t || s.d));
  if (approach.length > 0) {
    const over = worstOverflow(approach.map(approachStepLines), PAGE_LINE_BUDGET - 4);
    if (over > 2) {
      warnings.push({
        section: "approach",
        label: "Zo werkt het in de praktijk",
        overflowLines: over,
        hint: "Kort de stappen in of voeg vergelijkbare stappen samen. Richtlijn: 5 à 6 korte stappen per pagina.",
      });
    }
  }

  const sources = (input.sources ?? []).filter((s) => s && s.label);
  if (sources.length > 0) {
    const over = worstOverflow(sources.map(sourceLines), PAGE_LINE_BUDGET - 8);
    if (over > 2) {
      warnings.push({
        section: "sources",
        label: "Bronnen bij dit advies",
        overflowLines: over,
        hint: "Houd elke bronomschrijving op één korte regel of laat minder essentiële bronnen weg. Richtlijn: maximaal 8 bronnen per pagina.",
      });
    }
  }

  return warnings;
}

export function layoutWarningText(warnings: LayoutWarning[]): string {
  if (warnings.length === 0) return "";
  const lines = warnings.map((w) => `- ${w.label}: ~${w.overflowLines} regels te veel. ${w.hint}`);
  return `LET OP - deze offerte loopt over de pagina:\n${lines.join("\n")}`;
}
