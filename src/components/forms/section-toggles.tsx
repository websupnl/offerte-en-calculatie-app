"use client";

import { Eye, EyeOff } from "lucide-react";

/**
 * Secties aan- en uitzetten. Uitzetten verbergt alleen; de inhoud blijft staan,
 * zodat je hem later weer aan kunt zetten zonder opnieuw te schrijven.
 *
 * De omslag en de akkoordpagina staan er bewust niet bij: een offerte zonder
 * voorblad of zonder ondertekening is geen offerte.
 */

export const SCHAKELBARE_SECTIES = [
  { key: "content", naam: "Inhoudsblokken", uitleg: "Vrije uitleg tussen intro en prijzen" },
  { key: "approach", naam: "Werkwijze", uitleg: "Zo werkt het in de praktijk" },
  { key: "visuals", naam: "Ontwerpvoorbeelden", uitleg: "Afbeeldingen op een eigen pagina" },
  { key: "modules", naam: "Modules", uitleg: "Wat de klant erbij kan kiezen" },
  { key: "terms", naam: "Afspraken", uitleg: "Uitgangspunten en niet inbegrepen" },
  { key: "sources", naam: "Bronnen", uitleg: "Onderbouwing bij technische claims" },
] as const;

export function SectionToggles({
  hidden,
  onChange,
  beschikbaar,
}: {
  hidden: string[];
  onChange: (next: string[]) => void;
  /** Secties zonder inhoud; die tonen we grijs zodat duidelijk is waarom ze niet verschijnen. */
  beschikbaar: Record<string, boolean>;
}) {
  const uit = new Set(hidden);

  const wissel = (key: string) => {
    const next = new Set(uit);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  };

  return (
    <div className="space-y-1.5">
      {SCHAKELBARE_SECTIES.map((sectie) => {
        const zichtbaar = !uit.has(sectie.key);
        const heeftInhoud = beschikbaar[sectie.key] ?? false;
        return (
          <button
            key={sectie.key}
            type="button"
            onClick={() => wissel(sectie.key)}
            className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
              zichtbaar ? "border-slate-200 bg-white hover:bg-slate-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            {zichtbaar
              ? <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              : <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-bold ${zichtbaar ? "text-slate-900" : "text-slate-400"}`}>
                {sectie.naam}
              </span>
              <span className="block text-xs text-slate-500">
                {!zichtbaar
                  ? "Uitgezet, inhoud blijft bewaard"
                  : heeftInhoud
                    ? sectie.uitleg
                    : "Nog geen inhoud, verschijnt daarom niet"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
