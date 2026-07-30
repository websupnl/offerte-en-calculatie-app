"use client";

import {
  Check,
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
};

type FlowItem = { n: number | string; t: string; d: string };
type ApproachStep = { n: number | string; t: string; d: string };
type QuoteAttachment = { id?: string; title?: string | null; imageUrl: string; liveUrl?: string | null; caption?: string | null; section?: string | null };

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
  acceptedAt?: string | null;
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  items: QuoteItem[];
  customer: { name: string; email: string | null; address: string | null; city: string | null };
  flow?: FlowItem[];
  approach?: ApproachStep[];
  options?: QuoteOption[];
  exclusions?: string[];
  assumptions?: string[];
  technicalNotes?: string[];
  customerResponsibilities?: string[];
  attachments?: QuoteAttachment[];
  adviceDocuments?: { id: string; type: string }[];
  company?: { name?: string | null; slug?: string | null };
  choiceGroups?: QuoteChoiceGroup[];
  commercial?: { priceDisplayMode?: "incl" | "excl"; [key: string]: unknown };
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

  const today = new Date().toISOString();
  const activeSlug = companySlug || quote.company?.slug || "websup";
  const brand = activeSlug === "koolhaas" ? COMPANY_COPY.koolhaas : COMPANY_COPY.websup;
  const isKoolhaas = brand.slug === "koolhaas";
  
  // Choice Logic
  const choiceGroups = quote.choiceGroups || [];
  const visibleItems = quote.items;
  const showExVat = quote.commercial?.priceDisplayMode === "excl";

  const flow = quote.flow ?? [];
  const approach = quote.approach ?? [];
  const options = quote.options ?? [];
  const totals = calculateQuoteSelectionTotals(quote.items, choiceGroups, options, {
    selectedChoiceIds,
    selectedOptionIds,
  });
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
  // Een afbeelding hoort bij een sectie (staat onderaan die pagina) of krijgt een eigen pagina.
  const SECTION_KEYS = ["intro", "werking", "items", "terms", "sign", "opties"];
  const isSectionImage = (a: QuoteAttachment) =>
    Boolean(a.imageUrl) && SECTION_KEYS.includes(a.section ?? "intro");
  const sectionImages = (key: string) =>
    attachments.filter((a) => isSectionImage(a) && (a.section ?? "intro") === key);
  const standaloneAttachments = attachments.filter((a) => !isSectionImage(a));
  const attachmentPages = standaloneAttachments.length;
  // Rendert de afbeelding(en) van een sectie in de vrije ruimte onderaan die pagina,
  // of een lege spacer als er geen afbeelding is. Nooit overloop dankzij max-height.
  const renderSectionSpace = (key: string) => {
    const imgs = sectionImages(key);
    if (imgs.length === 0) return <div className="spacer"></div>;
    return (
      <div className="section-figure">
        {imgs.map((att, i) => (
          <figure className="section-figure-item" key={att.id ?? `${att.imageUrl}-${i}`}>
            <img src={att.imageUrl} alt={att.title || "Afbeelding bij deze sectie"} />
            {att.caption && <figcaption>{att.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  };
  const validUntilLabel = quote.validUntil ? formatDate(quote.validUntil) : null;
  const hasOptionsPage = options.length > 0;
  const hasTermsPage = Boolean(exclusions.length || technicalNotes.length || customerResponsibilities.length || quote.outro);
  // Werking van de installatie (approach-stappen) krijgt een eigen pagina na de intro.
  const hasApproachPage = approach.length > 0;
  const approachPageOffset = hasApproachPage ? 1 : 0;

  // Bij keuze-configuraties krijgt de inbegrepen-tabel een eigen pagina, zodat
  // de keuze-kaarten een volle pagina houden en niets afgesneden wordt.
  const splitItemsPage = choiceGroups.length > 0 && visibleItems.length > 0;
  const itemsPageOffset = splitItemsPage ? 1 : 0;

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
  const termsPageOffset = splitTermsPage ? 1 : 0;

  const totalPages =
    4 + approachPageOffset + attachmentPages + itemsPageOffset + (hasOptionsPage ? 1 : 0) + (hasTermsPage ? 1 : 0) + termsPageOffset;
  const pageLabel = (page: number) =>
    `${String(page).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
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
      return <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className={cover ? "brand-logo brand-logo-cover" : "brand-logo"} />;
    }
    return <img src="/logos/websup-cover.png" alt="WebsUp" className={cover ? "brand-logo brand-logo-cover" : "brand-logo"} />;
  };

  const renderPageFooter = (pageNo: string) => (
    <div className="doc-foot">
      {isKoolhaas ? (
        <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className="brand-logo doc-foot-brand-logo" />
      ) : (
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
        { id: `morework-${Date.now()}`, t: "Nieuw optioneel meerwerk", d: "Korte omschrijving van deze uitbreiding.", tag: "Optioneel", price: 0, vatRate: 21, details: [] },
      ],
    });
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
          <InlineTextarea
            isEditable={Boolean(isEditable)}
            value={item}
            onChange={(value) => updateTextList(field, values, index, value)}
            className="doc-text-line"
          />
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
          </tbody>
          <tfoot>
            <tr className="grand-total">
              <td>
                <span>Totaal {showExVat ? "excl." : "incl."} btw</span>
                <strong>{formatCurrency(Number(showExVat ? totals.totalExVat : totals.totalIncVat))}</strong>
              </td>
            </tr>
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
                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-900">
                  <span>€</span>
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
                    aria-label="Prijs optioneel meerwerk exclusief btw (leeg = op aanvraag)"
                  />
                  <span>excl. btw</span>
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
                          {[quote.customer.address, quote.customer.city].filter(Boolean).join(", ")}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
                <div className="cov-foot">
                  {!isKoolhaas && <img src="/logos/websup-icon-w.png" alt="" className="cov-foot-icon" />}
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
            <InlineTextarea 
              isEditable={isEditable} 
              value={introText} 
              onChange={(v) => onUpdate?.({ intro: v })} 
              className="letter" 
            />
            <div className="sig">
              <div className="sig-av">
                <img src="/logos/daan-koolhaas.jpg" alt="Daan Koolhaas" />
              </div>
              <div>
                <div className="sig-name">Daan Koolhaas</div>
                <div className="sig-role">{brand.role}</div>
              </div>
            </div>
            {renderSectionSpace("intro")}
            {renderPageFooter(pageLabel(2))}
          </div>
        </section>

        {/* ── WERKING VAN DE INSTALLATIE ── */}
        {hasApproachPage && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>
              <div className="row-badge">
                <div>
                  <span className="eyebrow">Werking van de installatie</span>
                  <h2 className="h2">Zo werkt het in de praktijk.</h2>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginTop: "16px" }}>
                {approach.map((step, index) => (
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
                      <InlineTextarea
                        isEditable={Boolean(isEditable)}
                        value={step.d}
                        onChange={(value) =>
                          onUpdate?.({ approach: approach.map((s, i) => (i === index ? { ...s, d: value } : s)) })
                        }
                        placeholder="Uitleg van deze stap"
                      />
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
                ))}
                {isEditable && (
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
              {renderPageFooter(pageLabel(3))}
            </div>
          </section>
        )}

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
                    <img
                      src={attachment.imageUrl}
                      alt={attachment.title || `Ontwerpvoorbeeld ${index + 1}`}
                    />
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

              <div className="spacer"></div>
              {renderPageFooter(pageLabel(3 + approachPageOffset + index))}
            </div>
          </section>
        ))}

        {/* ── PAGINA 4: INVESTERING + CHOICES ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>

            {/* Systeemconfiguraties worden hier samengevat; kiezen gebeurt bij akkoord. */}
            {choiceGroups.map(group => (
              <div key={group.id} className="choice-section mb-8">
                <div className="mb-4">
                  <span className="eyebrow">Mogelijke systemen</span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{group.title}</h3>
                  {group.description && <p className="mt-1 text-sm text-slate-500">{group.description}</p>}
                </div>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                  {group.choices.map(choice => {
                    const isActive = selectedChoiceIds[group.id] === choice.id;
                    const systeemIncVat = choice.items.reduce((sum, item) => {
                      const line = Number(item.qty) * Number(item.unitPrice);
                      return sum + line * (1 + Number(item.vatRate) / 100);
                    }, 0);
                    const systeemExVat = choice.items.reduce(
                      (sum, item) => sum + Number(item.qty) * Number(item.unitPrice),
                      0,
                    );
                    const total = showExVat
                      ? systeemExVat + totals.baseExVat
                      : systeemIncVat + baseIncVat;
                    const isRecommended = group.recommendedChoiceId === choice.id || choice.label?.toLowerCase() === "aanbevolen";
                    return (
                      <div key={choice.id} className={`relative flex flex-col rounded-xl border p-5 ${isActive ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
                        {(choice.imageUrl || choice.image) && (
                          <div className="choice-photo mb-3 aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={choice.imageUrl || choice.image}
                              alt={choice.title}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        )}
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <h4 className="text-base font-bold leading-tight text-slate-900">{choice.title}</h4>
                          {(choice.label || isRecommended) && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${isRecommended ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                              {choice.label || "Aanbevolen"}
                            </span>
                          )}
                        </div>
                        {choice.summary && <p className="mb-3 text-sm leading-relaxed text-slate-600">{choice.summary}</p>}
                        <ul className="choice-details">
                          {choice.items.map((item, index) => (
                              <li key={`${choice.id}-detail-${index}`}>
                                <Check size={10} strokeWidth={3} />
                                <span>{item.description}</span>
                              </li>
                            ))}
                        </ul>
                        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{isActive ? "Geselecteerd" : "Keuze bij akkoord"}</span>
                          <strong className="text-base text-slate-900">
                            {formatCurrency(total)} {showExVat ? "excl. btw" : "incl. btw"}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {!splitItemsPage && itemsTableBlock}

            {renderSectionSpace("items")}
            {renderPageFooter(pageLabel(3 + approachPageOffset + attachmentPages))}
          </div>
        </section>

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
              {renderPageFooter(pageLabel(4 + approachPageOffset + attachmentPages))}
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
              {renderPageFooter(pageLabel(4 + approachPageOffset + attachmentPages + itemsPageOffset))}
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

              {splitTermsPage ? <div className="spacer"></div> : renderSectionSpace("terms")}
              {renderPageFooter(pageLabel(4 + approachPageOffset + attachmentPages + itemsPageOffset + (hasOptionsPage ? 1 : 0)))}
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

              {renderSectionSpace("terms")}
              {renderPageFooter(pageLabel(4 + approachPageOffset + attachmentPages + itemsPageOffset + (hasOptionsPage ? 1 : 0) + 1))}
            </div>
          </section>
        )}

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
                  <img src="/signatures/daan-koolhaas-signature.png" alt="Handtekening" className="sign-signature-img" />
                </div>
              </div>
            </div>

            {renderSectionSpace("sign")}
            {renderPageFooter(pageLabel(totalPages))}
          </div>
        </section>
      </div>
    </div>
  );
}
