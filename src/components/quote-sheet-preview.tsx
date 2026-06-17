"use client";

import {
  Check,
  Layers,
  X,
  PlusCircle,
  MinusCircle,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
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
  indent?: number;
  choiceGroupId?: string | null;
};

type ChoiceGroup = {
  id: string;
  title: string;
  type: "SINGLE_SELECT" | "MULTI_SELECT";
};

type FlowItem = { n: number; t: string; d: string };
type ApproachStep = { n: string; t: string; d: string };
type QuoteOption = { t: string; d: string; tag: string };
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
  attachments?: QuoteAttachment[];
  adviceDocuments?: { id: string; type: string }[];
  company?: { name?: string | null; slug?: string | null };
  choiceGroups?: ChoiceGroup[];
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
  onChoiceSelect?: (groupId: string, choiceId: string) => void;
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
  onRemoveItem,
  selectedChoiceIds: externalSelectedChoiceIds,
  onChoiceSelect
}: QuoteSheetPreviewProps) {
  const [internalSelectedChoiceIds, setInternalSelectedChoiceIds] = useState<Record<string, string>>({});
  const selectedChoiceIds = externalSelectedChoiceIds || internalSelectedChoiceIds;

  // Set initial selections for choice groups
  useEffect(() => {
    if (quote.choiceGroups?.length && Object.keys(selectedChoiceIds).length === 0) {
      const defaults: Record<string, string> = {};
      quote.choiceGroups.forEach(group => {
        const firstItem = quote.items.find(i => i.choiceGroupId === group.id && (i.indent ?? 0) === 0);
        if (firstItem) defaults[group.id] = firstItem.id;
      });
      setInternalSelectedChoiceIds(defaults);
    }
  }, [quote.choiceGroups, quote.items]);

  const handleChoiceSelect = (groupId: string, choiceId: string) => {
    if (onChoiceSelect) {
      onChoiceSelect(groupId, choiceId);
    } else {
      setInternalSelectedChoiceIds(prev => ({ ...prev, [groupId]: choiceId }));
    }
  };

  const today = new Date().toISOString();
  const activeSlug = companySlug || quote.company?.slug || "websup";
  const brand = activeSlug === "koolhaas" ? COMPANY_COPY.koolhaas : COMPANY_COPY.websup;
  const isKoolhaas = brand.slug === "koolhaas";
  
  // Choice Logic
  const choiceGroups = quote.choiceGroups || [];
  
  const isItemVisible = (item: QuoteItem) => {
    if (!item.choiceGroupId) return true;
    if (isEditable) return true;
    return selectedChoiceIds[item.choiceGroupId] === item.id || (item.indent ?? 0) > 0;
  };

  const visibleItems = quote.items.filter(isItemVisible);

  const calculateTotals = () => {
    let ex = 0;
    let vat = 0;
    
    quote.items.forEach(item => {
      const isBaseItem = !item.choiceGroupId;
      const isSelectedChoice = item.choiceGroupId && selectedChoiceIds[item.choiceGroupId] === item.id;
      if (isBaseItem || isSelectedChoice) {
        ex += Number(item.total);
        vat += Number(item.total) * (Number(item.vatRate) / 100);
      }
    });
    
    return { ex, vat, inc: ex + vat };
  };

  const totals = isEditable ? {
    ex: Number(quote.totalExVat),
    vat: Number(quote.totalVat),
    inc: Number(quote.totalIncVat)
  } : calculateTotals();

  const brandKey = isKoolhaas ? "koolhaas" : "websup";
  const flow = quote.flow?.length ? quote.flow : DEFAULT_FLOW[brandKey];
  const approach = quote.approach?.length ? quote.approach : DEFAULT_APPROACH[brandKey];
  const options = quote.options?.length ? quote.options : DEFAULT_OPTIONS[brandKey];
  const exclusions = quote.exclusions?.length ? quote.exclusions : DEFAULT_EXCLUSIONS[brandKey];
  const attachments = quote.attachments ?? [];
  const attachmentPages = Math.ceil(attachments.length / 2);
  const attachmentPairs = Array.from({ length: attachmentPages }, (_, index) =>
    attachments.slice(index * 2, index * 2 + 2)
  );
  
  const includedSubItemCount = visibleItems.filter((item) => (item.indent ?? 0) > 0 || (Number(item.unitPrice) === 0 && Number(item.total) === 0)).length;
  const itemsOverflow = visibleItems.length > 6;
  const totalPages = 4 + attachmentPages + (itemsOverflow ? 1 : 0);
  const pageLabel = (page: number) =>
    `${String(page).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
  const coverHeading = isKoolhaas ? (quote.category || quote.title || brand.defaultTitle) : "Offerte";
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
        <span>Geldig tot {quote.validUntil ? formatDate(quote.validUntil) : "selecteer datum"}</span>
        <span>{pageNo}</span>
      </div>
    </div>
  );

  const optionsBlock = (
    <>
      <div className="row-badge">
        <div>
          <span className="eyebrow">{brand.optionsEyebrow}</span>
          <h2 className="h2">{brand.optionsTitle}</h2>
        </div>
      </div>
      <div className="opts">
        {options.map((o, idx) => (
          <div key={idx} className="opt group relative">
            <span className="opt-ic"><Layers size={15} /></span>
            <div className="flex-1">
              <h4 className="font-bold">{o.t}</h4>
              <p className="text-xs">{o.d}</p>
              <span className="opt-tag">{o.tag}</span>
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
                      <dt>Geldig tot</dt>    <dd>{quote.validUntil ? formatDate(quote.validUntil) : "Selecteer datum"}</dd>
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
                      value={quote.title || brand.defaultTitle} 
                      onChange={(v) => onUpdate?.({ title: v })}
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
              value={quote.intro || ""} 
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

            {/* CHOICE GROUPS (Tesla Style) */}
            {!isEditable && choiceGroups.map(group => (
              <div key={group.id} className="choice-section mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <span className="eyebrow text-blue-600 mb-4 block">{group.title}</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quote.items.filter(i => i.choiceGroupId === group.id && (i.indent ?? 0) === 0).map(choice => {
                    const isActive = selectedChoiceIds[group.id] === choice.id;
                    return (
                      <div 
                        key={choice.id} 
                        onClick={() => handleChoiceSelect(group.id, choice.id)}
                        className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer group ${
                          isActive 
                          ? 'border-blue-600 bg-blue-50/30 shadow-lg shadow-blue-100' 
                          : 'border-slate-100 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className={`p-2 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-300'}`}>
                            <CheckCircle2 size={20} />
                          </div>
                          <span className={`text-xl font-black ${isActive ? 'text-blue-600' : 'text-slate-900'}`}>
                            {formatCurrency(Number(choice.unitPrice))}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 mb-2">{choice.description}</h4>
                        <div className="space-y-1">
                          {quote.items.filter(i => i.indent === 1 && i.id.startsWith(choice.id.slice(0,5))).map(sub => (
                            <div key={sub.id} className="flex items-center gap-2 text-xs text-slate-500">
                              <Check size={10} className="text-blue-500" /> {sub.description}
                            </div>
                          ))}
                        </div>
                        {isActive && (
                          <div className="absolute top-0 right-0 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl rounded-tr-xl">
                            Geselecteerd
                          </div>
                        )}
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
                  <InlineInput 
                    isEditable={isEditable} 
                    value={quote.itemsHeader || (isKoolhaas ? "Materiaaloverzicht" : "Prijsopbouw")} 
                    onChange={(v) => onUpdate?.({ itemsHeader: v })}
                    className="h3-inline"
                  />
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
                  {visibleItems.map((item) => {
                    const isSubItem = (item.indent ?? 0) > 0 || (Number(item.unitPrice) === 0 && Number(item.total) === 0);
                    if (isSubItem) {
                      return (
                        <tr key={item.id} className="article-sub-row">
                          <td colSpan={4}>
                            <span className="article-sub-dot"><Check size={9} strokeWidth={3} /></span>
                            <InlineTextarea 
                              isEditable={isEditable} 
                              value={item.description} 
                              onChange={(v) => onUpdateItem?.(item.id, { description: v })}
                              className="article-description"
                            />
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={item.id} className={item.choiceGroupId ? "choice-item-row" : ""}>
                        <td className="article-description">
                          {item.choiceGroupId && isEditable && <span className="choice-badge">{item.choiceGroupId}</span>}
                          <InlineTextarea 
                            isEditable={isEditable} 
                            value={item.description} 
                            onChange={(v) => onUpdateItem?.(item.id, { description: v })}
                          />
                        </td>
                        <td>{Number(item.qty).toLocaleString('nl-NL')}</td>
                        <td>{formatCurrency(Number(item.unitPrice))}</td>
                        <td>{formatCurrency(Number(item.total))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Totaal excl. btw</td>
                    <td>{formatCurrency(Number(totals.ex))}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>Btw</td>
                    <td>{formatCurrency(Number(totals.vat))}</td>
                  </tr>
                  <tr className="grand-total">
                    <td colSpan={3}>Totaal incl. btw</td>
                    <td>{formatCurrency(Number(totals.inc))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!itemsOverflow && (
              <>
                <div className="div"></div>
                {optionsBlock}
              </>
            )}
            <div className="spacer"></div>
            {renderPageFooter(pageLabel(3 + attachmentPages))}
          </div>
        </section>

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
            {renderPageFooter(pageLabel(4 + attachmentPages + (itemsOverflow ? 1 : 0)))}
          </div>
        </section>
      </div>
    </div>
  );
}
