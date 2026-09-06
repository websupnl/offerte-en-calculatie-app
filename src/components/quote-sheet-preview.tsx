"use client";

import {
  Check,
  ExternalLink,
  Layers,
  PlusCircle,
  Sparkles,
  Loader2,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import "@/app/q/[token]/portal.css";
import { useRef, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  calculateQuoteSelectionTotals,
  getQuoteOptionPrice,
  getQuoteOptionRecurringInterval,
  getQuoteOptionRecurringPrice,
  getRecommendedSelection,
  type QuoteChoiceGroup,
  type QuoteOption,
} from "@/lib/quote-selection";

// ─── Shared Components (Outside to prevent focus loss) ──────────────────────

const InlineTextarea = ({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  isEditable 
}: { 
  value: string, 
  onChange: (v: string) => void, 
  placeholder?: string, 
  className?: string,
  isEditable: boolean 
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  if (!isEditable) {
    const content = value || placeholder || "";
    if (className?.split(/\s+/).includes("letter")) {
      return (
        <div className={className}>
          {content.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index} style={{ whiteSpace: "pre-line" }}>{paragraph}</p>
          ))}
        </div>
      );
    }
    return <p style={{ whiteSpace: "pre-wrap" }} className={className}>{content}</p>;
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`editable-textarea ${className}`}
      rows={1}
    />
  );
};

const InlineInput = ({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  isEditable 
}: { 
  value: string, 
  onChange: (v: string) => void, 
  placeholder?: string, 
  className?: string,
  isEditable: boolean 
}) => {
  if (!isEditable) return <span className={className}>{value || placeholder}</span>;
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`editable-input ${className}`}
    />
  );
};

// ─── Types ──────────────────────────────────────────────────────────────────

type QuoteItem = {
  id: string;
  description: string;
  qty: string | number;
  unitPrice: string | number;
  vatRate: string | number;
  total: string | number;
  indent?: number;
  hiddenOnQuote?: boolean;
};

type FlowItem = { n: number | string; t: string; d: string };
type ApproachStep = { n: number | string; t: string; d: string };
type QuoteAttachment = { id?: string; title?: string | null; imageUrl: string; liveUrl?: string | null; caption?: string | null; section?: string | null };

const quoteAttachmentSection = (attachment: QuoteAttachment) =>
  attachment.section?.trim().toLowerCase() || "intro";
type QuoteSource = { id?: string; label: string; description?: string; url: string };

export type QuoteContentBlock = {
  id?: string;
  type: "heading" | "text" | "list" | "steps" | "callout" | "specs" | "image";
  title?: string | null;
  body?: string | null;
  items?: unknown;
  tone?: string | null;
  imageUrl?: string | null;
  caption?: string | null;
};

/**
 * Hoeveel regels een blok ongeveer inneemt. Zelfde ruwe maat als estimateTermLines
 * hieronder: genoeg om te bepalen wanneer een pagina vol is, zonder echt te meten.
 */
const estimateBlockLines = (block: QuoteContentBlock): number => {
  const textLines = (value?: string | null) =>
    value ? Math.max(1, Math.ceil(value.length / 90)) : 0;
  const list = Array.isArray(block.items) ? block.items : [];

  switch (block.type) {
    case "heading": return 2;
    case "image": return 12;
    case "list": return 2 + list.length;
    case "steps": return 2 + list.length * 3;
    case "specs": return 2 + Math.ceil(list.length / 2) * 2;
    case "callout": return 2 + textLines(block.body);
    default: return 1 + textLines(block.body);
  }
};

/** Verdeelt de blokken over pagina's op basis van dat regelbudget. */
const paginateContentBlocks = (blocks: QuoteContentBlock[], budget = 34): QuoteContentBlock[][] => {
  const pages: QuoteContentBlock[][] = [];
  let current: QuoteContentBlock[] = [];
  let used = 0;

  for (const block of blocks) {
    const cost = estimateBlockLines(block);
    // Een kop onderaan een pagina hoort bij wat erna komt, dus die schuift mee.
    const startsSection = block.type === "heading";
    if (current.length > 0 && (used + cost > budget || (startsSection && used > budget - 8))) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += cost;
  }
  if (current.length > 0) pages.push(current);
  return pages;
};

// Een kort label ("Easee: ERE") zegt de lezer meer dan de hostname. Alleen als het
// label ontbreekt of te lang is voor een inline chip vallen we terug op het domein.
const SOURCE_LABEL_MAX = 28;

const sourceShortName = (source: QuoteSource) => {
  const label = source.label?.trim();
  if (label && label.length <= SOURCE_LABEL_MAX) return label;
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, "");
    if (host) return host;
  } catch {
    /* geen geldige URL — val terug op label */
  }
  return label || source.url;
};

/**
 * Het logo van de bron, afgeleid uit de URL. Geen veld om in te vullen en geen
 * instructie voor de AI nodig: het domein staat al in de bron.
 *
 * De browser van de klant haalt het icoon bij DuckDuckGo op. Die ziet daarmee
 * welke domeinen in de offerte staan, maar niet wie de offerte leest of wat
 * erin staat. Laadt het icoon niet, dan blijft het nummer staan.
 */
const SourceIcon = ({ url, index }: { url: string; index: number }) => {
  const [gefaald, setGefaald] = useState(false);

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  if (!host || gefaald) return <span className="source-number">{index + 1}</span>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
      alt=""
      aria-hidden="true"
      className="source-icon"
      loading="lazy"
      onError={() => setGefaald(true)}
    />
  );
};

const CitedText = ({
  value,
  sources,
  className,
  paragraphs = false,
}: {
  value: string;
  sources: QuoteSource[];
  className?: string;
  paragraphs?: boolean;
}) => {
  const renderInline = (text: string) =>
    text.split(/(\[\d+\])/g).map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return part;

      const sourceNumber = match[1];
      const source = sources.find((candidate) => String(candidate.id) === sourceNumber)
        ?? sources[Number(sourceNumber) - 1];
      // Onbekende verwijzing (bron verwijderd) — marker weglaten i.p.v. "[3]" tonen.
      if (!source) return null;

      return (
        <a
          key={`${sourceNumber}-${index}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-citation"
          aria-label={`Bron ${sourceNumber}: ${source.label}`}
          title={source.label}
        >
          {sourceShortName(source)}
          <ExternalLink size={9} aria-hidden="true" />
        </a>
      );
    });

  if (paragraphs) {
    return (
      <div className={className}>
        {value.split(/\n\s*\n/).map((paragraph, index) => (
          <p key={index} style={{ whiteSpace: "pre-line" }}>{renderInline(paragraph)}</p>
        ))}
      </div>
    );
  }

  return <p style={{ whiteSpace: "pre-wrap" }} className={className}>{renderInline(value)}</p>;
};

export type QuotePreviewData = {
  number: string;
  title: string | null;
  category: string | null;
  tagline: string | null;
  itemsHeader: string | null;
  status: string;
  intro: string | null;
  outro: string | null;
  notes?: string | null;
  validUntil: string | null;
  createdAt?: string | null;
  acceptedAt?: string | null;
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  items: QuoteItem[];
  customer: { name: string; email: string | null; address: string | null; city: string | null; zipCode?: string | null };
  flow?: FlowItem[];
  approach?: ApproachStep[];
  options?: QuoteOption[];
  exclusions?: string[];
  assumptions?: string[];
  technicalNotes?: string[];
  customerResponsibilities?: string[];
  contentBlocks?: QuoteContentBlock[];
  hiddenSections?: string[];
  attachments?: QuoteAttachment[];
  adviceDocuments?: { id: string; type: string }[];
  company?: { name?: string | null; slug?: string | null };
  choiceGroups?: QuoteChoiceGroup[];
  commercial?: { priceDisplayMode?: "incl" | "excl"; [key: string]: unknown };
  batteryAdvice?: { sources?: QuoteSource[]; [key: string]: unknown };
};

const isMisplacedIntroLine = (value: string | null | undefined, customerName: string) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  const normalizedCustomer = customerName.trim().toLowerCase();
  return (
    normalized.startsWith(`voor ${normalizedCustomer},`) ||
    normalized.startsWith(`voor ${normalizedCustomer}.`) ||
    (normalized.startsWith("op basis van") && normalized.includes("adviseren wij"))
  );
};

const stripPersonalSignOff = (value: string) =>
  value
    .replace(
      /\n+\s*Met vriendelijke groet,?\s*\n+\s*Daan Koolhaas\s*(?:\n+\s*(?:WebsUp\.nl|Koolhaas Installaties))?\s*$/i,
      "",
    )
    .trimEnd();

export type QuotePageMeta = {
  id: string;
  nr: number;
  label: string;
  /** Sectiesleutel uit SCHAKELBARE_SECTIES, of leeg als de pagina niet uit te zetten is. */
  section: string;
};

interface QuoteSheetPreviewProps {
  quote: QuotePreviewData;
  companySlug?: string;
  isEditable?: boolean;
  onUpdate?: (updates: Partial<QuotePreviewData>) => void;
  onUpdateItem?: (id: string, updates: Partial<QuoteItem>) => void;
  onAddItem?: () => void;
  onRemoveItem?: (id: string) => void;
  selectedChoiceIds?: Record<string, string>;
  selectedOptionIds?: string[];
  /** De editor gebruikt dit voor de paginastrip; hier telt de offerte zijn pagina's. */
  onPagesChange?: (pages: QuotePageMeta[]) => void;
  /** Waar de prijs vandaan komt. Alleen in de editor, zodat je weet waar je moet zijn. */
  priceSource?: { label: string; href: string } | null;
  // Statische render (PDF/print): geen "kies hieronder"-teksten, want er is
  // geen interactieve keuze-UI beschikbaar zoals in het klantportaal.
  isPrint?: boolean;
}

const COMPANY_COPY = {
  websup: {
    slug: "websup",
    name: "WebsUp.nl",
    logoText: (
      <>
        Webs<span>Up.</span>
      </>
    ),
    website: "websup.nl",
    email: "info@websup.nl",
    phone: "06 82 20 21 48",
    kvk: "95524061",
    role: "Eigenaar WebsUp.nl",
    defaultCategory: "Maatwerk project",
    defaultTitle: "Persoonlijk voorstel op maat",
    defaultTagline: "Ontwerp - Bouw - Plaatsing",
    phaseLabel: "Fase 1",
    summaryGoal: "Complete, gestructureerde aanvragen - minder navraag achteraf",
    delivery: "Indicatie 4-6 weken na akkoord",
    itemsHeader: "Prijsopbouw",
    processEyebrow: "Het proces",
    processTitle: "In duidelijke stappen.",
    approachEyebrow: "De werkwijze",
    approachTitle: "Van intake tot oplevering.",
    investmentTitle: "Een heldere prijs, geen verrassingen.",
    investmentLabel: "Totale investering - Fase 1",
    investmentDescription: "Investering voor het project zoals beschreven in de voorgaande pagina's.",
    optionsEyebrow: "Optionele uitbreidingen",
    optionsTitle: "Klaar om mee te groeien.",
    exclusionsEyebrow: "Goed om te weten",
    exclusionsTitle: "Niet standaard inbegrepen.",
    closingTitle: "Klaar om te starten?",
    contractor: "WebsUp.nl - Daan Koolhaas",
    footerLine: "WebsUp.nl - Daan Koolhaas - Friesland",
  },
  koolhaas: {
    slug: "koolhaas",
    name: "Koolhaas Installaties",
    logoText: null,
    website: "koolhaasinstallaties.nl",
    email: "info@koolhaasinstallaties.nl",
    phone: "06 82 20 21 48",
    kvk: "95524061",
    role: "Koolhaas Installaties",
    defaultCategory: "Installatie - Energieopslag",
    defaultTitle: "Thuisbatterij installatie",
    defaultTagline: "Advies - Installatie - Inbedrijfstelling",
    phaseLabel: "Installatie",
    summaryGoal: "Eigen zonnestroom opslaan en slim verbruiken",
    delivery: "Installatie in 1 dag - ca. 2-3 weken na akkoord",
    itemsHeader: "Wat wordt er geïnstalleerd",
    processEyebrow: "Planning",
    processTitle: "Van akkoord tot werkende installatie.",
    approachEyebrow: "Werkwijze",
    approachTitle: "Netjes voorbereid en veilig uitgevoerd.",
    investmentTitle: "Eenmalige investering, helder opgebouwd.",
    investmentLabel: "Totale investering",
    investmentDescription:
      "Een eenmalige investering voor materialen, montage, aansluiting, controle en oplevering zoals beschreven in deze offerte.",
    optionsEyebrow: "Optioneel meerwerk",
    optionsTitle: "Alleen waar het technisch logisch is.",
    exclusionsEyebrow: "Niet inbegrepen",
    exclusionsTitle: "Wat valt er buiten de offerte.",
    closingTitle: "Onderteken om te starten.",
    contractor: "Koolhaas Installaties - Daan Koolhaas",
    footerLine: "Koolhaas Installaties - Daan Koolhaas - Friesland",
  },
} as const;

export function QuoteSheetPreview({
  quote,
  companySlug,
  isEditable = false,
  onUpdate,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  selectedChoiceIds: externalSelectedChoiceIds,
  selectedOptionIds = [],
  onPagesChange,
  priceSource,
  isPrint = false,
}: QuoteSheetPreviewProps) {
  const defaultSelectedChoiceIds = useMemo(() => {
    return getRecommendedSelection(quote.choiceGroups ?? []).selectedChoiceIds;
  }, [quote.choiceGroups]);
  // Val per configuratiegroep terug op de aanbevolen keuze zolang de klant nog niets
  // heeft geselecteerd. Een lege of onvolledige `selectedChoiceIds` (zoals de portal
  // vóór akkoord opslaat) mag nooit een totaal van € 0,00 opleveren.
  const selectedChoiceIds = useMemo(() => {
    const merged = { ...defaultSelectedChoiceIds };
    if (externalSelectedChoiceIds) {
      for (const group of quote.choiceGroups ?? []) {
        const candidate = externalSelectedChoiceIds[group.id];
        if (candidate && group.choices.some((choice) => choice.id === candidate)) {
          merged[group.id] = candidate;
        }
      }
    }
    return merged;
  }, [externalSelectedChoiceIds, defaultSelectedChoiceIds, quote.choiceGroups]);

  // De offertedatum komt uit de offerte zelf. Eerder stond hier new Date(), waardoor
  // de server een andere datum kon renderen dan de browser (hydration-mismatch) en de
  // klant elke dag een nieuwe datum zag in plaats van de datum van het aanbod.
  const today = quote.createdAt ?? new Date().toISOString();
  const activeSlug = companySlug || quote.company?.slug || "websup";
  const brand = activeSlug === "koolhaas" ? COMPANY_COPY.koolhaas : COMPANY_COPY.websup;
  const isKoolhaas = brand.slug === "koolhaas";
  
  // Choice Logic
  const choiceGroups = quote.choiceGroups || [];
  const visibleItems = quote.items.filter((item) => !item.hiddenOnQuote);
  const showExVat = quote.commercial?.priceDisplayMode === "excl";

  const flow = quote.flow ?? [];
  const approach = quote.approach ?? [];
  const options = quote.options ?? [];
  const totals = calculateQuoteSelectionTotals(quote.items, choiceGroups, options, {
    selectedChoiceIds,
    selectedOptionIds,
  });
  // Terugkerende bedragen van geselecteerde modules — los van het eenmalige totaal.
  const recurringTotalLines: { interval: string; amount: number }[] = [];
  if (totals.recurring.perMonthExVat > 0) {
    recurringTotalLines.push({
      interval: "per maand",
      amount: showExVat ? totals.recurring.perMonthExVat : totals.recurring.perMonthIncVat,
    });
  }
  if (totals.recurring.perYearExVat > 0) {
    recurringTotalLines.push({
      interval: "per jaar",
      amount: showExVat ? totals.recurring.perYearExVat : totals.recurring.perYearIncVat,
    });
  }
  // Vaste werkzaamheden zitten in elke configuratie → per optie tonen we een all-in prijs (systeem + basis).
  const baseIncVat = quote.items.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.unitPrice) * (1 + Number(item.vatRate) / 100),
    0,
  );
  const exclusions = quote.exclusions ?? [];
  // Uitgangspunten worden getoond onder één kopje, maar blijven twee aparte velden.
  // We houden ze gescheiden zodat bewerken en verwijderen naar het juiste veld gaat.
  const assumptionsOwn = isKoolhaas
    ? (quote.assumptions ?? []).filter(Boolean).filter((item) => !isMisplacedIntroLine(item, quote.customer.name))
    : [];
  const technicalNotesOwn = isKoolhaas
    ? (quote.technicalNotes ?? []).filter(Boolean).filter((item) => !isMisplacedIntroLine(item, quote.customer.name))
    : [];
  const technicalNotes = [...assumptionsOwn, ...technicalNotesOwn];
  const customerResponsibilities = isKoolhaas ? (quote.customerResponsibilities ?? []).filter(Boolean) : [];
  const attachments = quote.attachments ?? [];
  // De klant ziet alleen complete bronnen. Tijdens bewerken blijven onvolledige
  // regels staan, anders verdwijnt een net toegevoegde bron voordat je hem invult.
  const sources = Array.isArray(quote.batteryAdvice?.sources)
    ? quote.batteryAdvice.sources.filter((source) =>
        isEditable ? source : source.label && source.url)
    : [];
  // Een afbeelding hoort bij een sectie (staat onderaan die pagina) of krijgt een eigen pagina.
  const SECTION_KEYS = ["intro", "werking", "items", "terms", "sign", "opties"];
  const isSectionImage = (a: QuoteAttachment) =>
    Boolean(a.imageUrl) && SECTION_KEYS.includes(quoteAttachmentSection(a));
  const sectionImages = (key: string) =>
    attachments.filter((a) => isSectionImage(a) && quoteAttachmentSection(a) === key);
  const standaloneAttachmentsAlle = attachments.filter((a) => !isSectionImage(a));
  // Rendert de afbeelding(en) van een sectie in de vrije ruimte onderaan die pagina,
  // of een lege spacer als er geen afbeelding is. Nooit overloop dankzij max-height.
  const renderSectionSpace = (key: string) => {
    const imgs = sectionImages(key);
    if (imgs.length === 0) return <div className="spacer"></div>;
    return (
      <div className="section-figure">
        {imgs.map((att, i) => (
          <figure className="section-figure-item" key={att.id ?? `${att.imageUrl}-${i}`}>
            {att.liveUrl ? (
              <a href={att.liveUrl} target="_blank" rel="noopener noreferrer" className="attachment-image-link">
                {/* eslint-disable-next-line @next/next/no-img-element -- offerte-afbeeldingen kunnen tijdelijke opslag-URL's zijn */}
                <img src={att.imageUrl} alt={att.title || "Afbeelding bij deze sectie"} />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- offerte-afbeeldingen kunnen tijdelijke opslag-URL's zijn
              <img src={att.imageUrl} alt={att.title || "Afbeelding bij deze sectie"} />
            )}
            {att.caption && <figcaption>{att.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  };
  const validUntilLabel = quote.validUntil ? formatDate(quote.validUntil) : null;
  // Secties die je bewust hebt uitgezet. De inhoud blijft staan, hij wordt
  // alleen niet getoond en telt niet mee in de paginanummering.
  const uit = new Set(quote.hiddenSections ?? []);
  const standaloneAttachments = uit.has("visuals") ? [] : standaloneAttachmentsAlle;
  const hasOptionsPage = options.length > 0 && !uit.has("modules");
  const hasTermsPage = !uit.has("terms") && Boolean(exclusions.length || technicalNotes.length || customerResponsibilities.length || quote.outro);
  // Tijdens bewerken blijft de bronnenpagina staan, ook als hij nog leeg is.
  // Anders kun je een eerste bron niet toevoegen omdat de pagina er niet is.
  const hasSourcesPage = !uit.has("sources") && (sources.length > 0 || Boolean(isEditable));

  // Een A4 heeft `overflow: hidden`, dus wat niet past valt er stil af. Bij door
  // AI geschreven stappen gebeurde dat: acht blokken liepen over de pagina heen.
  // Daarom verdelen we ze vooraf over zoveel pagina's als nodig.
  const approachPages: typeof approach[] = (() => {
    if (approach.length === 0 || uit.has("approach")) return [];
    // Zelfde model als src/lib/quote-layout-estimate.ts: titel- en tekstregels
    // apart tellen. De oude schatting (alleen /68) telde te laag, waardoor acht
    // stappen op één pagina overliepen.
    const kosten = (step: { t?: string; d?: string }) =>
      1 +
      Math.max(1, Math.ceil((step.t?.length ?? 0) / 34)) +
      Math.max(1, Math.ceil((step.d?.length ?? 0) / 58));
    // Regelbudget van een inhoudspagina, na kop en voettekst.
    const BUDGET = 36;
    const pages: typeof approach[] = [];
    let huidig: typeof approach = [];
    let gebruikt = 0;
    for (const step of approach) {
      const kost = kosten(step);
      if (huidig.length > 0 && gebruikt + kost > BUDGET) {
        pages.push(huidig);
        huidig = [];
        gebruikt = 0;
      }
      huidig.push(step);
      gebruikt += kost;
    }
    if (huidig.length > 0) pages.push(huidig);
    return pages;
  })();

  // Bij keuze-configuraties krijgt de inbegrepen-tabel een eigen pagina, zodat
  // de keuze-kaarten een volle pagina houden en niets afgesneden wordt.
  const splitItemsPage = choiceGroups.length > 0 && visibleItems.length > 0;

  // Elke systeemoptie krijgt een eigen volle pagina i.p.v. samen op één pagina
  // gepropt te worden — anders wordt de langste checklist afgesneden.
  const choiceEntries = choiceGroups.flatMap((group) => group.choices.map((choice) => ({ group, choice })));

  // Voorwaarden-pagina opsplitsen als de tekst te vol wordt: technische
  // uitgangspunten op pagina 1, voorbereiding + niet-inbegrepen op pagina 2.
  // Schatting van het aantal regels bepaalt of splitsen nodig is (ca. 55 tekens
  // per regel); bij weinig tekst blijft alles compact op één pagina.
  const estimateTermLines = (arr: string[]) =>
    arr.reduce((n, s) => n + Math.max(1, Math.ceil((s?.length ?? 0) / 55)), 0);
  const termsLineLoad =
    estimateTermLines(technicalNotes) +
    estimateTermLines(customerResponsibilities) +
    estimateTermLines(exclusions);
  const splitTermsPage =
    hasTermsPage &&
    technicalNotes.length > 0 &&
    customerResponsibilities.length + exclusions.length > 0 &&
    termsLineLoad > 24;

  // Bronnen kregen één vaste pagina; een lange lijst liep er stil vanaf. Nu
  // verdelen we ze over zoveel pagina's als nodig, zelfde model als de
  // werkwijze en als src/lib/quote-layout-estimate.ts.
  const sourcePages: (typeof sources)[] = (() => {
    if (!hasSourcesPage) return [];
    if (sources.length === 0) return [[]]; // lege pagina in bewerkmodus
    const kosten = (s: QuoteSource) =>
      1 +
      Math.max(1, Math.ceil((s.label?.length ?? 0) / 40)) +
      (s.description ? Math.max(1, Math.ceil(s.description.length / 64)) : 0);
    const BUDGET = 32;
    const pages: (typeof sources)[] = [];
    let huidig: typeof sources = [];
    let gebruikt = 0;
    for (const s of sources) {
      const kost = kosten(s);
      if (huidig.length > 0 && gebruikt + kost > BUDGET) {
        pages.push(huidig);
        huidig = [];
        gebruikt = 0;
      }
      huidig.push(s);
      gebruikt += kost;
    }
    if (huidig.length > 0) pages.push(huidig);
    return pages;
  })();

  const contentBlocks = uit.has("content") ? [] : (quote.contentBlocks ?? []).filter(Boolean);
  const contentPages = paginateContentBlocks(contentBlocks);

  // De paginavolgorde staat hier één keer, in plaats van als rekensom bij elke
  // voettekst. Een sectie toevoegen of verplaatsen is nu één regel in deze lijst;
  // voorheen moest je acht optellingen bijwerken en dat ging telkens mis.
  const pageOrder: string[] = [
    "cover",
    "intro",
    ...contentPages.map((_, i) => `content-${i}`),
    ...approachPages.map((_, i) => `approach-${i}`),
    ...standaloneAttachments.map((_, i) => `attachment-${i}`),
    ...choiceEntries.map((_, i) => `choice-${i}`),
    ...(splitItemsPage ? ["items"] : []),
    ...(choiceEntries.length === 0 ? ["investering"] : []),
    ...(hasOptionsPage ? ["options"] : []),
    ...(hasTermsPage ? ["terms"] : []),
    ...(splitTermsPage ? ["terms-2"] : []),
    ...sourcePages.map((_, i) => `sources-${i}`),
    "sign",
  ];
  const totalPages = pageOrder.length;

  // Zelfde lijst, maar met een naam en de sectie waar de pagina bij hoort. De
  // paginastrip in de editor leest dit, zodat er maar één plek is die weet uit
  // welke pagina's een offerte bestaat.
  const pageLabels: Record<string, string> = {
    cover: "Voorblad",
    intro: "Begeleidende brief",
    items: "Onderdelen",
    investering: "Investering",
    options: "Modules",
    terms: "Afspraken",
    "terms-2": "Afspraken (2)",
    sources: "Bronnen",
    sign: "Akkoord",
  };
  const pageSecties: Record<string, string> = {
    content: "content",
    approach: "approach",
    attachment: "visuals",
    choice: "",
    items: "",
    investering: "",
    options: "modules",
    terms: "terms",
    "terms-2": "terms",
    sources: "sources",
  };
  const pageMeta = pageOrder.map((id, index) => {
    const stam = id.replace(/-\d+$/, "");
    const genummerd = /-\d+$/.test(id);
    const nummer = genummerd ? Number(id.slice(stam.length + 1)) + 1 : 0;
    const namen: Record<string, string> = {
      content: "Toelichting",
      approach: "Werkwijze",
      attachment: "Ontwerp",
      choice: "Keuze",
      sources: "Bronnen",
    };
    return {
      id,
      nr: index + 1,
      label: pageLabels[id] ?? `${namen[stam] ?? stam}${nummer > 1 ? ` ${nummer}` : ""}`,
      section: pageSecties[id] ?? pageSecties[stam] ?? "",
    };
  });

  // De strip in de editor moet weten welke pagina's er zijn. Serialiseren
  // voorkomt dat een nieuwe array bij elke render een update losmaakt.
  const paginaSleutel = pageMeta.map((p) => `${p.id}:${p.label}`).join("|");
  useEffect(() => {
    onPagesChange?.(pageMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaSleutel]);

  const pageNr = (id: string) => {
    const index = pageOrder.indexOf(id);
    const page = index === -1 ? totalPages : index + 1;
    return `${String(page).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
  };
  const coverHeading = isKoolhaas ? (quote.title || brand.defaultTitle) : "Offerte";
  const introText = quote.intro?.trim() && !isMisplacedIntroLine(quote.intro, quote.customer.name)
    ? stripPersonalSignOff(quote.intro)
    : "";
  const [generating, setGenerating] = useState<string | null>(null);

  const handleAiGen = async (section: string) => {
    if (!onUpdate) return;
    setGenerating(section);
    try {
      const sectionInstructions: Record<string, string> = {
        intro: [
          "Schrijf een persoonlijke inleiding in de ik-vorm namens Daan Koolhaas.",
          "Begin niet met 'wij zijn verheugd' of andere generieke bureautaal.",
          "Gebruik je/jij voor WebsUp-offertes en u/uw voor Koolhaas Installaties.",
          "Maak het concreet op basis van klant, projecttitel, categorie, inbegrepen regels, opties en uitsluitingen.",
          "Benoem kort wat de klant krijgt en waarom dat praktisch waardevol is.",
          "Sluit niet af alsof het hele project al verkocht is; houd het als offerte-intro.",
        ].join(" "),
        outro: [
          "Schrijf een kort persoonlijk slotwoord in de ik-vorm namens Daan Koolhaas.",
          "Maak duidelijk dat vragen of aanpassingen welkom zijn.",
        ].join(" "),
        options: "Genereer alleen passende optionele uitbreidingen als losse objecten.",
        exclusions: "Genereer alleen heldere uitsluitingen als losse strings.",
        flow: "Genereer alleen concrete processtappen die passen bij deze offerte.",
        approach: "Genereer alleen een praktische werkwijze die past bij deze offerte.",
      };

      const context = {
        section,
        instruction: sectionInstructions[section] ?? `Genereer alleen de sectie ${section}.`,
        company: { slug: brand.slug, name: brand.name, role: brand.role, sender: "Daan Koolhaas" },
        customer: quote.customer,
        quote: {
          number: quote.number,
          title: quote.title,
          category: quote.category,
          tagline: quote.tagline,
          itemsHeader: quote.itemsHeader,
          intro: quote.intro,
          outro: quote.outro,
          totalExVat: quote.totalExVat,
          totalIncVat: quote.totalIncVat,
          items: quote.items,
          flow,
          approach,
          options,
          exclusions,
        },
      };

      const res = await fetch("/api/ai/extract-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: `Genereer of herschrijf alleen de sectie '${section}' voor deze offerte. Context:\n${JSON.stringify(context, null, 2)}`,
          customerName: quote.customer.name 
        }),
      });
      const data = await res.json();
      if (data[section]) {
        onUpdate({ [section]: data[section] });
        toast.success(`Sectie ${section} gegenereerd!`);
      }
    } catch {
      toast.error("AI generatie mislukt.");
    } finally {
      setGenerating(null);
    }
  };

  const renderHeaderLogo = (cover = false) => {
    if (isKoolhaas) {
      // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout gebruikt intrinsieke CSS-afmetingen
      return <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className={cover ? "brand-logo brand-logo-cover" : "brand-logo"} />;
    }
    // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout gebruikt intrinsieke CSS-afmetingen
    return <img src="/logos/websup-cover.png" alt="WebsUp" className={cover ? "brand-logo brand-logo-cover" : "brand-logo"} />;
  };

  const renderPageFooter = (pageNo: string) => (
    <div className="doc-foot">
      {isKoolhaas ? (
        // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout gebruikt intrinsieke CSS-afmetingen
        <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className="brand-logo doc-foot-brand-logo" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout gebruikt intrinsieke CSS-afmetingen
        <img src="/logos/websup-icon.png" alt="WebsUp" className="doc-foot-icon" />
      )}
      <div className="doc-foot-meta">
        <div className="doc-foot-meta-row">
          {!isKoolhaas && <span>{brand.website}</span>}
          <span>{brand.email}</span>
          <span>{brand.phone}</span>
          <span>KVK {brand.kvk}</span>
        </div>
        <div className="doc-foot-meta-row">
          {validUntilLabel && <span>Geldig tot {validUntilLabel}</span>}
          <span>{pageNo}</span>
        </div>
      </div>
    </div>
  );

  const updateOption = (index: number, updates: Partial<QuoteOption>) => {
    const nextOptions = options.map((option, optionIndex) =>
      optionIndex === index ? { ...option, ...updates } : option
    );
    onUpdate?.({ options: nextOptions });
  };

  const addOption = () => {
    onUpdate?.({
      options: [
        ...options,
        { id: `morework-${Date.now()}`, t: "Nieuw optioneel meerwerk", d: "Korte omschrijving van deze uitbreiding.", tag: "Optioneel", price: 0, recurringPrice: null, recurringInterval: null, vatRate: 21, defaultSelected: false, details: [] },
      ],
    });
  };

  // De id van een bron is het nummer waarnaar de tekst verwijst ([1], [2], ...).
  // Bij bewerken blijft die id staan, zodat bestaande verwijzingen blijven kloppen.
  const writeSources = (next: QuoteSource[]) => {
    onUpdate?.({ batteryAdvice: { ...(quote.batteryAdvice ?? {}), sources: next } });
  };

  const updateSource = (index: number, updates: Partial<QuoteSource>) => {
    writeSources(sources.map((source, i) => (i === index ? { ...source, ...updates } : source)));
  };

  const addSource = () => {
    const highest = sources.reduce((max, source) => Math.max(max, Number(source.id) || 0), 0);
    writeSources([
      ...sources,
      { id: String(highest + 1), label: "Nieuwe bron", description: "", url: "" },
    ]);
  };

  const removeSource = (index: number) => {
    writeSources(sources.filter((_, i) => i !== index));
  };

  const removeOption = (index: number) => {
    onUpdate?.({ options: options.filter((_, optionIndex) => optionIndex !== index) });
  };

  const updateTextList = (
    field: "exclusions" | "assumptions" | "technicalNotes" | "customerResponsibilities",
    values: string[],
    index: number,
    value: string
  ) => {
    onUpdate?.({ [field]: values.map((item, itemIndex) => (itemIndex === index ? value : item)) });
  };

  const addTextListItem = (
    field: "exclusions" | "assumptions" | "technicalNotes" | "customerResponsibilities",
    values: string[],
    fallback: string
  ) => {
    onUpdate?.({ [field]: [...values, fallback] });
  };

  const removeTextListItem = (
    field: "exclusions" | "assumptions" | "technicalNotes" | "customerResponsibilities",
    values: string[],
    index: number
  ) => {
    onUpdate?.({ [field]: values.filter((_, itemIndex) => itemIndex !== index) });
  };

  const renderTextList = (
    field: "exclusions" | "assumptions" | "technicalNotes" | "customerResponsibilities",
    values: string[],
    fallback: string,
    showAdd: boolean = true
  ) => (
    <div className="doc-text-list">
      {values.map((item, index) => (
        <div key={index} className="doc-text-row">
          {isEditable ? (
            <InlineTextarea
              isEditable
              value={item}
              onChange={(value) => updateTextList(field, values, index, value)}
              className="doc-text-line"
            />
          ) : (
            <CitedText value={item} sources={sources} className="doc-text-line" />
          )}
          {isEditable && (
            <button
              type="button"
              className="inline-delete"
              onClick={() => removeTextListItem(field, values, index)}
              aria-label="Regel verwijderen"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {isEditable && showAdd && (
        <button
          type="button"
          className="doc-edit-btn doc-list-add"
          onClick={() => addTextListItem(field, values, fallback)}
        >
          <PlusCircle size={14} />
          Regel
        </button>
      )}
    </div>
  );

  const itemsTableBlock = (
    <>
      <div className="article-table-head">
        <div>
          <span className="eyebrow">{isKoolhaas ? "Inbegrepen werkzaamheden" : "Diensten"}</span>
          <h2 className="h2">
            <InlineInput
              isEditable={isEditable}
              value={quote.itemsHeader || (isKoolhaas ? "Materiaaloverzicht" : "Prijsopbouw")}
              onChange={(v) => onUpdate?.({ itemsHeader: v })}
            />
          </h2>
        </div>
      </div>
      <div className="article-table-wrap">
        <table className="article-table">
          <thead>
            <tr>
              <th>Omschrijving</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const isSubItem = (item.indent ?? 0) > 0 || (Number(item.unitPrice) === 0 && Number(item.total) === 0);
              if (isSubItem) {
                return (
                  <tr key={item.id} className="article-sub-row">
                    <td>
                      <span className="article-sub-dot"><Check size={9} strokeWidth={3} /></span>
                      <span className="article-sub-content">
                        <InlineTextarea
                          isEditable={isEditable}
                          value={item.description}
                          onChange={(v) => onUpdateItem?.(item.id, { description: v })}
                          className="article-description"
                        />
                      </span>
                      {isEditable && (
                        <button
                          type="button"
                          className="inline-delete"
                          onClick={() => onRemoveItem?.(item.id)}
                          aria-label="Regel verwijderen"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={item.id}>
                  <td className="article-description">
                    <span style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <InlineTextarea
                        isEditable={isEditable}
                        value={item.description}
                        onChange={(v) => onUpdateItem?.(item.id, { description: v })}
                      />
                      {isEditable && (
                        <button
                          type="button"
                          className="inline-delete"
                          onClick={() => onRemoveItem?.(item.id)}
                          aria-label="Regel verwijderen"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {isEditable && onAddItem && (
              <tr>
                <td>
                  <button type="button" className="doc-edit-btn doc-list-add" onClick={() => onAddItem()}>
                    <PlusCircle size={14} />
                    Regel
                  </button>
                </td>
              </tr>
            )}
            {isEditable && !onAddItem && priceSource && (
              <tr>
                <td>
                  <a href={priceSource.href} className="doc-edit-btn doc-list-add">
                    <Layers size={14} />
                    Regels en prijzen staan in {priceSource.label}
                  </a>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="grand-total">
              <td>
                <span>{recurringTotalLines.length > 0 ? "Eenmalig" : "Totaal"} {showExVat ? "excl." : "incl."} btw</span>
                <strong>{formatCurrency(Number(showExVat ? totals.totalExVat : totals.totalIncVat))}</strong>
              </td>
            </tr>
            {recurringTotalLines.map((line) => (
              <tr className="grand-total grand-total-recurring" key={line.interval}>
                <td>
                  <span>Daarna {line.interval} {showExVat ? "excl." : "incl."} btw</span>
                  <strong>{formatCurrency(line.amount)}</strong>
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </>
  );

  const technicalNotesBlock = technicalNotes.length > 0 ? (
    <>
      <div className="row-badge">
        <div>
          <span className="eyebrow">Technische uitgangspunten</span>
          <h2 className="h2">Uitgangspunten voor de uitvoering.</h2>
        </div>
      </div>
      {assumptionsOwn.length > 0 &&
        renderTextList("assumptions", assumptionsOwn, "Nieuw uitgangspunt voor deze offerte.", technicalNotesOwn.length === 0)}
      {technicalNotesOwn.length > 0 &&
        renderTextList("technicalNotes", technicalNotesOwn, "Nieuw uitgangspunt voor deze offerte.", true)}
    </>
  ) : null;

  const responsibilitiesBlock = customerResponsibilities.length > 0 ? (
    <>
      <div className="row-badge">
        <div>
          <span className="eyebrow">Voorbereiding voor de uitvoering</span>
          <h2 className="h2">Wat vooraf nodig is.</h2>
        </div>
      </div>
      {renderTextList("customerResponsibilities", customerResponsibilities, "Nieuwe afspraak voor voorbereiding door opdrachtgever.")}
    </>
  ) : null;

  const exclusionsBlock = exclusions.length > 0 ? (
    <>
      <div className="row-badge">
        <div>
          <span className="eyebrow">{brand.exclusionsEyebrow}</span>
          <h2 className="h2">{brand.exclusionsTitle}</h2>
        </div>
      </div>
      {renderTextList("exclusions", exclusions, "Nieuwe uitsluiting of randvoorwaarde.")}
    </>
  ) : null;

  const optionsBlock = (
    <>
      <div className="row-badge">
        <div>
          <span className="eyebrow">{brand.optionsEyebrow}</span>
          <h2 className="h2">{brand.optionsTitle}</h2>
        </div>
        {isEditable && (
          <button type="button" className="doc-edit-btn" onClick={addOption}>
            <PlusCircle size={14} />
            Optie
          </button>
        )}
      </div>
      <div className="opts">
        {options.map((o, idx) => {
          const oneTimePrice = getQuoteOptionPrice(o);
          const recurringPrice = getQuoteOptionRecurringPrice(o);
          const recurringInterval = getQuoteOptionRecurringInterval(o);
          const displayOneTimePrice = oneTimePrice == null
            ? null
            : showExVat
              ? oneTimePrice
              : oneTimePrice * (1 + o.vatRate / 100);
          const displayRecurringPrice = recurringPrice == null
            ? null
            : showExVat
              ? recurringPrice
              : recurringPrice * (1 + o.vatRate / 100);
          const hasRenderedPrice = displayOneTimePrice != null || displayRecurringPrice != null;

          return (
          <div key={idx} className="opt group relative">
            {isEditable && (
              <button
                type="button"
                className="doc-remove-btn"
                onClick={() => removeOption(idx)}
                aria-label="Optioneel meerwerk verwijderen"
              >
                <Trash2 size={13} />
              </button>
            )}
            <span className="opt-ic"><Layers size={15} /></span>
            <div className="flex-1">
              <h4 className="font-bold">
                <InlineInput
                  value={o.t}
                  onChange={(value) => updateOption(idx, { t: value })}
                  placeholder="Titel optioneel meerwerk"
                  className="font-bold"
                  isEditable={Boolean(isEditable)}
                />
              </h4>
              <InlineTextarea
                value={o.d}
                onChange={(value) => updateOption(idx, { d: value })}
                placeholder="Omschrijving optioneel meerwerk"
                className="text-xs"
                isEditable={Boolean(isEditable)}
              />
              {(isEditable || !hasRenderedPrice) && (
                <span className="opt-tag">
                  <InlineInput
                    value={o.tag}
                    onChange={(value) => updateOption(idx, { tag: value })}
                    placeholder="Label"
                    isEditable={Boolean(isEditable)}
                  />
                </span>
              )}
              {!isEditable && hasRenderedPrice && (
                <span className="opt-price-badges">
                  {displayOneTimePrice != null && (
                    <span className="opt-price-badge">
                      <b>+ {formatCurrency(displayOneTimePrice)}</b>
                      <small>eenmalig {showExVat ? "excl. btw" : "incl. btw"}</small>
                    </span>
                  )}
                  {displayRecurringPrice != null && recurringInterval && (
                    <span className="opt-price-badge">
                      <b>+ {formatCurrency(displayRecurringPrice)}</b>
                      <small>{recurringInterval} {showExVat ? "excl. btw" : "incl. btw"}</small>
                    </span>
                  )}
                </span>
              )}
              {isEditable && (
                <div className="mt-2 space-y-2 text-xs font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    <span>Eenmalig €</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={o.price ?? ""}
                      placeholder="Op aanvraag"
                      onChange={(event) =>
                        updateOption(idx, { price: event.target.value === "" ? null : Number(event.target.value) })
                      }
                      className="editable-input max-w-28"
                      aria-label="Eenmalige prijs optioneel meerwerk exclusief btw (leeg = op aanvraag)"
                    />
                    <span>excl. btw</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Per</span>
                    <select
                      value={o.recurringInterval ?? ""}
                      onChange={(event) =>
                        updateOption(idx, {
                          recurringInterval: (event.target.value || null) as "maand" | "jaar" | null,
                          ...(event.target.value ? {} : { recurringPrice: null }),
                        })
                      }
                      className="editable-input max-w-24"
                      aria-label="Interval terugkerende prijs"
                    >
                      <option value="">geen abonnement</option>
                      <option value="maand">maand</option>
                      <option value="jaar">jaar</option>
                    </select>
                    {o.recurringInterval && (
                      <>
                        <span>€</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={o.recurringPrice ?? ""}
                          placeholder="0,00"
                          onChange={(event) =>
                            updateOption(idx, {
                              recurringPrice: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                          className="editable-input max-w-28"
                          aria-label="Terugkerende prijs exclusief btw"
                        />
                        <span>excl. btw</span>
                      </>
                    )}
                  </div>
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={o.defaultSelected ?? false}
                      onChange={(event) => updateOption(idx, { defaultSelected: event.target.checked })}
                    />
                    Standaard aangevinkt in het klantportaal
                  </label>
                </div>
              )}
              {isEditable && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <InlineTextarea
                    value={o.technicalCondition || ""}
                    onChange={(value) => updateOption(idx, { technicalCondition: value })}
                    placeholder="Technische voorwaarde (optioneel)"
                    className="text-xs"
                    isEditable
                  />
                  <InlineTextarea
                    value={o.details.join("\n")}
                    onChange={(value) => updateOption(idx, { details: value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                    placeholder="Technische details, één regel per punt"
                    className="text-xs"
                    isEditable
                  />
                </div>
              )}
              {!isEditable && o.details.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm leading-relaxed text-slate-700">
                  {o.details.map((detail, detailIdx) => (
                    <li key={detailIdx}>{detail}</li>
                  ))}
                </ul>
              )}
              {!isEditable && o.technicalCondition && (
                <p className="mt-1 text-[11px] italic text-slate-400">{o.technicalCondition}</p>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className={`portal-container ${isKoolhaas ? "portal-koolhaas" : "portal-websup"}`} style={{ minHeight: 'auto', backgroundColor: 'transparent' }}>
      <div className="doc-viewer" style={{ paddingBottom: 0 }}>
        
        {/* ── PAGINA 1: COVER ── */}
        <section className="sheet cover">
          <div className="cov-layout">
            <div className="cov-panel">
              <div className="bar"></div>
              <div className="cov-pad">
                <div className="cov-top">
                  {renderHeaderLogo(true)}
                  <div className="cov-meta">
                    <dl>
                      <dt>Offertenummer</dt> <dd>{quote.number || "CONCEPT"}</dd>
                      <dt>Datum</dt>         <dd>{formatDate(today)}</dd>
                      {validUntilLabel && <><dt>Geldig tot</dt><dd>{validUntilLabel}</dd></>}
                      <dt>Contactpersoon</dt><dd>Daan Koolhaas</dd>
                    </dl>
                  </div>
                </div>
                <div className="cov-main">
                  <div className="cov-line" />
                  <div className="cov-mid">
                    <InlineInput 
                      isEditable={isEditable} 
                      value={quote.category || brand.defaultCategory} 
                      onChange={(v) => onUpdate?.({ category: v })}
                      className="eyebrow inv"
                    />
                    <h1 className="cov-h1">{coverHeading}</h1>
                    <InlineInput 
                      isEditable={isEditable} 
                      value={quote.tagline || quote.category || brand.defaultCategory} 
                      onChange={(v) => onUpdate?.({ tagline: v })}
                      className="cov-project"
                    />
                    <div className="cov-for">
                      <span>Voor</span>
                      <b>{quote.customer.name || "Klantnaam"}</b>
                      {(quote.customer.address || quote.customer.city) && (
                        <small className="cov-for-address">
                          {[quote.customer.address, [quote.customer.zipCode, quote.customer.city].filter(Boolean).join(" ")]
                            .filter(Boolean)
                            .join(", ")}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
                <div className="cov-foot">
                  {!isKoolhaas && (
                    // eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout gebruikt intrinsieke CSS-afmetingen
                    <img src="/logos/websup-icon-w.png" alt="" className="cov-foot-icon" />
                  )}
                  <span><small>Web</small><b>{brand.website}</b></span>
                  <span><small>Mail</small><b>{brand.email}</b></span>
                  <span><small>Telefoon</small><b>{brand.phone}</b></span>
                  <span><small>KVK</small><b>{brand.kvk}</b></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PAGINA 2: INTRO ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">Toelichting op mijn voorstel</span>
              {isEditable && (
                <button onClick={() => handleAiGen('intro')} disabled={!!generating} className="ai-gen-btn">
                  {generating === 'intro' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Magische tekst
                </button>
              )}
            </div>
            <h2 className="h2">
              <InlineInput
                isEditable={isEditable}
                value={quote.title || (isKoolhaas ? "Uw installatie op maat." : "Mijn voorstel voor jou.")}
                onChange={(v) => onUpdate?.({ title: v })}
              />
            </h2>
            {isEditable ? (
              <InlineTextarea
                isEditable
                value={introText}
                onChange={(v) => onUpdate?.({ intro: v })}
                className="letter"
              />
            ) : (
              <CitedText value={introText} sources={sources} className="letter" paragraphs />
            )}
            <div className="sig">
              <div className="sig-av">
                {/* eslint-disable-next-line @next/next/no-img-element -- vaste documentlayout gebruikt intrinsieke CSS-afmetingen */}
                <img src="/logos/daan-koolhaas.jpg" alt="Daan Koolhaas" />
              </div>
              <div>
                <div className="sig-name">Daan Koolhaas</div>
                <div className="sig-role">{brand.role}</div>
              </div>
            </div>
            {renderSectionSpace("intro")}
            {renderPageFooter(pageNr("intro"))}
          </div>
        </section>

        {/* ── INHOUDSBLOKKEN: vrije uitleg tussen intro en prijzen ── */}
        {contentPages.map((page, pageIndex) => (
          <section className="sheet" key={`content-${pageIndex}`}>
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              <div className="content-blocks">
                {page.map((block, blockIndex) => {
                  const key = block.id ?? `${pageIndex}-${blockIndex}`;
                  const list = Array.isArray(block.items) ? block.items : [];

                  if (block.type === "heading") {
                    return (
                      <div className="row-badge" key={key}>
                        <div>
                          {block.body && <span className="eyebrow">{block.body}</span>}
                          <h2 className="h2">{block.title}</h2>
                        </div>
                      </div>
                    );
                  }

                  if (block.type === "list") {
                    return (
                      <div className="content-block" key={key}>
                        {block.title && <h3 className="content-block-title">{block.title}</h3>}
                        <ul className="content-list">
                          {(list as string[]).map((entry, i) => <li key={i}>{entry}</li>)}
                        </ul>
                      </div>
                    );
                  }

                  if (block.type === "steps") {
                    return (
                      <div className="content-block" key={key}>
                        {block.title && <h3 className="content-block-title">{block.title}</h3>}
                        <div className="flow">
                          {(list as { t?: string; d?: string }[]).map((step, i) => (
                            <div className="flow-item" key={i}>
                              <div className="flow-num">{String(i + 1).padStart(2, "0")}</div>
                              <div>
                                <div className="flow-title">{step.t}</div>
                                <div className="flow-desc">{step.d}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (block.type === "specs") {
                    return (
                      <div className="content-block" key={key}>
                        {block.title && <h3 className="content-block-title">{block.title}</h3>}
                        <div className="content-specs">
                          {(list as { k?: string; v?: string }[]).map((spec, i) => (
                            <div className="content-spec" key={i}>
                              <span className="content-spec-key">{spec.k}</span>
                              <span className="content-spec-value">{spec.v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (block.type === "callout") {
                    return (
                      <div className={`content-callout content-callout-${block.tone || "info"}`} key={key}>
                        {block.title && <strong>{block.title}</strong>}
                        {block.body && <CitedText value={block.body} sources={sources} paragraphs />}
                      </div>
                    );
                  }

                  if (block.type === "image") {
                    return (
                      <figure className="content-image" key={key}>
                        {block.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- offerte-afbeeldingen kunnen tijdelijke opslag-URL's zijn
                          <img src={block.imageUrl} alt={block.title || block.caption || "Afbeelding"} />
                        )}
                        {block.caption && <figcaption>{block.caption}</figcaption>}
                      </figure>
                    );
                  }

                  return (
                    <div className="content-block" key={key}>
                      {block.title && <h3 className="content-block-title">{block.title}</h3>}
                      {block.body && <CitedText value={block.body} sources={sources} className="letter" paragraphs />}
                    </div>
                  );
                })}
              </div>

              <div className="spacer"></div>
              {renderPageFooter(pageNr(`content-${pageIndex}`))}
            </div>
          </section>
        ))}

        {/* ── WERKING VAN DE INSTALLATIE ── */}
        {approachPages.map((paginaStappen, paginaIndex) => (
          <section className="sheet" key={`approach-${paginaIndex}`}>
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>
              <div className="row-badge">
                <div>
                  <span className="eyebrow">Werking van de installatie</span>
                  <h2 className="h2">{paginaIndex === 0 ? "Zo werkt het in de praktijk." : "Zo werkt het in de praktijk, vervolg."}</h2>
                </div>
              </div>
              <div className="flow-grid">
                {paginaStappen.map((step) => {
                  const index = approach.indexOf(step);
                  return (
                  <div className="flow-item" key={index} style={{ position: "relative" }}>
                    <div className="fn">{step.n ?? index + 1}</div>
                    <div style={{ flex: 1 }}>
                      <h4>
                        <InlineInput
                          isEditable={Boolean(isEditable)}
                          value={step.t}
                          onChange={(value) =>
                            onUpdate?.({ approach: approach.map((s, i) => (i === index ? { ...s, t: value } : s)) })
                          }
                          placeholder="Titel van de stap"
                        />
                      </h4>
                      {isEditable ? (
                        <InlineTextarea
                          isEditable
                          value={step.d}
                          onChange={(value) =>
                            onUpdate?.({ approach: approach.map((s, i) => (i === index ? { ...s, d: value } : s)) })
                          }
                          placeholder="Uitleg van deze stap"
                        />
                      ) : (
                        <CitedText value={step.d} sources={sources} />
                      )}
                    </div>
                    {isEditable && (
                      <button
                        type="button"
                        className="inline-delete"
                        onClick={() => onUpdate?.({ approach: approach.filter((_, i) => i !== index) })}
                        aria-label="Stap verwijderen"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  );
                })}
                {isEditable && paginaIndex === approachPages.length - 1 && (
                  <button
                    type="button"
                    className="doc-edit-btn doc-list-add"
                    onClick={() =>
                      onUpdate?.({
                        approach: [
                          ...approach,
                          { n: approach.length + 1, t: "Nieuwe stap", d: "Korte uitleg van deze stap." },
                        ],
                      })
                    }
                  >
                    <PlusCircle size={14} />
                    Stap
                  </button>
                )}
              </div>
              {renderSectionSpace("werking")}
              {renderPageFooter(pageNr(`approach-${paginaIndex}`))}
            </div>
          </section>
        ))}

        {/* ── ONTWERPVOORBEELDEN ── */}
        {standaloneAttachments.map((attachment, index) => (
          <section className="sheet design-sheet" key={attachment.id ?? `${attachment.imageUrl}-${index}`}>
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              <div className="row-badge">
                <div>
                  <span className="eyebrow">Ontwerpvoorbeeld {index + 1}</span>
                  <h2 className="h2">{attachment.title || "Voorbeeld van de uitwerking"}</h2>
                </div>
              </div>

              <figure className="design-full design-full-preview">
                <div className="design-full-frame">
                  {attachment.imageUrl ? (
                    attachment.liveUrl ? (
                      <a
                        href={attachment.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="attachment-image-link"
                        aria-label={`Open ${attachment.title || "het ontwerpvoorbeeld"} in een nieuw tabblad`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- offerte-afbeeldingen kunnen tijdelijke opslag-URL's zijn */}
                        <img
                          src={attachment.imageUrl}
                          alt={attachment.title || `Ontwerpvoorbeeld ${index + 1}`}
                        />
                      </a>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- offerte-afbeeldingen kunnen tijdelijke opslag-URL's zijn
                      <img
                        src={attachment.imageUrl}
                        alt={attachment.title || `Ontwerpvoorbeeld ${index + 1}`}
                      />
                    )
                  ) : (
                    <a
                      href={attachment.liveUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="design-live-frame"
                    >
                      <span>Werkend voorbeeld</span>
                      <b>{attachment.liveUrl || "Open het voorbeeld online"}</b>
                    </a>
                  )}
                </div>
                <figcaption className="design-full-caption">
                  <div className="design-caption-copy">
                    <span className="design-caption-label">
                      {attachment.liveUrl ? "Werkend ontwerp" : "Ontwerpimpressie"}
                    </span>
                    <p>
                      {attachment.caption ||
                        (attachment.liveUrl
                          ? "Bekijk het ontwerp op ware grootte en ervaar hoe de pagina straks werkt."
                          : "Een visuele indruk van de voorgestelde uitwerking.")}
                    </p>
                  </div>
                  {attachment.liveUrl && (
                    <a
                      href={attachment.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="design-open-link"
                    >
                      Open het interactieve ontwerp
                    </a>
                  )}
                </figcaption>
              </figure>

              {renderPageFooter(pageNr(`attachment-${index}`))}
            </div>
          </section>
        ))}

        {/* ── PAGINA 4: INVESTERING (of geen keuzes) ── */}
        {choiceEntries.length === 0 && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              {!splitItemsPage && itemsTableBlock}

              {renderSectionSpace("items")}
              {renderPageFooter(pageNr("investering"))}
            </div>
          </section>
        )}

        {/* ── PAGINA'S 4..: elke systeemoptie krijgt een eigen volle pagina ── */}
        {choiceEntries.map(({ group, choice }, entryIndex) => {
          const isActive = selectedChoiceIds[group.id] === choice.id;
          const systeemIncVat = choice.items.reduce((sum, item) => {
            const line = Number(item.qty) * Number(item.unitPrice);
            return sum + line * (1 + Number(item.vatRate) / 100);
          }, 0);
          const systeemExVat = choice.items.reduce(
            (sum, item) => sum + Number(item.qty) * Number(item.unitPrice),
            0,
          );
          const total = showExVat ? systeemExVat + totals.baseExVat : systeemIncVat + baseIncVat;
          const isRecommended = group.recommendedChoiceId === choice.id || choice.label?.toLowerCase() === "aanbevolen";
          const isLast = entryIndex === choiceEntries.length - 1;
          // Materiaal/arbeid met een prijs los van de inbegrepen (€0) werkzaamheden,
          // zodat de klant ziet wat er geleverd wordt vs. wat erbij inbegrepen is.
          const materialItems = choice.items.filter((item) => !item.hiddenOnQuote && Number(item.unitPrice) > 0);
          const includedItems = choice.items.filter(
            (item) => !item.hiddenOnQuote && Number(item.unitPrice) === 0 && item.description.trim().toLowerCase() !== "inbegrepen werkzaamheden",
          );
          return (
            <section className="sheet" key={choice.id}>
              <div className="bar"></div>
              <div className="pad">
                <div className="ph">
                  {renderHeaderLogo()}
                  <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
                </div>

                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <span className="eyebrow">Mogelijke systemen</span>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">{group.title}</h3>
                    {group.description && <p className="mt-1 text-sm text-slate-500">{group.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    Optie {entryIndex + 1} / {choiceEntries.length}
                  </span>
                </div>

                <div className={`relative flex flex-1 flex-col rounded-2xl border p-7 md:p-9 ${isActive ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
                  {(choice.imageUrl || choice.image) && (
                    <div className="choice-photo mb-5 h-56 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={choice.imageUrl || choice.image}
                        alt={choice.title}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <h4 className="text-2xl font-bold leading-tight text-slate-900">{choice.title}</h4>
                    {(choice.label || isRecommended) && (
                      <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${isRecommended ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {choice.label || "Aanbevolen"}
                      </span>
                    )}
                  </div>
                  {choice.summary && <p className="mb-2 text-base leading-relaxed text-slate-600">{choice.summary}</p>}
                  {materialItems.length > 0 && (
                    <ul className="choice-details mt-7">
                      {materialItems.map((item, index) => (
                          <li key={`${choice.id}-material-${index}`}>
                            <Check size={13} strokeWidth={3} />
                            <span>{item.description}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                  {includedItems.length > 0 && (
                    <div className="choice-included mt-5 rounded-lg bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Inbegrepen bij deze keuze</p>
                      <ul className="choice-details choice-details-included">
                        {includedItems.map((item, index) => (
                            <li key={`${choice.id}-included-${index}`}>
                              <Check size={13} strokeWidth={3} />
                              <span>{item.description}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  <div className={`mt-auto flex items-end gap-3 border-t border-slate-100 pt-4 ${isActive || !isPrint ? "justify-between" : "justify-end"}`}>
                    {(isActive || !isPrint) && (
                      <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
                        {isActive ? "Geselecteerd" : "Keuze bij akkoord"}
                      </span>
                    )}
                    <strong className="text-xl text-slate-900">
                      {formatCurrency(total)} {showExVat ? "excl. btw" : "incl. btw"}
                    </strong>
                  </div>
                </div>

                {isLast && !splitItemsPage && visibleItems.length > 0 && itemsTableBlock}

                {isLast ? renderSectionSpace("items") : <div className="spacer"></div>}
                {renderPageFooter(pageNr(`choice-${entryIndex}`))}
              </div>
            </section>
          );
        })}

        {splitItemsPage && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              {itemsTableBlock}

              {renderSectionSpace("items")}
              {renderPageFooter(pageNr("items"))}
            </div>
          </section>
        )}

        {hasOptionsPage && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              {optionsBlock}

              {renderSectionSpace("opties")}
              {renderPageFooter(pageNr("options"))}
            </div>
          </section>
        )}

        {hasTermsPage && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              {technicalNotesBlock}

              {!splitTermsPage && responsibilitiesBlock && (
                <>
                  <div className="div"></div>
                  {responsibilitiesBlock}
                </>
              )}

              {!splitTermsPage && exclusionsBlock && (
                <>
                  <div className="div"></div>
                  {exclusionsBlock}
                </>
              )}

              {renderSectionSpace("terms")}
              {renderPageFooter(pageNr("terms"))}
            </div>
          </section>
        )}

        {splitTermsPage && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              {responsibilitiesBlock}

              {responsibilitiesBlock && exclusionsBlock && <div className="div"></div>}

              {exclusionsBlock}

              <div className="spacer"></div>
              {renderPageFooter(pageNr("terms-2"))}
            </div>
          </section>
        )}

        {sourcePages.map((paginaBronnen, paginaIndex) => (
          <section className="sheet" key={`sources-${paginaIndex}`}>
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              <div className="row-badge">
                <div>
                  <span className="eyebrow">Technische onderbouwing</span>
                  <h2 className="h2">
                    {paginaIndex === 0 ? "Bronnen bij dit advies." : "Bronnen bij dit advies, vervolg."}
                  </h2>
                </div>
              </div>
              {paginaIndex === 0 && (
                <p className="source-intro">
                  De belangrijkste technische uitgangspunten in deze offerte zijn gecontroleerd aan de hand van onderstaande informatie van fabrikanten en aanbieders.
                </p>
              )}
              <div className="source-grid">
                {paginaBronnen.map((source) => {
                  const index = sources.indexOf(source);
                  return isEditable ? (
                    // Bewerkbaar: label, toelichting en link. AI vult deze bronnen,
                    // dus je moet ze zonder omweg kunnen corrigeren.
                    <div key={source.id ?? index} className="source-card source-card-edit group relative">
                      <span className="source-number">{index + 1}</span>
                      <span className="source-copy">
                        <InlineInput
                          isEditable
                          value={source.label}
                          onChange={(value) => updateSource(index, { label: value })}
                          placeholder="Merk: onderwerp"
                          className="font-bold"
                        />
                        <InlineInput
                          isEditable
                          value={source.description ?? ""}
                          onChange={(value) => updateSource(index, { description: value })}
                          placeholder="Wat deze bron onderbouwt"
                          className="text-xs"
                        />
                        <InlineInput
                          isEditable
                          value={source.url}
                          onChange={(value) => updateSource(index, { url: value })}
                          placeholder="https://..."
                          className="text-xs"
                        />
                      </span>
                      <button
                        type="button"
                        className="inline-delete"
                        onClick={() => removeSource(index)}
                        aria-label="Bron verwijderen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <a
                      key={source.id ?? source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-card"
                    >
                      <SourceIcon url={source.url} index={index} />
                      <span className="source-copy">
                        <strong>{source.label}</strong>
                        {source.description && <small>{source.description}</small>}
                        <span className="source-link">Open officiële bron <ExternalLink size={12} /></span>
                      </span>
                    </a>
                  );
                })}
              </div>
              {isEditable && paginaIndex === sourcePages.length - 1 && (
                <button type="button" className="doc-edit-btn doc-list-add" onClick={addSource}>
                  <PlusCircle size={14} /> Bron toevoegen
                </button>
              )}

              <div className="spacer"></div>
              {renderPageFooter(pageNr(`sources-${paginaIndex}`))}
            </div>
          </section>
        ))}

        {/* ── PAGINA 5: SIGN ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>
            <span className="eyebrow">{isKoolhaas ? "Akkoord voor uitvoering" : "Volgende stap"}</span>
            <h2 className="h2">{brand.closingTitle}</h2>

            {quote.outro && (
              <div className="sign-outro">
                <InlineTextarea
                  isEditable={isEditable}
                  value={quote.outro}
                  onChange={(v) => onUpdate?.({ outro: v })}
                  className="letter"
                />
              </div>
            )}

            {quote.status === "ACCEPTED" && (
              <div className="acceptance-banner">
                <Check size={15} strokeWidth={3} />
                <span>Digitaal akkoord gegeven door {quote.customer.name}.</span>
              </div>
            )}
            
            <div className="sign-grid">
              <div className="sign-box">
                <div className="sign-who">Namens opdrachtgever</div>
                <div className="sign-org">{quote.customer.name}</div>
                <div className="sign-line"><div className="sign-lbl">Naam</div><div className="sign-rule"></div></div>
                <div className="sign-rule" style={{ marginTop: '40px', borderBottom: '1px solid var(--border-str)' }}></div>
              </div>
              <div className="sign-box">
                <div className="sign-who">Namens opdrachtnemer</div>
                <div className="sign-org">{brand.contractor}</div>
                <div className="sign-signature-slot">
                  {/* eslint-disable-next-line @next/next/no-img-element -- handtekening volgt de vaste printlayout */}
                  <img src="/signatures/daan-koolhaas-signature.png" alt="Handtekening" className="sign-signature-img" />
                </div>
              </div>
            </div>

            {renderSectionSpace("sign")}
            {renderPageFooter(pageNr("sign"))}
          </div>
        </section>
      </div>
    </div>
  );
}
