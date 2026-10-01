"use client";

import { GitBranch, Copy, Loader2, ArrowUpRight } from "lucide-react";
import { m } from "motion/react";
import { Button } from "@/components/ui/button";

export function CalculationForkAction({ title, busy, canCreateAlternative, locked, onAlternative, onCopy }: {
  title: string;
  busy: boolean;
  canCreateAlternative: boolean;
  locked: boolean;
  onAlternative: () => void;
  onCopy: () => void;
}) {
  return <section aria-label="Verder met deze calculatie" aria-busy={busy} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
    <div className="relative grid h-16 w-28 shrink-0 grid-cols-2 items-center gap-8" aria-hidden="true">
      <svg viewBox="0 0 112 64" className="absolute inset-0 size-full fill-none stroke-border" strokeWidth="1.5">
        <path d="M28 32H48Q56 32 56 24V16Q56 12 64 12H88M56 28V48Q56 52 64 52H88" />
      </svg>
      <span className="z-10 grid size-9 place-items-center rounded-lg border border-border bg-muted"><Copy className="size-4 text-muted-foreground" /></span>
      <div className="z-10 flex flex-col gap-3">
        <span className="grid h-6 w-10 place-items-center rounded border border-border bg-card text-sm text-muted-foreground">A</span>
        <m.span animate={busy ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={busy ? { duration: 0.9, repeat: Infinity } : { duration: 0.15 }} className="grid h-6 w-10 place-items-center rounded border border-primary/40 bg-primary/10 text-sm font-semibold text-foreground">B</m.span>
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <h2 className="text-base font-semibold">Een andere uitvoering vergelijken</h2>
      <p className="mt-1 text-base leading-6 text-muted-foreground">{locked
        ? "Deze offerte is al verstuurd. Maak een losse kopie om een nieuwe uitvoering uit te werken."
        : "Gebruik deze calculatie als vertrekpunt. Beide uitvoeringen worden keuzes in dezelfde conceptofferte. Optionele extra’s blijven apart beschikbaar."}</p>
      <span className="sr-only">Uitgangspunt: {title}</span>
      {!canCreateAlternative && !locked && <p className="mt-1 text-sm text-muted-foreground">Koppel eerst een klant om een conceptofferte met alternatieven te maken.</p>}
    </div>
    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
      <Button onClick={onAlternative} disabled={busy || !canCreateAlternative || locked}>{busy ? <Loader2 className="animate-spin" /> : <GitBranch />}Maak alternatief<ArrowUpRight /></Button>
      <Button variant="ghost" onClick={onCopy} disabled={busy}><Copy />Losse kopie</Button>
    </div>
  </section>;
}
