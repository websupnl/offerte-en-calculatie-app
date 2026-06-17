"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Loader2,
  Save,
  ArrowLeft,
  X,
  Sparkles,
  Wand2,
  Upload,
  Image as ImageIcon,
  Scissors,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CornerDownRight,
  Activity,
  FileText,
  Calculator,
  ShieldCheck,
  Calendar,
  Zap,
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
  costPrice?: number;
  vatRate: number;
  total: number;
  indent: number;
};

type QuoteAttachment = {
  id: string;
  title: string;
  imageUrl: string;
  liveUrl: string;
  caption: string;
};

type InitialQuoteAttachment = {
  id?: string;
  title?: string | null;
  imageUrl?: string | null;
  liveUrl?: string | null;
  caption?: string | null;
};

type GeneratedQuoteItem = {
  description?: string | null;
  qty?: number | string | null;
  unitPrice?: number | string | null;
  unit_price?: number | string | null;
  vatRate?: number | string | null;
  vat_rate?: number | string | null;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_FLOW = [
  { n: 1, t: "Locatie & situatie", d: "Adres, type woning of pand en de gewenste plek voor de laadpaal." },
  { n: 2, t: "Meterkast & aansluiting", d: "Foto meterkast, close-up slimme meter en het aantal fasen." },
  { n: 3, t: "Verdeelkast", d: "Overzichtsfoto en ruimte voor een extra groep of loadbalancing." },
  { n: 4, t: "Kabelroute", d: "Route en lengte van meterkast naar paal — is er graafwerk nodig?" },
  { n: 5, t: "Laadpaal & montage", d: "Type 2 of vaste kabel, gevel of montagepaal, verrekening." },
  { n: 6, t: "Klantgegevens", d: "Contactgegevens en of het zakelijk of particulier is." },
  { n: 7, t: "Controle & versturen", d: "Overzicht van alle gegevens en foto's, akkoord en verzenden." },
];

const DEFAULT_APPROACH = [
  { n: "01", t: "Inventarisatie", d: "Samen scope, velden en interne opvolging scherp krijgen." },
  { n: "02", t: "UX-ontwerp", d: "Stappen, volgorde en logica van de aanvraagflow." },
  { n: "03", t: "Visueel ontwerp", d: "Styling in de huisstijl — klaar voor akkoord." },
  { n: "04", t: "Technische bouw", d: "Maatwerk in WordPress: uploads, e-mail en formulierlogica." },
  { n: "05", t: "Test & feedback", d: "Testen op alle apparaten + één feedbackronde." },
  { n: "06", t: "Livegang & nazorg", d: "Plaatsing, korte uitleg en ondersteuning na oplevering." },
];

const DEFAULT_OPTIONS = [
  { t: "Dashboardomgeving", d: "Alle aanvragen, foto's en statussen centraal op één scherm.", tag: "Aparte offerte" },
  { t: "Extra dienst-flows", d: "Airco, warmtepomp, zonnepanelen, thuisbatterij, EMS — per dienst uitgebreid.", tag: "Per dienst" },
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

function splitDescriptionParts(description: string) {
  return description
    .split(/\r?\n|(?:\s+[•*-]\s+)/)
    .map((part) => part.replace(/^[\s•*-]+/, "").trim())
    .filter(Boolean);
}

function normalizeGeneratedItems(items: GeneratedQuoteItem[]): QuoteItem[] {
  return items.flatMap((item) => {
    const description = String(item.description ?? "");
    const parts = splitDescriptionParts(description);
    const descriptions = parts.length > 1 ? parts : [description.trim()];

    return descriptions
      .filter(Boolean)
      .map((part, index) => ({
        ...item,
        id: genId(),
        description: part,
        qty: Number(item.qty ?? 1),
        unitPrice: index === 0 ? Number(item.unitPrice ?? item.unit_price ?? 0) : 0,
        vatRate: Number(item.vatRate ?? item.vat_rate ?? 21),
        total: index === 0 ? Number(item.qty ?? 1) * Number(item.unitPrice ?? item.unit_price ?? 0) : 0,
        indent: index === 0 ? 0 : 1,
      }));
  });
}

export function QuoteBuilder({
  customers,
  initialQuote,
  initialAdvice,
  companySlug,
}: {
  customers: Customer[];
  products: Product[];
  productSets: ProductSet[];
  companySlug: string;
  companyName: string;
  initialQuote?: any;
  initialAdvice?: any;
}) {
  const router = useRouter();
  const isKoolhaas = companySlug === "koolhaas";

  // ─── Core State ───
  const [customerId, setCustomerId] = useState(initialQuote?.customerId || initialAdvice?.customerId || "");
  const [title, setTitle] = useState(initialQuote?.title || initialAdvice?.title || (isKoolhaas ? "Thuisbatterij installatie" : "Maatwerk website met voorraadbeheer"));
  const [category, setCategory] = useState(initialQuote?.category || (isKoolhaas ? "Installatie · Energieopslag" : "Maatwerk module · WordPress"));
  const [tagline, setTagline] = useState(initialQuote?.tagline || (isKoolhaas ? "Advies · Installatie · Inbedrijfstelling" : "Ontwerp · Bouw · Plaatsing"));
  const [itemsHeader, setItemsHeader] = useState(initialQuote?.itemsHeader || (isKoolhaas ? "Wat wordt er geïnstalleerd" : "Prijsopbouw"));
  const [validUntil, setValidUntil] = useState(initialQuote?.validUntil ? new Date(initialQuote.validUntil).toISOString().split('T')[0] : "");
  
  // Items Logic
  const [items, setItems] = useState<QuoteItem[]>(
    initialQuote?.items?.map((i: any) => ({ ...i, id: i.id || genId(), indent: i.indent ?? 0 })) || 
    (initialAdvice ? [
      { 
        id: genId(), 
        description: `Thuisbatterij systeem (${initialAdvice.scenarios[1]?.capacityKwh} kWh) - ${initialAdvice.scenarios[1]?.goal}`, 
        qty: 1, unitPrice: 0, vatRate: 21, total: 0, indent: 0 
      },
      {
        id: genId(),
        description: "Inclusief Slimme Sturing (EMS) en installatie",
        qty: 1, unitPrice: 0, vatRate: 21, total: 0, indent: 1
      }
    ] : [
      { id: genId(), description: isKoolhaas ? "Levering en installatie volgens offerte" : "Professionele website waarop bezoekers snel het aanbod kunnen bekijken en eenvoudig contact kunnen opnemen", qty: 1, unitPrice: 0, vatRate: 21, total: 0, indent: 0 },
    ])
  );

  // Attachments Logic
  const [attachments, setAttachments] = useState<QuoteAttachment[]>(
    initialQuote?.attachments?.map((attachment: InitialQuoteAttachment) => ({
      id: attachment.id || genId(),
      title: attachment.title || "",
      imageUrl: attachment.imageUrl || "",
      liveUrl: attachment.liveUrl || "",
      caption: attachment.caption || "",
    })) || []
  );

  // Text & Content State
  const [intro, setIntro] = useState(initialQuote?.intro || initialAdvice?.summary || (isKoolhaas ? "" : "Bedankt voor je interesse. In dit voorstel staat een professionele website centraal waarmee bezoekers snel kunnen zien wat je aanbiedt en eenvoudig contact kunnen opnemen. Daarnaast krijg je een praktische beheeromgeving, zodat je zelf zonder technische kennis inhoud kunt aanpassen."));
  const [outro, setOutro] = useState(initialQuote?.outro || "");
  const [notes, setNotes] = useState(initialQuote?.notes || "");
  const [quoteType, setQuoteType] = useState(initialQuote?.quoteType || (initialAdvice ? "BATTERY" : "GENERAL"));
  const [assumptions, setAssumptions] = useState(initialQuote?.assumptions || (initialAdvice?.currentDevs || []));
  const [technicalNotes, setTechnicalNotes] = useState(initialQuote?.technicalNotes || []);
  const [customerResponsibilities, setCustomerResponsibilities] = useState(initialQuote?.customerResponsibilities || []);
  const [planning, setPlanning] = useState(initialQuote?.planning || { leadTime: "", executionDuration: "", preferredDate: "" });
  const [commercial, setCommercial] = useState(initialQuote?.commercial || { validDays: 30, paymentTerms: "", warranty: "" });
  const [batteryAdvice, setBatteryAdvice] = useState(initialQuote?.batteryAdvice || {
    nominalCapacityKwh: initialAdvice?.calculation?.resultKwh || 0,
    recommendedScenario: initialAdvice?.scenarios[1]?.name || ""
  });
  const [choiceGroups, setChoiceGroups] = useState<any[]>(initialQuote?.choiceGroups || []);
  const [internalAdvice, setInternalAdvice] = useState(initialQuote?.internalAdvice || initialAdvice?.analysis || "");
  
  const [flow, setFlow] = useState(initialQuote?.flow || (isKoolhaas ? KOOLHAAS_FLOW : DEFAULT_FLOW));
  const [approach, setApproach] = useState(initialQuote?.approach || (isKoolhaas ? KOOLHAAS_APPROACH : DEFAULT_APPROACH));
  const [options, setOptions] = useState(initialQuote?.options || (isKoolhaas ? KOOLHAAS_OPTIONS : DEFAULT_OPTIONS));
  const [exclusions, setExclusions] = useState(initialQuote?.exclusions || (isKoolhaas ? KOOLHAAS_EXCLUSIONS : DEFAULT_EXCLUSIONS));

  // ─── UI State ───
  const [saving, setSaving] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [priceDisplayMode, setPriceDisplayMode] = useState<"incl" | "excl">("incl");
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after"; indent: number } | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const customer = customers.find((c) => c.id === customerId);
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const totalExVat = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const totalVat = items.reduce((acc, i) => acc + i.qty * i.unitPrice * (i.vatRate / 100), 0);
  const totalIncVat = totalExVat + totalVat;
  const displayedTotal = priceDisplayMode === "incl" ? totalIncVat : totalExVat;

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
    attachments,
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
      if (data.items) setItems(normalizeGeneratedItems(data.items));
      if (data.flow) setFlow(data.flow);
      if (data.approach) setApproach(data.approach);
      if (data.options) setOptions(data.options);
      if (data.exclusions) setExclusions(data.exclusions);
      if (data.outro) setOutro(data.outro);

      // Apply New expert fields
      if (data.quoteType) setQuoteType(data.quoteType);
      if (data.assumptions) setAssumptions(data.assumptions);
      if (data.technicalNotes) setTechnicalNotes(data.technicalNotes);
      if (data.customerResponsibilities) setCustomerResponsibilities(data.customerResponsibilities);
      if (data.planning) setPlanning(data.planning);
      if (data.commercial) setCommercial(data.commercial);
      if (data.batteryAdvice) setBatteryAdvice(data.batteryAdvice);
      if (data.internalAdvice) setInternalAdvice(data.internalAdvice);

      toast.success("AI Magic toegepast! Controleer de velden.");
      setShowAiModal(false);
    } catch {
      toast.error("AI Magic is mislukt. Probeer het opnieuw.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleVisionScan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setVisionLoading(true);
    const toastId = toast.loading("Foto analyseren...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/vision-extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.suggestedItems?.length) {
        const newItems = data.suggestedItems.map((item: any) => ({
          id: genId(),
          description: item.description,
          qty: item.qty || 1,
          unitPrice: item.unitPrice || 0,
          vatRate: 21,
          total: (item.qty || 1) * (item.unitPrice || 0),
          indent: 0
        }));
        setItems(prev => [...prev, ...newItems]);
      }

      if (data.findings?.length) {
        setTechnicalNotes(prev => [...prev as string[], ...data.findings]);
      }

      toast.success("Foto geanalyseerd! Materialen toegevoegd.", { id: toastId });
    } catch {
      toast.error("Analyse mislukt. Probeer het opnieuw.", { id: toastId });
    } finally {
      setVisionLoading(false);
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
          quoteType,
          assumptions,
          technicalNotes,
          customerResponsibilities,
          planning,
          commercial,
          batteryAdvice,
          internalAdvice,
          flow,
          approach,
          options,
          exclusions,
          attachments: attachments
            .filter((attachment) => attachment.imageUrl.trim() || attachment.liveUrl.trim())
            .map(({ id, ...rest }) =>
              initialQuote?.id && id.length > 20 ? { ...rest, id } : rest
            ),
          items: items.map(({ id, ...rest }) => ({
            ...rest,
            id: (initialQuote?.id && id.length > 20) ? id : undefined
          }))
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
      { id: genId(), description: "Nieuw onderdeel", qty: 1, unitPrice: 0, vatRate: 21, total: 0, indent: 0 },
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
    setItems((prev) => prev.length > 1 ? prev.filter((i) => i.id !== id) : prev);
  }

  function setItemIndent(id: string, indent: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, indent: Math.max(0, Math.min(1, indent)) } : item)));
  }

  function moveItem(draggedId: string, targetId: string, position: "before" | "after", indent: number) {
    if (draggedId === targetId) return;
    setItems((prev) => {
      const dragged = prev.find((i) => i.id === draggedId);
      if (!dragged) return prev;
      const without = prev.filter((i) => i.id !== draggedId);
      let targetIndex = without.findIndex((i) => i.id === targetId);
      if (targetIndex === -1) return prev;
      if (position === "after") targetIndex += 1;
      const next = [...without];
      next.splice(targetIndex, 0, { ...dragged, indent });
      return next;
    });
  }

  function handleItemDragOver(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    if (!dragItemId || dragItemId === targetId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const position: "before" | "after" = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    const indent = e.clientX - rect.left > 28 ? 1 : 0;
    setDropTarget({ id: targetId, position, indent });
  }

  function handleItemDrop(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    if (dragItemId && dropTarget && dropTarget.id === targetId) {
      moveItem(dragItemId, targetId, dropTarget.position, dropTarget.indent);
    }
    setDragItemId(null);
    setDropTarget(null);
  }

  function splitItem(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;

      const parts = splitDescriptionParts(item.description);

      if (parts.length < 2) return prev;

      return prev.flatMap((current) => {
        if (current.id !== id) return current;
        return parts.map((description, index) => ({
          ...current,
          id: index === 0 ? current.id : genId(),
          description,
          unitPrice: index === 0 ? current.unitPrice : 0,
          total: index === 0 ? current.qty * current.unitPrice : 0,
        }));
      });
    });
  }

  function updateAttachment(id: string, updates: Partial<QuoteAttachment>) {
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === id ? { ...attachment, ...updates } : attachment
      )
    );
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }

  function addAttachmentUrl() {
    setAttachments((prev) => [
      ...prev,
      { id: genId(), title: "Ontwerp", imageUrl: "", liveUrl: "", caption: "" },
    ]);
  }

  async function handleAttachmentUpload(files: FileList | null) {
    if (!files?.length) return;

    try {
      const next = await Promise.all(
        Array.from(files).map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error("Alleen afbeeldingen zijn toegestaan");
          }

          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/quote-attachments/upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Upload mislukt");

          const uploaded = (await res.json()) as { url: string; title?: string };
          return {
            id: genId(),
            title: uploaded.title || file.name.replace(/\.[^.]+$/, ""),
            imageUrl: uploaded.url,
            liveUrl: "",
            caption: "",
          };
        })
      );
      setAttachments((prev) => [...prev, ...next]);
      toast.success(`${next.length} ontwerp${next.length === 1 ? "" : "en"} toegevoegd`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload mislukt");
    }
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
      {/* ── Top Toolbar ── */}
      <header className="sticky top-0 z-[100] bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Terug
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="leading-tight">
            <h1 className="font-bold text-slate-900">
              {initialQuote ? `${title || initialQuote.number} bewerken` : "Nieuwe offerte visueel bewerken"}
            </h1>
            {initialQuote && <p className="text-xs text-slate-400">{initialQuote.number}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <Button variant="outline" asChild className="text-blue-600 border-blue-200 hover:bg-blue-50 bg-blue-50/50 font-bold gap-2">
              <div>
                {visionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Scan Situatie
              </div>
            </Button>
            <input type="file" accept="image/*" className="sr-only" onChange={handleVisionScan} disabled={visionLoading} />
          </label>

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
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Naam:</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naam van de offerte"
              className="w-[220px] h-9"
            />
          </div>

          <div className="flex items-center gap-2 mr-4">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Klant:</Label>
            <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
              <PopoverTrigger render={
                <Button variant="outline" className="w-[200px] h-9 justify-between font-normal">
                  <span className="truncate">{customer?.name || "Selecteer klant"}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
              } />
              <PopoverContent align="start" className="z-[200] w-[240px] p-0 gap-0">
                <div className="p-2 border-b border-slate-100">
                  <Input
                    autoFocus
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Zoek klant..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-xs text-slate-400 px-2 py-3 text-center">Geen klant gevonden</p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerPickerOpen(false);
                          setCustomerSearch("");
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-slate-100 ${
                          c.id === customerId ? "bg-slate-100 font-semibold" : ""
                        }`}
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
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
        {/* ── Visual Editor (The Paper) ── */}
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

        {/* ── Right Panel (Controls) ── */}
        <aside className="w-[420px] 2xl:w-[460px] sticky top-[88px] space-y-6 pb-2">
          <Tabs defaultValue="quote" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="quote"><FileText className="h-4 w-4 mr-2" />Offerte</TabsTrigger>
              <TabsTrigger value="tech"><Zap className="h-4 w-4 mr-2" />Technisch</TabsTrigger>
              <TabsTrigger value="margin"><Calculator className="h-4 w-4 mr-2" />Marge</TabsTrigger>
            </TabsList>

            <TabsContent value="quote" className="space-y-6">
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
                  <p className="text-xs text-slate-400 -mt-1">
                    Sleep aan de greep om te herordenen. Sleep naar rechts om te nesten.
                  </p>
                  <div className="space-y-1 max-h-[460px] overflow-y-auto pr-2">
                    {items.map((item) => (
                      <div key={item.id}>
                        {dropTarget?.id === item.id && dropTarget.position === "before" && (
                          <div
                            className="h-0.5 rounded-full bg-orange-500 mb-1"
                            style={{ marginLeft: dropTarget.indent ? 28 : 0 }}
                          />
                        )}
                        <div
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDrop={(e) => handleItemDrop(e, item.id)}
                          onDragEnd={() => { setDragItemId(null); setDropTarget(null); }}
                          className={`flex gap-2 p-3 rounded-lg border space-y-0 relative group transition-colors ${
                            item.indent ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200"
                          } ${dragItemId === item.id ? "opacity-40" : ""}`}
                          style={{ marginLeft: item.indent ? 28 : 0 }}
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDragItemId(item.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="flex shrink-0 cursor-grab items-center self-stretch text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              {item.indent ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  <CornerDownRight className="h-3 w-3" /> Sub-regel
                                </span>
                              ) : <span />}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button type="button" onClick={() => setItemIndent(item.id, item.indent ? 0 : 1)} className="bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-400 hover:bg-slate-50">
                                  {item.indent ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                                <button type="button" onClick={() => removeItem(item.id)} className="bg-white border border-slate-200 rounded-full p-1 shadow-sm text-red-500 hover:bg-red-50">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <Textarea
                              placeholder="Omschrijving..."
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              rows={2}
                              className="min-h-16 resize-y text-sm"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Aantal</Label>
                                <Input type="number" value={item.qty} onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Stukprijs (Verk)</Label>
                                <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Groep ID (Optie)</Label>
                                <Input placeholder="bijv: g1" value={item.choiceGroupId || ""} onChange={(e) => updateItem(item.id, { choiceGroupId: e.target.value })} className="h-8 text-sm" />
                              </div>
                            </div>
                          </div>
                        </div>
                        {dropTarget?.id === item.id && dropTarget.position === "after" && (
                          <div
                            className="h-0.5 rounded-full bg-orange-500 mt-1"
                            style={{ marginLeft: dropTarget.indent ? 28 : 0 }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    Ontwerpen
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={addAttachmentUrl} className="h-8">
                        <Plus className="h-3 w-3 mr-1" /> URL
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                      Voeg mockups of screenshots toe.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                          <Input value={attachment.title} onChange={(e) => updateAttachment(attachment.id, { title: e.target.value })} className="h-8 text-sm" />
                          <Button size="icon" variant="ghost" onClick={() => removeAttachment(attachment.id)} className="h-8 w-8 text-red-500"><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tech" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-green-600" /> Intern Technisch Advies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Offerte Type</Label>
                    <Select value={quoteType} onValueChange={setQuoteType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">Algemeen Project</SelectItem>
                        <SelectItem value="BATTERY">Thuisbatterij</SelectItem>
                        <SelectItem value="SOLAR">Zonnepanelen</SelectItem>
                        <SelectItem value="WEB">Webdevelopment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Onderbouwing (Intern)</Label>
                    <Textarea 
                      rows={6} 
                      value={internalAdvice} 
                      onChange={(e) => setInternalAdvice(e.target.value)} 
                      placeholder="Waarom dit advies? Bronnen, berekeningen..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Technische Aannames</Label>
                    <Textarea 
                      rows={3} 
                      value={assumptions.join("\n")} 
                      onChange={(e) => setAssumptions(e.target.value.split("\n"))} 
                      placeholder="Meterkast is geschikt, etc."
                    />
                  </div>

                  {quoteType === "BATTERY" && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 space-y-3">
                      <Label className="text-[10px] font-black text-orange-800 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="h-3 w-3" /> Batterij Dimensionering
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Capaciteit (kWh)</Label>
                          <Input type="number" value={batteryAdvice.nominalCapacityKwh || ""} onChange={(e) => setBatteryAdvice({...batteryAdvice, nominalCapacityKwh: Number(e.target.value)})} className="h-8 bg-white" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Vermogen (kW)</Label>
                          <Input type="number" value={batteryAdvice.chargePowerKw || ""} onChange={(e) => setBatteryAdvice({...batteryAdvice, chargePowerKw: Number(e.target.value)})} className="h-8 bg-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600" /> Planning & Commercieel
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Levertijd</Label>
                      <Input value={planning.leadTime || ""} onChange={(e) => setPlanning({...planning, leadTime: e.target.value})} className="h-8" placeholder="4-6 weken" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Doorlooptijd</Label>
                      <Input value={planning.executionDuration || ""} onChange={(e) => setPlanning({...planning, executionDuration: e.target.value})} className="h-8" placeholder="1 dag" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Garantie</Label>
                    <Input value={commercial.warranty || ""} onChange={(e) => setCommercial({...commercial, warranty: e.target.value})} className="h-8" placeholder="10 jaar fabrieksgarantie" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="margin" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Winst & Marge Analyse</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {items.map((item) => {
                      const cost = (item as any).costPrice || 0;
                      const profit = item.total - (cost * item.qty);
                      const margin = item.total > 0 ? (profit / item.total) * 100 : 0;
                      
                      return (
                        <div key={item.id} className="p-2 bg-slate-50 rounded border text-xs space-y-1">
                          <div className="font-medium truncate">{item.description}</div>
                          <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">Inkoop:</span>
                              <Input 
                                type="number" 
                                value={cost} 
                                onChange={(e) => updateItem(item.id, { costPrice: Number(e.target.value) } as any)} 
                                className="h-6 w-20 text-[10px] px-1"
                              />
                            </div>
                            <div className="text-right">
                              <span className={`font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(profit)}
                              </span>
                              <span className="text-slate-400 ml-1">({margin.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="bg-slate-900 text-white p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Totale Inkoop</span>
                      <span>{formatCurrency(items.reduce((acc, i) => acc + (((i as any).costPrice || 0) * i.qty), 0))}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Totale Omzet (Ex)</span>
                      <span>{formatCurrency(totalExVat)}</span>
                    </div>
                    <Separator className="bg-white/10" />
                    <div className="flex justify-between font-bold text-lg">
                      <span className="text-orange-400">Netto Winst</span>
                      <span>{formatCurrency(totalExVat - items.reduce((acc, i) => acc + (((i as any).costPrice || 0) * i.qty), 0))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className={`relative overflow-hidden border-none text-white shadow-xl ${isKoolhaas ? "bg-[#08111f]" : "bg-[#06040c]"}`}>
            <div className="pointer-events-none absolute inset-0">
              {isKoolhaas ? (
                <>
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#1f9ba3]/45 blur-3xl" />
                  <div className="absolute left-1/2 -top-20 h-44 w-44 -translate-x-1/2 rounded-full bg-[#1f7295]/35 blur-3xl" />
                  <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-[#5bbfb0]/30 blur-3xl" />
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1f9ba3] via-[#1f7295] to-[#5bbfb0]" />
                </>
              ) : (
                <>
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/45 blur-3xl" />
                  <div className="absolute left-1/2 -top-20 h-44 w-44 -translate-x-1/2 rounded-full bg-pink-500/35 blur-3xl" />
                  <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-purple-400/30 blur-3xl" />
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-400" />
                </>
              )}
            </div>
            <CardContent className="relative z-10 space-y-4 pt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Totale investering</p>
                <Select value={priceDisplayMode} onValueChange={(value) => setPriceDisplayMode(value as "incl" | "excl")}>
                  <SelectTrigger className="h-8 w-[118px] border-white/15 bg-white/10 px-3 text-xs font-bold text-white shadow-none focus:ring-white/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incl">Incl. btw</SelectItem>
                    <SelectItem value="excl">Excl. btw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-white">{formatCurrency(displayedTotal)}</span>
                <span className="text-xs font-bold text-white/65">{priceDisplayMode === "incl" ? "incl. btw" : "excl. btw"}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
