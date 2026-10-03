"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_BRANDING, getBranding, gradientCssFromBranding, readableBrandText, type CompanyBranding } from "@/lib/branding";

export function BrandPaletteEditor({ companySlug, companyName, branding, onChange }: {
  companySlug: string;
  companyName: string;
  branding: CompanyBranding;
  onChange: (branding: CompanyBranding) => void;
}) {
  const preview = getBranding(companySlug, branding);
  const defaults = DEFAULT_BRANDING[companySlug] ?? DEFAULT_BRANDING.websup;
  function colorField(key: string, label: string, value: string, update: (value: string) => void) {
    return <div key={key} className="space-y-2">
      <Label htmlFor={`${companySlug}-brand-${key}`}>{label}</Label>
      <div className="flex gap-2">
        <input aria-label={`${label} kiezen`} type="color" value={/^#[\da-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={(event) => update(event.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1" />
        <Input id={`${companySlug}-brand-${key}`} value={value} onChange={(event) => update(event.target.value)}
          aria-invalid={!/^#[\da-f]{6}$/i.test(value)} maxLength={7} placeholder="#123456" className="font-mono text-base md:text-base" />
      </div>
    </div>;
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-base text-muted-foreground">Kleuren uit de huisstijl van {companyName}.</p>
      <Button type="button" variant="outline" onClick={() => onChange({
        ...branding, primaryColor: defaults.primaryColor, accentColor: defaults.accentColor,
        backgroundColor: defaults.backgroundColor, textColor: defaults.textColor, gradient: { ...defaults.gradient },
      })}>Gebruik websitekleuren</Button>
    </div>
    <div className="overflow-hidden rounded-lg border border-border" aria-label={`Merkpreview ${companyName}`}>
      <div className="h-12" style={{ background: gradientCssFromBranding(preview) }} aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-4 p-6" style={{ background: preview.backgroundColor, color: preview.textColor }}>
        <div>
          <p className="text-xl font-semibold" style={{ color: preview.primaryColor }}>{companyName}</p>
          <p className="mt-1 text-base">Voorbeeld van je huisstijl</p>
        </div>
        <span className="inline-flex min-h-11 items-center rounded-md px-4 text-base font-semibold"
          style={{ background: preview.accentColor, color: readableBrandText(preview.accentColor) }}>Actiekleur</span>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {([
        ["primaryColor", "Primaire kleur"], ["accentColor", "Actiekleur"],
        ["backgroundColor", "Achtergrondkleur"], ["textColor", "Tekstkleur"],
      ] as const).map(([key, label]) => colorField(key, label, branding[key], (value) => onChange({ ...branding, [key]: value })))}
    </div>
    <div className="space-y-4 border-t border-border pt-6">
      <div>
        <h3 className="text-base font-semibold">Merkgradient</h3>
        <p className="mt-1 text-base text-muted-foreground">Dit kleurverloop verschijnt in de offerte, het portaal en de e-mail. Actieknoppen gebruiken de actiekleur.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {([["from", "Begin"], ["via", "Midden"], ["to", "Einde"]] as const).map(([key, label]) =>
          colorField(`gradient-${key}`, label, branding.gradient[key], (value) => onChange({ ...branding, gradient: { ...branding.gradient, [key]: value } })))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${companySlug}-gradient-angle`}>Richting (graden)</Label>
          <Input id={`${companySlug}-gradient-angle`} className="text-base md:text-base" type="number" min={0} max={360} value={branding.gradient.angle}
            onChange={(event) => onChange({ ...branding, gradient: { ...branding.gradient, angle: Number(event.target.value) } })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${companySlug}-gradient-position`}>Positie middenkleur (%)</Label>
          <Input id={`${companySlug}-gradient-position`} className="text-base md:text-base" type="number" min={1} max={99} value={branding.gradient.viaPosition}
            onChange={(event) => onChange({ ...branding, gradient: { ...branding.gradient, viaPosition: Number(event.target.value) } })} />
        </div>
      </div>
    </div>
  </div>;
}
