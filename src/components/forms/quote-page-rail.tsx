"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import type { QuotePageMeta } from "@/components/quote-sheet-preview";
import { SCHAKELBARE_SECTIES } from "@/components/forms/section-toggles";

/**
 * De paginastrip naast het papier.
 *
 * Dit verving de tab "Pagina's" in de zijkolom. Een offerte is een document van
 * een aantal A4'tjes, dus je hoort ze naast elkaar te zien staan: hoeveel het er
 * zijn, waar je bent, en welke je uitzet. Een formulierenkolom kon dat niet.
 *
 * De strip navigeert en schakelt, meer niet. Bewerken doe je op het papier zelf.
 */

const SECTIE_NAAM = new Map(SCHAKELBARE_SECTIES.map((s) => [s.key as string, s.naam]));

export function QuotePageRail({
  pages,
  hiddenSections,
  onToggleSection,
  paperRef,
}: {
  pages: QuotePageMeta[];
  hiddenSections: string[];
  onToggleSection: (key: string) => void;
  paperRef: RefObject<HTMLDivElement | null>;
}) {
  const [actief, setActief] = useState(0);

  // Welke pagina in beeld staat, bepaald door wat het dichtst bij de bovenkant
  // van het scherm ligt. Een IntersectionObserver werkt hier slecht: A4'tjes zijn
  // hoger dan het venster, dus er is vaak géén pagina volledig zichtbaar.
  useEffect(() => {
    const container = paperRef.current;
    if (!container) return;

    const meten = () => {
      const sheets = [...container.querySelectorAll<HTMLElement>(".sheet")];
      if (sheets.length === 0) return;
      let dichtstbij = 0;
      let kleinste = Infinity;
      sheets.forEach((sheet, index) => {
        const afstand = Math.abs(sheet.getBoundingClientRect().top - 120);
        if (afstand < kleinste) {
          kleinste = afstand;
          dichtstbij = index;
        }
      });
      setActief(dichtstbij);
    };

    meten();
    window.addEventListener("scroll", meten, { passive: true });
    window.addEventListener("resize", meten);
    return () => {
      window.removeEventListener("scroll", meten);
      window.removeEventListener("resize", meten);
    };
  }, [paperRef, pages.length]);

  const springNaar = (index: number) => {
    const sheets = paperRef.current?.querySelectorAll<HTMLElement>(".sheet");
    const doel = sheets?.[index];
    if (!doel) return;
    const top = doel.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const uit = new Set(hiddenSections);
  // Secties die wel bestaan maar uitstaan, hebben geen pagina meer. Die zetten we
  // onderaan als grijze regel, anders lijkt het alsof ze verdwenen zijn.
  const uitgezet = SCHAKELBARE_SECTIES.filter((sectie) => uit.has(sectie.key));

  return (
    <nav
      aria-label="Pagina's in deze offerte"
      className="sticky top-[132px] hidden w-[132px] shrink-0 self-start lg:block"
    >
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {pages.length} pagina&apos;s
      </p>

      <ol className="max-h-[calc(100vh-220px)] space-y-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        {pages.map((page, index) => {
          const isActief = index === actief;
          return (
            <li key={page.id} className="group relative">
              <button
                type="button"
                onClick={() => springNaar(index)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                  isActief
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {/* Een miniatuur van een A4 als houvast: staand blokje met het nummer. */}
                <span
                  className={`flex h-7 w-[21px] shrink-0 items-center justify-center rounded-[3px] border text-[10px] font-bold tabular-nums ${
                    isActief ? "border-white/30 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  {page.nr}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{page.label}</span>
              </button>

              {page.section && (
                <button
                  type="button"
                  onClick={() => onToggleSection(page.section)}
                  title={`${SECTIE_NAAM.get(page.section) ?? page.section} verbergen`}
                  aria-label={`${SECTIE_NAAM.get(page.section) ?? page.section} verbergen`}
                  className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-900 group-hover:block"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {uitgezet.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2">
          <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Uit</p>
          <ul className="space-y-1">
            {uitgezet.map((sectie) => (
              <li key={sectie.key}>
                <button
                  type="button"
                  onClick={() => onToggleSection(sectie.key)}
                  title="Weer aanzetten"
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{sectie.naam}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
