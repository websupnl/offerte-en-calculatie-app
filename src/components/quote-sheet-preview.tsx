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
    return <p style={{ whiteSpace: 'pre-wrap' }} className={className}>{value || placeholder}</p>;
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

type FlowItem = { n: number; t: string; d: string };
type ApproachStep = { n: string; t: string; d: string };
type QuoteAttachment = { id?: string; title?: string | null; imageUrl: string; liveUrl?: string | null; caption?: string | null };

type Quote = {
  number: string;
  title: string | null;
  category: string | null;
  tagline: string | null;
  itemsHeader: string | null;
  status: string;
  intro: string | null;
  outro: string | null;
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
};

const createPersonalIntro = (quote: Quote, brandName: string) => {
  const customerName = quote.customer.name || "klant";
  const projectTitle = quote.title || quote.category || "deze aanvraag";
  const itemSummary = quote.items
    .filter((item) => Number(item.unitPrice) > 0 || Number(item.total) > 0)
    .slice(0, 2)
    .map((item) => item.description.toLowerCase())
    .join(" en ");

  return [
    `Beste ${customerName},`,
    "",
    `Bedankt voor uw aanvraag. In deze offerte heb ik het voorstel voor ${projectTitle.toLowerCase()} overzichtelijk uitgewerkt, inclusief de onderdelen, werkzaamheden en het totaalbedrag.`,
    itemSummary
      ? `Ik ben uitgegaan van ${itemSummary}, met de aanvullende onderdelen zoals opgenomen in het overzicht.`
      : "Ik heb de offerte zo opgebouwd dat u snel ziet wat er wordt geleverd en welke afspraken daarbij horen.",
    "Heeft u na het lezen nog vragen of wilt u iets aanpassen, dan hoor ik dat graag.",
    "",
    "Met vriendelijke groet,",
    "Daan Koolhaas",
    brandName,
  ].join("\n");
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

interface QuoteSheetPreviewProps {
  quote: Quote;
  companySlug?: string;
  isEditable?: boolean;
  onUpdate?: (updates: Partial<Quote>) => void;
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
    email: "hallo@websup.nl",
    phone: "+31 6 12 34 56 78",
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
    closingTitle: "Zetten we de stap?",
    contractor: "WebsUp.nl - Daan Koolhaas",
    footerLine: "WebsUp.nl - Daan Koolhaas - Friesland",
  },
  koolhaas: {
    slug: "koolhaas",
    name: "Koolhaas Installaties",
    logoText: null,
    website: "koolhaasinstallaties.nl",
    email: "daan@koolhaasinstallaties.nl",
    phone: "+31 6 82 20 21 48",
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

const DEFAULT_FLOW: Record<"websup" | "koolhaas", FlowItem[]> = {
  websup: [
    { n: 1, t: "Intake", d: "Wensen, randvoorwaarden en inhoud scherp krijgen." },
    { n: 2, t: "Ontwerp", d: "Structuur, schermen en technische aanpak uitwerken." },
    { n: 3, t: "Bouw", d: "Realisatie van de afgesproken onderdelen." },
    { n: 4, t: "Test", d: "Controle op werking, inhoud en gebruiksgemak." },
    { n: 5, t: "Oplevering", d: "Livegang met korte overdracht." },
  ],
  koolhaas: [
    { n: 1, t: "Akkoord", d: "Offerte akkoord en bevestiging van de uitgangspunten." },
    { n: 2, t: "Technische check", d: "Laatste controle van meterkast, bekabeling en opstelplek." },
    { n: 3, t: "Planning", d: "Installatiemoment afstemmen en materialen reserveren." },
    { n: 4, t: "Installatie", d: "Plaatsing, aansluiting en nette afwerking op locatie." },
    { n: 5, t: "Inbedrijfstelling", d: "Testen, instellen en opleveren van de thuisbatterij." },
  ],
};

const DEFAULT_APPROACH: Record<"websup" | "koolhaas", ApproachStep[]> = {
  websup: [
    { n: "01", t: "Scherp starten", d: "We leggen doelen, inhoud en prioriteiten vast voordat de bouw begint." },
    { n: "02", t: "Gefaseerd bouwen", d: "De belangrijkste onderdelen worden eerst uitgewerkt en getest." },
    { n: "03", t: "Netjes opleveren", d: "Na controle volgt overdracht en ruimte voor kleine finetuning." },
  ],
  koolhaas: [
    { n: "01", t: "Voorbereiding", d: "We controleren de situatie en nemen de technische aandachtspunten door." },
    { n: "02", t: "Veilige montage", d: "Bekabeling, beveiliging en aansluiting worden volgens geldende normen uitgevoerd." },
    { n: "03", t: "Werkend opleveren", d: "De installatie wordt getest, ingesteld en duidelijk overgedragen." },
  ],
};

const DEFAULT_EXCLUSIONS: Record<"websup" | "koolhaas", string[]> = {
  websup: [
    "Werk buiten de beschreven scope",
    "Licenties of externe abonnementen",
    "Teksten, fotografie of contentproductie",
    "Koppelingen die niet vooraf zijn besproken",
  ],
  koolhaas: [
    "Hak- en breekwerk buiten normale montage",
    "Verzwaring of wijziging van de netaansluiting",
    "Aanpassingen aan dak, gevel of constructie",
    "Meerwerk door onvoorziene bestaande gebreken",
  ],
};

export function QuoteSheetPreview({
  quote,
  companySlug,
  isEditable = false,
  onUpdate,
  onUpdateItem,
  selectedChoiceIds: externalSelectedChoiceIds,
  selectedOptionIds = [],
}: QuoteSheetPreviewProps) {
  const defaultSelectedChoiceIds = useMemo(() => {
    return getRecommendedSelection(quote.choiceGroups ?? []).selectedChoiceIds;
  }, [quote.choiceGroups]);
  const selectedChoiceIds = externalSelectedChoiceIds !== undefined
    ? externalSelectedChoiceIds
    : defaultSelectedChoiceIds;

  const today = new Date().toISOString();
  const activeSlug = companySlug || quote.company?.slug || "websup";
  const brand = activeSlug === "koolhaas" ? COMPANY_COPY.koolhaas : COMPANY_COPY.websup;
  const isKoolhaas = brand.slug === "koolhaas";
  
  // Choice Logic
  const choiceGroups = quote.choiceGroups || [];
  const visibleItems = quote.items;

  const brandKey = isKoolhaas ? "koolhaas" : "websup";
  const flow = quote.flow?.length ? quote.flow : DEFAULT_FLOW[brandKey];
  const approach = quote.approach?.length ? quote.approach : DEFAULT_APPROACH[brandKey];
  const options = quote.options ?? [];
  const totals = calculateQuoteSelectionTotals(quote.items, choiceGroups, options, {
    selectedChoiceIds,
    selectedOptionIds,
  });
  const exclusions = quote.exclusions?.length ? quote.exclusions : DEFAULT_EXCLUSIONS[brandKey];
  const technicalNotesField = quote.technicalNotes?.length ? "technicalNotes" : "assumptions";
  const technicalNotes = isKoolhaas
    ? (quote.technicalNotes?.length ? quote.technicalNotes : quote.assumptions ?? [])
        .filter(Boolean)
        .filter((item) => !isMisplacedIntroLine(item, quote.customer.name))
    : [];
  const customerResponsibilities = isKoolhaas ? (quote.customerResponsibilities ?? []).filter(Boolean) : [];
  const attachments = quote.attachments ?? [];
  const attachmentPages = Math.ceil(attachments.length / 2);
  const validUntilLabel = quote.validUntil ? formatDate(quote.validUntil) : null;
  const hasOptionsPage = options.length > 0;
  const hasTermsPage = Boolean(exclusions.length || technicalNotes.length || customerResponsibilities.length || quote.outro);
  
  const totalPages = 4 + (hasOptionsPage ? 1 : 0) + (hasTermsPage ? 1 : 0);
  const pageLabel = (page: number) =>
    `${String(page).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
  const coverHeading = isKoolhaas ? (quote.title || brand.defaultTitle) : "Offerte";
  const introText = quote.intro?.trim() && !isMisplacedIntroLine(quote.intro, quote.customer.name)
    ? quote.intro
    : createPersonalIntro(quote, brand.name);
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
        {!isKoolhaas && <span>{brand.website}</span>}
        <span>{brand.email}</span>
        <span>{brand.phone}</span>
        {validUntilLabel && <span>Geldig tot {validUntilLabel}</span>}
        <span>{pageNo}</span>
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
    fallback: string
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
      {isEditable && (
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
        {options.map((o, idx) => (
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
              <span className="opt-tag">
                <InlineInput
                  value={o.tag}
                  onChange={(value) => updateOption(idx, { tag: value })}
                  placeholder="Label"
                  isEditable={Boolean(isEditable)}
                />
              </span>
              <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-900">
                {isEditable ? (
                  <>
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
                  </>
                ) : o.price == null ? (
                  <span>Prijs op aanvraag</span>
                ) : (
                  <span>+ {formatCurrency(o.price * (1 + o.vatRate / 100))} incl. btw</span>
                )}
              </div>
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
            </div>
          </div>
        ))}
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
                    </div>
                  </div>
                </div>
                <div className="cov-foot">
                  {!isKoolhaas && <img src="/logos/websup-icon-w.png" alt="" className="cov-foot-icon" />}
                  <span>{brand.email}</span>
                  <span>{brand.phone}</span>
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
              <span className="eyebrow">Persoonlijke toelichting</span>
              {isEditable && (
                <button onClick={() => handleAiGen('intro')} disabled={!!generating} className="ai-gen-btn">
                  {generating === 'intro' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Magische tekst
                </button>
              )}
            </div>
            <InlineTextarea 
              isEditable={isEditable} 
              value={introText} 
              onChange={(v) => onUpdate?.({ intro: v })} 
              className="letter" 
            />
            <div className="sig">
              <div className="sig-av"><img src="/logos/daan-koolhaas.jpg" alt="Daan Koolhaas" /></div>
              <div>
                <div className="sig-name">Daan Koolhaas</div>
                <div className="sig-role">{brand.role}</div>
              </div>
            </div>
            <div className="spacer"></div>
            {renderPageFooter(pageLabel(2))}
          </div>
        </section>

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
                  <span className="eyebrow text-blue-600 block">Beschikbare configuraties</span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{group.title}</h3>
                  {group.description && <p className="mt-1 text-sm text-slate-500">{group.description}</p>}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {group.choices.map(choice => {
                    const isActive = selectedChoiceIds[group.id] === choice.id;
                    const total = choice.items.reduce((sum, item) => {
                      const line = Number(item.qty) * Number(item.unitPrice);
                      return sum + line * (1 + Number(item.vatRate) / 100);
                    }, 0);
                    const isRecommended = group.recommendedChoiceId === choice.id || choice.label?.toLowerCase() === "aanbevolen";
                    return (
                      <div key={choice.id} className={`relative rounded-xl border p-4 ${isActive ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900">{choice.title}</h4>
                          {(choice.label || isRecommended) && (
                            <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isRecommended ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                              {choice.label || "Aanbevolen"}
                            </span>
                          )}
                        </div>
                        {choice.summary && <p className="mb-3 text-xs leading-relaxed text-slate-500">{choice.summary}</p>}
                        <div className="flex items-end justify-between gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isActive ? "Geselecteerd" : "Keuze bij akkoord"}</span>
                          <strong className="text-sm text-slate-900">{formatCurrency(total)} incl. btw</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="article-table-wrap">
              <div className="article-table-head">
                <div>
                  <span className="eyebrow">{isKoolhaas ? "Materialen" : "Diensten"}</span>
                  <div className="article-table-title">
                    <InlineInput 
                      isEditable={isEditable} 
                      value={quote.itemsHeader || (isKoolhaas ? "Materiaaloverzicht" : "Prijsopbouw")} 
                      onChange={(v) => onUpdate?.({ itemsHeader: v })}
                    />
                  </div>
                </div>
              </div>
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
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={item.id}>
                        <td className="article-description">
                          <InlineTextarea 
                            isEditable={isEditable} 
                            value={item.description} 
                            onChange={(v) => onUpdateItem?.(item.id, { description: v })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="grand-total">
                    <td>
                      <span>Totaal incl. btw</span>
                      <strong>{formatCurrency(Number(totals.totalIncVat))}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="spacer"></div>
            {renderPageFooter(pageLabel(3 + attachmentPages))}
          </div>
        </section>

        {hasOptionsPage && (
          <section className="sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              {optionsBlock}

              <div className="spacer"></div>
              {renderPageFooter(pageLabel(4))}
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

              {technicalNotes.length > 0 && (
                <>
                  <div className="row-badge">
                    <div>
                      <span className="eyebrow">Technische basis</span>
                      <h2 className="h2">Uitgangspunten voor deze offerte.</h2>
                    </div>
                  </div>
                  {renderTextList(technicalNotesField, technicalNotes, "Nieuw uitgangspunt voor deze offerte.")}
                </>
              )}

              {customerResponsibilities.length > 0 && (
                <>
                  <div className="div"></div>
                  <div className="row-badge">
                    <div>
                      <span className="eyebrow">Door opdrachtgever</span>
                      <h2 className="h2">Afstemming en voorbereiding.</h2>
                    </div>
                  </div>
                  {renderTextList("customerResponsibilities", customerResponsibilities, "Nieuwe afspraak voor voorbereiding door opdrachtgever.")}
                </>
              )}

              {exclusions.length > 0 && (
                <>
                  <div className="div"></div>
                  <div className="row-badge">
                    <div>
                      <span className="eyebrow">{brand.exclusionsEyebrow}</span>
                      <h2 className="h2">{brand.exclusionsTitle}</h2>
                    </div>
                  </div>
                  {renderTextList("exclusions", exclusions, "Nieuwe uitsluiting of randvoorwaarde.")}
                </>
              )}

              {quote.outro && (
                <>
                  <div className="div"></div>
                  <span className="eyebrow">Voorwaarden</span>
                  <InlineTextarea
                    isEditable={isEditable}
                    value={quote.outro}
                    onChange={(v) => onUpdate?.({ outro: v })}
                    className="letter"
                  />
                </>
              )}

              <div className="spacer"></div>
              {renderPageFooter(pageLabel(4 + (hasOptionsPage ? 1 : 0)))}
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
            <span className="eyebrow">Akkoord voor uitvoering</span>
            <h2 className="h2">{brand.closingTitle}</h2>

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

            <div className="spacer"></div>
            {renderPageFooter(pageLabel(totalPages))}
          </div>
        </section>
      </div>
    </div>
  );
}
