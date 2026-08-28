"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, FileText } from "lucide-react";
import { formatDate } from "@/lib/format";

type AdviceDoc = { id: string; type: string; content: string; createdAt: string };
type Product = { id: string; name: string; category: string };

const ADVICE_TYPES = [
  { value: "BATTERY", label: "Thuisbatterij", icon: "🔋", fields: ["jaarverbruik_kwh", "teruglevering_kwh", "type_woning", "huidige_zonnepanelen_wp", "doelstelling"] },
  { value: "EMS", label: "EMS & Energiemanagement", icon: "⚡", fields: ["huidige_systemen", "zonnepanelen_wp", "batterij_aanwezig", "laadpaal_aanwezig", "doelstelling"] },
  { value: "SOLAR", label: "Zonnepanelen", icon: "☀️", fields: ["jaarverbruik_kwh", "type_dak", "dakoppervlak_m2", "orientatie_dak", "doelstelling"] },
  { value: "ELECTRICAL", label: "Verdeelkast & Elektra", icon: "🔌", fields: ["huidige_groepen", "jaar_installatie", "toekomstige_verbruikers", "knelpunten"] },
  { value: "CAMERA", label: "Camera's & Beveiliging", icon: "📷", fields: ["type_pand", "gewenste_zones", "opslag_wens", "bestaande_systemen"] },
  { value: "HEATPUMP", label: "Warmtepomp", icon: "🌡️", fields: ["type_woning", "bouwjaar", "isolatiewaarde", "huidige_verwarming", "vloeroppervlak_m2"] },
];

const FIELD_LABELS: Record<string, string> = {
  jaarverbruik_kwh: "Jaarverbruik (kWh)",
  teruglevering_kwh: "Teruglevering zonnepanelen (kWh/jaar)",
  type_woning: "Type woning",
  huidige_zonnepanelen_wp: "Huidig zonnepanelen vermogen (Wp)",
  doelstelling: "Doelstelling klant",
  huidige_systemen: "Huidige systemen aanwezig",
  zonnepanelen_wp: "Zonnepanelen vermogen (Wp)",
  batterij_aanwezig: "Thuisbatterij aanwezig?",
  laadpaal_aanwezig: "Laadpaal aanwezig?",
  type_dak: "Type dak",
  dakoppervlak_m2: "Beschikbaar dakoppervlak (m²)",
  orientatie_dak: "Oriëntatie dak (bijv. ZW)",
  huidige_groepen: "Aantal huidige groepen",
  jaar_installatie: "Jaar van installatie",
  toekomstige_verbruikers: "Toekomstige verbruikers (laadpaal, batterij, etc.)",
  knelpunten: "Bekende knelpunten",
  type_pand: "Type pand",
  gewenste_zones: "Gewenste camerazones",
  opslag_wens: "Opslag gewenst (lokaal/cloud)",
  bestaande_systemen: "Bestaande beveiligingssystemen",
  bouwjaar: "Bouwjaar woning",
  isolatiewaarde: "Isolatiewaarde (slecht/matig/goed/zeer goed)",
  huidige_verwarming: "Huidige verwarmingsinstallatie",
  vloeroppervlak_m2: "Totaal vloeroppervlak (m²)",
};

export function AdviceDocumentForm({
  quoteId,
  products,
  existingDocs,
}: {
  quoteId: string;
  products: Product[];
  existingDocs: AdviceDoc[];
}) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [docs, setDocs] = useState<AdviceDoc[]>(existingDocs);

  const adviceType = ADVICE_TYPES.find((t) => t.value === selectedType);

  async function handleGenerate() {
    if (!selectedType) return toast.error("Selecteer een adviestype");
    setGenerating(true);
    setGeneratedContent("");
    try {
      const res = await fetch("/api/ai/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          type: selectedType,
          customerData: formData,
          productIds: selectedProductIds,
        }),
      });
      const data = await res.json();
      setGeneratedContent(data.content);
      setDocs((prev) => [
        { id: data.id, type: selectedType, content: data.content, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      toast.success("Adviesdocument gegenereerd!");
    } catch {
      toast.error("Generatie mislukt");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Bestaande docs */}
      {docs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Gegenereerde adviesdocumenten</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {docs.map((doc) => {
              const typeInfo = ADVICE_TYPES.find((t) => t.value === doc.type);
              return (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{typeInfo?.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{typeInfo?.label ?? doc.type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setGeneratedContent(doc.content)}>
                      <FileText className="mr-2 h-3 w-3" />
                      Bekijken
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/advice/${doc.id}/pdf`, "_blank")}>
                      <Download className="mr-2 h-3 w-3" />
                      PDF
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Nieuw document genereren */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Nieuw adviesdocument genereren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-3">
            {ADVICE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setSelectedType(t.value); setFormData({}); }}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedType === t.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="text-sm font-medium">{t.label}</div>
              </button>
            ))}
          </div>

          {adviceType && (
            <>
              <Separator />

              {/* Dynamic form fields */}
              <div className="grid grid-cols-2 gap-4">
                {adviceType.fields.map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs">{FIELD_LABELS[field] ?? field}</Label>
                    <Input
                      placeholder={FIELD_LABELS[field]}
                      value={formData[field] ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Product selection */}
              {products.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Producten meenemen in advies (optioneel)</Label>
                  <div className="flex flex-wrap gap-2">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSelectedProductIds((prev) =>
                            prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                          selectedProductIds.includes(p.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Genereren...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Adviesdocument genereren</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Generated content preview */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Gegenereerd adviesdocument</CardTitle>
              <Badge>AI gegenereerd</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {generatedContent}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
