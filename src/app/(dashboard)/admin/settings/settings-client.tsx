"use client";

import { PageHeader } from "@/components/layout/page-header";
import { BrandPaletteEditor } from "@/components/forms/brand-palette-editor";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getBranding, type CompanyBranding as BrandSettings, type InvoiceSettings } from "@/lib/branding";
import { useCompany } from "@/lib/company-context";
import { Loader2, Save, Settings, Palette, Bot, Key, FileText, ExternalLink, Upload, Trash2 } from "lucide-react";

type TravelPricingTier = {
  maxKm: number | null;
  price: number;
};

type CompanySettings = {
  defaultVatRate: number;
  quoteValidDays: number;
  quoteIntroDefault: string;
  quoteOutroDefault: string;
  paymentTerms: string;
  openaiApiKey: string;
  emailFrom: string;
  notifyEmail: string;
  aiSystemPrompts: Record<string, string>;
  homeBaseZipCode: string;
  travelPricingTiers: TravelPricingTier[];
  invoice: InvoiceSettings;
};

type CompanyBranding = BrandSettings;

type LegalDocumentState = {
  terms: { name: string | null; size: number | null };
  privacy: { name: string | null; size: number | null };
};

const PROMPT_LABELS: Record<string, string> = {
  BATTERY: "Thuisbatterij advies",
  EMS: "EMS & Energiemanagement",
  SOLAR: "Zonnepanelen advies",
  ELECTRICAL: "Verdeelkast & Elektra",
  CAMERA: "Camera's & Beveiliging",
  HEATPUMP: "Warmtepomp advies",
  quote_intro: "Offerte intro (AI)",
  quote_outro: "Offerte outro (AI)",
};

export function SettingsClient({
  companyId,
  companyName,
  companySlug,
  settings: initialSettings,
  branding: initialBranding,
  legalDocuments: initialLegalDocuments,
}: {
  companyId: string;
  companyName: string;
  companySlug: string;
  settings: CompanySettings;
  branding: CompanyBranding;
  legalDocuments: LegalDocumentState;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [branding, setBranding] = useState(initialBranding);
  const [uploadingBrandAsset, setUploadingBrandAsset] = useState<"logo" | "favicon" | null>(null);
  const { reloadBranding } = useCompany();
  const [legalDocuments, setLegalDocuments] = useState(initialLegalDocuments);
  const [saving, setSaving] = useState(false);
  const setInvoice = (patch: Partial<InvoiceSettings>) =>
    setSettings((s) => ({ ...s, invoice: { ...s.invoice, ...patch } }));
  const [uploadingLegal, setUploadingLegal] = useState<"terms" | "privacy" | null>(null);

  async function saveSettings() {
    setSaving(true);
    try {
      // Don't send the masked key if it hasn't changed
      const isMasked = settings.openaiApiKey.includes("...");
      const finalSettings = {
        ...settings,
        openaiApiKey: isMasked ? initialSettings.openaiApiKey : settings.openaiApiKey,
      };

      const response = await fetch(`/api/company/${companyId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: finalSettings, branding }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Instellingen konden niet worden opgeslagen");
      }
      await reloadBranding();
      toast.success("Instellingen opgeslagen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function uploadBrandAsset(kind: "logo" | "favicon", file: File | undefined) {
    if (!file) return;
    setUploadingBrandAsset(kind);
    try {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("file", file);
      const response = await fetch(`/api/company/${companyId}/branding-asset`, { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Uploaden mislukt");
      setBranding(getBranding(companySlug, body.branding));
      await reloadBranding();
      toast.success(kind === "logo" ? "Logo bijgewerkt" : "Favicon bijgewerkt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uploaden mislukt");
    } finally {
      setUploadingBrandAsset(null);
    }
  }


  async function uploadLegal(type: "terms" | "privacy", file: File | undefined) {
    if (!file) return;
    setUploadingLegal(type);
    try {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("file", file);

      const response = await fetch(`/api/company/${companyId}/legal-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Upload mislukt");
      }

      const body = await response.json();
      setLegalDocuments((current) => ({
        ...current,
        [type]: {
          name: body.document.name,
          size: body.document.size,
        },
      }));
      toast.success("PDF geupload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload mislukt");
    } finally {
      setUploadingLegal(null);
    }
  }

  async function deleteLegal(type: "terms" | "privacy") {
    setUploadingLegal(type);
    try {
      const response = await fetch(`/api/company/${companyId}/legal-pdf`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Verwijderen mislukt");
      }

      setLegalDocuments((current) => ({
        ...current,
        [type]: { name: null, size: null },
      }));
      toast.success("PDF verwijderd");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verwijderen mislukt");
    } finally {
      setUploadingLegal(null);
    }
  }

  const isKoolhaas = companySlug === "koolhaas";

  function formatFileSize(size: number | null) {
    if (!size) return null;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  const legalUploads = [
    {
      type: "terms" as const,
      title: "Algemene voorwaarden",
      description: "Deze PDF wordt geopend via de link algemene voorwaarden in het offerteportaal.",
      uploadLabel: "Upload voorwaarden",
    },
    {
      type: "privacy" as const,
      title: "Privacyverklaring",
      description: "Deze PDF wordt geopend via de privacy-link in het offerteportaal.",
      uploadLabel: "Upload privacyverklaring",
    },
  ];

  const brandAssetSrc = (kind: "logo" | "favicon") => {
    const value = kind === "logo" ? branding.logoUrl : branding.faviconUrl;
    return value.startsWith("s3://") ? `/api/brand-assets/${companyId}/${kind}` : value;
  };

  return (
    <div className="w-full max-w-[1400px] space-y-6 p-6 lg:p-8 2xl:px-10">
      <PageHeader className="px-0! pt-0!" eyebrow="Beheer" title="Instellingen" description={companyName} actions={<Button onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Opslaan</Button>} />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Settings className="mr-2 h-4 w-4" />Algemeen</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="mr-2 h-4 w-4" />Branding</TabsTrigger>
          <TabsTrigger value="ai"><Bot className="mr-2 h-4 w-4" />AI & Prompts</TabsTrigger>
          <TabsTrigger value="api"><Key className="mr-2 h-4 w-4" />API Keys</TabsTrigger>
          <TabsTrigger value="legal"><FileText className="mr-2 h-4 w-4" />Juridisch</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Offerte instellingen</CardTitle>
              <CardDescription>Standaardwaarden voor nieuwe offertes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Standaard BTW (%)</Label>
                  <Input
                    type="number"
                    value={settings.defaultVatRate}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultVatRate: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Offerte geldig (dagen)</Label>
                  <Input
                    type="number"
                    value={settings.quoteValidDays}
                    onChange={(e) => setSettings((s) => ({ ...s, quoteValidDays: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Standaard intro tekst</Label>
                <Textarea
                  rows={3}
                  value={settings.quoteIntroDefault}
                  onChange={(e) => setSettings((s) => ({ ...s, quoteIntroDefault: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Standaard outro tekst</Label>
                <Textarea
                  rows={3}
                  value={settings.quoteOutroDefault}
                  onChange={(e) => setSettings((s) => ({ ...s, quoteOutroDefault: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Betalingsvoorwaarden</Label>
                <Textarea
                  rows={2}
                  value={settings.paymentTerms}
                  onChange={(e) => setSettings((s) => ({ ...s, paymentTerms: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Factuurgegevens</CardTitle>
              <CardDescription>
                Deze gegevens komen onderaan elke factuur. KvK, btw-id en IBAN zijn wettelijk verplicht.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bedrijfsadres</Label>
                <Textarea
                  rows={2}
                  placeholder={"Straat 1\n1234 AB Plaats"}
                  value={settings.invoice.address}
                  onChange={(e) => setInvoice({ address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>KvK-nummer</Label>
                  <Input value={settings.invoice.kvk} onChange={(e) => setInvoice({ kvk: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Btw-id</Label>
                  <Input placeholder="NL000000000B01" value={settings.invoice.vatNumber} onChange={(e) => setInvoice({ vatNumber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input placeholder="NL00 BANK 0000 0000 00" value={settings.invoice.iban} onChange={(e) => setInvoice({ iban: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ten name van</Label>
                  <Input placeholder={companyName} value={settings.invoice.accountHolder} onChange={(e) => setInvoice({ accountHolder: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Betaaltermijn (dagen)</Label>
                  <Input type="number" value={settings.invoice.paymentDays} onChange={(e) => setInvoice({ paymentDays: Number(e.target.value) || 14 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Voettekst factuur (optioneel)</Label>
                <Textarea
                  rows={2}
                  placeholder="Bijvoorbeeld: op al mijn werk zijn de algemene voorwaarden van toepassing."
                  value={settings.invoice.footer}
                  onChange={(e) => setInvoice({ footer: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Voorrijkosten</CardTitle>
              <CardDescription>
                Vertrekpostcode en prijsschijven voor de knop &quot;Reiskosten berekenen&quot; in de offerte-editor.
                De afstand is een schatting op basis van postcodes, niet een exacte routeplanner.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Vertrekpostcode (jouw vestigingsadres)</Label>
                <Input
                  placeholder="Bijv. 9145 RW"
                  value={settings.homeBaseZipCode}
                  onChange={(e) => setSettings((s) => ({ ...s, homeBaseZipCode: e.target.value }))}
                  className="max-w-[200px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Prijsschijven (excl. btw)</Label>
                <div className="space-y-2">
                  {settings.travelPricingTiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-16 shrink-0">t/m</span>
                      <Input
                        type="number"
                        placeholder="km"
                        value={tier.maxKm ?? ""}
                        disabled={i === settings.travelPricingTiers.length - 1}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            travelPricingTiers: s.travelPricingTiers.map((t, j) =>
                              j === i ? { ...t, maxKm: e.target.value === "" ? null : Number(e.target.value) } : t,
                            ),
                          }))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">km =</span>
                      <Input
                        type="number"
                        placeholder="euro"
                        value={tier.price}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            travelPricingTiers: s.travelPricingTiers.map((t, j) =>
                              j === i ? { ...t, price: Number(e.target.value) } : t,
                            ),
                          }))
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">euro</span>
                      {settings.travelPricingTiers.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() =>
                            setSettings((s) => ({
                              ...s,
                              travelPricingTiers: s.travelPricingTiers.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSettings((s) => {
                      const tiers = [...s.travelPricingTiers];
                      const last = tiers[tiers.length - 1];
                      const previousMax = tiers.length > 1 ? tiers[tiers.length - 2]?.maxKm ?? 0 : (last?.maxKm ?? 0);
                      tiers.splice(tiers.length - 1, 0, { maxKm: (previousMax ?? 0) + 10, price: last?.price ?? 0 });
                      return { ...s, travelPricingTiers: tiers };
                    })
                  }
                >
                  Schijf toevoegen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Deze huisstijl wordt gebruikt in de werkplek, offertes, PDF en e-mails.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BrandPaletteEditor companySlug={companySlug} companyName={companyName} branding={branding} onChange={setBranding} />
              <div className="space-y-2">
                <Label htmlFor="brand-font">Lettertype</Label>
                <select id="brand-font" value={branding.font} onChange={(e) => setBranding((b) => ({ ...b, font: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm">
                  {["Inter", "Nunito", "Sora", "Bricolage Grotesque", "Arial"].map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {([ ["logo", "Logo"], ["favicon", "Favicon"] ] as const).map(([kind, label]) => (
                  <div key={kind} className="space-y-2">
                    <Label htmlFor={`brand-${kind}`}>{label}</Label>
                    <div className="flex min-h-20 items-center gap-3 rounded-lg border border-border p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- afbeelding is door de gebruiker gekozen */}
                      <img src={brandAssetSrc(kind)} alt={`Huidig ${label.toLowerCase()}`} className={kind === "logo" ? "h-12 max-w-40 object-contain" : "h-10 w-10 object-contain"} />
                      <Input id={`brand-${kind}`} type="file" accept="image/png,image/jpeg,image/webp" className="min-w-0"
                        disabled={uploadingBrandAsset !== null} onChange={(e) => { void uploadBrandAsset(kind, e.target.files?.[0]); e.currentTarget.value = ""; }} />
                    </div>
                    {uploadingBrandAsset === kind && <p className="text-sm text-muted-foreground">Uploaden…</p>}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">PNG, JPG of WebP, maximaal 4 MB. Een vierkante PNG werkt het best als favicon.</p>
              <div className="space-y-2">
                <Label htmlFor="brand-tagline">Tagline</Label>
                <Input
                  id="brand-tagline"
                  value={branding.tagline}
                  onChange={(e) => setBranding((b) => ({ ...b, tagline: e.target.value }))}
                  placeholder="Jouw tagline..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Prompts */}
        <TabsContent value="ai">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Offerte AI prompts</CardTitle>
                <CardDescription>Systeem-prompts voor het genereren van offerteteksten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {["quote_intro", "quote_outro"].map((key) => (
                  <div key={key} className="space-y-2">
                    <Label>{PROMPT_LABELS[key] ?? key}</Label>
                    <Textarea
                      rows={4}
                      value={settings.aiSystemPrompts[key] ?? ""}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          aiSystemPrompts: { ...s.aiSystemPrompts, [key]: e.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {isKoolhaas && (
              <Card>
                <CardHeader>
                  <CardTitle>Koolhaas Advies prompts</CardTitle>
                  <CardDescription>Systeem-prompts per adviestype (aanpasbaar)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {["BATTERY", "EMS", "SOLAR", "ELECTRICAL", "CAMERA", "HEATPUMP"].map((key) => (
                    <div key={key} className="space-y-2">
                      <Label>{PROMPT_LABELS[key] ?? key}</Label>
                      <Textarea
                        rows={5}
                        value={settings.aiSystemPrompts[key] ?? ""}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            aiSystemPrompts: { ...s.aiSystemPrompts, [key]: e.target.value },
                          }))
                        }
                      />
                      <Separator />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Sla API keys op per bedrijf (versleuteld opgeslagen)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <Input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings((s) => ({ ...s, openaiApiKey: e.target.value }))}
                  placeholder="sk-..."
                />
                <p className="text-sm text-muted-foreground">
                  Laat leeg om de globale OPENAI_API_KEY omgevingsvariabele te gebruiken
                </p>
              </div>
              <div className="space-y-2">
                <Label>Afzenderadres (emailFrom)</Label>
                <Input
                  type="email"
                  value={settings.emailFrom}
                  onChange={(e) => setSettings((s) => ({ ...s, emailFrom: e.target.value }))}
                  placeholder="offerte@jouwbedrijf.nl"
                />
                <p className="text-sm text-muted-foreground">
                  E-mailadres waarmee offertes worden verstuurd via Resend
                </p>
              </div>
              <div className="space-y-2">
                <Label>Notificatie e-mail (notifyEmail)</Label>
                <Input
                  type="email"
                  value={settings.notifyEmail}
                  onChange={(e) => setSettings((s) => ({ ...s, notifyEmail: e.target.value }))}
                  placeholder="info@websup.nl"
                />
                <p className="text-sm text-muted-foreground">
                  Ontvang een melding wanneer een klant een offerte accepteert of afwijst
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Juridisch */}
        <TabsContent value="legal">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Upload hier de definitieve PDF-bestanden. De links in het offerteportaal tonen exact deze bestanden.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              {legalUploads.map((document) => {
                const current = legalDocuments[document.type];
                const isBusy = uploadingLegal === document.type;
                const fileSize = formatFileSize(current.size);

                return (
                  <Card key={document.type}>
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle>{document.title}</CardTitle>
                          <CardDescription>{document.description}</CardDescription>
                        </div>
                        {current.name && (
                          <a
                            href={`/api/legal/${companySlug}/${document.type}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Bekijk PDF
                          </a>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-md border border-dashed p-4">
                        {current.name ? (
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{current.name}</p>
                              {fileSize && <p className="text-sm text-muted-foreground">{fileSize}</p>}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteLegal(document.type)}
                              disabled={isBusy}
                              aria-label={`${document.title} verwijderen`}
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nog geen PDF geupload.</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Label
                          htmlFor={`legal-${document.type}`}
                          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {document.uploadLabel}
                        </Label>
                        <Input
                          id={`legal-${document.type}`}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          disabled={isBusy}
                          onChange={(event) => {
                            uploadLegal(document.type, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                        <span className="text-sm text-muted-foreground">PDF, max. 15 MB</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
