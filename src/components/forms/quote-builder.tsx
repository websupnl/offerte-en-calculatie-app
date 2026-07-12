"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Save,
  ArrowLeft,
  X,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CornerDownRight,
  FileText,
  Search,
  Package,
  Layers,
  PackagePlus,
  Upload,
  Copy,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { calculateTotals } from "@/lib/calculation";
import { QuoteSheetPreview, type QuotePreviewData } from "@/components/quote-sheet-preview";
import { SheetScaler } from "@/components/sheet-scaler";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Customer = { id: string; name: string; email: string | null };
type Product = {
  id: string;
  category: string;
  name: string;
  description?: string | null;
  basePrice: string | number;
  costPrice?: string | number | null;
  vatRate: string | number;
  unit: string;
};
type ProductSetItem = { productId: string; qty: string | number; product: Product };
type ProductSet = { id: string; name: string; items: ProductSetItem[] };

type QuoteItem = {
  id: string;
  productId?: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  costPrice?: number | null;
  vatRate: number;
  total: number;
  indent: number;
};

type InitialQuoteItem = Omit<QuoteItem, "qty" | "unitPrice" | "costPrice" | "vatRate" | "total"> & {
  qty: number | string;
  unitPrice: number | string;
  costPrice?: number | string | null;
  vatRate: number | string;
  total: number | string;
};

type ChoiceItem = Omit<QuoteItem, "id" | "total"> & {
  id?: string;
  total?: number;
};

type Choice = {
  id: string;
  label?: string;
  title: string;
  summary?: string;
  tag?: string;
  items: ChoiceItem[];
};

type ChoiceGroup = {
  id: string;
  title: string;
  description?: string;
  type: "SINGLE_SELECT";
  recommendedChoiceId?: string;
  choices: Choice[];
};

type QuoteOption = {
  id: string;
  t: string;
  d: string;
  tag: string;
  price: number | null; // null = "Op aanvraag" (geen vaste prijs)
  vatRate: number;
  required?: boolean;
  details: string[];
  technicalCondition?: string;
};

type QuoteAttachment = {
  id: string;
  title: string;
  imageUrl: string;
  storageRef?: string;
  liveUrl: string;
  caption: string;
};

type InitialQuoteAttachment = {
  id?: string;
  title?: string | null;
  imageUrl?: string | null;
  storageRef?: string | null;
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
  costPrice?: number | string | null;
  cost_price?: number | string | null;
  indent?: number | string | null;
  type?: string | null;
};

type QuoteImportPreview = {
  source: "json" | "ai";
  quote: {
    quoteType?: string;
    title?: string;
    category?: string;
    tagline?: string;
    intro?: string;
    itemsHeader?: string;
    items: GeneratedQuoteItem[];
    optionalWork?: QuoteOption[];
    exclusions?: string[];
    outro?: string;
    notes?: string;
    flow?: Array<{ n: number | string; t: string; d: string }>;
    approach?: Array<{ n: number | string; t: string; d: string }>;
    validDays?: number;
    attachments?: InitialQuoteAttachment[];
    assumptions?: string[];
    technicalNotes?: string[];
    customerResponsibilities?: string[];
    planning?: { leadTime?: string; executionDuration?: string; preferredDate?: string };
    commercial?: { validDays?: number; paymentTerms?: string; warranty?: string; priceDisplayMode?: "incl" | "excl" };
    batteryAdvice?: Record<string, unknown>;
    configurations?: ChoiceGroup[];
    internalAdvice?: string;
  };
  warnings: string[];
  unknownFields: string[];
  totals: {
    totalExVat: number;
    totalVat: number;
    totalIncVat: number;
    includedItemCount: number;
  };
};

type InitialQuote = Partial<Omit<QuotePreviewData, "items" | "customer" | "choiceGroups" | "options" | "attachments">> & {
  id?: string;
  customerId?: string;
  items?: InitialQuoteItem[];
  choiceGroups?: ChoiceGroup[] | null;
  options?: QuoteOption[] | null;
  attachments?: InitialQuoteAttachment[] | null;
  quoteType?: string;
  notes?: string | null;
  planning?: Record<string, string>;
  commercial?: Record<string, string | number>;
  batteryAdvice?: Record<string, unknown>;
  internalAdvice?: string | null;
};

type InitialAdvice = {
  customerId: string;
  title?: string;
  summary?: string;
  analysis?: string;
  currentDevs?: string[];
  calculation?: { resultKwh?: number };
  scenarios: Array<{ capacityKwh?: number; goal?: string; name?: string }>;
};

type VisionSuggestedItem = {
  description: string;
  qty?: number;
  unitPrice?: number;
};

type QuoteContractResponse = {
  version: string;
  systemPrompt: string;
  jsonSchema: unknown;
  rules: Record<string, string>;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

const PLANNING_DEFAULTS = { leadTime: "", executionDuration: "", preferredDate: "" };
const COMMERCIAL_DEFAULTS = { validDays: 30, paymentTerms: "", warranty: "" };

const QUOTE_IMPORT_PROMPT_TEMPLATE = {
  quoteType: "installatie",
  title: "Concrete titel van de offerte",
  category: "Korte categorie",
  tagline: "Levering, montage en inbedrijfstelling",
  intro: "Persoonlijke opening namens Daan. Geen prijslijst of technische specificaties.",
  itemsHeader: "Vaste werkzaamheden",
  items: [
    {
      description: "Hoofdregel voor vaste basis",
      qty: 1,
      unitPrice: 0,
      costPrice: 0,
      vatRate: 21,
      indent: 0,
    },
    {
      description: "Inbegrepen onderdeel onder de hoofdregel",
      qty: 1,
      unitPrice: 0,
      vatRate: 21,
      indent: 1,
    },
  ],
  configurations: [
    {
      title: "Kies je systeem",
      description: "Alleen gebruiken bij echte, volledige alternatieven.",
      choices: [
        {
          title: "Concrete keuze A",
          summary: "Korte uitleg waarom deze keuze past.",
          items: [
            { description: "Levering en montage keuze A", qty: 1, unitPrice: 0, vatRate: 21, indent: 0 },
          ],
        },
        {
          label: "Aanbevolen",
          title: "Concrete keuze B",
          summary: "Korte uitleg waarom dit de aanbevolen keuze is.",
          items: [
            { description: "Levering en montage keuze B", qty: 1, unitPrice: 0, vatRate: 21, indent: 0 },
          ],
        },
      ],
    },
  ],
  optionalWork: [
    {
      t: "Los selecteerbaar meerwerk",
      d: "Korte klantgerichte uitleg.",
      tag: "Optioneel",
      price: 0,
      vatRate: 21,
      details: ["Concrete detailregel"],
      technicalCondition: "Alleen invullen wanneer relevant.",
    },
  ],
  exclusions: ["Concrete uitsluiting als de klant dit redelijkerwijs inbegrepen kan verwachten"],
  assumptions: ["Concreet uitgangspunt waarop de prijs is gebaseerd"],
  technicalNotes: ["Technisch uitgangspunt of aandachtspunt"],
  customerResponsibilities: ["Wat de klant zelf aanlevert of regelt"],
  flow: [{ n: 1, t: "Akkoord", d: "De klant bevestigt de offerte digitaal." }],
  approach: [],
  planning: { leadTime: "", executionDuration: "", preferredDate: "" },
  commercial: { validDays: 30, paymentTerms: "", warranty: "" },
  batteryAdvice: {},
  attachments: [{ title: "Bijlage", imageUrl: "https://...", liveUrl: "", caption: "" }],
  outro: "Tot slot\nKorte persoonlijke afsluiting.\n\nVolgende stap\nConcrete vervolgstap na akkoord.",
  notes: "",
  internalAdvice: "Alleen interne aandachtspunten. Niet zichtbaar voor klant.",
  validDays: 30,
};

function genId() {
  return Math.random().toString(36).slice(2);
}

function normalizeGeneratedItems(items: GeneratedQuoteItem[]): QuoteItem[] {
  return items
    .map((item) => {
      const qty = Number(item.qty ?? 1);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      return {
        id: genId(),
        description: String(item.description ?? "").trim(),
        qty,
        unitPrice,
        costPrice: item.costPrice === undefined && item.cost_price === undefined ? undefined : Number(item.costPrice ?? item.cost_price ?? 0),
        vatRate: Number(item.vatRate ?? item.vat_rate ?? 21),
        total: qty * unitPrice,
        indent: Number(item.indent ?? 0),
        type: item.type ?? undefined,
      };
    })
    .filter((item) => item.description);
}

export function QuoteBuilder({
  customers,
  products,
  productSets,
  initialQuote,
  initialAdvice,
  companySlug,
}: {
  customers: Customer[];
  products: Product[];
  productSets: ProductSet[];
  companySlug: string;
  companyName: string;
  initialQuote?: InitialQuote;
  initialAdvice?: InitialAdvice;
}) {
  const router = useRouter();
  const isKoolhaas = companySlug === "koolhaas";

  // ─── Core State ───
  const [customerId, setCustomerId] = useState(initialQuote?.customerId || initialAdvice?.customerId || "");
  const [title, setTitle] = useState(initialQuote?.title || initialAdvice?.title || "Voorstel");
  const [category, setCategory] = useState(initialQuote?.category || (isKoolhaas ? "Installatie" : "Webdevelopment"));
  const [tagline, setTagline] = useState(initialQuote?.tagline || (isKoolhaas ? "Levering, montage en inbedrijfstelling" : "Ontwerp, bouw en oplevering"));
  const [itemsHeader, setItemsHeader] = useState(initialQuote?.itemsHeader || "Inbegrepen werkzaamheden");
  const [validUntil, setValidUntil] = useState(initialQuote?.validUntil ? new Date(initialQuote.validUntil).toISOString().split('T')[0] : "");
  
  // Items Logic
  const [items, setItems] = useState<QuoteItem[]>(
    initialQuote?.items?.map((i) => ({
      ...i,
      id: i.id || genId(),
      qty: Number(i.qty),
      unitPrice: Number(i.unitPrice),
      costPrice: i.costPrice == null ? undefined : Number(i.costPrice),
      vatRate: Number(i.vatRate),
      total: Number(i.total),
      indent: i.indent ?? 0,
    })) ||
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
    ] : [])
  );

  // Attachments Logic
  const [attachments, setAttachments] = useState<QuoteAttachment[]>(
    initialQuote?.attachments?.map((attachment: InitialQuoteAttachment) => ({
      id: attachment.id || genId(),
      title: attachment.title || "",
      imageUrl: attachment.imageUrl || "",
      storageRef: attachment.storageRef || undefined,
      liveUrl: attachment.liveUrl || "",
      caption: attachment.caption || "",
    })) || []
  );

  // Text & Content State
  const [intro, setIntro] = useState(initialQuote?.intro || initialAdvice?.summary || (isKoolhaas ? "" : "Bedankt voor je interesse. In dit voorstel staat een professionele website centraal waarmee bezoekers snel kunnen zien wat je aanbiedt en eenvoudig contact kunnen opnemen. Daarnaast krijg je een praktische beheeromgeving, zodat je zelf zonder technische kennis inhoud kunt aanpassen."));
  const [outro, setOutro] = useState(initialQuote?.outro || "");
  const [notes, setNotes] = useState(initialQuote?.notes || "");
  const [quoteType, setQuoteType] = useState(initialQuote?.quoteType || (initialAdvice ? "BATTERY" : "GENERAL"));
  const [assumptions, setAssumptions] = useState<string[]>(initialQuote?.assumptions || (initialAdvice?.currentDevs || []));
  const [technicalNotes, setTechnicalNotes] = useState<string[]>(initialQuote?.technicalNotes || []);
  const [customerResponsibilities, setCustomerResponsibilities] = useState<string[]>(initialQuote?.customerResponsibilities || []);
  const [planning, setPlanning] = useState(initialQuote?.planning || PLANNING_DEFAULTS);
  const [commercial, setCommercial] = useState(initialQuote?.commercial || COMMERCIAL_DEFAULTS);
  const [batteryAdvice, setBatteryAdvice] = useState(initialQuote?.batteryAdvice || {
    nominalCapacityKwh: initialAdvice?.calculation?.resultKwh || 0,
    recommendedScenario: initialAdvice?.scenarios[1]?.name || ""
  });
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroup[]>(initialQuote?.choiceGroups || []);
  const [internalAdvice, setInternalAdvice] = useState(initialQuote?.internalAdvice || initialAdvice?.analysis || "");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  
  const [flow, setFlow] = useState(initialQuote?.flow || []);
  const [approach, setApproach] = useState(initialQuote?.approach || []);
  const [options, setOptions] = useState<QuoteOption[]>(
    (initialQuote?.options || []).map((option: Partial<QuoteOption> & { t: string; d: string; tag: string }, index: number) => ({
      id: option.id || `morework-${index + 1}`,
      t: option.t,
      d: option.d,
      tag: option.tag || "Optioneel",
      price: option.price == null ? null : Number(option.price),
      vatRate: Number(option.vatRate || 21),
      required: option.required === true,
      details: option.details || [],
      technicalCondition: option.technicalCondition || "",
    }))
  );
  const [exclusions, setExclusions] = useState(initialQuote?.exclusions || []);

  // ─── UI State ───
  const [saving, setSaving] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copyPromptLoading, setCopyPromptLoading] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [creationMode, setCreationMode] = useState<"manual" | "ai" | null>(
    initialQuote || initialAdvice ? "manual" : null
  );
  const [importPreview, setImportPreview] = useState<QuoteImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [priceDisplayMode, setPriceDisplayMode] = useState<"incl" | "excl">(
    initialQuote?.commercial?.priceDisplayMode === "excl" ? "excl" : "incl",
  );
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after"; indent: number } | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogProducts, setCatalogProducts] = useState(products);
  const [savingCatalogItemId, setSavingCatalogItemId] = useState<string | null>(null);

  const customer = customers.find((c) => c.id === customerId);
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const totals = calculateTotals(items);
  const totalExVat = totals.revenueExVat;
  const totalVat = totals.vat;
  const totalIncVat = totals.revenueIncVat;
  const displayedTotal = priceDisplayMode === "incl" ? totalIncVat : totalExVat;
  const catalogQuery = catalogSearch.trim().toLowerCase();
  const filteredProducts = catalogProducts
    .filter((product) =>
      !catalogQuery ||
      product.name.toLowerCase().includes(catalogQuery) ||
      product.category.toLowerCase().includes(catalogQuery) ||
      (product.description ?? "").toLowerCase().includes(catalogQuery),
    )
    .slice(0, 8);
  const filteredSets = productSets
    .filter((set) => !catalogQuery || set.name.toLowerCase().includes(catalogQuery))
    .slice(0, 4);

  const quoteData: QuotePreviewData = {
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
    choiceGroups,
    assumptions,
    technicalNotes,
    customerResponsibilities,
    flow,
    approach,
    options,
    exclusions,
    commercial: { ...commercial, priceDisplayMode },
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
    setImportErrors([]);
    setImportPreview(null);
    try {
      const res = await fetch("/api/ai/extract-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiInput, customerName: customer?.name || "de klant", intent: "quoteImport" }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setImportErrors(data.errors || [data.error || "De offerte kon niet worden verwerkt."]);
        return;
      }

      setImportPreview(data as QuoteImportPreview);
    } catch {
      setImportErrors(["AI Magic is mislukt. Probeer het opnieuw."]);
    } finally {
      setAiLoading(false);
    }
  }

  function applyImportPreview() {
    if (!importPreview) return;
    const data = importPreview.quote;

    if (data.title) setTitle(data.title);
    if (data.category) setCategory(data.category);
    if (data.tagline) setTagline(data.tagline);
    if (data.intro !== undefined) setIntro(data.intro);
    if (data.itemsHeader) setItemsHeader(data.itemsHeader);
    setItems(normalizeGeneratedItems(data.items || []));
    if (data.flow) setFlow(data.flow);
    if (data.approach) setApproach(data.approach);
    if (data.optionalWork) setOptions(data.optionalWork);
    if (data.exclusions) setExclusions(data.exclusions);
    if (data.outro !== undefined) setOutro(data.outro);
    if (data.notes !== undefined) setNotes(data.notes);
    if (data.quoteType) setQuoteType(data.quoteType);
    if (data.assumptions) setAssumptions(data.assumptions);
    if (data.technicalNotes) setTechnicalNotes(data.technicalNotes);
    if (data.customerResponsibilities) setCustomerResponsibilities(data.customerResponsibilities);
    if (data.planning) setPlanning({ ...PLANNING_DEFAULTS, ...data.planning });
    if (data.commercial) {
      setCommercial({ ...COMMERCIAL_DEFAULTS, ...data.commercial });
      if (data.commercial.priceDisplayMode) setPriceDisplayMode(data.commercial.priceDisplayMode);
    }
    if (data.batteryAdvice) setBatteryAdvice(data.batteryAdvice);
    if (data.configurations) setChoiceGroups(data.configurations);
    if (data.internalAdvice !== undefined) setInternalAdvice(data.internalAdvice);
    if (data.attachments) {
      setAttachments(data.attachments.map((attachment) => ({
        id: attachment.id || genId(),
        title: attachment.title || "",
        imageUrl: attachment.imageUrl || "",
        storageRef: attachment.storageRef || undefined,
        liveUrl: attachment.liveUrl || "",
        caption: attachment.caption || "",
      })));
    }

    const validDays = data.validDays ?? data.commercial?.validDays;
    if (validDays) {
      setValidUntil(new Date(Date.now() + validDays * 86400000).toISOString().split("T")[0]);
    }

    toast.success("Import geladen als bewerkbare offerteregels. Controleer regels en configuraties.");
    setCreationMode("manual");
    setAiInput("");
    setImportPreview(null);
    setImportErrors([]);
    setShowAiModal(false);
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

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error?.formErrors?.[0] || errorBody?.error || "Opslaan mislukt");
      }
      const data = await res.json() as { suggestedItems?: VisionSuggestedItem[]; findings?: string[] };

      if (data.suggestedItems?.length) {
        const newItems = data.suggestedItems.map((item) => ({
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
        const findings = data.findings;
        setTechnicalNotes((prev) => [...prev, ...findings]);
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
    if (items.length === 0 && choiceGroups.length === 0) return toast.error("Voeg minimaal één offerteregel of configuratie toe");
    if (items.some((i) => !i.description)) return toast.error("Vul alle omschrijvingen in");
    if (choiceGroups.some((group) => group.choices.length < 2)) return toast.error("Een configuratiekeuze heeft minimaal twee alternatieven nodig");
    if (choiceGroups.some((group) => group.choices.some((choice) => /^(optie\s*\d+|hoofdregel)$/i.test(choice.title)))) {
      return toast.error("Vervang alle placeholdernamen bij configuraties");
    }

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
          commercial: { ...commercial, priceDisplayMode },
          batteryAdvice,
          internalAdvice,
          choiceGroups,
          flow,
          approach,
          options,
          exclusions,
          attachments: attachments
            .filter((attachment) => attachment.imageUrl.trim() || attachment.liveUrl.trim())
            .map(({ id, title, imageUrl, storageRef, liveUrl, caption }) => {
              const attachment = {
                title,
                imageUrl: storageRef || imageUrl,
                liveUrl,
                caption,
              };
              return initialQuote?.id && id.length > 20
                ? { ...attachment, id }
                : attachment;
            }),
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
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

  function addProduct(product: Product) {
    const qty = 1;
    const unitPrice = Number(product.basePrice);
    setItems((prev) => [
      ...prev,
      {
        id: genId(),
        productId: product.id,
        description: product.description?.trim() || product.name,
        qty,
        unitPrice,
        costPrice: product.costPrice == null ? undefined : Number(product.costPrice),
        vatRate: Number(product.vatRate),
        total: qty * unitPrice,
        indent: 0,
      },
    ]);
    toast.success(`${product.name} toegevoegd`);
  }

  function addProductSet(set: ProductSet) {
    const newItems = set.items.map(({ product, qty }) => {
      const numericQty = Number(qty);
      const unitPrice = Number(product.basePrice);
      return {
        id: genId(),
        productId: product.id,
        description: product.description?.trim() || product.name,
        qty: numericQty,
        unitPrice,
        costPrice: product.costPrice == null ? undefined : Number(product.costPrice),
        vatRate: Number(product.vatRate),
        total: numericQty * unitPrice,
        indent: 0,
      };
    });
    setItems((prev) => [...prev, ...newItems]);
    toast.success(`${set.name} toegevoegd`);
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

  function handlePreviewItemUpdate(id: string, updates: {
    description?: string;
    qty?: string | number;
    unitPrice?: string | number;
    vatRate?: string | number;
    total?: string | number;
    indent?: number;
  }) {
    updateItem(id, {
      ...updates,
      qty: updates.qty === undefined ? undefined : Number(updates.qty),
      unitPrice: updates.unitPrice === undefined ? undefined : Number(updates.unitPrice),
      vatRate: updates.vatRate === undefined ? undefined : Number(updates.vatRate),
      total: updates.total === undefined ? undefined : Number(updates.total),
    });
  }

  function choiceItemTotal(item: ChoiceItem) {
    return Number(item.qty || 0) * Number(item.unitPrice || 0);
  }

  function addChoiceGroup() {
    const id = `group-${genId()}`;
    const firstChoiceId = `choice-${genId()}`;
    setChoiceGroups((prev) => [
      ...prev,
      {
        id,
        title: "Kies uw systeemconfiguratie",
        description: "",
        type: "SINGLE_SELECT",
        recommendedChoiceId: firstChoiceId,
        choices: [
          {
            id: firstChoiceId,
            label: "Aanbevolen",
            title: "Configuratie A",
            summary: "",
            items: [
              { description: "Complete configuratie A", qty: 1, unitPrice: 0, vatRate: 21, indent: 0 },
            ],
          },
          {
            id: `choice-${genId()}`,
            label: "Alternatief",
            title: "Configuratie B",
            summary: "",
            items: [{ description: "Complete configuratie B", qty: 1, unitPrice: 0, vatRate: 21, indent: 0 }],
          },
        ],
      },
    ]);
  }

  function updateChoiceGroup(groupId: string, updates: Partial<ChoiceGroup>) {
    setChoiceGroups((prev) => prev.map((group) => group.id === groupId ? { ...group, ...updates } : group));
  }

  function removeChoiceGroup(groupId: string) {
    setChoiceGroups((prev) => prev.filter((group) => group.id !== groupId));
  }

  function addChoice(groupId: string) {
    const choiceId = `choice-${genId()}`;
    setChoiceGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        choices: [
          ...group.choices,
          {
            id: choiceId,
            label: "Alternatief",
            title: `Configuratie ${group.choices.length + 1}`,
            summary: "",
            items: [{ description: "Complete configuratie", qty: 1, unitPrice: 0, vatRate: 21, indent: 0 }],
          },
        ],
      };
    }));
  }

  function updateChoice(groupId: string, choiceId: string, updates: Partial<Choice>) {
    setChoiceGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        choices: group.choices.map((choice) => choice.id === choiceId ? { ...choice, ...updates } : choice),
      };
    }));
  }

  function removeChoice(groupId: string, choiceId: string) {
    setChoiceGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      const choices = group.choices.filter((choice) => choice.id !== choiceId);
      return {
        ...group,
        choices,
        recommendedChoiceId: group.recommendedChoiceId === choiceId ? choices[0]?.id : group.recommendedChoiceId,
      };
    }));
  }

  function addChoiceItem(groupId: string, choiceId: string) {
    updateChoice(groupId, choiceId, {
      items: [
        ...(choiceGroups.find((group) => group.id === groupId)?.choices.find((choice) => choice.id === choiceId)?.items ?? []),
        { description: "Inbegrepen onderdeel", qty: 1, unitPrice: 0, vatRate: 21, indent: 1 },
      ],
    });
  }

  function updateChoiceItem(groupId: string, choiceId: string, itemIndex: number, updates: Partial<ChoiceItem>) {
    setChoiceGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        choices: group.choices.map((choice) => {
          if (choice.id !== choiceId) return choice;
          return {
            ...choice,
            items: choice.items.map((item, index) => index === itemIndex ? { ...item, ...updates } : item),
          };
        }),
      };
    }));
  }

  function removeChoiceItem(groupId: string, choiceId: string, itemIndex: number) {
    setChoiceGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        choices: group.choices.map((choice) => {
          if (choice.id !== choiceId) return choice;
          return { ...choice, items: choice.items.filter((_, index) => index !== itemIndex) };
        }),
      };
    }));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function saveItemToCatalog(item: QuoteItem) {
    if (item.productId) return;
    setSavingCatalogItemId(item.id);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Overig",
          name: item.description.split(/\r?\n/)[0].slice(0, 120),
          description: item.description,
          unit: "stuk",
          basePrice: item.unitPrice,
          costPrice: item.costPrice ?? null,
          vatRate: item.vatRate,
        }),
      });
      const product = await response.json();
      if (!response.ok) throw new Error(product.error || "Artikel opslaan mislukt");
      setCatalogProducts((current) => [...current, product]);
      updateItem(item.id, { productId: product.id });
      toast.success("Offerteregel is opgeslagen als catalogusartikel");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Artikel opslaan mislukt");
    } finally {
      setSavingCatalogItemId(null);
    }
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

  function updateAttachment(id: string, updates: Partial<QuoteAttachment>) {
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === id ? { ...attachment, ...updates } : attachment
      )
    );
  }

  function removeAttachment(id: string) {
    const attachment = attachments.find((item) => item.id === id);
    setAttachments((prev) => prev.filter((item) => item.id !== id));

    if (attachment?.storageRef && id.length <= 20) {
      void fetch("/api/quote-attachments/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: attachment.storageRef }),
      });
    }
  }

  function addAttachmentUrl() {
    setAttachments((prev) => [
      ...prev,
      { id: genId(), title: "Ontwerp", imageUrl: "", liveUrl: "", caption: "" },
    ]);
  }

  async function uploadAttachment(file: File) {
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/quote-attachments/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
        url?: string;
        previewUrl?: string;
        title?: string;
      } | null;

      if (!response.ok || !result?.url || !result.previewUrl) {
        throw new Error(result?.error || "Uploaden mislukt");
      }
      const storageRef = result.url;
      const previewUrl = result.previewUrl;

      setAttachments((current) => [
        ...current,
        {
          id: genId(),
          title: result.title || file.name.replace(/\.[^.]+$/, ""),
          imageUrl: previewUrl,
          storageRef,
          liveUrl: "",
          caption: "",
        },
      ]);
      toast.success("Afbeelding geüpload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uploaden mislukt");
    } finally {
      setUploadingAttachment(false);
    }
  }

  const handleUpdate = (updates: Partial<QuotePreviewData>) => {
    if (updates.title !== undefined) setTitle(updates.title ?? "");
    if (updates.category !== undefined) setCategory(updates.category ?? "");
    if (updates.tagline !== undefined) setTagline(updates.tagline ?? "");
    if (updates.itemsHeader !== undefined) setItemsHeader(updates.itemsHeader ?? "");
    if (updates.intro !== undefined) setIntro(updates.intro ?? "");
    if (updates.outro !== undefined) setOutro(updates.outro ?? "");
    if (updates.flow !== undefined) setFlow(updates.flow);
    if (updates.approach !== undefined) setApproach(updates.approach);
    if (updates.options !== undefined) {
      setOptions((updates.options ?? []).map((option) => ({
        ...option,
        price: option.price ?? null,
      })));
    }
    if (updates.exclusions !== undefined) setExclusions(updates.exclusions);
  };

  function buildQuoteImportPrompt(contract: QuoteContractResponse) {
    const rulesText = Object.entries(contract.rules)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");

    return [
      "Je bent een offerte-assistent voor de offerte-app van Daan Koolhaas.",
      "Maak op basis van mijn input exact een JSON-object dat direct geplakt kan worden in de offerte-app.",
      "",
      "Belangrijk:",
      "- Retourneer uitsluitend geldige JSON. Geen markdown, geen uitleg, geen codeblok.",
      "- Gebruik alleen velden uit het schema hieronder.",
      "- Alle prijzen zijn exclusief btw.",
      "- Bereken geen totalen.",
      "- Verzin geen prijzen, typenummers, garanties of technische claims.",
      "- Gebruik configurations alleen bij echte volledige alternatieven.",
      "- Gebruik optionalWork alleen voor los selecteerbaar meerwerk.",
      "- Gebruik geen id-velden en geen recommendedChoiceId.",
      "- Markeer een aanbevolen configuratie met label: \"Aanbevolen\".",
      "",
      `Bedrijf: ${companySlug}`,
      `Klant: ${customer?.name || "[vul klantnaam in]"}`,
      "",
      "Systeeminstructie uit de app:",
      contract.systemPrompt,
      "",
      `Contractversie: ${contract.version}`,
      "",
      "Regels per veld:",
      rulesText,
      "",
      "JSON Schema:",
      JSON.stringify(contract.jsonSchema, null, 2),
      "",
      "Gebruik deze structuur als uitgangspunt. Laat optionele secties leeg of weg wanneer ze niets toevoegen:",
      JSON.stringify(QUOTE_IMPORT_PROMPT_TEMPLATE, null, 2),
      "",
      "Mijn input voor de offerte:",
      "[plak hier gesprek, klantwens, producten, prijzen, foto's/links, technische opname of notities]",
    ].join("\n");
  }

  async function copyQuoteImportPrompt() {
    setCopyPromptLoading(true);
    try {
      const response = await fetch("/api/integrations/quote-contract");
      const contract = await response.json() as QuoteContractResponse;
      if (!response.ok || !contract?.jsonSchema || !contract?.systemPrompt) {
        throw new Error("Promptstructuur kon niet worden opgehaald");
      }

      await navigator.clipboard.writeText(buildQuoteImportPrompt(contract));
      toast.success("Prompt gekopieerd. Plak hem in je AI-model en voeg je klantsituatie toe.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kopiëren mislukt");
    } finally {
      setCopyPromptLoading(false);
    }
  }

  const importDialogContent = (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500" />
          Offerte importeren
        </DialogTitle>
        <DialogDescription>
          Plak hier een volledige offerte uit ChatGPT. Geldige JSON wordt direct verwerkt; gewone tekst wordt eerst door AI omgezet.
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[calc(90vh-120px)] space-y-4 overflow-y-auto py-4 pr-2">
        {!importPreview ? (
          <>
            <div className="rounded-lg border border-orange-100 bg-orange-50/70 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">AI-prompt nodig?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Kopieer de actuele schema-instructie, plak die in ChatGPT of Claude en plak de JSON daarna hier terug.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyQuoteImportPrompt}
                  disabled={copyPromptLoading}
                  className="shrink-0 border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
                >
                  {copyPromptLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy prompt
                </Button>
              </div>
            </div>
            <Textarea
              placeholder='Plak hier je offerte-JSON of gewone tekst. Bijvoorbeeld: {"title":"...","items":[...]}'
              rows={12}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              className="h-[360px] max-h-[45vh] resize-none overflow-y-auto font-mono text-xs leading-relaxed"
            />
            {importErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-bold">Import niet gelukt</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {importErrors.map((error, index) => <li key={index}>{error}</li>)}
                </ul>
              </div>
            )}
            <Button
              onClick={handleAiMagic}
              disabled={aiLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg font-bold gap-2"
            >
              {aiLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
              Offerte verwerken
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Preview ({importPreview.source === "json" ? "JSON" : "AI"})
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{importPreview.quote.title || "Zonder titel"}</h3>
                  {importPreview.quote.intro && (
                    <p className="mt-2 line-clamp-3 text-sm text-slate-600">{importPreview.quote.intro}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold text-slate-900">{formatCurrency(importPreview.totals.totalIncVat)}</p>
                  <p className="text-xs text-slate-500">vaste basis incl. btw</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Prijsregels:</span> <b>{importPreview.quote.items.length}</b></div>
                <div><span className="text-slate-500">Inbegrepen:</span> <b>{importPreview.totals.includedItemCount}</b></div>
                <div><span className="text-slate-500">Excl. btw:</span> <b>{formatCurrency(importPreview.totals.totalExVat)}</b></div>
                <div><span className="text-slate-500">Btw:</span> <b>{formatCurrency(importPreview.totals.totalVat)}</b></div>
                <div><span className="text-slate-500">Meerwerk:</span> <b>{importPreview.quote.optionalWork?.length ?? 0}</b></div>
                <div><span className="text-slate-500">Configuraties:</span> <b>{importPreview.quote.configurations?.length ?? 0}</b></div>
                <div><span className="text-slate-500">Uitsluitingen:</span> <b>{importPreview.quote.exclusions?.length ?? 0}</b></div>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bewerkbare inhoud</p>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs">
                  {importPreview.quote.items.map((item, index) => (
                    <div key={`base-${index}`} className="flex justify-between gap-3 rounded bg-white px-2 py-1.5">
                      <span className="truncate">Vaste regel · {item.description}</span>
                      <span className="shrink-0 font-semibold">
                        {formatCurrency(Number(item.qty ?? 1) * Number(item.unitPrice ?? item.unit_price ?? 0))}
                      </span>
                    </div>
                  ))}
                  {importPreview.quote.configurations?.flatMap((group) =>
                    group.choices.map((choice) => (
                      <div key={`${group.id}-${choice.id}`} className="flex justify-between gap-3 rounded bg-teal-50 px-2 py-1.5 text-teal-900">
                        <span className="truncate">Configuratie · {group.title} → {choice.title} ({choice.items.length} regels)</span>
                        <span className="shrink-0 font-semibold">
                          {formatCurrency(choice.items.reduce(
                            (sum, item) => sum + Number(item.qty ?? 1) * Number(item.unitPrice ?? 0),
                            0,
                          ))}
                        </span>
                      </div>
                    )),
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Import maakt vrije offerteregels, geen dubbele catalogusartikelen. Een regel kan later bewust als herbruikbaar artikel worden opgeslagen.
                </p>
              </div>
            </div>

            {(importPreview.warnings.length > 0 || importPreview.unknownFields.length > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-bold">Controleer voor import</p>
                {importPreview.warnings.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {importPreview.warnings.map((warning, index) => <li key={`w-${index}`}>{warning}</li>)}
                  </ul>
                )}
                {importPreview.unknownFields.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">Niet-herkende velden:</p>
                    <p className="mt-1 break-words text-xs">{importPreview.unknownFields.join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setImportPreview(null)}>
                Terug naar invoer
              </Button>
              <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={applyImportPreview}>
                Offerte invullen
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );

  if (!creationMode) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-slate-50">
        <header className="sticky top-[72px] z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Terug
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="leading-tight">
              <h1 className="font-bold text-slate-900">Nieuwe offerte maken</h1>
              <p className="text-xs text-slate-400">Kies hoe je wilt beginnen</p>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl items-center px-6 py-10">
          <div className="w-full">
            <div className="mb-6 max-w-2xl">
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">Startpunt</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">Hoe wil je de offerte opbouwen?</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setCreationMode("manual")}
                className="group rounded-lg border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black text-slate-950">Handmatig starten</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Open de normale editor met standaardregels, teksten en opties.
                </p>
                <div className="mt-6 inline-flex items-center text-sm font-bold text-slate-900">
                  Editor openen <ChevronRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportErrors([]);
                  setImportPreview(null);
                  setShowAiModal(true);
                }}
                className="group rounded-lg border border-orange-200 bg-orange-50/60 p-6 text-left shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:shadow-md"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                  <Wand2 className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black text-slate-950">Via ChatGPT plakken</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Plak een complete JSON-offerte of gewone tekst. Na de preview wordt de editor automatisch ingevuld.
                </p>
                <div className="mt-6 inline-flex items-center text-sm font-bold text-orange-700">
                  Offerte plakken <ChevronRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>
            <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
              {importDialogContent}
            </Dialog>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50">
      {/* ── Top Toolbar ── */}
      <header className="sticky top-[72px] z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Terug
          </Button>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate font-bold text-slate-900">
              {initialQuote ? `${title || initialQuote.number} bewerken` : "Nieuwe offerte"}
            </h1>
            {initialQuote && <p className="text-xs text-slate-400">{initialQuote.number}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50">
            {visionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Scan Situatie
            <input type="file" accept="image/*" className="sr-only" onChange={handleVisionScan} disabled={visionLoading} />
          </label>

          {initialQuote && (
            <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
              <DialogTrigger render={
                <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 bg-orange-50/50 font-bold gap-2">
                  <Wand2 className="h-4 w-4" /> Importeer
                </Button>
              } />
              {importDialogContent}
            </Dialog>
          )}

          {initialQuote && <div className="hidden h-6 w-px bg-slate-200 xl:block" />}

          <div className="flex items-center gap-2">
            <Label className="hidden text-xs font-bold uppercase tracking-wider text-slate-500 2xl:block">Naam:</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naam van de offerte"
              className="h-9 w-[150px] xl:w-[200px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="hidden text-xs font-bold uppercase tracking-wider text-slate-500 2xl:block">Klant:</Label>
            <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
              <PopoverTrigger render={
                <Button variant="outline" className="h-9 w-[160px] justify-between font-normal xl:w-[190px]">
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

          <div className="flex items-center gap-2">
            <Label className="hidden text-xs font-bold uppercase tracking-wider text-slate-500 2xl:block">Geldig tot:</Label>
            <Input
              type="date"
              className="h-9 w-[140px] xl:w-[150px]"
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

      <div className="flex w-full max-w-[1920px] flex-col gap-6 p-4 lg:flex-row lg:gap-8 lg:p-6 2xl:px-10 mx-auto items-start">
        {/* ── Visual Editor (The Paper) ── */}
        <div className="w-full min-w-0 flex-1">
          <SheetScaler>
            <QuoteSheetPreview
              quote={quoteData}
              companySlug={companySlug}
              isEditable={true}
              onUpdate={handleUpdate}
              onUpdateItem={handlePreviewItemUpdate}
              onAddItem={addItem}
              onRemoveItem={removeItem}
            />
          </SheetScaler>
        </div>

        {/* ── Right Panel (Controls) ── */}
        <aside className="w-full space-y-6 pb-2 lg:w-[360px] lg:shrink-0 xl:sticky xl:top-[132px] xl:max-h-[calc(100vh-148px)] xl:w-[400px] xl:overflow-y-auto xl:overscroll-contain xl:pr-2 [scrollbar-gutter:stable] 2xl:w-[440px]">
          <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    Offerteregels
                    <Button size="sm" variant="outline" onClick={addItem} className="h-8">
                      <Plus className="h-3 w-3 mr-1" /> Regel
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(catalogProducts.length > 0 || productSets.length > 0) && (
                    <details
                      className="group rounded-xl border border-slate-200 bg-white"
                      onToggle={(event) => {
                        if (!(event.currentTarget as HTMLDetailsElement).open) setCatalogSearch("");
                      }}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700">
                        <span className="flex items-center gap-2">
                          <PackagePlus className="h-4 w-4 text-slate-400" />
                          Regel uit catalogus toevoegen
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="space-y-3 border-t border-slate-100 p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={catalogSearch}
                            onChange={(event) => setCatalogSearch(event.target.value)}
                            placeholder="Zoek gericht op naam, categorie of set…"
                            className="h-9 pl-9"
                          />
                        </div>
                        {!catalogQuery ? (
                          <p className="text-xs leading-relaxed text-slate-400">
                            Zoek een bestaand artikel of een vaste set. Alleen wat je aanklikt wordt aan deze offerte toegevoegd.
                          </p>
                        ) : (
                          <div className="max-h-64 space-y-3 overflow-y-auto">
                            {filteredSets.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  <Layers className="h-3 w-3" /> Sets
                                </p>
                                <div className="space-y-1">
                                  {filteredSets.map((set) => (
                                    <button
                                      key={set.id}
                                      type="button"
                                      onClick={() => addProductSet(set)}
                                      className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left hover:border-slate-300 hover:bg-slate-50"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold">{set.name}</span>
                                        <span className="block text-xs text-slate-400">{set.items.length} artikelen</span>
                                      </span>
                                      <Plus className="h-4 w-4 shrink-0 text-slate-400" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {filteredProducts.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  <Package className="h-3 w-3" /> Artikelen en diensten
                                </p>
                                <div className="space-y-1">
                                  {filteredProducts.map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      onClick={() => addProduct(product)}
                                      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left hover:border-slate-300 hover:bg-slate-50"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{product.name}</span>
                                        <span className="block truncate text-xs text-slate-400">{product.category} · per {product.unit}</span>
                                      </span>
                                      <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(product.basePrice))}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {filteredProducts.length === 0 && filteredSets.length === 0 && (
                              <p className="py-3 text-center text-sm text-slate-400">Geen artikelen of sets gevonden.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </details>
                  )}
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
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {item.productId ? "Catalogusartikel" : "Vrije offerteregel"}
                                </span>
                              )}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                {!item.productId && (
                                  <button
                                    type="button"
                                    title="Opslaan als catalogusartikel"
                                    disabled={savingCatalogItemId === item.id}
                                    onClick={() => saveItemToCatalog(item)}
                                    className="rounded-full border border-slate-200 bg-white p-1 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-[#167f88] disabled:opacity-50"
                                  >
                                    {savingCatalogItemId === item.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <PackagePlus className="h-3 w-3" />}
                                  </button>
                                )}
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
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Aantal</Label>
                                <Input type="number" value={item.qty} onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Stukprijs (Verk)</Label>
                                <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })} className="h-8 text-sm" />
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
                    Systeemconfiguraties
                    <Button size="sm" variant="outline" onClick={addChoiceGroup} className="h-8">
                      <Plus className="h-3 w-3 mr-1" /> Blok
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {choiceGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                      Voeg alleen volwaardige alternatieven toe, zoals SolarEdge of Sigenergy. De klant kiest er één bij het accepteren.
                    </div>
                  ) : (
                    choiceGroups.map((group) => (
                      <div key={group.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <Input
                              value={group.title}
                              onChange={(e) => updateChoiceGroup(group.id, { title: e.target.value })}
                              className="h-8 text-sm font-bold"
                              placeholder="Bijv. Kies uw batterijsysteem"
                            />
                            <Select value={group.recommendedChoiceId || ""} onValueChange={(value) => updateChoiceGroup(group.id, { recommendedChoiceId: value || undefined })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aanbevolen configuratie" /></SelectTrigger>
                              <SelectContent>
                                {group.choices.map((choice) => (
                                  <SelectItem key={choice.id} value={choice.id}>{choice.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeChoiceGroup(group.id)} className="h-8 w-8 text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={group.description || ""}
                          onChange={(e) => updateChoiceGroup(group.id, { description: e.target.value })}
                          className="h-8 text-sm"
                          placeholder="Korte uitleg bij deze keuze"
                        />

                        <div className="space-y-3">
                          {group.choices.map((choice) => {
                            const choiceExVat = choice.items.reduce((acc, item) => acc + choiceItemTotal(item), 0);
                            const choiceVat = choice.items.reduce((acc, item) => acc + choiceItemTotal(item) * (Number(item.vatRate) / 100), 0);
                            return (
                              <div key={choice.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
                                <div className="flex items-start gap-2">
                                  <div className="grid flex-1 grid-cols-[1fr_110px] gap-2">
                                    <Input
                                      value={choice.title}
                                      onChange={(e) => updateChoice(group.id, choice.id, { title: e.target.value })}
                                      className="h-8 bg-white text-sm font-bold"
                                      placeholder="Bijv. Sigenergy 8 kWh"
                                    />
                                    <Input
                                      value={choice.label || ""}
                                      onChange={(e) => updateChoice(group.id, choice.id, { label: e.target.value })}
                                      className="h-8 bg-white text-xs"
                                      placeholder="Aanbevolen"
                                    />
                                  </div>
                                  <Button size="icon" variant="ghost" onClick={() => removeChoice(group.id, choice.id)} className="h-8 w-8 text-red-500">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Textarea
                                  value={choice.summary || ""}
                                  onChange={(e) => updateChoice(group.id, choice.id, { summary: e.target.value })}
                                  rows={2}
                                  className="resize-none bg-white text-sm"
                                  placeholder="Waarom deze keuze logisch is"
                                />
                                <div className="space-y-2">
                                  {choice.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="grid grid-cols-[1fr_54px_78px_58px_32px] gap-2">
                                      <div className="relative">
                                        <Input
                                          value={item.description}
                                          onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { description: e.target.value })}
                                          className={`h-8 bg-white text-xs ${item.productId ? "pr-8" : ""}`}
                                          placeholder="Regel"
                                          title={item.productId
                                            ? `Gekoppeld aan ${catalogProducts.find((product) => product.id === item.productId)?.name ?? "catalogusproduct"}`
                                            : undefined}
                                        />
                                        {item.productId && (
                                          <Package
                                            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-600"
                                            aria-label="Gekoppeld catalogusproduct"
                                          />
                                        )}
                                      </div>
                                      <Input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { qty: Number(e.target.value) })}
                                        className="h-8 bg-white px-2 text-xs"
                                      />
                                      <Input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { unitPrice: Number(e.target.value) })}
                                        className="h-8 bg-white px-2 text-xs"
                                        title="Stukprijs excl. btw"
                                      />
                                      <Input
                                        type="number"
                                        value={item.vatRate}
                                        onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { vatRate: Number(e.target.value) })}
                                        className="h-8 bg-white px-2 text-xs"
                                      />
                                      <Button size="icon" variant="ghost" onClick={() => removeChoiceItem(group.id, choice.id, itemIndex)} className="h-8 w-8 text-red-500">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <Button size="sm" variant="outline" onClick={() => addChoiceItem(group.id, choice.id)} className="h-7 text-xs">
                                    <Plus className="h-3 w-3 mr-1" /> Regel
                                  </Button>
                                  <div className="text-right text-xs text-slate-500">
                                    <span className="font-bold text-slate-900">{formatCurrency(choiceExVat + choiceVat)}</span> incl. btw
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Button size="sm" variant="outline" onClick={() => addChoice(group.id)} className="h-8 w-full">
                          <Plus className="h-3 w-3 mr-1" /> Configuratie toevoegen
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    Afbeeldingen en ontwerpen
                    <div className="flex items-center gap-2">
                      <label
                        className={`inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium shadow-xs transition-colors hover:bg-slate-50 ${
                          uploadingAttachment ? "pointer-events-none opacity-60" : ""
                        }`}
                      >
                          {uploadingAttachment ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="mr-1 h-3 w-3" />
                          )}
                          Uploaden
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={uploadingAttachment}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadAttachment(file);
                              event.target.value = "";
                            }}
                          />
                      </label>
                      <Button size="sm" variant="outline" onClick={addAttachmentUrl} className="h-8">
                        <Plus className="h-3 w-3 mr-1" /> URL
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                      Voeg een installatie-, product- of projectfoto toe. Bij Koolhaas wordt de eerste afbeelding onder de persoonlijke toelichting geplaatst.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {isKoolhaas && (
                        <p className="text-xs leading-relaxed text-slate-500">
                          De eerste afbeelding staat onder de toelichting. Overige afbeeldingen krijgen een eigen vervolgpagina.
                        </p>
                      )}
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                          {attachment.imageUrl && (
                            <img
                              src={attachment.imageUrl}
                              alt=""
                              className="h-28 w-full rounded-md border border-slate-200 object-cover"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <Input
                              value={attachment.title}
                              onChange={(e) => updateAttachment(attachment.id, { title: e.target.value })}
                              placeholder="Titel (bijv. Homepagina)"
                              className="h-8 text-sm flex-1"
                            />
                            <Button size="icon" variant="ghost" onClick={() => removeAttachment(attachment.id)} className="h-8 w-8 text-red-500 shrink-0">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            value={attachment.storageRef ? "" : attachment.imageUrl}
                            onChange={(e) => updateAttachment(attachment.id, { imageUrl: e.target.value })}
                            placeholder={attachment.storageRef ? "Opgeslagen in S3" : "Afbeelding URL (screenshot of https://...)"}
                            disabled={Boolean(attachment.storageRef)}
                            className="h-8 text-xs font-mono"
                          />
                          <Input
                            value={attachment.liveUrl}
                            onChange={(e) => updateAttachment(attachment.id, { liveUrl: e.target.value })}
                            placeholder="Live URL — klikbaar in de offerte (optioneel)"
                            className="h-8 text-xs font-mono"
                          />
                          <Input
                            value={attachment.caption}
                            onChange={(e) => updateAttachment(attachment.id, { caption: e.target.value })}
                            placeholder="Bijschrift (optioneel)"
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>

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
                <span className="text-xs font-bold text-white/65">
                  {choiceGroups.length > 0 ? "vaste basis · " : ""}{priceDisplayMode === "incl" ? "incl. btw" : "excl. btw"}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
