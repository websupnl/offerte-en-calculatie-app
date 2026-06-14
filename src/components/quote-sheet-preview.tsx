"use client";

import {
  Check,
  Layers,
  X,
  PlusCircle,
  MinusCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import "@/app/q/[token]/portal.css";
import { useRef, useEffect, useState } from "react";
import { toast } from "sonner";

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
};

type FlowItem = { n: number; t: string; d: string };
type ApproachStep = { n: string; t: string; d: string };
type QuoteOption = { t: string; d: string; tag: string };
type QuoteAttachment = { id?: string; title?: string | null; imageUrl: string; caption?: string | null };
type EditableArrayField = "flow" | "approach" | "options" | "exclusions";
type EditableArrayValue = FlowItem | ApproachStep | QuoteOption | string;
type EditableObjectValue = { n?: string | number; t?: string; d?: string; tag?: string };

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
  attachments?: QuoteAttachment[];
  adviceDocuments?: { id: string; type: string }[];
  company?: { name?: string | null; slug?: string | null };
};

interface QuoteSheetPreviewProps {
  quote: Quote;
  companySlug?: string;
  isEditable?: boolean;
  onUpdate?: (updates: Partial<Quote>) => void;
  onUpdateItem?: (id: string, updates: Pick<QuoteItem, "description">) => void;
  onAddItem?: () => void;
  onRemoveItem?: (id: string) => void;
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
    itemsHeader: "Onderdelen binnen fase 1.",
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
    itemsHeader: "Wat wordt er geinstalleerd",
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
    exclusionsTitle: "Duidelijke grenzen aan de scope.",
    closingTitle: "Akkoord voor uitvoering",
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

const DEFAULT_OPTIONS: Record<"websup" | "koolhaas", QuoteOption[]> = {
  websup: [
    { t: "Extra koppeling", d: "Een aanvullende koppeling met een extern systeem of formulier.", tag: "Op aanvraag" },
    { t: "Doorontwikkeling", d: "Nieuwe functies na oplevering op basis van praktijkgebruik.", tag: "Los voorstel" },
  ],
  koolhaas: [
    { t: "Extra energiemeting", d: "Aanvullende meetpunten wanneer dit technisch nodig is.", tag: "In overleg" },
    { t: "Groepenkast aanpassing", d: "Meerwerk als de bestaande kast niet geschikt blijkt.", tag: "In overleg" },
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
  onAddItem,
  onRemoveItem
}: QuoteSheetPreviewProps) {
  const today = new Date().toISOString();
  const activeSlug = companySlug || quote.company?.slug || "websup";
  const brand = activeSlug === "koolhaas" ? COMPANY_COPY.koolhaas : COMPANY_COPY.websup;
  const isKoolhaas = brand.slug === "koolhaas";
  const brandKey = isKoolhaas ? "koolhaas" : "websup";
  const flow = quote.flow?.length ? quote.flow : DEFAULT_FLOW[brandKey];
  const approach = quote.approach?.length ? quote.approach : DEFAULT_APPROACH[brandKey];
  const options = quote.options?.length ? quote.options : DEFAULT_OPTIONS[brandKey];
  const exclusions = quote.exclusions?.length ? quote.exclusions : DEFAULT_EXCLUSIONS[brandKey];
  const attachments = quote.attachments ?? [];
  const totalPages = 4 + attachments.length;
  const pageLabel = (page: number) =>
    `${String(page).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
  const coverHeading = isKoolhaas ? (quote.category || quote.title || brand.defaultTitle) : "Offerte";
  const primaryItem = quote.items[0]?.description || quote.title || brand.defaultTitle;
  const valueTitle = isKoolhaas
    ? "Een nette installatie zonder onduidelijkheid achteraf."
    : "Een website die bezoekers sneller naar contact brengt.";
  const valueCopy = isKoolhaas
    ? "Je krijgt een duidelijke installatie met veilige montage, nette afwerking en uitleg bij oplevering. Vooraf is helder wat er wordt geplaatst en wat buiten de scope valt."
    : "Bezoekers moeten snel kunnen zien wat je aanbiedt, eenvoudig vinden wat relevant is en zonder drempel contact opnemen. Jij kunt de belangrijkste inhoud zelf beheren, zonder technische kennis of afhankelijkheid voor kleine wijzigingen.";
  const [generating, setGenerating] = useState<string | null>(null);

  const handleAiGen = async (section: string) => {
    if (!onUpdate) return;
    setGenerating(section);
    try {
      const res = await fetch("/api/ai/extract-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: `Genereer alleen de sectie '${section}' voor een offerte voor project '${quote.title}' voor klant '${quote.customer.name}'. De items zijn: ${quote.items.map(i => i.description).join(", ")}.`,
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

  // Helper for updating array fields
  const updateArray = (field: Exclude<EditableArrayField, "exclusions">, index: number, value: EditableObjectValue) => {
    if (!onUpdate) return;
    const current = (quote[field] || []) as EditableObjectValue[];
    const next = [...current];
    next[index] = { ...next[index], ...value };
    onUpdate({ [field]: next } as Partial<Quote>);
  };

  const removeFromArray = (field: EditableArrayField, index: number) => {
    if (!onUpdate) return;
    const current = (quote[field] || []) as EditableArrayValue[];
    const next = current.filter((_, i) => i !== index);
    onUpdate({ [field]: next } as Partial<Quote>);
  };

  const addToArray = (field: EditableArrayField, defaultValue: EditableArrayValue) => {
    if (!onUpdate) return;
    const current = (quote[field] || []) as EditableArrayValue[];
    const next = [...current, defaultValue];
    onUpdate({ [field]: next } as Partial<Quote>);
  };

  const updateExclusion = (index: number, value: string) => {
    if (!onUpdate) return;
    const next = [...(quote.exclusions || [])];
    next[index] = value;
    onUpdate({ exclusions: next });
  };

  const renderHeaderLogo = (cover = false) => {
    if (isKoolhaas) {
      return (
        <img
          src="/logos/koolhaas-logo-tight.png"
          alt="Koolhaas Installaties"
          className={cover ? "brand-logo brand-logo-cover" : "brand-logo"}
        />
      );
    }
    return (
      <img
        src="/logos/websup-cover.png"
        alt="WebsUp"
        className={cover ? "brand-logo brand-logo-cover" : "brand-logo"}
      />
    );
  };

  const renderPageFooter = (pageNo: string) => (
    <div className="doc-foot">
      {isKoolhaas ? (
        <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" className="brand-logo doc-foot-brand-logo" />
      ) : (
        <img src="/logos/websup-icon-w.png" alt="WebsUp" className="doc-foot-icon" />
      )}
      <div className="doc-foot-meta">
        <span>{brand.website}</span>
        <span>{brand.email}</span>
        <span>{brand.phone}</span>
        <span>Geldig tot {quote.validUntil ? formatDate(quote.validUntil) : "selecteer datum"}</span>
        <span>{pageNo}</span>
      </div>
    </div>
  );

  return (
    <div
      className={`portal-container ${isKoolhaas ? "portal-koolhaas" : "portal-websup"}`}
      style={{ minHeight: 'auto', backgroundColor: 'transparent' }}
    >
      <div className="doc-viewer" style={{ paddingBottom: 0 }}>
        
        {/* ── PAGINA 1: COVER ── */}
        <section className="sheet cover">
          <div className="cov-layout">
            <div className="cov-panel">
              <div className="bar"></div>
              <div className="cov-pad">
                {/* BOVEN: logo + meta */}
                <div className="cov-top">
                  {renderHeaderLogo(true)}
                  <div className="cov-meta">
                    <dl>
                      <dt>Offertenummer</dt> <dd>{quote.number || "CONCEPT"}</dd>
                      <dt>Datum</dt>         <dd>{formatDate(today)}</dd>
                      <dt>Geldig tot</dt>    <dd>{quote.validUntil ? formatDate(quote.validUntil) : "Selecteer datum"}</dd>
                      <dt>Contactpersoon</dt><dd>Daan Koolhaas</dd>
                    </dl>
                  </div>
                </div>

                {/* Content: verticaal gecentreerd */}
                <div className="cov-main">
                  <div className="cov-line" />
                  <div className="cov-mid">
                    <span className="eyebrow inv">
                      <InlineInput
                        value={quote.category || brand.defaultCategory}
                        onChange={(v) => onUpdate?.({ category: v })}
                        isEditable={isEditable}
                      />
                    </span>
                    <h1 className="cov-h1">{coverHeading}</h1>
                    <div className="cov-project">
                      <InlineInput
                        value={quote.title || brand.defaultTitle}
                        onChange={(v) => onUpdate?.({ title: v })}
                        isEditable={isEditable}
                      />
                    </div>
                    <div className="cov-for">
                      <span>Voor</span>
                      <b>{quote.customer.name || "Klantnaam"}</b>
                    </div>
                  </div>
                </div>

                {/* FOOTER: contact */}
                <div className="cov-foot">
                  {!isKoolhaas && <img src="/logos/websup-icon-w.png" alt="" className="cov-foot-icon" />}
                  <span>{brand.website}</span>
                  <span>{brand.email}</span>
                  <span>{brand.phone}</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── PAGINA 2: INTRO + DELIVERABLES ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>

            <div className="flex justify-between items-start">
              <span className="eyebrow">Persoonlijke toelichting</span>
              {isEditable && (
                <button 
                  onClick={() => handleAiGen('intro')} 
                  disabled={!!generating}
                  className="text-[10px] flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider hover:text-orange-600"
                >
                  {generating === 'intro' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI Inleiding
                </button>
              )}
            </div>
            {!isKoolhaas && <h2 className="h2">Beste {quote.customer.name || "klant"},</h2>}
            <div className="letter">
              <InlineTextarea 
                value={quote.intro || ""} 
                onChange={(v) => onUpdate?.({ intro: v })}
                placeholder="Typ hier de inleiding..."
                isEditable={isEditable}
              />
            </div>
            <div className="sig">
              <div className="sig-av">
                <img src="/logos/daan-koolhaas.jpg" alt="Daan Koolhaas" />
              </div>
              <div>
                <div className="sig-name">Daan Koolhaas</div>
                <div className="sig-role">{brand.role}</div>
              </div>
            </div>

            <div className="value-panel">
              <span className="eyebrow">{isKoolhaas ? "Wat dit oplevert" : "Wat ik voor je bouw"}</span>
              <h2 className="h2">{valueTitle}</h2>
              <p>{valueCopy}</p>
            </div>

            <div className="included-block">
              <div className="row-badge">
                <div>
                  <span className="eyebrow">Inbegrepen</span>
                  <h2 className="h2">{quote.itemsHeader || brand.itemsHeader}</h2>
                </div>
                <span className="badge">{quote.items.length} onderdelen</span>
              </div>
              <ul className="included-list">
                {quote.items.map((item) => (
                  <li key={item.id}>
                    <span className="ic-ok"><Check size={10} strokeWidth={3} /></span>
                    <span>{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isKoolhaas && (
              <div className="scope-grid">
                <div className="scope-card scope-card-main">
                  <span>Hoofdinstallatie</span>
                  <b>{primaryItem}</b>
                  <p>Levering en montage van het thuisbatterijsysteem zoals opgenomen in de artikellijst.</p>
                </div>
                <div className="scope-card">
                  <span>Aansluiting</span>
                  <b>Meterkast en bekabeling</b>
                  <p>Nette aansluiting, controle van beveiliging en afwerking van de kabelroute.</p>
                </div>
                <div className="scope-card">
                  <span>Configuratie</span>
                  <b>App en monitoring</b>
                  <p>Inbedrijfstelling, basisuitleg en controle dat het systeem correct werkt.</p>
                </div>
              </div>
            )}
            <div className="spacer"></div>
            {renderPageFooter(pageLabel(2))}
          </div>
        </section>

        {false && (
          <>

        {/* ── PAGINA 3: FLOW + AANPAK ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>

            <div className="row-badge">
              <div>
                <span className="eyebrow">{brand.processEyebrow}</span>
                <h2 className="h2">{brand.processTitle}</h2>
              </div>
              <div className="flex gap-3 items-center">
                {isEditable && (
                  <button 
                    onClick={() => handleAiGen('flow')} 
                    disabled={!!generating}
                    className="text-[10px] flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider hover:text-orange-600"
                  >
                    {generating === 'flow' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    AI Flow
                  </button>
                )}
                <span className="badge">{flow.length} stappen</span>
                {isEditable && (
                  <button onClick={() => addToArray('flow', { n: (quote.flow || []).length + 1, t: "Nieuwe stap", d: "Beschrijving..." })} className="text-orange-500 hover:text-orange-600">
                    <PlusCircle size={20} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flow">
              {flow.map((s, idx) => (
                <div key={idx} className="flow-item group relative">
                  <div className="fn">{s.n}</div>
                  <div className="flex-1">
                    <h4 className="font-bold">
                      <InlineInput value={s.t} onChange={(v) => updateArray('flow', idx, { t: v })} isEditable={isEditable} />
                    </h4>
                    <InlineTextarea value={s.d} onChange={(v) => updateArray('flow', idx, { d: v })} isEditable={isEditable} className="text-xs" />
                  </div>
                  {isEditable && (
                    <button onClick={() => removeFromArray('flow', idx)} className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity">
                      <MinusCircle size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isKoolhaas ? (
              <>
                <div className="div"></div>
                <span className="eyebrow">Praktisch op locatie</span>
                <h2 className="h2">Waar we vooraf op letten.</h2>
                <div className="install-note-row">
                  <div><b>Meterkast</b><span>Ruimte, beveiliging en geschikte aansluiting.</span></div>
                  <div><b>Opstelplek</b><span>Voldoende ruimte, ventilatie en bereikbaarheid.</span></div>
                  <div><b>Bekabeling</b><span>Kabelroute en nette afwerking vooraf afgestemd.</span></div>
                </div>
              </>
            ) : (
              <>
                <div className="div"></div>

                <div className="row-badge">
                  <div>
                    <span className="eyebrow">{brand.approachEyebrow}</span>
                    <h2 className="h2">{brand.approachTitle}</h2>
                  </div>
                  <div className="flex gap-3 items-center">
                    {isEditable && (
                      <button
                        onClick={() => handleAiGen('approach')}
                        disabled={!!generating}
                        className="text-[10px] flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider hover:text-orange-600"
                      >
                        {generating === 'approach' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        AI Aanpak
                      </button>
                    )}
                    {isEditable && (
                      <button onClick={() => addToArray('approach', { n: "0" + ((quote.approach || []).length + 1), t: "Nieuwe fase", d: "Toelichting..." })} className="text-orange-500 hover:text-orange-600">
                        <PlusCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="steps">
                  {approach.map((s, idx) => (
                    <div key={idx} className="step group relative">
                      <div className="sn">{s.n}</div>
                      <h4 className="font-bold">
                        <InlineInput value={s.t} onChange={(v) => updateArray('approach', idx, { t: v })} isEditable={isEditable} />
                      </h4>
                      <InlineTextarea value={s.d} onChange={(v) => updateArray('approach', idx, { d: v })} isEditable={isEditable} className="text-[11px]" />
                      {isEditable && (
                        <button onClick={() => removeFromArray('approach', idx)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="spacer"></div>
            {renderPageFooter(pageLabel(3))}
          </div>
        </section>

          </>
        )}

        {attachments.map((attachment, idx) => (
          <section key={attachment.id ?? idx} className="sheet design-sheet">
            <div className="bar"></div>
            <div className="pad">
              <div className="ph">
                {renderHeaderLogo()}
                <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
              </div>

              <div className="row-badge">
                <div>
                  <span className="eyebrow">Ontwerp & uitwerking</span>
                  <h2 className="h2">{attachment.title || (isKoolhaas ? "Technische indruk en plaatsing." : "Zo ziet de richting eruit.")}</h2>
                </div>
                <span className="badge">{idx + 1} / {attachments.length}</span>
              </div>

              <figure className="design-full">
                <a className="design-full-frame" href={attachment.imageUrl} target="_blank" rel="noreferrer">
                  <img src={attachment.imageUrl} alt={attachment.title || attachment.caption || `Ontwerp ${idx + 1}`} />
                </a>
                {(attachment.caption || attachment.title) && (
                  <figcaption className="design-full-caption">
                    {attachment.title && <b>{attachment.title}</b>}
                    {attachment.caption && <span>{attachment.caption}</span>}
                  </figcaption>
                )}
                <a className="design-open-link no-print" href={attachment.imageUrl} target="_blank" rel="noreferrer">
                  Open afbeelding volledig
                </a>
              </figure>

              <div className="spacer"></div>
              {renderPageFooter(pageLabel(3 + idx))}
            </div>
          </section>
        ))}

        {/* ── PAGINA 4: INVESTERING + OPTIONS ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>

            <div className="article-table-wrap">
              <div className="article-table-head">
                <div>
                  <span className="eyebrow">{isKoolhaas ? "Materialen" : "Diensten"}</span>
                  <h3>{quote.itemsHeader || brand.itemsHeader}</h3>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="badge">{quote.items.length} regels</span>
                  {isEditable && (
                    <button onClick={onAddItem} className="text-orange-500 hover:text-orange-600">
                      <PlusCircle size={20} />
                    </button>
                  )}
                </div>
              </div>
              <table className="article-table">
                <thead>
                  <tr>
                    <th>Omschrijving</th>
                    <th>Aantal</th>
                    <th>Prijs</th>
                    <th>Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.id} className="group relative">
                      <td>
                        <InlineInput
                          value={item.description}
                          onChange={(v) => onUpdateItem?.(item.id, { description: v })}
                          isEditable={isEditable}
                        />
                        {isEditable && (
                          <button onClick={() => onRemoveItem?.(item.id)} className="absolute -left-6 top-3 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity">
                            <MinusCircle size={16} />
                          </button>
                        )}
                      </td>
                      <td>{Number(item.qty).toLocaleString('nl-NL')}</td>
                      <td>{formatCurrency(Number(item.unitPrice))}</td>
                      <td>{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Totaal excl. btw</td>
                    <td>{formatCurrency(Number(quote.totalExVat))}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>Btw</td>
                    <td>{formatCurrency(Number(quote.totalVat))}</td>
                  </tr>
                  <tr className="grand-total">
                    <td colSpan={3}>Totaal incl. btw</td>
                    <td>{formatCurrency(Number(quote.totalIncVat))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="div"></div>

            <div className="row-badge">
              <div>
                <span className="eyebrow">{brand.optionsEyebrow}</span>
                <h2 className="h2">{brand.optionsTitle}</h2>
              </div>
              <div className="flex gap-3 items-center">
                {isEditable && (
                  <button 
                    onClick={() => handleAiGen('options')} 
                    disabled={!!generating}
                    className="text-[10px] flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider hover:text-orange-600"
                  >
                    {generating === 'options' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    AI Opties
                  </button>
                )}
                {isEditable && (
                  <button onClick={() => addToArray('options', { t: "Nieuwe optie", d: "Beschrijving...", tag: "Op aanvraag" })} className="text-orange-500 hover:text-orange-600">
                    <PlusCircle size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="opts">
              {options.map((o, idx) => (
                <div key={idx} className="opt group relative">
                  <span className="opt-ic"><Layers size={15} /></span>
                  <div className="flex-1">
                    <h4 className="font-bold">
                      <InlineInput value={o.t} onChange={(v) => updateArray('options', idx, { t: v })} isEditable={isEditable} />
                    </h4>
                    <InlineTextarea value={o.d} onChange={(v) => updateArray('options', idx, { d: v })} isEditable={isEditable} className="text-xs" />
                    <span className="opt-tag">
                      <InlineInput value={o.tag} onChange={(v) => updateArray('options', idx, { tag: v })} isEditable={isEditable} />
                    </span>
                  </div>
                  {isEditable && (
                    <button onClick={() => removeFromArray('options', idx)} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="spacer"></div>
            {renderPageFooter(pageLabel(3 + attachments.length))}
          </div>
        </section>

        {/* ── PAGINA 5: EXCLUSIONS + SIGN ── */}
        <section className="sheet">
          <div className="bar"></div>
          <div className="pad">
            <div className="ph">
              {renderHeaderLogo()}
              <div className="ph-meta">{quote.number || "CONCEPT"} &nbsp;&middot;&nbsp; {quote.customer.name || "Klant"}</div>
            </div>

            <div className="row-badge">
              <div>
                <span className="eyebrow">{brand.exclusionsEyebrow}</span>
                <h2 className="h2">{brand.exclusionsTitle}</h2>
              </div>
              <div className="flex gap-3 items-center">
                {isEditable && (
                  <button 
                    onClick={() => handleAiGen('exclusions')} 
                    disabled={!!generating}
                    className="text-[10px] flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider hover:text-orange-600"
                  >
                    {generating === 'exclusions' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    AI Uitsluitingen
                  </button>
                )}
                {isEditable && (
                  <button onClick={() => addToArray('exclusions', "Nieuwe uitsluiting...")} className="text-orange-500 hover:text-orange-600">
                    <PlusCircle size={20} />
                  </button>
                )}
              </div>
            </div>

            <ul className="excl">
              {exclusions.map((item, idx) => (
                <li key={idx} className="group relative">
                  <span className="ic-x"><X size={9} strokeWidth={3} /></span>
                  <InlineInput value={item} onChange={(v) => updateExclusion(idx, v)} isEditable={isEditable} />
                  {isEditable && (
                    <button onClick={() => removeFromArray('exclusions', idx)} className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity">
                      <X size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="div"></div>

            <div className="flex justify-between items-start">
              <span className="eyebrow">Slotwoord</span>
              {isEditable && (
                <button 
                  onClick={() => handleAiGen('outro')} 
                  disabled={!!generating}
                  className="text-[10px] flex items-center gap-1 text-orange-500 font-bold uppercase tracking-wider hover:text-orange-600"
                >
                  {generating === 'outro' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI Slotwoord
                </button>
              )}
            </div>
            <div className="letter">
              <InlineTextarea 
                value={quote.outro || ""} 
                onChange={(v) => onUpdate?.({ outro: v })}
                placeholder="Typ hier het slotwoord..."
                isEditable={isEditable}
              />
            </div>

            <div className="div"></div>

            <span className="eyebrow">Akkoord voor uitvoering</span>
            <h2 className="h2">{brand.closingTitle}</h2>

            {quote.status === "ACCEPTED" && quote.acceptedAt && (
              <div className="acceptance-banner">
                <Check size={15} strokeWidth={3} />
                <span>Digitaal akkoord gegeven op {formatDate(quote.acceptedAt)} door {quote.customer.name || "opdrachtgever"}.</span>
              </div>
            )}
            
            <div className="sign-grid">
              <div className="sign-box">
                <div className="sign-who">Namens opdrachtgever</div>
                <div className="sign-org">{quote.customer.name || "Klantnaam"}</div>
                <div className="sign-line"><div className="sign-lbl">Naam</div><div className="sign-rule"></div></div>
                <div className="sign-rule" style={{ marginTop: '40px', borderBottom: '1px solid var(--border-str)' }}></div>
              </div>
              <div className="sign-box">
                <div className="sign-who">Namens opdrachtnemer</div>
                <div className="sign-org">{brand.contractor}</div>
                <div className="sign-line"><div className="sign-lbl">Naam</div><div className="sign-rule"></div></div>
                <div className="sign-rule" style={{ marginTop: '40px', borderBottom: '1px solid var(--border-str)' }}></div>
              </div>
            </div>

            <div className="spacer"></div>
            {renderPageFooter(pageLabel(4 + attachments.length))}
          </div>
        </section>

      </div>
    </div>
  );
}
