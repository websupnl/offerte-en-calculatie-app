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
import { Loader2, Save, Settings, Palette, Bot, Key } from "lucide-react";

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
};

type CompanyBranding = {
  primaryColor: string;
  accentColor: string;
  tagline: string;
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
}: {
  companyId: string;
  companyName: string;
  companySlug: string;
  settings: CompanySettings;
  branding: CompanyBranding;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [branding, setBranding] = useState(initialBranding);
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch(`/api/company/${companyId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, branding }),
      });
      toast.success("Instellingen opgeslagen");
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  const isKoolhaas = companySlug === "koolhaas";

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
                  placeholder="daan@websup.nl"
                />
                <p className="text-xs text-muted-foreground">
                  Ontvang een melding wanneer een klant een offerte accepteert of afwijst
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
