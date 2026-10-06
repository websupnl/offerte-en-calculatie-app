"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ChevronUp,
  CornerDownRight,
  Search,
  Package,
  Layers,
  PackagePlus,
  Upload,
  SlidersHorizontal,
  Copy,
  Check,
  Calculator,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { calculateTotals } from "@/lib/calculation";
import { calculateQuotePriceSummary, type QuoteChoiceGroup } from "@/lib/quote-selection";
import { estimateTravelDistanceKm, getTravelPrice, type TravelPricingTier } from "@/lib/travel";
import { QuoteSheetPreview, type QuotePageMeta, type QuotePreviewData } from "@/components/quote-sheet-preview";
import { SheetScaler } from "@/components/sheet-scaler";
import { SheetOverflowMonitor } from "@/components/forms/sheet-overflow-monitor";
import { SectionToggles } from "@/components/forms/section-toggles";
import { PageHeader } from "@/components/layout/page-header";
import { QuotePageRail } from "@/components/forms/quote-page-rail";
import { QuotePricePanel, type PanelCalculation } from "@/components/forms/quote-price-panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-context";

type Customer = { id: string; name: string; email: string | null; address?: string | null; city?: string | null; zipCode?: string | null };
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
  hiddenOnQuote?: boolean;
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
  image?: string; // persisted ref (s3://... of externe URL)
  imageUrl?: string; // tijdelijke weergave-URL, niet opgeslagen
  items: ChoiceItem[];
  calculationId?: string; // gekoppelde Calculatie — indien gezet, bron van items
};

type ChoiceGroup = {
  id: string;
  title: string;
  description?: string;
  type: "SINGLE_SELECT";
  recommendedChoiceId?: string;
  choices: Choice[];
};

type CalculationSummary = {
  id: string;
  number: string;
  title: string;
  status: string;
  totalCostPrice: number;
  totalSalesPrice: number;
  marginPercent: number;
};

type AvailableCalculation = { id: string; number: string; title: string; customerName?: string | null };

type QuoteOption = {
  id: string;
  t: string;
  d: string;
  tag: string;
  price: number | null; // null = "Op aanvraag" (geen eenmalige prijs)
  recurringPrice?: number | null; // abonnement/onderhoud per interval, excl. btw
  recurringInterval?: "maand" | "kwartaal" | "jaar" | null;
  vatRate: number;
  required?: boolean;
  defaultSelected?: boolean; // standaard aangevinkt in het klantportaal
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
  section: string;
};

type InitialQuoteAttachment = {
  id?: string;
  title?: string | null;
  imageUrl?: string | null;
  storageRef?: string | null;
  liveUrl?: string | null;
  caption?: string | null;
  section?: string | null;
};

type QuoteDocumentLink = {
  id: string;
  productDocument: { id: string; name: string; type: string; url: string | null };
};

type AvailableProductDocument = { id: string; name: string; type: string; productId: string; productName: string };
type AvailableQuoteImage = { url: string; previewUrl: string; title: string; size: number };

async function compressQuoteImage(file: File): Promise<File> {
  // GIF kan animatie bevatten; die laten we intact. Andere formaten worden
  // client-side naar compacte WebP omgezet voordat ze naar opslag gaan.
  if (file.type === "image/gif" || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size || !["image/webp", "image/jpeg", "image/png"].includes(blob.type)) return file;
    const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}

// Waar een afbeelding in de offerte terechtkomt. Bij een sectie staat hij onderaan
// die pagina, in de vrije ruimte. "eigen-pagina" geeft een losse afbeeldingspagina.
const ATTACHMENT_SECTIONS: { value: string; label: string }[] = [
  { value: "intro", label: "Bij de toelichting (intro)" },
  { value: "werking", label: "Bij Werking van de installatie" },
  { value: "items", label: "Bij Levering en montage (prijzen)" },
  { value: "opties", label: "Bij Optioneel meerwerk" },
  { value: "terms", label: "Bij de uitgangspunten" },
  { value: "sign", label: "Bij de slotpagina" },
  { value: "eigen-pagina", label: "Op een eigen pagina" },
];

const ATTACHMENT_INLINE_SECTIONS = ATTACHMENT_SECTIONS.filter((section) => section.value !== "eigen-pagina");

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
  documents?: QuoteDocumentLink[] | null;
  quoteType?: string;
  notes?: string | null;
  planning?: Record<string, string>;
  commercial?: Record<string, string | number>;
  batteryAdvice?: Record<string, unknown>;
  internalAdvice?: string | null;
  status?: string;
  /**
   * De gekoppelde calculaties. Sinds de omslag is dit de bron van de prijs en de
   * artikelen; `items` blijft alleen gevuld bij offertes van vóór die omslag.
   */
  usesCalculations?: boolean;
  calculations?: {
    id: string;
    number: string;
    title: string;
    role?: string | null;
    items?: {
      optional?: boolean | null;
      hiddenOnQuote?: boolean | null;
      totalSalesPrice?: string | number | null;
      totalCostPrice?: string | number | null;
      type?: string | null;
      recurringInterval?: string | null;
    }[] | null;
  }[] | null;
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
  homeBaseZipCode,
  travelPricingTiers,
}: {
  customers: Customer[];
  products: Product[];
  productSets: ProductSet[];
  companySlug: string;
  companyName: string;
  initialQuote?: InitialQuote;
  initialAdvice?: InitialAdvice;
  homeBaseZipCode?: string;
  travelPricingTiers?: TravelPricingTier[];
}) {
  const router = useRouter();
  const { branding, activeCompany } = useCompany();
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
      section: attachment.section || "intro",
    })) || []
  );

  // Datasheets & brochures Logic
  const [documents, setDocuments] = useState<QuoteDocumentLink[]>(initialQuote?.documents ?? []);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docPickerLoading, setDocPickerLoading] = useState(false);
  const [docPickerQuery, setDocPickerQuery] = useState("");
  const [availableDocs, setAvailableDocs] = useState<AvailableProductDocument[]>([]);

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
  const [hiddenSections, setHiddenSections] = useState<string[]>(initialQuote?.hiddenSections ?? []);
  const [batteryAdvice, setBatteryAdvice] = useState(initialQuote?.batteryAdvice || {
    nominalCapacityKwh: initialAdvice?.calculation?.resultKwh || 0,
    recommendedScenario: initialAdvice?.scenarios[1]?.name || ""
  });
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroup[]>(initialQuote?.choiceGroups || []);
  const [internalAdvice, setInternalAdvice] = useState(initialQuote?.internalAdvice || initialAdvice?.analysis || "");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerLoading, setMediaPickerLoading] = useState(false);
  const [availableQuoteImages, setAvailableQuoteImages] = useState<AvailableQuoteImage[]>([]);
  const [attachmentDropActive, setAttachmentDropActive] = useState(false);
  const [activeTab, setActiveTab] = useState("prijs");
  const panelRef = useRef<HTMLElement>(null);
  const [paginas, setPaginas] = useState<QuotePageMeta[]>([]);

  // Prijs en artikelen komen uit de calculaties zodra er losse offerteregels
  // meer zijn. Zie src/lib/quote-pricing.ts voor waarom die grens daar ligt.
  const gekoppeldeCalculaties = initialQuote?.calculations ?? [];
  const werktMetCalculaties = initialQuote?.usesCalculations === true
    || (gekoppeldeCalculaties.length > 0 && (initialQuote?.items?.length ?? 0) === 0);

  const paneelCalculaties: PanelCalculation[] = gekoppeldeCalculaties.map((calculatie) => {
    const regels = calculatie.items ?? [];
    const vast = regels.filter((regel) => !regel.optional);
    const omzet = vast.reduce((som, regel) => som + Number(regel.totalSalesPrice ?? 0), 0);
    const inkoop = vast
      .filter((regel) => regel.type !== "LABOR")
      .reduce((som, regel) => som + Number(regel.totalCostPrice ?? 0), 0);
    return {
      id: calculatie.id,
      number: calculatie.number,
      title: calculatie.title,
      role: calculatie.role ?? "BASE",
      totalExVat: omzet,
      marginPercent: omzet > 0 ? ((omzet - inkoop) / omzet) * 100 : 0,
      regels: vast.length,
      extras: regels.length - vast.length,
    };
  });

  // Optionele regels in een variant zouden alleen mogen tellen als die variant
  // gekozen is, en dat kan het klantportaal niet. Ze verdwijnen dus stil van de
  // offerte. Dat melden we, in plaats van het te laten gebeuren.
  const variantExtraWaarschuwing = (() => {
    const varianten = paneelCalculaties.filter((c) => c.role === "VARIANT");
    const meerprijzen = paneelCalculaties.filter((c) => c.role === "OPTION");
    const stille = [...(varianten.length >= 2 ? varianten : []), ...meerprijzen].filter((c) => c.extras > 0);
    if (stille.length === 0) return null;
    return `Optionele regels in een variant of meerprijs verschijnen niet op de offerte. Zet ze in de `
      + `basiscalculatie. Het gaat om: ${stille.map((c) => `${c.number} (${c.title})`).join(", ")}.`;
  })();

  const wisselSectie = (key: string) =>
    setHiddenSections((vorige) =>
      vorige.includes(key) ? vorige.filter((k) => k !== key) : [...vorige, key],
    );
  const [uploadingChoiceImageId, setUploadingChoiceImageId] = useState<string | null>(null);

  // Calculatie-koppeling per systeemoptie
  const [calculationSummaries, setCalculationSummaries] = useState<Record<string, CalculationSummary>>({});
  const [linkingChoiceId, setLinkingChoiceId] = useState<string | null>(null);
  const [calcPickerOpen, setCalcPickerOpen] = useState(false);
  const [calcPickerQuery, setCalcPickerQuery] = useState("");
  const [calcPickerLoading, setCalcPickerLoading] = useState(false);
  const [calcPickerTarget, setCalcPickerTarget] = useState<{ groupId: string; choiceId: string } | null>(null);
  const [availableCalculations, setAvailableCalculations] = useState<AvailableCalculation[]>([]);

  const [flow, setFlow] = useState(initialQuote?.flow || []);
  const [approach, setApproach] = useState(initialQuote?.approach || []);
  const [options, setOptions] = useState<QuoteOption[]>(
    (initialQuote?.options || []).map((option: Partial<QuoteOption> & { t: string; d: string; tag: string }, index: number) => ({
      id: option.id || `morework-${index + 1}`,
      t: option.t,
      d: option.d,
      tag: option.tag || "Optioneel",
      price: option.price == null ? null : Number(option.price),
      recurringPrice: option.recurringPrice == null ? null : Number(option.recurringPrice),
      recurringInterval: option.recurringInterval ?? null,
      vatRate: Number(option.vatRate || 21),
      required: option.required === true,
      defaultSelected: option.defaultSelected === true,
      details: option.details || [],
      technicalCondition: option.technicalCondition || "",
    }))
  );
  const [exclusions, setExclusions] = useState(initialQuote?.exclusions || []);

  // ─── UI State ───
  const [saving, setSaving] = useState(false);
  // Autosave-status: idle = nog niks gewijzigd, unsaved = wijziging in behandeling,
  // saving = bezig, saved = opgeslagen, error = mislukt.
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const autosaveInFlight = useRef(false);
  // Container van de gerenderde pagina's, zodat we kunnen meten of tekst overloopt.
  const paperRef = useRef<HTMLDivElement>(null);
  const firstAutosaveRender = useRef(true);
  const savedSignatureRef = useRef<string | null>(null);
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

  const baseTotals = calculateTotals(items);
  const priceSummary = choiceGroups.length > 0
    ? calculateQuotePriceSummary(items, choiceGroups as unknown as QuoteChoiceGroup[]).recommended
    : null;
  const totalExVat = priceSummary ? priceSummary.totalExVat : baseTotals.revenueExVat;
  const totalVat = priceSummary ? priceSummary.totalVat : baseTotals.vat;
  const totalIncVat = priceSummary ? priceSummary.totalIncVat : baseTotals.revenueIncVat;
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
    // Zonder deze drie kon de editor de bronnen, de inhoudsblokken en de
    // offertedatum niet tonen, en dus ook niet laten aanpassen.
    batteryAdvice,
    hiddenSections,
    contentBlocks: initialQuote?.contentBlocks ?? [],
    createdAt: initialQuote?.createdAt ?? null,
    commercial: { ...commercial, priceDisplayMode },
    customer: {
      name: customer?.name || "Selecteer een klant",
      email: customer?.email || null,
      address: customer?.address || null,
      city: customer?.city || null,
      zipCode: customer?.zipCode || null,
    },
    company: { id: activeCompany?.id, slug: companySlug, branding: branding ?? undefined }
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
        section: attachment.section || "intro",
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

  // Bouwt de offerte-payload uit de huidige builder-state.
  // includeAttachments = false bij autosave: dan blijven afbeeldingen ongemoeid,
  // zodat autosave nooit per ongeluk een foto kan wissen. Afbeeldingen worden
  // bewaard via de handmatige opslag (die stuurt de volledige lijst mee).
  function buildPayload(includeAttachments: boolean = true, overrideChoiceGroups?: ChoiceGroup[]) {
    const attachmentsPayload = attachments
      .filter((attachment) => attachment.imageUrl.trim() || attachment.liveUrl.trim())
      .map(({ id, title, imageUrl, storageRef, liveUrl, caption, section }) => {
        const attachment = {
          title,
          imageUrl: storageRef || imageUrl,
          liveUrl,
          caption,
          section,
        };
        return initialQuote?.id && id.length > 20
          ? { ...attachment, id }
          : attachment;
      });
    return {
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
      hiddenSections,
      internalAdvice,
      flow,
      approach,
      exclusions,
      ...(includeAttachments ? { attachments: attachmentsPayload } : {}),
      // Prijs, artikelen, varianten en modules komen op het nieuwe pad uit de
      // calculaties. Ze staan hier alleen in de state om het papier te kunnen
      // tonen. Terugschrijven zou er echte offerteregels en modules van maken,
      // en dan zijn er weer drie plekken waar een prijs kan ontstaan.
      ...(werktMetCalculaties ? {} : {
        choiceGroups: (overrideChoiceGroups ?? choiceGroups).map((group) => ({
          ...group,
          choices: group.choices.map((choice) => {
            // imageUrl is een tijdelijke presigned URL; alleen `image` (ref) opslaan
            const sanitized = { ...choice };
            delete sanitized.imageUrl;
            return sanitized;
          }),
        })),
        options,
        items: items.map(({ id, ...rest }) => ({
          ...rest,
          id: (initialQuote?.id && id.length > 20) ? id : undefined,
        })),
      }),
    };
  }

  // Is de offerte in een staat die opgeslagen kan worden?
  function canPersist() {
    if (!customerId) return false;
    if (!werktMetCalculaties && items.length === 0 && choiceGroups.length === 0) return false;
    if (items.some((i) => !i.description)) return false;
    if (choiceGroups.some((group) => group.choices.length < 2)) return false;
    return true;
  }

  // Stille opslag voor autosave: PUT zonder navigatie of toast, met statusindicatie.
  // Autosave is de enige opslagmanier voor een bestaande offerte; er is geen losse
  // opslaan-knop meer. Afbeeldingen gaan mee, behalve terwijl er nog een upload
  // loopt — dan wacht autosave één cyclus zodat de lijst niet half wordt weggeschreven.
  async function silentSave() {
    if (!initialQuote?.id) return;
    if (autosaveInFlight.current) return;
    if (uploadingAttachment || uploadingChoiceImageId) return;
    if (!canPersist()) return;
    const payload = buildPayload(true);
    const signature = JSON.stringify(payload);
    autosaveInFlight.current = true;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/quotes/${initialQuote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      savedSignatureRef.current = signature;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      autosaveInFlight.current = false;
    }
  }

  // Debounce: 1,5s na de laatste wijziging automatisch opslaan (alleen bestaande offertes).
  const currentSignature = JSON.stringify(buildPayload(true));
  useEffect(() => {
    if (!initialQuote?.id) return;
    if (firstAutosaveRender.current) {
      firstAutosaveRender.current = false;
      savedSignatureRef.current = currentSignature;
      return;
    }
    if (currentSignature === savedSignatureRef.current) return;
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      void silentSave();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSignature]);

  // Waarschuw bij weggaan met niet-opgeslagen wijzigingen.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved" || saveStatus === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  async function handleSave() {
    if (!customerId) return toast.error("Selecteer een klant");
    if (!werktMetCalculaties && items.length === 0 && choiceGroups.length === 0) {
      return toast.error("Maak eerst een calculatie, of voeg een offerteregel toe");
    }
    if (items.some((i) => !i.description)) return toast.error("Vul alle omschrijvingen in");
    if (choiceGroups.some((group) => group.choices.length < 2)) return toast.error("Een configuratiekeuze heeft minimaal twee alternatieven nodig");
    if (choiceGroups.some((group) => group.choices.some((choice) => /^(optie\s*\d+|hoofdregel)$/i.test(choice.title)))) {
      return toast.error("Vervang alle placeholdernamen bij configuraties");
    }

    setSaving(true);
    // Wacht tot een lopende autosave klaar is en blokkeer nieuwe autosaves,
    // zodat autosave en handmatig opslaan nooit tegelijk dezelfde offerte schrijven.
    while (autosaveInFlight.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    autosaveInFlight.current = true;
    try {
      const hasLinkedCalculations = choiceGroups.some((group) => group.choices.some((choice) => choice.calculationId));
      const freshChoiceGroups = hasLinkedCalculations ? await getFreshChoiceGroups() : choiceGroups;

      const method = initialQuote?.id ? "PUT" : "POST";
      const url = initialQuote?.id ? `/api/quotes/${initialQuote.id}` : "/api/quotes";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true, freshChoiceGroups)),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      savedSignatureRef.current = currentSignature;
      setSaveStatus("saved");
      toast.success(initialQuote?.id ? "Offerte opgeslagen" : "Offerte aangemaakt");
      router.push(`/quotes/${initialQuote?.id ?? data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      autosaveInFlight.current = false;
      setSaving(false);
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: genId(), description: "Nieuw onderdeel", qty: 1, unitPrice: 0, vatRate: 21, total: 0, indent: 0 },
    ]);
  }

  function addTravelItem() {
    if (!customer?.zipCode) {
      toast.error("Deze klant heeft geen postcode, vul die eerst aan bij de klantgegevens");
      return;
    }
    if (!homeBaseZipCode) {
      toast.error("Stel eerst je vertrekpostcode in bij Instellingen > Voorrijkosten");
      return;
    }
    const distanceKm = estimateTravelDistanceKm(homeBaseZipCode, customer.zipCode);
    if (distanceKm === null) {
      toast.error("Kon de afstand niet bepalen op basis van deze postcodes");
      return;
    }
    const price = getTravelPrice(distanceKm, travelPricingTiers);
    if (price === null) {
      toast.error("Geen voorrijkosten-schijven ingesteld bij Instellingen > Voorrijkosten");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        id: genId(),
        description: `Voorrijkosten (± ${Math.round(distanceKm)} km enkele reis)`,
        qty: 1,
        unitPrice: price,
        vatRate: 21,
        total: price,
        indent: 0,
      },
    ]);
    toast.success(`Reiskosten toegevoegd: ± ${Math.round(distanceKm)} km, € ${price}`);
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
    // Alleen meegegeven velden omzetten naar number — anders overschrijft dit
    // ongewenst qty/unitPrice/vatRate/total met undefined (-> NaN) wanneer bv.
    // alleen de omschrijving wordt aangepast.
    const converted: Partial<QuoteItem> = {};
    if (updates.description !== undefined) converted.description = updates.description;
    if (updates.indent !== undefined) converted.indent = updates.indent;
    if (updates.qty !== undefined) converted.qty = Number(updates.qty);
    if (updates.unitPrice !== undefined) converted.unitPrice = Number(updates.unitPrice);
    if (updates.vatRate !== undefined) converted.vatRate = Number(updates.vatRate);
    if (updates.total !== undefined) converted.total = Number(updates.total);
    updateItem(id, converted);
  }

  function choiceItemTotal(item: ChoiceItem) {
    return Number(item.qty || 0) * Number(item.unitPrice || 0);
  }

  // ─── Modules (optioneel meerwerk) ──────────────────────────────────────────
  function addModule() {
    setOptions((prev) => [
      ...prev,
      {
        id: `module-${genId()}`,
        t: "Nieuwe module",
        d: "Korte omschrijving van wat deze module inhoudt.",
        tag: "Optioneel",
        price: null,
        recurringPrice: null,
        recurringInterval: null,
        vatRate: 21,
        required: false,
        defaultSelected: false,
        details: [],
        technicalCondition: "",
      },
    ]);
  }

  function updateModule(index: number, patch: Partial<QuoteOption>) {
    setOptions((prev) => prev.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  }

  function removeModule(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveModule(index: number, direction: -1 | 1) {
    setOptions((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
            // Doortellen met letters, zodat de derde "Configuratie C" heet en niet
            // "Configuratie 3" naast een bestaande "Configuratie A".
            title: `Configuratie ${String.fromCharCode(65 + group.choices.length)}`,
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

  async function uploadChoiceImage(groupId: string, choiceId: string, file: File) {
    setUploadingChoiceImageId(choiceId);
    try {
      const compressedFile = await compressQuoteImage(file);
      const formData = new FormData();
      formData.append("file", compressedFile);
      const response = await fetch("/api/quote-attachments/upload", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        url?: string;
        previewUrl?: string;
      } | null;
      if (!response.ok || !result?.url || !result.previewUrl) {
        throw new Error(result?.error || "Uploaden mislukt");
      }
      updateChoice(groupId, choiceId, { image: result.url, imageUrl: result.previewUrl });
      toast.success("Foto toegevoegd");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uploaden mislukt");
    } finally {
      setUploadingChoiceImageId(null);
    }
  }

  function removeChoiceImage(groupId: string, choiceId: string) {
    updateChoice(groupId, choiceId, { image: undefined, imageUrl: undefined });
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

  // ── Calculatie-koppeling per systeemoptie ──────────────────────────────
  // Een gekoppelde optie haalt zijn regels (en dus prijzen) op uit een losse
  // Calculatie in plaats van dat je ze hier handmatig invoert. De Calculatie
  // is de bron; `choice.items` is een gesynchroniseerde momentopname die de
  // PDF/het portaal standalone kunnen tonen zonder de Calculatie te raadplegen.

  function calculationSummaryFromResponse(calc: {
    id: string; number: string; title: string; status: string;
    totalCostPrice: number | string; totalSalesPrice: number | string; marginPercent: number | string;
  }): CalculationSummary {
    return {
      id: calc.id,
      number: calc.number,
      title: calc.title,
      status: calc.status,
      totalCostPrice: Number(calc.totalCostPrice) || 0,
      totalSalesPrice: Number(calc.totalSalesPrice) || 0,
      marginPercent: Number(calc.marginPercent) || 0,
    };
  }

  function mapCalculationItemsToChoiceItems(calc: {
    items?: Array<{
      description: string; qty: number | string; unitPrice: number | string;
      costPrice?: number | string | null; vatRate: number | string; optional?: boolean; hiddenOnQuote?: boolean;
    }>;
  }): ChoiceItem[] {
    return (calc.items ?? [])
      .filter((item) => !item.optional)
      .map((item) => ({
        description: item.description,
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        costPrice: item.costPrice != null ? Number(item.costPrice) : null,
        vatRate: Number(item.vatRate) || 21,
        indent: 0,
        hiddenOnQuote: item.hiddenOnQuote ?? false,
      }));
  }

  async function syncChoiceFromCalculation(
    groupId: string,
    choiceId: string,
    calculationId: string,
    opts: { silent?: boolean } = {},
  ) {
    if (!opts.silent) setLinkingChoiceId(choiceId);
    try {
      const res = await fetch(`/api/calculations/${calculationId}`);
      if (!res.ok) throw new Error("Calculatie niet gevonden");
      const calc = await res.json();
      updateChoice(groupId, choiceId, { items: mapCalculationItemsToChoiceItems(calc) });
      setCalculationSummaries((prev) => ({ ...prev, [calculationId]: calculationSummaryFromResponse(calc) }));
      if (!opts.silent) toast.success("Prijzen vernieuwd vanuit de calculatie");
    } catch (error) {
      if (!opts.silent) toast.error(error instanceof Error ? error.message : "Vernieuwen mislukt");
    } finally {
      if (!opts.silent) setLinkingChoiceId(null);
    }
  }

  // Haalt vlak vóór het opslaan de actuele prijzen op van alle configuratiekeuzes die
  // aan een calculatie gekoppeld zijn. Zo kan een opgeslagen offerte nooit verouderde
  // cijfers bevatten, ook niet als het browsertabblad nooit opnieuw gefocust is nadat
  // de gekoppelde calculatie elders is aangepast.
  async function getFreshChoiceGroups(): Promise<ChoiceGroup[]> {
    const fresh = await Promise.all(
      choiceGroups.map(async (group) => {
        const choices = await Promise.all(
          group.choices.map(async (choice) => {
            if (!choice.calculationId) return choice;
            try {
              const res = await fetch(`/api/calculations/${choice.calculationId}`);
              if (!res.ok) return choice;
              const calc = await res.json();
              setCalculationSummaries((prev) => ({ ...prev, [choice.calculationId!]: calculationSummaryFromResponse(calc) }));
              return { ...choice, items: mapCalculationItemsToChoiceItems(calc) };
            } catch {
              return choice;
            }
          }),
        );
        return { ...group, choices };
      }),
    );
    setChoiceGroups(fresh);
    return fresh;
  }

  async function createCalculationForChoice(groupId: string, choiceId: string) {
    const choice = choiceGroups.find((g) => g.id === groupId)?.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    setLinkingChoiceId(choiceId);
    try {
      const res = await fetch("/api/calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${initialQuote?.number || "Offerte"} — ${choice.title}`,
          customerId: customerId || undefined,
          items: choice.items.map((item) => ({
            description: item.description,
            qty: Number(item.qty) || 1,
            costPrice: item.costPrice != null ? Number(item.costPrice) : 0,
            unitPrice: Number(item.unitPrice) || 0,
            vatRate: Number(item.vatRate) || 21,
          })),
        }),
      });
      if (!res.ok) throw new Error("Aanmaken van de calculatie is mislukt");
      const calc = await res.json();
      updateChoice(groupId, choiceId, { calculationId: calc.id, items: mapCalculationItemsToChoiceItems(calc) });
      setCalculationSummaries((prev) => ({ ...prev, [calc.id]: calculationSummaryFromResponse(calc) }));
      toast.success("Calculatie aangemaakt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aanmaken mislukt");
    } finally {
      setLinkingChoiceId(null);
    }
  }

  function unlinkCalculation(groupId: string, choiceId: string) {
    updateChoice(groupId, choiceId, { calculationId: undefined });
  }

  async function openCalculationPicker(groupId: string, choiceId: string) {
    setCalcPickerTarget({ groupId, choiceId });
    setCalcPickerOpen(true);
    if (availableCalculations.length === 0) {
      setCalcPickerLoading(true);
      try {
        const res = await fetch("/api/calculations");
        if (res.ok) {
          const list = await res.json();
          setAvailableCalculations(
            (Array.isArray(list) ? list : []).map((calc: { id: string; number: string; title: string; customer?: { name?: string } | null }) => ({
              id: calc.id,
              number: calc.number,
              title: calc.title,
              customerName: calc.customer?.name ?? null,
            })),
          );
        }
      } finally {
        setCalcPickerLoading(false);
      }
    }
  }

  function linkExistingCalculation(calculationId: string) {
    if (!calcPickerTarget) return;
    const { groupId, choiceId } = calcPickerTarget;
    updateChoice(groupId, choiceId, { calculationId });
    void syncChoiceFromCalculation(groupId, choiceId, calculationId, { silent: true });
    setCalcPickerOpen(false);
    setCalcPickerTarget(null);
  }

  // Bij terugkeer naar dit tabblad (bijv. na bewerken in de Calculatie in een
  // nieuw tabblad) stil de prijzen van alle gekoppelde opties verversen.
  useEffect(() => {
    function handleFocus() {
      for (const group of choiceGroups) {
        for (const choice of group.choices) {
          if (choice.calculationId) {
            void syncChoiceFromCalculation(group.id, choice.id, choice.calculationId, { silent: true });
          }
        }
      }
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceGroups]);

  // Eenmalig bij laden: marge/status ophalen voor al gekoppelde opties.
  useEffect(() => {
    choiceGroups.forEach((group) => {
      group.choices.forEach((choice) => {
        if (choice.calculationId && !calculationSummaries[choice.calculationId]) {
          void syncChoiceFromCalculation(group.id, choice.id, choice.calculationId, { silent: true });
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      { id: genId(), title: "Ontwerp", imageUrl: "", liveUrl: "", caption: "", section: "intro" },
    ]);
  }

  async function uploadAttachments(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;

    setUploadingAttachment(true);
    let added = 0;
    try {
      // Eén voor één: de upload-route neemt per aanroep één bestand aan.
      for (const file of images) {
        try {
          const compressedFile = await compressQuoteImage(file);
          const formData = new FormData();
          formData.append("file", compressedFile);

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
              section: "intro",
            },
          ]);
          added += 1;
        } catch (error) {
          toast.error(
            `${file.name}: ${error instanceof Error ? error.message : "uploaden mislukt"}`,
          );
        }
      }
    } finally {
      setUploadingAttachment(false);
    }

    if (added > 0) {
      // Spring naar de mediatab, anders plak je iets wat je nergens ziet staan.
      setActiveTab("media");
      toast.success(added === 1 ? "Afbeelding toegevoegd" : `${added} afbeeldingen toegevoegd`);
    }
  }

  async function openMediaPicker() {
    setMediaPickerOpen(true);
    setMediaPickerLoading(true);
    try {
      const response = await fetch("/api/quote-attachments/upload");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ophalen van afbeeldingen mislukt");
      setAvailableQuoteImages(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ophalen van afbeeldingen mislukt");
    } finally {
      setMediaPickerLoading(false);
    }
  }

  function selectExistingMedia(image: AvailableQuoteImage) {
    if (attachments.some((attachment) => attachment.storageRef === image.url)) {
      toast.info("Deze afbeelding staat al in de offerte");
      return;
    }
    setAttachments((current) => [...current, {
      id: genId(),
      title: image.title,
      imageUrl: image.previewUrl,
      storageRef: image.url,
      liveUrl: "",
      caption: "",
      section: "intro",
    }]);
    setActiveTab("media");
    setMediaPickerOpen(false);
    toast.success("Afbeelding toegevoegd aan de offerte");
  }

  // Een screenshot uit het klembord plakken werkt overal in de builder. Staat de
  // cursor in een tekstveld, dan bevat het klembord tekst en gebeurt hier niets.
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const images = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (images.length === 0) return;
      event.preventDefault();
      void uploadAttachments(
        images.map((file, index) =>
          // Een geplakte screenshot heet overal "image.png"; dat wordt anders de titel.
          file.name && file.name !== "image.png"
            ? file
            : new File(
                [file],
                `Afbeelding${images.length > 1 ? ` ${index + 1}` : ""}.${file.type.split("/")[1] || "png"}`,
                { type: file.type },
              ),
        ),
      );
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  async function openDocPicker() {
    setDocPickerOpen(true);
    setDocPickerLoading(true);
    try {
      const res = await fetch("/api/products/documents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ophalen mislukt");
      setAvailableDocs(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ophalen documenten mislukt");
    } finally {
      setDocPickerLoading(false);
    }
  }

  async function attachDocument(productDocumentId: string) {
    if (!initialQuote?.id) return;
    try {
      const res = await fetch(`/api/quotes/${initialQuote.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productDocumentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Koppelen mislukt");
      setDocuments((prev) => [...prev, data]);
      setDocPickerOpen(false);
      toast.success("Document gekoppeld aan offerte");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Koppelen mislukt");
    }
  }

  async function removeDocument(quoteDocumentId: string) {
    if (!initialQuote?.id) return;
    setDocuments((prev) => prev.filter((d) => d.id !== quoteDocumentId));
    await fetch(`/api/quotes/${initialQuote.id}/documents/${quoteDocumentId}`, { method: "DELETE" });
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
    if (updates.assumptions !== undefined) setAssumptions(updates.assumptions ?? []);
    if (updates.technicalNotes !== undefined) setTechnicalNotes(updates.technicalNotes ?? []);
    if (updates.customerResponsibilities !== undefined) setCustomerResponsibilities(updates.customerResponsibilities ?? []);
    if (updates.notes !== undefined) setNotes(updates.notes ?? "");
    // Bronnen bij het advies. Zonder deze regel deed "Bron toevoegen" niets:
    // de preview stuurde de wijziging wel, maar de builder ving hem niet op.
    if (updates.batteryAdvice !== undefined) setBatteryAdvice(updates.batteryAdvice ?? {});
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
          <Sparkles className="h-5 w-5 text-primary" />
          Offerte importeren
        </DialogTitle>
        <DialogDescription>
          Plak hier een volledige offerte uit ChatGPT. Geldige JSON wordt direct verwerkt; gewone tekst wordt eerst door AI omgezet.
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[calc(90vh-120px)] space-y-4 overflow-y-auto py-4 pr-2">
        {!importPreview ? (
          <>
            <div className="rounded-lg border border-primary/25 bg-primary/10 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">AI-prompt nodig?</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Kopieer de actuele schema-instructie, plak die in ChatGPT of Claude en plak de JSON daarna hier terug.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyQuoteImportPrompt}
                  disabled={copyPromptLoading}
                  className="shrink-0 border-primary/25 bg-card text-primary hover:bg-primary/10"
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
              className="h-[360px] max-h-[45vh] resize-none overflow-y-auto font-mono text-sm leading-relaxed"
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
              className="w-full bg-primary hover:bg-primary h-12 text-lg font-bold gap-2"
            >
              {aiLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
              Offerte verwerken
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Preview ({importPreview.source === "json" ? "JSON" : "AI"})
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-foreground">{importPreview.quote.title || "Zonder titel"}</h3>
                  {importPreview.quote.intro && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{importPreview.quote.intro}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold text-foreground">{formatCurrency(importPreview.totals.totalIncVat)}</p>
                  <p className="text-sm text-muted-foreground">totaal incl. btw</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Prijsregels:</span> <b>{importPreview.quote.items.length}</b></div>
                <div><span className="text-muted-foreground">Inbegrepen:</span> <b>{importPreview.totals.includedItemCount}</b></div>
                <div><span className="text-muted-foreground">Excl. btw:</span> <b>{formatCurrency(importPreview.totals.totalExVat)}</b></div>
                <div><span className="text-muted-foreground">Btw:</span> <b>{formatCurrency(importPreview.totals.totalVat)}</b></div>
                <div><span className="text-muted-foreground">Meerwerk:</span> <b>{importPreview.quote.optionalWork?.length ?? 0}</b></div>
                <div><span className="text-muted-foreground">Configuraties:</span> <b>{importPreview.quote.configurations?.length ?? 0}</b></div>
                <div><span className="text-muted-foreground">Uitsluitingen:</span> <b>{importPreview.quote.exclusions?.length ?? 0}</b></div>
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Bewerkbare inhoud</p>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto text-sm">
                  {importPreview.quote.items.map((item, index) => (
                    <div key={`base-${index}`} className="flex justify-between gap-3 rounded bg-card px-2 py-1.5">
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
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
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
                    <p className="mt-1 break-words text-sm">{importPreview.unknownFields.join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setImportPreview(null)}>
                Terug naar invoer
              </Button>
              <Button className="flex-1 bg-primary hover:bg-primary" onClick={applyImportPreview}>
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
      <div className="min-h-[calc(100dvh-56px)] bg-[var(--ws-bg)]">
        <PageHeader eyebrow="Offertes" title="Nieuwe conceptofferte" description="Begin met een calculatie of zet je voorstel uit ChatGPT klaar voor review." actions={<Button variant="outline" onClick={() => router.back()}><ArrowLeft />Terug</Button>} />
        <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
          <div className="w-full">
            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/calculations?create=1" className="group rounded-xl border border-border bg-card p-6 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Calculator className="mb-5 size-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Vanuit een calculatie</h2>
                <p className="mt-2 text-base leading-6 text-muted-foreground">Werk materialen, arbeid en alternatieven uit. Maak daarna een conceptofferte met deze calculatie als prijsbron.</p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-foreground">Calculatie maken<ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
              <button type="button" onClick={() => { setImportErrors([]); setImportPreview(null); setShowAiModal(true); }} className="group rounded-xl border border-border bg-card p-6 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Wand2 className="mb-5 size-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Samen met ChatGPT</h2>
                <p className="mt-2 text-base leading-6 text-muted-foreground">Kopieer de actuele offerte-instructies en plak je voorstel terug. Bekijk de inhoud voordat je het concept bewaart.</p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-foreground">Voorstel importeren<ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></span>
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3"><p className="text-base text-muted-foreground">Je kunt ook zelf tekst en regels invullen.</p><Button variant="ghost" onClick={() => setCreationMode("manual")}><Plus />Handmatig starten</Button></div>
            <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
              {importDialogContent}
            </Dialog>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-muted/40">
      {/* ── Top Toolbar ── */}
      <header className="sticky top-[56px] z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-3 shadow-none lg:px-6">
        {/* Bij een bestaande offerte staan titel, nummer en een terugknop al in de
            paginakop erboven. Alleen een nieuwe offerte heeft hier een eigen kop nodig. */}
        {initialQuote ? (
          <div className="min-w-0" />
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Terug
            </Button>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <h1 className="truncate font-bold text-foreground">Nieuwe offerte</h1>
          </div>
        )}

        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10">
            {visionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Scan Situatie
            <input type="file" accept="image/*" className="sr-only" onChange={handleVisionScan} disabled={visionLoading} />
          </label>

          {initialQuote && (
            <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
              <DialogTrigger render={
                <Button variant="outline" className="text-primary border-primary/25 hover:bg-primary/10 bg-primary/10 font-bold gap-2">
                  <Wand2 className="h-4 w-4" /> Importeer
                </Button>
              } />
              {importDialogContent}
            </Dialog>
          )}

          {initialQuote && <div className="hidden h-6 w-px bg-border xl:block" />}

          <div className="flex items-center gap-2">
            <Label className="hidden text-sm font-bold uppercase tracking-wider text-muted-foreground 2xl:block">Naam:</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naam van de offerte"
              aria-label="Naam van de offerte"
              className="h-9 w-[150px] xl:w-[200px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="hidden text-sm font-bold uppercase tracking-wider text-muted-foreground 2xl:block">Klant:</Label>
            <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
              <PopoverTrigger render={
                <Button variant="outline" className="h-9 w-[160px] justify-between font-normal xl:w-[190px]">
                  <span className="truncate">{customer?.name || "Selecteer klant"}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
              } />
              <PopoverContent align="start" className="z-[200] w-[240px] p-0 gap-0">
                <div className="p-2 border-b border-border">
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
                    <p className="text-sm text-muted-foreground px-2 py-3 text-center">Geen klant gevonden</p>
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
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted ${
                          c.id === customerId ? "bg-muted font-semibold" : ""
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
            <Label className="hidden text-sm font-bold uppercase tracking-wider text-muted-foreground 2xl:block">Geldig tot:</Label>
            <Input
              type="date"
              aria-label="Geldig tot"
              className="h-9 w-[140px] xl:w-[150px]"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          {/* Eén opslagmanier: een bestaande offerte slaat zichzelf op. Alleen bij
              een nieuwe offerte of een fout is er een knop. */}
          {initialQuote?.id && (
            <div className="flex items-center justify-end gap-1.5 text-sm font-medium" aria-live="polite">
              {saveStatus === "saving" && (
                <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Bezig met opslaan</span></>
              )}
              {saveStatus === "saved" && (
                <><Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /><span className="text-emerald-700 dark:text-emerald-400">Opgeslagen</span></>
              )}
              {saveStatus === "unsaved" && (
                <span className="text-muted-foreground">Wijzigingen worden opgeslagen</span>
              )}
              {saveStatus === "idle" && (
                <span className="text-muted-foreground">Slaat automatisch op</span>
              )}
            </div>
          )}

          <div className="h-6 w-px bg-border" />

          <button
            type="button"
            onClick={() => {
              setActiveTab("prijs");
              panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-1.5 text-left transition-colors hover:bg-muted/40"
            title="Prijs, media en documenten"
          >
            <span className="leading-tight">
              <span className="block text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {priceDisplayMode === "incl" ? "Incl. btw" : "Excl. btw"}
              </span>
              <span className="block text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(displayedTotal)}
              </span>
            </span>
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>

          {!initialQuote?.id ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Offerte opslaan
            </Button>
          ) : saveStatus === "error" ? (
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Opnieuw opslaan
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] flex-col items-start gap-5 p-4 lg:p-6 xl:flex-row">
        <QuotePageRail
          pages={paginas}
          hiddenSections={hiddenSections}
          onToggleSection={wisselSectie}
          paperRef={paperRef}
        />

        {/* ── Het papier. Alles wat de klant leest bewerk je hier, niet ernaast. ── */}
        <div className="w-full min-w-0 flex-1" ref={paperRef}>
          <SheetOverflowMonitor containerRef={paperRef} />
          <SheetScaler>
            <QuoteSheetPreview
              quote={quoteData}
              companySlug={companySlug}
              isEditable={true}
              onUpdate={handleUpdate}
              {...(werktMetCalculaties
                // Regels bewerk je in de calculatie. Hier zou je aan een kopie
                // zitten te typen die nooit wordt opgeslagen.
                ? {}
                : {
                    onUpdateItem: handlePreviewItemUpdate,
                    onAddItem: addItem,
                    onRemoveItem: removeItem,
                  })}
              priceSource={
                werktMetCalculaties && paneelCalculaties[0]
                  ? { label: paneelCalculaties[0].number, href: `/calculations/${paneelCalculaties[0].id}` }
                  : null
              }
              onPagesChange={setPaginas}
            />
          </SheetScaler>
        </div>

        <aside ref={panelRef} aria-label="Instellingen voor deze offerte" className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-[132px] xl:max-h-[calc(100dvh-9rem)] xl:w-[340px] xl:shrink-0 xl:overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
              <h2 className="text-base font-semibold">Offerte bewerken</h2>
            </div>
            <div className="space-y-5 px-4 pb-5 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList aria-label="Offerteonderdelen" className="mb-3 grid h-auto! w-full! grid-cols-2 gap-1">
              {[
                ["prijs", "Prijs"], ["pagina", "Pagina’s"], ["media", "Media"], ["documenten", "Documenten"],
                ...(werktMetCalculaties ? [] : [["regels", "Regels"], ["configuraties", "Configuraties"], ["modules", "Modules"]]),
              ].map(([value, label]) => <TabsTrigger key={value} value={value} className="min-h-8">{label}</TabsTrigger>)}
            </TabsList>

            <TabsContent value="prijs" className="space-y-6">
              <QuotePricePanel
                quoteId={initialQuote?.id ?? ""}
                calculations={paneelCalculaties}
                legacyItemCount={werktMetCalculaties ? 0 : items.length}
                isDraft={(initialQuote?.status ?? "DRAFT") === "DRAFT"}
                waarschuwing={variantExtraWaarschuwing}
              />
            </TabsContent>

            <TabsContent value="regels" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    Offerteregels
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={addTravelItem} className="h-8">
                        <MapPin className="h-3 w-3 mr-1" /> Reiskosten
                      </Button>
                      <Button size="sm" variant="outline" onClick={addItem} className="h-8">
                        <Plus className="h-3 w-3 mr-1" /> Regel
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(catalogProducts.length > 0 || productSets.length > 0) && (
                    <details
                      className="group rounded-xl border border-border bg-card"
                      onToggle={(event) => {
                        if (!(event.currentTarget as HTMLDetailsElement).open) setCatalogSearch("");
                      }}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-foreground">
                        <span className="flex items-center gap-2">
                          <PackagePlus className="h-4 w-4 text-muted-foreground" />
                          Regel uit catalogus toevoegen
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="space-y-3 border-t border-border p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={catalogSearch}
                            onChange={(event) => setCatalogSearch(event.target.value)}
                            placeholder="Zoek gericht op naam, categorie of set…"
                            className="h-9 pl-9"
                          />
                        </div>
                        {!catalogQuery ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            Zoek een bestaand artikel of een vaste set. Alleen wat je aanklikt wordt aan deze offerte toegevoegd.
                          </p>
                        ) : (
                          <div className="max-h-64 space-y-3 overflow-y-auto">
                            {filteredSets.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                  <Layers className="h-3 w-3" /> Sets
                                </p>
                                <div className="space-y-1">
                                  {filteredSets.map((set) => (
                                    <button
                                      key={set.id}
                                      type="button"
                                      onClick={() => addProductSet(set)}
                                      className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:border-border hover:bg-muted/40"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold">{set.name}</span>
                                        <span className="block text-sm text-muted-foreground">{set.items.length} artikelen</span>
                                      </span>
                                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {filteredProducts.length > 0 && (
                              <div>
                                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                  <Package className="h-3 w-3" /> Artikelen en diensten
                                </p>
                                <div className="space-y-1">
                                  {filteredProducts.map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      onClick={() => addProduct(product)}
                                      className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:border-border hover:bg-muted/40"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{product.name}</span>
                                        <span className="block truncate text-sm text-muted-foreground">{product.category} · per {product.unit}</span>
                                      </span>
                                      <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(product.basePrice))}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {filteredProducts.length === 0 && filteredSets.length === 0 && (
                              <p className="py-3 text-center text-sm text-muted-foreground">Geen artikelen of sets gevonden.</p>
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
                            className="h-0.5 rounded-full bg-primary mb-1"
                            style={{ marginLeft: dropTarget.indent ? 28 : 0 }}
                          />
                        )}
                        <div
                          onDragOver={(e) => handleItemDragOver(e, item.id)}
                          onDrop={(e) => handleItemDrop(e, item.id)}
                          onDragEnd={() => { setDragItemId(null); setDropTarget(null); }}
                          className={`flex gap-2 p-3 rounded-lg border space-y-0 relative group transition-colors ${
                            item.indent ? "bg-card border-border" : "bg-muted/40 border-border"
                          } ${dragItemId === item.id ? "opacity-40" : ""}`}
                          style={{ marginLeft: item.indent ? 28 : 0 }}
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDragItemId(item.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className="flex shrink-0 cursor-grab items-center self-stretch text-muted-foreground hover:text-muted-foreground active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              {item.indent ? (
                                <span className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                  <CornerDownRight className="h-3 w-3" /> Sub-regel
                                </span>
                              ) : (
                                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
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
                                    className="rounded-full border border-border bg-card p-1 text-muted-foreground shadow-none hover:bg-muted/40 hover:text-[var(--ws-accent)] disabled:opacity-50"
                                  >
                                    {savingCatalogItemId === item.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <PackagePlus className="h-3 w-3" />}
                                  </button>
                                )}
                                <button type="button" onClick={() => setItemIndent(item.id, item.indent ? 0 : 1)} className="bg-card border border-border rounded-full p-1 shadow-none text-muted-foreground hover:bg-muted/40">
                                  {item.indent ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                                <button type="button" onClick={() => removeItem(item.id)} className="bg-card border border-border rounded-full p-1 shadow-none text-red-500 hover:bg-red-50">
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
                                <Label className="text-sm uppercase font-bold text-muted-foreground">Aantal</Label>
                                <Input type="number" value={item.qty} onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-sm uppercase font-bold text-muted-foreground">Stukprijs (Verk)</Label>
                                <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })} className="h-8 text-sm" />
                              </div>
                            </div>
                          </div>
                        </div>
                        {dropTarget?.id === item.id && dropTarget.position === "after" && (
                          <div
                            className="h-0.5 rounded-full bg-primary mt-1"
                            style={{ marginLeft: dropTarget.indent ? 28 : 0 }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="configuraties" className="space-y-6">
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
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                      Voeg alleen volwaardige alternatieven toe, zoals SolarEdge of Sigenergy. De klant kiest er één bij het accepteren.
                    </div>
                  ) : (
                    choiceGroups.map((group) => (
                      <div key={group.id} className="rounded-xl border border-border bg-card p-3 space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <Input
                              value={group.title}
                              onChange={(e) => updateChoiceGroup(group.id, { title: e.target.value })}
                              className="h-8 text-sm font-bold"
                              placeholder="Bijv. Kies uw batterijsysteem"
                            />
                            <Select value={group.recommendedChoiceId || ""} onValueChange={(value) => updateChoiceGroup(group.id, { recommendedChoiceId: value || undefined })}>
                              <SelectTrigger className="h-8 text-sm">
                                {/* Expliciet de titel tonen; anders valt de trigger terug
                                    op de waarde en staat er een technische id op het scherm. */}
                                <SelectValue placeholder="Aanbevolen configuratie">
                                  {group.choices.find((choice) => choice.id === group.recommendedChoiceId)?.title
                                    || "Aanbevolen configuratie"}
                                </SelectValue>
                              </SelectTrigger>
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
                              <div key={choice.id} className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                                <div className="flex items-start gap-2">
                                  <div className="grid flex-1 grid-cols-[1fr_110px] gap-2">
                                    <Input
                                      value={choice.title}
                                      onChange={(e) => updateChoice(group.id, choice.id, { title: e.target.value })}
                                      className="h-8 bg-card text-sm font-bold"
                                      placeholder="Bijv. Sigenergy 8 kWh"
                                    />
                                    <Input
                                      value={choice.label || ""}
                                      onChange={(e) => updateChoice(group.id, choice.id, { label: e.target.value })}
                                      className="h-8 bg-card text-sm"
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
                                  className="resize-none bg-card text-sm"
                                  placeholder="Waarom deze keuze logisch is"
                                />
                                <div className="flex items-center gap-3">
                                  {(choice.imageUrl || choice.image) && (
                                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={choice.imageUrl || choice.image} alt="" className="h-full w-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => removeChoiceImage(group.id, choice.id)}
                                        className="absolute right-0.5 top-0.5 rounded-full bg-card/90 p-0.5 text-red-500 shadow"
                                        aria-label="Foto verwijderen"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                  <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:border-slate-400 ${uploadingChoiceImageId === choice.id ? "pointer-events-none opacity-60" : ""}`}>
                                    {uploadingChoiceImageId === choice.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <ImageIcon className="h-3.5 w-3.5" />
                                    )}
                                    {(choice.imageUrl || choice.image) ? "Vervang foto" : "Foto toevoegen"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      disabled={uploadingChoiceImageId === choice.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void uploadChoiceImage(group.id, choice.id, file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                </div>

                                <div className="rounded-lg border border-border bg-card p-3">
                                  {choice.calculationId ? (
                                    (() => {
                                      const summary = calculationSummaries[choice.calculationId!];
                                      const busy = linkingChoiceId === choice.id;
                                      return (
                                        <div className="space-y-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-foreground">
                                              {summary ? `${summary.number} · ${summary.title}` : "Calculatie gekoppeld"}
                                            </p>
                                            {summary && (
                                              <p className="text-sm text-muted-foreground">
                                                Marge {summary.marginPercent.toFixed(1)}% · {formatCurrency(summary.totalSalesPrice)} verkoop excl. btw
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Link href={`/calculations/${choice.calculationId}`} target="_blank" rel="noopener noreferrer">
                                              <Button type="button" size="sm" variant="outline" className="h-7 text-sm">
                                                <Calculator className="h-3 w-3 mr-1" /> Open in Calculatie
                                              </Button>
                                            </Link>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-sm"
                                              disabled={busy}
                                              onClick={() => void syncChoiceFromCalculation(group.id, choice.id, choice.calculationId!)}
                                            >
                                              {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                              Vernieuw prijzen
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 text-sm text-red-500"
                                              onClick={() => unlinkCalculation(group.id, choice.id)}
                                            >
                                              Ontkoppelen
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-sm"
                                        disabled={linkingChoiceId === choice.id}
                                        onClick={() => void createCalculationForChoice(group.id, choice.id)}
                                      >
                                        {linkingChoiceId === choice.id ? (
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        ) : (
                                          <Calculator className="h-3 w-3 mr-1" />
                                        )}
                                        Nieuwe calculatie
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-sm"
                                        onClick={() => void openCalculationPicker(group.id, choice.id)}
                                      >
                                        Bestaande koppelen
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {!choice.calculationId && (
                                <div className="space-y-2">
                                  {/* Zonder koppen zijn de drie getalvelden niet te onderscheiden. */}
                                  <div className="grid grid-cols-[1fr_54px_78px_58px_32px] gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    <span>Omschrijving</span>
                                    <span>Aantal</span>
                                    <span>Prijs</span>
                                    <span>Btw %</span>
                                    <span className="sr-only">Verwijderen</span>
                                  </div>
                                  {choice.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="grid grid-cols-[1fr_54px_78px_58px_32px] gap-2">
                                      <div className="relative">
                                        <Input
                                          value={item.description}
                                          onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { description: e.target.value })}
                                          className={`h-8 bg-card text-sm ${item.productId ? "pr-8" : ""}`}
                                          placeholder="Regel"
                                          title={item.productId
                                            ? `Gekoppeld aan ${catalogProducts.find((product) => product.id === item.productId)?.name ?? "catalogusproduct"}`
                                            : undefined}
                                        />
                                        {item.productId && (
                                          <Package
                                            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700 dark:text-emerald-400"
                                            aria-label="Gekoppeld catalogusproduct"
                                          />
                                        )}
                                      </div>
                                      <Input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { qty: Number(e.target.value) })}
                                        className="h-8 bg-card px-2 text-sm"
                                      />
                                      <Input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { unitPrice: Number(e.target.value) })}
                                        className="h-8 bg-card px-2 text-sm"
                                        title="Stukprijs excl. btw"
                                      />
                                      <Input
                                        type="number"
                                        value={item.vatRate}
                                        onChange={(e) => updateChoiceItem(group.id, choice.id, itemIndex, { vatRate: Number(e.target.value) })}
                                        className="h-8 bg-card px-2 text-sm"
                                      />
                                      <Button size="icon" variant="ghost" onClick={() => removeChoiceItem(group.id, choice.id, itemIndex)} className="h-8 w-8 text-red-500">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                                )}
                                <div className="flex items-center justify-between gap-3">
                                  {!choice.calculationId ? (
                                    <Button size="sm" variant="outline" onClick={() => addChoiceItem(group.id, choice.id)} className="h-7 text-sm">
                                      <Plus className="h-3 w-3 mr-1" /> Regel
                                    </Button>
                                  ) : <span />}
                                  <div className="text-right text-sm text-muted-foreground">
                                    <span className="font-bold text-foreground">{formatCurrency(choiceExVat + choiceVat)}</span> incl. btw
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
            </TabsContent>

            <TabsContent value="modules" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    Modules & optioneel meerwerk
                    <Button size="sm" variant="outline" onClick={addModule} className="h-8">
                      <Plus className="h-3 w-3 mr-1" /> Module
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {options.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                      Losse bouwstenen die de klant in het portaal aan- of uitzet. Bijvoorbeeld &ldquo;Twitch-embed&rdquo;, &ldquo;Basis SEO&rdquo; of &ldquo;Technisch onderhoud &euro; 15 per maand&rdquo;. Zet een prijs bij eenmalig, bij abonnement, of allebei.
                    </div>
                  ) : (
                    options.map((option, index) => {
                      const moduleKind = option.required ? "verplicht" : option.defaultSelected ? "standaard" : "optioneel";
                      return (
                        <div key={option.id} className="rounded-xl border border-border bg-card p-3 space-y-3">
                          <div className="flex items-start gap-2">
                            <Input
                              value={option.t}
                              onChange={(e) => updateModule(index, { t: e.target.value })}
                              className="h-8 flex-1 text-sm font-bold"
                              placeholder="Bijv. Twitch-embed"
                            />
                            <div className="flex items-center">
                              <Button size="icon" variant="ghost" onClick={() => moveModule(index, -1)} disabled={index === 0} className="h-8 w-8">
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => moveModule(index, 1)} disabled={index === options.length - 1} className="h-8 w-8">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => removeModule(index)} className="h-8 w-8 text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <Textarea
                            value={option.d}
                            onChange={(e) => updateModule(index, { d: e.target.value })}
                            rows={2}
                            className="resize-none text-sm"
                            placeholder="Wat houdt deze module in? Maximaal twee zinnen."
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-sm text-muted-foreground">In het portaal</Label>
                              <Select
                                value={moduleKind}
                                onValueChange={(value) =>
                                  updateModule(index, {
                                    required: value === "verplicht",
                                    defaultSelected: value === "standaard",
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="optioneel">Optioneel (uit)</SelectItem>
                                  <SelectItem value="standaard">Standaard aangevinkt</SelectItem>
                                  <SelectItem value="verplicht">Verplicht (vast aan)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm text-muted-foreground">Label</Label>
                              <Input
                                value={option.tag ?? ""}
                                onChange={(e) => updateModule(index, { tag: e.target.value })}
                                className="h-8 text-sm"
                                placeholder="Optioneel"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-sm text-muted-foreground">Eenmalig &euro; excl. btw</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={option.price ?? ""}
                                onChange={(e) => updateModule(index, { price: e.target.value === "" ? null : Number(e.target.value) })}
                                className="h-8 text-sm"
                                placeholder="Op aanvraag"
                              />
                            </div>
                            <div>
                              <Label className="text-sm text-muted-foreground">BTW %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={option.vatRate}
                                onChange={(e) => updateModule(index, { vatRate: Number(e.target.value) })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-sm text-muted-foreground">Abonnement</Label>
                              <Select
                                value={option.recurringInterval ?? "geen"}
                                onValueChange={(value) =>
                                  updateModule(index, {
                                    recurringInterval: value === "geen" ? null : (value as "maand" | "jaar"),
                                    ...(value === "geen" ? { recurringPrice: null } : {}),
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="geen">Geen abonnement</SelectItem>
                                  <SelectItem value="maand">Per maand</SelectItem>
                                  <SelectItem value="jaar">Per jaar</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {option.recurringInterval && (
                              <div>
                                <Label className="text-sm text-muted-foreground">Bedrag &euro; excl. btw</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={option.recurringPrice ?? ""}
                                  onChange={(e) => updateModule(index, { recurringPrice: e.target.value === "" ? null : Number(e.target.value) })}
                                  className="h-8 text-sm"
                                  placeholder="0,00"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <Label className="text-sm text-muted-foreground">Details, &eacute;&eacute;n regel per punt</Label>
                            <Textarea
                              value={(option.details ?? []).join("\n")}
                              onChange={(e) => updateModule(index, { details: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                              rows={2}
                              className="resize-none text-sm"
                              placeholder={"Inclusief installatie\nInclusief korte uitleg"}
                            />
                          </div>

                          <Input
                            value={option.technicalCondition ?? ""}
                            onChange={(e) => updateModule(index, { technicalCondition: e.target.value })}
                            className="h-8 text-sm"
                            placeholder="Technische voorwaarde (optioneel)"
                          />
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pagina" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Welke secties tonen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                    Zet uit wat deze offerte niet nodig heeft. De inhoud blijft bewaard, dus je kunt een
                    sectie later weer aanzetten zonder opnieuw te schrijven.
                  </p>
                  <SectionToggles
                    hidden={hiddenSections}
                    onChange={setHiddenSections}
                    beschikbaar={{
                      content: (initialQuote?.contentBlocks?.length ?? 0) > 0,
                      approach: approach.length > 0,
                      visuals: attachments.length > 0,
                      modules: options.length > 0,
                      terms: exclusions.length > 0 || assumptions.length > 0 || technicalNotes.length > 0,
                      sources: Array.isArray((batteryAdvice as { sources?: unknown[] })?.sources)
                        && ((batteryAdvice as { sources?: unknown[] }).sources?.length ?? 0) > 0,
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    Afbeeldingen en ontwerpen
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => void openMediaPicker()} className="h-8">
                        <ImageIcon className="mr-1 h-3 w-3" /> Bestaand kiezen
                      </Button>
                      <label
                        className={`inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted/40 ${
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
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={uploadingAttachment}
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              if (files.length > 0) void uploadAttachments(files);
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
                <CardContent
                  onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes("Files")) return;
                    event.preventDefault();
                    setAttachmentDropActive(true);
                  }}
                  onDragLeave={(event) => {
                    // Alleen loslaten als de cursor de kaart echt verlaat, niet bij
                    // elk kind-element waar hij overheen beweegt.
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                    setAttachmentDropActive(false);
                  }}
                  onDrop={(event) => {
                    const files = Array.from(event.dataTransfer.files ?? []);
                    if (files.length === 0) return;
                    event.preventDefault();
                    setAttachmentDropActive(false);
                    void uploadAttachments(files);
                  }}
                  className={
                    attachmentDropActive
                      ? "rounded-lg outline-2 outline-dashed outline-offset-[-6px] outline-slate-400"
                      : undefined
                  }
                >
                  {attachments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                      Upload afbeeldingen, kies eerder gebruikte bestanden of plak een screenshot met Ctrl+V. Je kunt een afbeelding onder een onderdeel plaatsen of op een eigen pagina zetten.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Kies per afbeelding waar hij in de offerte komt. Een eigen pagina wordt automatisch toegevoegd. Grote uploads worden vóór opslag verkleind.
                      </p>
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                          {attachment.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element -- directe preview van een upload/blob-URL
                            <img
                              src={attachment.imageUrl}
                              alt=""
                              className="h-28 w-full rounded-md border border-border object-cover"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <Input
                              value={attachment.title}
                              onChange={(e) => updateAttachment(attachment.id, { title: e.target.value })}
                              placeholder="Titel (bijv. Homepagina)"
                              className="h-8 flex-1 !bg-card !text-foreground placeholder:!text-muted-foreground"
                            />
                            <Button size="icon" variant="ghost" onClick={() => removeAttachment(attachment.id)} className="h-8 w-8 text-red-500 shrink-0">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <fieldset className="space-y-2">
                                <legend className="text-sm font-medium !text-foreground">Plaatsing in de offerte</legend>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => updateAttachment(attachment.id, { section: "intro" })}
                                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                  attachment.section !== "eigen-pagina"
                                    ? "border-primary/25 bg-primary/10 text-primary ring-1 ring-primary/25"
                                    : "border-border !bg-card !text-foreground hover:bg-muted/40"
                                }`}
                              >
                                <span className="block font-semibold">In de offerte</span>
                                <span className="block text-sm opacity-75">Onder een gekozen onderdeel</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAttachment(attachment.id, { section: "eigen-pagina" })}
                                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                  attachment.section === "eigen-pagina"
                                    ? "border-primary/25 bg-primary/10 text-primary ring-1 ring-primary/25"
                                    : "border-border !bg-card !text-foreground hover:bg-muted/40"
                                }`}
                              >
                                <span className="block font-semibold">Eigen ontwerppagina</span>
                                <span className="block text-sm opacity-75">Groot, met uitleg en link</span>
                              </button>
                            </div>
                            {attachment.section !== "eigen-pagina" && (
                              <label className="flex items-center gap-2 text-sm !text-foreground">
                                <span className="shrink-0">Onderdeel</span>
                                <select
                                  value={ATTACHMENT_INLINE_SECTIONS.some((option) => option.value === attachment.section) ? attachment.section : "intro"}
                                  onChange={(e) => updateAttachment(attachment.id, { section: e.target.value })}
                                  className="h-8 flex-1 rounded-md border border-border !bg-card px-2 text-sm !text-foreground"
                                >
                                  {ATTACHMENT_INLINE_SECTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label.replace("Bij ", "")}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </fieldset>
                          <Input
                            value={attachment.storageRef ? "" : attachment.imageUrl}
                            onChange={(e) => updateAttachment(attachment.id, { imageUrl: e.target.value })}
                            placeholder={attachment.storageRef ? "Opgeslagen in S3" : "Afbeelding URL (screenshot of https://...)"}
                            disabled={Boolean(attachment.storageRef)}
                            className="h-8 font-mono !bg-card !text-foreground placeholder:!text-muted-foreground"
                          />
                          <Input
                            value={attachment.liveUrl}
                            onChange={(e) => updateAttachment(attachment.id, { liveUrl: e.target.value })}
                            placeholder="Live URL — klikbaar in de offerte (optioneel)"
                            className="h-8 font-mono !bg-card !text-foreground placeholder:!text-muted-foreground"
                          />
                          <Input
                            value={attachment.caption}
                            onChange={(e) => updateAttachment(attachment.id, { caption: e.target.value })}
                            placeholder="Bijschrift (optioneel)"
                            className="h-8 !bg-card !text-foreground placeholder:!text-muted-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documenten" className="space-y-6">
              {initialQuote?.id && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      Documenten & datasheets
                      <Button size="sm" variant="outline" onClick={openDocPicker} className="h-8">
                        <Plus className="h-3 w-3 mr-1" /> Toevoegen
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                        Koppel een datasheet of brochure van een artikel (upload die eerst bij het artikel in Beheer &rarr; Artikelen).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{doc.productDocument.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {doc.productDocument.type === "BROCHURE" ? "Brochure" : "Datasheet"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {doc.productDocument.url && (
                                <a href={doc.productDocument.url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="h-8">Bekijk</Button>
                                </a>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => removeDocument(doc.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            </TabsContent>
          </Tabs>

          <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Afbeelding kiezen</DialogTitle>
                <DialogDescription>Kies een eerder geüploade afbeelding om aan deze offerte toe te voegen.</DialogDescription>
              </DialogHeader>
              {mediaPickerLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : availableQuoteImages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Er zijn nog geen opgeslagen afbeeldingen.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                  {availableQuoteImages.map((image) => (
                    <button key={image.url} type="button" onClick={() => selectExistingMedia(image)} className="overflow-hidden rounded-lg border border-border bg-card text-left hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed media preview URL */}
                      <img src={image.previewUrl} alt="" className="h-28 w-full object-cover" />
                      <span className="block truncate px-2 py-2 text-sm font-medium text-foreground">{image.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={docPickerOpen} onOpenChange={setDocPickerOpen}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Document koppelen aan offerte</DialogTitle>
              </DialogHeader>
              <Input
                value={docPickerQuery}
                onChange={(e) => setDocPickerQuery(e.target.value)}
                placeholder="Zoek op artikel- of bestandsnaam..."
                autoFocus
              />
              <div className="flex-1 overflow-y-auto space-y-1">
                {docPickerLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Laden...</div>
                ) : (
                  (() => {
                    const q = docPickerQuery.trim().toLowerCase();
                    const filtered = availableDocs.filter(
                      (d) =>
                        !documents.some((existing) => existing.productDocument.id === d.id) &&
                        (!q || d.name.toLowerCase().includes(q) || d.productName.toLowerCase().includes(q)),
                    );
                    if (filtered.length === 0) {
                      return <div className="py-8 text-center text-sm text-muted-foreground">Geen documenten gevonden.</div>;
                    }
                    return filtered.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => attachDocument(d.id)}
                        className="w-full rounded-md p-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="block font-medium">{d.name}</span>
                        <span className="block text-sm text-muted-foreground">{d.productName} · {d.type === "BROCHURE" ? "Brochure" : "Datasheet"}</span>
                      </button>
                    ));
                  })()
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={calcPickerOpen} onOpenChange={setCalcPickerOpen}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Bestaande calculatie koppelen</DialogTitle>
              </DialogHeader>
              <Input
                value={calcPickerQuery}
                onChange={(e) => setCalcPickerQuery(e.target.value)}
                placeholder="Zoek op nummer, titel of klant..."
                autoFocus
              />
              <div className="flex-1 overflow-y-auto space-y-1">
                {calcPickerLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Laden...</div>
                ) : (
                  (() => {
                    const q = calcPickerQuery.trim().toLowerCase();
                    const filtered = availableCalculations.filter(
                      (c) =>
                        !q ||
                        c.number.toLowerCase().includes(q) ||
                        c.title.toLowerCase().includes(q) ||
                        (c.customerName ?? "").toLowerCase().includes(q),
                    );
                    if (filtered.length === 0) {
                      return <div className="py-8 text-center text-sm text-muted-foreground">Geen calculaties gevonden.</div>;
                    }
                    return filtered.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => linkExistingCalculation(c.id)}
                        className="w-full rounded-md p-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="block font-medium">{c.number} · {c.title}</span>
                        {c.customerName && <span className="block text-sm text-muted-foreground">{c.customerName}</span>}
                      </button>
                    ));
                  })()
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Card className="relative border-border bg-muted/40 py-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: branding?.accentColor || "#ec4899" }} />
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">Totale investering</p>
                <Select value={priceDisplayMode} onValueChange={(value) => setPriceDisplayMode(value as "incl" | "excl")}>
                  <SelectTrigger className="h-8 w-[118px] text-sm" aria-label="Prijs inclusief of exclusief btw">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incl">Incl. btw</SelectItem>
                    <SelectItem value="excl">Excl. btw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{formatCurrency(displayedTotal)}</span>
                <span className="text-sm text-muted-foreground">
                  {choiceGroups.length > 0 ? "bij aanbevolen/goedkoopste keuze · " : ""}{priceDisplayMode === "incl" ? "incl. btw" : "excl. btw"}
                </span>
              </div>
            </CardContent>
          </Card>
            </div>
        </aside>
      </div>
    </div>
  );
}
