"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Loader2, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

/**
 * Waar de prijs vandaan komt.
 *
 * Hiervoor kon een prijs op drie plekken ontstaan: losse offerteregels, een
 * configuratie met een eigen kopie van die regels, en modules met nog een eigen
 * prijs. Drie plekken om te vergeten bij te werken. Nu is er één: de calculatie.
 *
 *   basis    telt altijd mee
 *   variant  de klant kiest er een uit
 *   extra    een optionele regel in de calculatie, de klant vinkt hem aan
 *
 * Bedragen zijn hier alleen te lezen. Wijzigen doe je in de calculatie, want
 * daar staat ook de inkoopprijs en zie je meteen wat het je oplevert.
 */

export type PanelCalculation = {
  id: string;
  number: string;
  title: string;
  role: string;
  totalExVat: number;
  marginPercent: number;
  regels: number;
  extras: number;
};

export function QuotePricePanel({
  quoteId,
  calculations,
  legacyItemCount,
  isDraft,
  waarschuwing,
}: {
  quoteId: string;
  calculations: PanelCalculation[];
  /** Aantal oude offerteregels. Meer dan 0 betekent: deze offerte zit nog op het oude pad. */
  legacyItemCount: number;
  isDraft: boolean;
  /** Bijvoorbeeld: optionele regels in een variant worden niet getoond. */
  waarschuwing?: string | null;
}) {
  const router = useRouter();
  const [bezig, setBezig] = useState<string | null>(null);

  // Zelfde regel als buildQuotePricing: één variant is geen keuze en telt dus
  // gewoon mee in de prijs. Pas vanaf twee mag de klant kiezen.
  const gemarkeerdeVarianten = calculations.filter((c) => c.role === "VARIANT");
  const varianten = gemarkeerdeVarianten.length >= 2 ? gemarkeerdeVarianten : [];
  const basis = calculations.filter((c) => !varianten.includes(c));

  async function maakCalculatie(body: Record<string, unknown>, melding: string) {
    setBezig(melding);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/calculations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "Aanmaken mislukt");
      router.push(`/calculations/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
      setBezig(null);
    }
  }

  const totaal = basis.reduce((sum, c) => sum + c.totalExVat, 0);

  return (
    <div className="space-y-5">
      {legacyItemCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Deze offerte gebruikt nog losse offerteregels
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            {legacyItemCount} regels staan los in de offerte, zonder inkoopprijs of marge.
            {isDraft
              ? " Zet ze om naar een calculatie, dan zie je wat je eraan overhoudt en werk je verder op één plek."
              : " Deze offerte is al verstuurd, dus hij blijft precies zoals de klant hem gezien heeft."}
          </p>
          {isDraft && (
            <Button
              size="sm"
              className="mt-3"
              disabled={bezig !== null}
              onClick={() => maakCalculatie({ moveItems: true }, "omzetten")}
            >
              {bezig === "omzetten"
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <ArrowRight className="mr-1.5 h-4 w-4" />}
              Omzetten naar calculatie
            </Button>
          )}
        </div>
      ) : calculations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm font-bold text-slate-800">Nog geen prijs</p>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
            Een offerte krijgt zijn prijs uit een calculatie. Daarin zet je de artikelen met
            inkoopprijs, zodat je meteen ziet wat je eraan overhoudt.
          </p>
          <Button
            size="sm"
            className="mt-3"
            disabled={bezig !== null}
            onClick={() => maakCalculatie({}, "nieuw")}
          >
            {bezig === "nieuw"
              ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              : <Plus className="mr-1.5 h-4 w-4" />}
            Calculatie maken
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Prijs op de offerte
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums">{formatCurrency(totaal)}</p>
            <p className="text-xs text-slate-400">
              excl. btw{varianten.length > 0 ? ", plus de variant die de klant kiest" : ""}
            </p>
          </div>

          {[
            ["Basis", basis, "Telt altijd mee in de prijs"],
            ["Varianten", varianten, "De klant kiest er een uit"],
          ].map(([kop, lijst, uitleg]) => {
            const rijen = lijst as PanelCalculation[];
            if (rijen.length === 0) return null;
            return (
              <div key={kop as string}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {kop as string}
                </p>
                <p className="mb-2 text-xs text-slate-500">{uitleg as string}</p>
                <ul className="space-y-2">
                  {rijen.map((calculatie) => (
                    <li key={calculatie.id}>
                      <Link
                        href={`/calculations/${calculatie.id}`}
                        className="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{calculatie.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {calculatie.number} &middot; {calculatie.regels} regels
                              {calculatie.extras > 0 && ` · ${calculatie.extras} optioneel`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold tabular-nums text-slate-900">
                              {formatCurrency(calculatie.totalExVat)}
                            </p>
                            <p className="flex items-center justify-end gap-1 text-xs font-semibold text-emerald-600">
                              <TrendingUp className="h-3 w-3" />
                              {calculatie.marginPercent.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {waarschuwing && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              {waarschuwing}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bezig !== null}
              onClick={() => maakCalculatie({ role: "VARIANT" }, "variant")}
            >
              {bezig === "variant"
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <GitBranch className="mr-1.5 h-4 w-4" />}
              Variant toevoegen
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Wil je een extra dat de klant zelf mag aanvinken? Zet die regel in de calculatie
            op <strong>optioneel</strong>. Hij telt dan niet mee in de prijs, maar verschijnt
            wel als keuze op de offerte.
          </p>
        </>
      )}
    </div>
  );
}
