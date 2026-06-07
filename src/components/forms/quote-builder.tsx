"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Save,
  ArrowLeft,
  X,
  Sparkles,
  Wand2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Customer = { id: string; name: string; email: string | null };
type Product = { id: string; category: string; name: string; basePrice: string | number; vatRate: string | number; unit: string };
type ProductSetItem = { productId: string; qty: string | number; product: Product };
type ProductSet = { id: string; name: string; items: ProductSetItem[] };

type QuoteItem = {
  id: string;
  productId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  total: number;
};

// â”€â”€â”€ Defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_FLOW = [
  { n: 1, t: "Locatie & situatie", d: "Adres, type woning of pand en de gewenste plek voor de laadpaal." },
  { n: 2, t: "Meterkast & aansluiting", d: "Foto meterkast, close-up slimme meter en het aantal fasen." },
  { n: 3, t: "Verdeelkast", d: "Overzichtsfoto en ruimte voor een extra groep of loadbalancing." },
  { n: 4, t: "Kabelroute", d: "Route en lengte van meterkast naar paal â€” is er graafwerk nodig?" },
  { n: 5, t: "Laadpaal & montage", d: "Type 2 of vaste kabel, gevel of montagepaal, verrekening." },
  { n: 6, t: "Klantgegevens", d: "Contactgegevens en of het zakelijk of particulier is." },
  { n: 7, t: "Controle & versturen", d: "Overzicht van alle gegevens en foto's, akkoord en verzenden." },
];

const DEFAULT_APPROACH = [
  { n: "01", t: "Inventarisatie", d: "Samen scope, velden en interne opvolging scherp krijgen." },
  { n: "02", t: "UX-ontwerp", d: "Stappen, volgorde en logica van de aanvraagflow." },
  { n: "03", t: "Visueel ontwerp", d: "Styling in de huisstijl â€” klaar voor akkoord." },
  { n: "04", t: "Technische bouw", d: "Maatwerk in WordPress: uploads, e-mail en formulierlogica." },
  { n: "05", t: "Test & feedback", d: "Testen op alle apparaten + Ã©Ã©n feedbackronde." },
  { n: "06", t: "Livegang & nazorg", d: "Plaatsing, korte uitleg en ondersteuning na oplevering." },
];

const DEFAULT_OPTIONS = [
  { t: "Dashboardomgeving", d: "Alle aanvragen, foto's en statussen centraal op Ã©Ã©n scherm.", tag: "Aparte offerte" },
  { t: "Extra dienst-flows", d: "Airco, warmtepomp, zonnepanelen, thuisbatterij, EMS â€” per dienst uitgebreid.", tag: "Per dienst" },
  { t: "Foto-export naar dossier", d: "Aangeleverde foto's makkelijk toevoegen aan een dossier in Syntess.", tag: "Op aanvraag" },
  { t: "Onderhoud & support", d: "Updates, monitoring en kleine aanpassingen na oplevering.", tag: "Maandelijks" },
];

const DEFAULT_EXCLUSIONS = [
  "Betaalde plugins of externe licenties",
  "Hosting en domeinnaam",
  "Teksten of fotografie",
  "Grote wijzigingen buiten de afgesproken scope",
  "Koppelingen met systemen buiten deze offerte",
];

const KOOLHAAS_FLOW = [
  { n: 1, t: "Akkoord & opname", d: "Offerte akkoord, laatste technische check en bevestiging van de opstelplek." },
  { n: 2, t: "Materialen bestellen", d: "Batterij, omvormer, beveiligingen, bekabeling en montagemateriaal worden ingepland." },
  { n: 3, t: "Meterkast voorbereiden", d: "Controle op fasen, beschikbare ruimte, hoofdzekering en benodigde uitbreidingen." },
  { n: 4, t: "Montage & bekabeling", d: "Plaatsing van de installatie met nette kabelroute en veilige afwerking." },
  { n: 5, t: "Aansluiten & testen", d: "Elektrische controle, inbedrijfstelling, app-koppeling en functionele test." },
  { n: 6, t: "Uitleg & oplevering", d: "Korte uitleg over gebruik, monitoring, onderhoud en wat u kunt verwachten." },
];

const KOOLHAAS_APPROACH = [
  { n: "01", t: "Technische controle", d: "Ik controleer of de gekozen oplossing past bij woning, meterkast en verbruik." },
  { n: "02", t: "Heldere voorbereiding", d: "Planning, materialen en eventuele bijzonderheden worden vooraf afgestemd." },
  { n: "03", t: "Veilige uitvoering", d: "Installatie volgens geldende normen, met nette montage en duidelijke kabelroutes." },
  { n: "04", t: "Inbedrijfstelling", d: "Systeem testen, instellingen nalopen en zorgen dat monitoring werkt." },
  { n: "05", t: "Oplevering", d: "Samen controleren we de installatie en krijgt u uitleg over gebruik en onderhoud." },
];

const KOOLHAAS_OPTIONS = [
  { t: "Meterkast uitbreiding", d: "Extra groep, beveiliging of aanpassing als de bestaande situatie dat vraagt.", tag: "Na opname" },
  { t: "Energiemanagement", d: "EMS voor slim sturen van batterij, zonnepanelen, laadpaal en grootverbruikers.", tag: "Optioneel" },
  { t: "Extra monitoring", d: "Inzicht in verbruik, teruglevering en batterijgedrag via app of dashboard.", tag: "Op aanvraag" },
  { t: "Onderhoudscontrole", d: "Periodieke controle op veiligheid, instellingen en prestaties.", tag: "Jaarlijks" },
];

const KOOLHAAS_EXCLUSIONS = [
  "Bouwkundige werkzaamheden zoals hak-, breek-, stuc- of schilderwerk",
  "Graafwerk of herstel van bestrating tenzij expliciet opgenomen",
  "Netverzwaring of werkzaamheden door de netbeheerder",
  "Vergunningen, subsidies of gemeentelijke regelingen",
  "Aanpassingen buiten de beschreven installatie en materialen",
];

function genId() {
  return Math.random().toString(36).slice(2);
}

export function QuoteBuilder({
  customers,
  initialQuote,
  companySlug,
}: {
  customers: Customer[];
  products: Product[];
  productSets: ProductSet[];
  companySlug: string;
  companyName: string;
  initialQuote?: any;
}) {
  const router = useRouter();
  const isKoolhaas = companySlug === "koolhaas";
  const [customerId, setCustomerId] = useState(initialQuote?.customerId || "");
  const [title, setTitle] = useState(initialQuote?.title || (isKoolhaas ? "Thuisbatterij installatie" : "Maatwerk offerte-aanvraagmodule laadpalen"));
  const [category, setCategory] = useState(initialQuote?.category || (isKoolhaas ? "Installatie · Energieopslag" : "Maatwerk module · WordPress"));
  const [tagline, setTagline] = useState(initialQuote?.tagline || (isKoolhaas ? "Advies · Installatie · Inbedrijfstelling" : "Ontwerp · Bouw · Plaatsing"));
  const [itemsHeader, setItemsHeader] = useState(initialQuote?.itemsHeader || (isKoolhaas ? "Wat wordt er geïnstalleerd" : "Onderdelen binnen fase 1."));
  const [validUntil, setValidUntil] = useState(initialQuote?.validUntil ? new Date(initialQuote.validUntil).toISOString().split('T')[0] : "");
  const [intro, setIntro] = useState(initialQuote?.intro || "");
  const [outro, setOutro] = useState(initialQuote?.outro || "");
  const [notes, setNotes] = useState(initialQuote?.notes || "");
  
  const [flow, setFlow] = useState(initialQuote?.flow || (isKoolhaas ? KOOLHAAS_FLOW : DEFAULT_FLOW));
  const [approach, setApproach] = useState(initialQuote?.approach || (isKoolhaas ? KOOLHAAS_APPROACH : DEFAULT_APPROACH));
  const [options, setOptions] = useState(initialQuote?.options || (isKoolhaas ? KOOLHAAS_OPTIONS : DEFAULT_OPTIONS));
  const [exclusions, setExclusions] = useState(initialQuote?.exclusions || (isKoolhaas ? KOOLHAAS_EXCLUSIONS : DEFAULT_EXCLUSIONS));

  const [items, setItems] = useState<QuoteItem[]>(
    initialQuote?.items?.map((i: any) => ({ ...i, id: i.id || genId() })) || [
      { id: genId(), description: isKoolhaas ? "Levering en installatie volgens offerte" : "Ontwerp, bouw en plaatsing van module", qty: 1, unitPrice: 0, vatRate: 21, total: 0 },
    ]
  );
  
  const [saving, setSaving] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const customer = customers.find((c) => c.id === customerId);

  const totalExVat = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const totalVat = items.reduce((acc, i) => acc + i.qty * i.unitPrice * (i.vatRate / 100), 0);
  const totalIncVat = totalExVat + totalVat;

  const quoteData = {
    number: initialQuote?.number || "CONCEPT",
    title,
    category,
    tagline,
    itemsHeader,
    status: initialQuote?.status || "DRAFT",
    intro,
    outro,
    validUntil,
    totalExVat,
    totalVat,
    totalIncVat,
    items,
    flow,
    approach,
    options,
    exclusions,
    customer: {
      name: customer?.name || "Selecteer een klant",
      email: customer?.email || null,
      address: null,
      city: null
    },
    company: { slug: companySlug }
  };

  async function handleAiMagic() {
    if (!aiInput.trim()) return toast.error("Plak eerst een gesprek of aantekeningen");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/extract-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiInput, customerName: customer?.name || "de klant" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      // Apply AI results
      if (data.title) setTitle(data.title);
      if (data.category) setCategory(data.category);
      if (data.tagline) setTagline(data.tagline);
      if (data.intro) setIntro(data.intro);
      if (data.itemsHeader) setItemsHeader(data.itemsHeader);
      if (data.items) setItems(data.items.map((i: any) => ({ ...i, id: genId(), vatRate: 21, total: i.qty * i.unitPrice })));
      if (data.flow) setFlow(data.flow);
      if (data.approach) setApproach(data.approach);
      if (data.options) setOptions(data.options);
      if (data.exclusions) setExclusions(data.exclusions);
      if (data.outro) setOutro(data.outro);

      toast.success("AI Magic toegepast! Controleer de velden.");
      setShowAiModal(false);
    } catch {
      toast.error("AI Magic is mislukt. Probeer het opnieuw.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!customerId) return toast.error("Selecteer een klant");
    if (items.some((i) => !i.description)) return toast.error("Vul alle omschrijvingen in");

    setSaving(true);
    try {
      const method = initialQuote?.id ? "PUT" : "POST";
      const url = initialQuote?.id ? `/api/quotes/${initialQuote.id}` : "/api/quotes";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          customerId, 
          title, 
          category, 
          tagline,
          itemsHeader,
          validUntil, 
          intro, 
          outro, 
          notes,
          flow,
          approach,
          options,
          exclusions,
          items: items.map(({ id, ...rest }) => initialQuote?.id ? { ...rest, id: id.length > 20 ? id : undefined } : rest) 
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(initialQuote?.id ? "Offerte opgeslagen" : "Offerte aangemaakt");
      router.push(`/quotes/${initialQuote?.id ?? data.id}`);
      router.refresh();
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: genId(), description: "Nieuw onderdeel", qty: 1, unitPrice: 0, vatRate: 21, total: 0 },
    ]);
  }

  function updateItem(id: string, updates: Partial<QuoteItem>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newItem = { ...item, ...updates };
        newItem.total = newItem.qty * newItem.unitPrice;
        return newItem;
      })
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const handleUpdate = (updates: Partial<any>) => {
    if (updates.title !== undefined) setTitle(updates.title);
    if (updates.category !== undefined) setCategory(updates.category);
    if (updates.tagline !== undefined) setTagline(updates.tagline);
    if (updates.itemsHeader !== undefined) setItemsHeader(updates.itemsHeader);
    if (updates.intro !== undefined) setIntro(updates.intro);
    if (updates.outro !== undefined) setOutro(updates.outro);
    if (updates.flow !== undefined) setFlow(updates.flow);
    if (updates.approach !== undefined) setApproach(updates.approach);
    if (updates.options !== undefined) setOptions(updates.options);
    if (updates.exclusions !== undefined) setExclusions(updates.exclusions);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* â”€â”€ Top Toolbar â”€â”€ */}
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Terug
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="font-bold text-slate-900">
            {initialQuote ? `Offerte ${initialQuote.number} bewerken` : "Nieuwe offerte visueel bewerken"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
            <DialogTrigger render={
              <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 bg-orange-50/50 font-bold gap-2">
                <Wand2 className="h-4 w-4" /> AI Magic
              </Button>
            } />
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  AI Magic: Gesprek omzetten naar offerte
                </DialogTitle>
                <DialogDescription>
                  Plak hier je ChatGPT gesprek of ruwe aantekeningen. De AI vult de hele offerte (5 pagina's) automatisch voor je in op basis van de besproken details.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea 
                  placeholder="Bijv: 'De klant wil een website met 5 pagina's...'" 
                  rows={12} 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  className="resize-none"
                />
                <Button 
                  onClick={handleAiMagic} 
                  disabled={aiLoading} 
                  className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg font-bold gap-2"
                >
                  {aiLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                  Genereer Offerte
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          <div className="flex items-center gap-2 mr-4">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Klant:</Label>
            <Select onValueChange={setCustomerId} value={customerId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Selecteer klant" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mr-4">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Geldig tot:</Label>
            <Input 
              type="date" 
              className="w-[160px] h-9" 
              value={validUntil} 
              onChange={(e) => setValidUntil(e.target.value)} 
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Offerte Opslaan
          </Button>
        </div>
      </header>

      <div className="flex w-full max-w-[1920px] gap-8 p-6 lg:p-8 2xl:px-10 mx-auto items-start">
        {/* â”€â”€ Visual Editor (The Paper) â”€â”€ */}
        <div className="flex-1">
          <QuoteSheetPreview 
            quote={quoteData as any} 
            companySlug={companySlug}
            isEditable={true} 
            onUpdate={handleUpdate}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
          />
        </div>

        {/* â”€â”€ Right Panel (Controls) â”€â”€ */}
        <aside className="w-[420px] 2xl:w-[460px] sticky top-[100px] space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                Prijzen & Regels
                <Button size="sm" variant="outline" onClick={addItem} className="h-8">
                  <Plus className="h-3 w-3 mr-1" /> Regel
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {items.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 relative group">
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <Input 
                      placeholder="Omschrijving..." 
                      value={item.description} 
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Aantal</Label>
                        <Input 
                          type="number" 
                          value={item.qty} 
                          onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Stukprijs</Label>
                        <Input 
                          type="number" 
                          value={item.unitPrice} 
                          onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">INTERNE NOTITIES</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  placeholder="Bijv. afspraken over korting..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
               <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>
            <CardContent className="pt-6 relative z-10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Totale Investering</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{formatCurrency(totalIncVat)}</span>
                <span className="text-xs text-slate-400">incl. btw</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Excl. BTW</span>
                  <span>{formatCurrency(totalExVat)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>BTW (21%)</span>
                  <span>{formatCurrency(totalVat)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
