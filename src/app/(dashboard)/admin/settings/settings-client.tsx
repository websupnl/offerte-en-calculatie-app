"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
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
};

type CompanyBranding = {
  primaryColor: string;
  accentColor: string;
  tagline: string;
};

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
  const [legalDocuments, setLegalDocuments] = useState(initialLegalDocuments);
  const [saving, setSaving] = useState(false);
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

      await fetch(`/api/company/${companyId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: finalSettings, branding }),
      });
      toast.success("Instellingen opgeslagen");
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
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

  return (
    <div className="w-full max-w-[1400px] space-y-6 p-6 lg:p-8 2xl:px-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instellingen</h1>
          <p className="text-muted-foreground">{companyName}</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Opslaan
        </Button>
      </div>

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
                      <span className="text-sm text-slate-500 w-16 shrink-0">t/m</span>
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
                      <span className="text-sm text-slate-500 shrink-0">km =</span>
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
                      <span className="text-sm text-slate-500 shrink-0">euro</span>
                      {settings.travelPricingTiers.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
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
              <CardDescription>Aanpassen van kleuren en teksten</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primaire kleur</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.primaryColor || (isKoolhaas ? "#0E2344" : "#0F172A")}
                      onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                      className="h-10 w-16 rounded cursor-pointer border"
                    />
                    <Input
                      value={branding.primaryColor}
                      onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                      placeholder="#0F172A"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent kleur</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.accentColor || (isKoolhaas ? "#1F9BA3" : "#6366F1")}
                      onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                      className="h-10 w-16 rounded cursor-pointer border"
                    />
                    <Input
                      value={branding.accentColor}
                      onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                      placeholder="#6366F1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
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
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
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
                            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
                              {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
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
                        <span className="text-xs text-muted-foreground">PDF, max. 15 MB</span>
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
