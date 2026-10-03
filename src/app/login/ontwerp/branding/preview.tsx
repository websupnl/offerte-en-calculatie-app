"use client";

import { useState } from "react";
import { BrandPaletteEditor } from "@/components/forms/brand-palette-editor";
import { DEFAULT_BRANDING } from "@/lib/branding";

export function BrandPalettePreview() {
  const [websup, setWebsup] = useState(DEFAULT_BRANDING.websup);
  const [koolhaas, setKoolhaas] = useState(DEFAULT_BRANDING.koolhaas);
  return <main className="mx-auto max-w-6xl space-y-8 p-6 sm:p-8">
    <header>
      <h1 className="text-3xl font-semibold">Huisstijl van beide bedrijven</h1>
      <p className="mt-2 text-base text-muted-foreground">Ontwerpvoorbeeld van de kleurinstellingen. Wijzigingen op deze pagina worden niet opgeslagen.</p>
    </header>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-6 text-2xl font-semibold">WebsUp</h2>
        <BrandPaletteEditor companySlug="websup" companyName="WebsUp.nl" branding={websup} onChange={setWebsup} />
      </section>
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-6 text-2xl font-semibold">Koolhaas</h2>
        <BrandPaletteEditor companySlug="koolhaas" companyName="Koolhaas Installaties" branding={koolhaas} onChange={setKoolhaas} />
      </section>
    </div>
  </main>;
}
