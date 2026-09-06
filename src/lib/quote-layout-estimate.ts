/**
 * Schat of een offerte over de rand van een A4 loopt, zonder de pagina echt te
 * renderen. De preview meet dat in de DOM (`sheet-overflow-monitor.tsx`), maar
 * een AI of de MCP-server heeft die meting niet. Deze schatting draait puur op
 * de tekstlengtes en waarschuwt op dezelfde plekken.
 *
 * De getallen zijn gekalibreerd op echte offertes die overliepen: 8 werkwijze-
 * stappen op één pagina (~16 regels te veel) en 9 bronnen op één pagina
 * (~5 regels te veel). Liever iets te streng dan een klant een halve zin laten
 * zien.
 */

export type LayoutWarning = {
  section: "approach" | "sources";
  label: string;
  /** Geschat aantal regels dat niet meer op de pagina past. */
  overflowLines: number;
  hint: string;
};

type ApproachStep = { t?: string | null; d?: string | null };
type Source = { label?: string | null; description?: string | null };

// Regelbudget van één inhoudspagina, na kop en voettekst.
const PAGE_LINE_BUDGET = 40;

function approachStepLines(step: ApproachStep): number {
  const titleLines = Math.max(1, Math.ceil((step.t?.length ?? 0) / 34));
  const bodyLines = Math.max(1, Math.ceil((step.d?.length ?? 0) / 58));
  return titleLines + bodyLines + 1; // +1 voor het nummer en de tussenruimte
}

function sourceLines(source: Source): number {
  const labelLines = Math.max(1, Math.ceil((source.label?.length ?? 0) / 40));
  const descLines = source.description ? Math.max(1, Math.ceil(source.description.length / 64)) : 0;
  return labelLines + descLines + 1; // +1 voor de "open bron"-regel en de rand
}

/** Verdeelt regels greedy over pagina's en geeft de ergste overschrijding terug. */
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

  const approach = (input.approach ?? []).filter((s) => (s?.t || s?.d));
  if (approach.length > 0) {
    // De koppagina heeft iets minder ruimte door de sectiekop.
    const budget = PAGE_LINE_BUDGET - 4;
    const over = worstOverflow(approach.map(approachStepLines), budget);
    if (over > 2) {
      warnings.push({
        section: "approach",
        label: "Zo werkt het in de praktijk",
        overflowLines: over,
        hint: "Kort de stappen in of voeg vergelijkbare stappen samen. Richtlijn: 5 à 6 korte stappen per pagina.",
      });
    }
  }

  const sources = (input.sources ?? []).filter((s) => s?.label);
  if (sources.length > 0) {
    const budget = PAGE_LINE_BUDGET - 8; // kop + inleidende zin
    const over = worstOverflow(sources.map(sourceLines), budget);
    if (over > 2) {
      warnings.push({
        section: "sources",
        label: "Bronnen bij dit advies",
        overflowLines: over,
        hint: "Houd elke bronomschrijving op één korte regel, of laat minder essentiële bronnen weg. Richtlijn: maximaal 8 bronnen per pagina.",
      });
    }
  }

  return warnings;
}

/** Korte, mensvriendelijke samenvatting voor in een MCP-antwoord. */
export function layoutWarningText(warnings: LayoutWarning[]): string {
  if (warnings.length === 0) return "";
  const lines = warnings.map(
    (w) => `- ${w.label}: ~${w.overflowLines} regels te veel. ${w.hint}`,
  );
  return `LET OP — deze offerte loopt over de pagina:\n${lines.join("\n")}`;
}
