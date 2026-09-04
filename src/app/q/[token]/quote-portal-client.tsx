"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Euro,
  FileText,
  Loader2,
  Mail,
  Shield,
  XCircle,
  PackageCheck,
} from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import { filenameFromResponse } from "@/lib/download-filename";
import "./portal.css";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import { AcceptanceSuccess } from "./acceptance-success";
import {
  calculateQuoteSelectionTotals,
  getQuoteOptionRecurringInterval,
  getQuoteOptionRecurringPrice,
  getQuoteOptionPrice,
  type QuoteChoiceGroup,
  type QuoteOption,
} from "@/lib/quote-selection";

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

type FlowItem = { n: number; t: string; d: string };
type ApproachStep = { n: string; t: string; d: string };
type QuoteAttachment = { id: string; title: string | null; imageUrl: string; liveUrl?: string | null; caption: string | null };

type Quote = {
  id: string;
  number: string;
  title: string | null;
  category: string | null;
  tagline: string | null;
  itemsHeader: string | null;
  status: string;
  intro: string | null;
  outro: string | null;
  validUntil: string | null;
  createdAt?: string | null;
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  items: QuoteItem[];
  customer: { name: string; email: string | null; address: string | null; city: string | null; zipCode: string | null };
  company: { name: string; slug: string };
  flow?: FlowItem[];
  approach?: ApproachStep[];
  options?: QuoteOption[];
  exclusions?: string[];
  attachments?: QuoteAttachment[];
  documents?: { id: string; name: string; type: string; url: string | null }[];
  adviceDocuments: { id: string; type: string }[];
  choiceGroups?: QuoteChoiceGroup[];
  commercial?: { priceDisplayMode?: "incl" | "excl"; [key: string]: unknown };
};

type Share = {
  id: string;
  token: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  signerName?: string | null;
  selectedChoiceIds?: Record<string, string> | null;
  selectedOptionIds?: string[] | null;
  acceptedTotalExVat?: string | number | null;
  acceptedTotalIncVat?: string | number | null;
};

function formatOptionPriceTag(tag: string) {
  return tag.replace(/€\s*([\d.,]+)/g, (_, rawAmount: string) => {
    const amount = Number(
      rawAmount
        .replace(/\.(?=\d{3}(?:\D|$))/g, "")
        .replace(",", "."),
    );
    return Number.isFinite(amount) ? formatCurrency(amount) : `€ ${rawAmount}`;
  });
}

export function QuotePortalClient({
  quote,
  share,
}: {
  quote: Quote;
  share: Share;
  companySlug: string;
  branding: Record<string, string>;
}) {
  const choiceGroups = quote.choiceGroups ?? [];
  const optionalWork = quote.options ?? [];
  const documents = quote.documents ?? [];
  const requiredOptionIds = optionalWork.filter((option) => option.required).map((option) => option.id);
  // Modules die standaard aanstaan (maar afvinkbaar zijn), plus de verplichte.
  const defaultOptionIds = optionalWork
    .filter((option) => option.defaultSelected || option.required)
    .map((option) => option.id);
  const hasSavedOptionSelection =
    Array.isArray(share.selectedOptionIds) && share.selectedOptionIds.length > 0;
  // Standaard de aanbevolen optie voorselecteren (recommendedChoiceId → label "Aanbevolen" → eerste optie),
  // zodat de totale investering meteen een echte all-in prijs toont i.p.v. alleen de vaste basis.
  const defaultChoiceIds: Record<string, string> = {};
  for (const group of choiceGroups) {
    const recommended =
      group.choices.find((c) => c.id === group.recommendedChoiceId) ??
      group.choices.find((c) => (c.label ?? "").toLowerCase() === "aanbevolen") ??
      group.choices[0];
    if (recommended) defaultChoiceIds[group.id] = recommended.id;
  }
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Record<string, string>>(
    share.selectedChoiceIds && Object.keys(share.selectedChoiceIds).length > 0
      ? share.selectedChoiceIds
      : defaultChoiceIds,
  );
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([
    ...new Set([
      ...(hasSavedOptionSelection ? share.selectedOptionIds! : defaultOptionIds),
      ...requiredOptionIds,
    ]),
  ]);
  const totals = calculateQuoteSelectionTotals(quote.items, choiceGroups, optionalWork, {
    selectedChoiceIds,
    selectedOptionIds,
  });
  const showExVat = quote.commercial?.priceDisplayMode === "excl";
  const priceLabel = showExVat ? "excl. btw" : "incl. btw";
  const displayedTotal = showExVat
    ? share.acceptedTotalExVat ?? totals.totalExVat
    : share.acceptedTotalIncVat ?? totals.totalIncVat;
  // Vaste werkzaamheden zitten in elke configuratie → per optie tonen we een all-in prijs (systeem + basis).
  const baseIncVat = quote.items.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.unitPrice) * (1 + Number(item.vatRate) / 100),
    0,
  );
  const baseExVat = quote.items.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.unitPrice),
    0,
  );

  const isKoolhaas = quote.company.slug === "koolhaas";
  const portalBrand = isKoolhaas
    ? {
        name: "Koolhaas Installaties",
        website: "koolhaasinstallaties.nl",
        // eslint-disable-next-line @next/next/no-img-element -- klantportaal rendert dynamische merkassets in print en web
        logo: <img src="/logos/koolhaas-lockup-white.png" alt="Koolhaas Installaties" />,
      }
    : {
        name: "WebsUp.nl",
        website: "websup.nl",
        // eslint-disable-next-line @next/next/no-img-element -- klantportaal rendert dynamische merkassets in print en web
        logo: <img src="/logos/websup-lockup-white.png" alt="WebsUp.nl" />,
      };

  const documentRef = useRef<HTMLDivElement>(null);
  const [signerName, setSignerName] = useState(quote.customer.name);
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [expandedOptionIds, setExpandedOptionIds] = useState<string[]>([]);

  async function handleDownloadPdf() {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/portal/${share.token}/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromResponse(res, "offerte.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  }
  const [submitted, setSubmitted] = useState<"accepted" | "declined" | null>(
    share.acceptedAt ? "accepted" : share.declinedAt ? "declined" : null
  );
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  const isExpired = quote.validUntil
    ? new Date(quote.validUntil).setHours(23, 59, 59, 999) < renderedAt
    : false;
  const canRespond = !submitted && !isExpired;
  const selectionsComplete = choiceGroups.every((group) => Boolean(selectedChoiceIds[group.id]));
  // Zelfde reden als in de sheet: de offertedatum is een eigenschap van de offerte,
  // geen "nu". new Date() hier gaf een hydration-mismatch en een verspringende datum.
  const today = quote.createdAt ?? new Date().toISOString();
  const statusLabel = submitted === "accepted"
    ? "Geaccepteerd"
    : submitted === "declined"
      ? "Afgewezen"
      : isExpired
        ? "Verlopen"
        : QUOTE_STATUS_LABELS[quote.status] ?? quote.status;
  const showStatusBadge = statusLabel.toLowerCase() !== "bekeken";
  const firstKoolhaasImageId = isKoolhaas
    ? quote.attachments?.find((attachment) => attachment.imageUrl)?.id
    : undefined;
  const portalAttachments = (quote.attachments ?? []).filter(
    (attachment) => attachment.imageUrl && attachment.id !== firstKoolhaasImageId,
  );

  async function handleAccept() {
    if (isExpired) {
      toast.error("Deze offerte is verlopen. Neem contact op voor een actuele versie.");
      return;
    }
    const incompleteGroup = choiceGroups.find((group) => !selectedChoiceIds[group.id]);
    if (incompleteGroup) {
      toast.error(`Maak eerst een keuze bij '${incompleteGroup.title}'.`);
      return;
    }
    if (!agreed) {
      toast.error("Vink het akkoord-vakje aan om te bevestigen");
      return;
    }
    if (!signerName.trim()) {
      toast.error("Vul je naam in om te ondertekenen");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/${share.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signerName, selectedChoiceIds, selectedOptionIds }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Accepteren mislukt");
      setSubmitted("accepted");
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      toast.success("Offerte geaccepteerd!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  const onChoiceSelect = (groupId: string, choiceId: string) => {
    setSelectedChoiceIds(prev => ({ ...prev, [groupId]: choiceId }));
  };

  const toggleOption = (optionId: string) => {
    if (requiredOptionIds.includes(optionId)) return;
    setSelectedOptionIds((current) => current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId]);
  };

  const toggleOptionExpanded = (optionId: string) => {
    setExpandedOptionIds((current) => current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId]);
  };

  async function handleDecline() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/${share.token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error();
      setSubmitted("declined");
      toast.info("Offerte afgewezen");
    } catch {
      toast.error("Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
      setShowDeclineConfirm(false);
    }
  }

  // ─── Prijsopbouw voor de samensteller ──────────────────────────────────────
  const moduleIsIncluded = (option: QuoteOption) =>
    option.required === true || option.defaultSelected === true;
  const includedModules = optionalWork.filter(moduleIsIncluded);
  const extraModules = optionalWork.filter((option) => !moduleIsIncluded(option));

  const oneTimeTotal = showExVat ? totals.totalExVat : totals.totalIncVat;

  const recurringDisplayLines: { interval: string; amount: number }[] = [];
  if (totals.recurring.perMonthExVat > 0) {
    recurringDisplayLines.push({
      interval: "per maand",
      amount: showExVat ? totals.recurring.perMonthExVat : totals.recurring.perMonthIncVat,
    });
  }
  if (totals.recurring.perYearExVat > 0) {
    recurringDisplayLines.push({
      interval: "per jaar",
      amount: showExVat ? totals.recurring.perYearExVat : totals.recurring.perYearIncVat,
    });
  }
  const hasRecurring = recurringDisplayLines.length > 0;
  const recurringMetaSuffix = recurringDisplayLines
    .map((line) => `${formatCurrency(line.amount)} ${line.interval}`)
    .join(" + ");

  const oneTimeBreakdown: { label: string; amount: number }[] = [];
  if (baseExVat > 0) {
    oneTimeBreakdown.push({
      label: quote.itemsHeader?.trim() || "Vaste werkzaamheden",
      amount: showExVat ? baseExVat : baseIncVat,
    });
  }
  for (const group of choiceGroups) {
    const choice = group.choices.find((c) => c.id === selectedChoiceIds[group.id]);
    if (!choice) continue;
    const choiceExVat = choice.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
    if (choiceExVat <= 0) continue;
    const choiceIncVat = choice.items.reduce(
      (sum, item) => sum + Number(item.qty) * Number(item.unitPrice) * (1 + Number(item.vatRate) / 100),
      0,
    );
    oneTimeBreakdown.push({ label: choice.title, amount: showExVat ? choiceExVat : choiceIncVat });
  }
  for (const option of optionalWork) {
    if (!selectedOptionIds.includes(option.id)) continue;
    const oneTimePrice = getQuoteOptionPrice(option);
    if (oneTimePrice == null || oneTimePrice <= 0) continue;
    oneTimeBreakdown.push({
      label: option.t,
      amount: showExVat ? oneTimePrice : oneTimePrice * (1 + option.vatRate / 100),
    });
  }

  const renderOptionCard = (option: QuoteOption) => {
    const selected = selectedOptionIds.includes(option.id);
    const expanded = expandedOptionIds.includes(option.id);
    const canExpandDescription = (option.d?.length ?? 0) > 110;
    const isRequired = option.required === true;
    const optionPrice = getQuoteOptionPrice(option);
    const optionInterval = getQuoteOptionRecurringInterval(option);
    const recurringOptionPrice = getQuoteOptionRecurringPrice(option);
    const displayedOptionPrice =
      optionPrice == null ? null : showExVat ? optionPrice : optionPrice * (1 + option.vatRate / 100);
    const displayedRecurringOptionPrice =
      recurringOptionPrice == null
        ? null
        : showExVat
          ? recurringOptionPrice
          : recurringOptionPrice * (1 + option.vatRate / 100);
    const fallbackPriceLabel = option.tag ? formatOptionPriceTag(option.tag) : "Prijs op aanvraag";
    const prefixFallbackPrice = !/op aanvraag/i.test(fallbackPriceLabel);
    const fallbackPriceParts = fallbackPriceLabel.match(/^(.*?)(\s+(?:excl|incl)\.?\s+btw.*)$/i);
    return (
      <div key={option.id} className={`portal-select-card portal-option-card ${selected ? "is-selected" : ""}`}>
        <label>
          <input
            type="checkbox"
            checked={selected}
            disabled={isRequired}
            onChange={() => toggleOption(option.id)}
          />
          <span className="portal-select-indicator" />
          <span className="portal-select-copy">
            <span className="portal-select-title">
              <b>{option.t}</b>
              {isRequired ? <em>Verplicht</em> : option.defaultSelected ? <em>Inbegrepen</em> : null}
            </span>
            {option.d && (
              <>
                <small className={`portal-option-desc ${expanded ? "is-expanded" : ""}`}>{option.d}</small>
                {canExpandDescription && (
                  <button
                    type="button"
                    className="portal-option-read-more"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleOptionExpanded(option.id);
                    }}
                  >
                    {expanded ? "Minder tonen" : "Lees meer"}
                  </button>
                )}
              </>
            )}
            {option.details.length > 0 && (
              <ul className="portal-option-bullets">
                {option.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            )}
            {option.technicalCondition && (
              <small className="portal-option-condition">{option.technicalCondition}</small>
            )}
            <span className="portal-option-price">
              {displayedOptionPrice != null && (
                <span className="portal-option-price-row">
                  <b>+ {formatCurrency(displayedOptionPrice)}</b>
                  <small>eenmalig {priceLabel}</small>
                </span>
              )}
              {displayedRecurringOptionPrice != null && optionInterval && (
                <span className="portal-option-price-row is-recurring">
                  <b>+ {formatCurrency(displayedRecurringOptionPrice)}</b>
                  <small>{optionInterval} {priceLabel}</small>
                </span>
              )}
              {displayedOptionPrice == null && displayedRecurringOptionPrice == null
                ? fallbackPriceParts
                  ? <>
                      <b>{prefixFallbackPrice && "+ "}{fallbackPriceParts[1]}</b>
                      <small>{fallbackPriceParts[2].trim()}</small>
                    </>
                  : <b>{prefixFallbackPrice && "+ "}{fallbackPriceLabel}</b>
                : null}
            </span>
          </span>
        </label>
      </div>
    );
  };

  return (
    <div className={`portal-container ${isKoolhaas ? "portal-koolhaas" : "portal-websup"}`}>
      <header className="portal-topbar no-print">
        <div className="portal-topbar-brand">
          {portalBrand.logo}
          <span>Offerte portaal</span>
        </div>
        <div className="portal-secure">
          <Shield />
          Beveiligde verbinding
        </div>
      </header>

      <main className="portal-shell">
        <section className="portal-overview no-print" aria-label="Offerte overzicht">
          <div className="portal-overview-copy">
            <p className="portal-kicker">{quote.number}</p>
            <h1>{quote.title || quote.category || "Offerte"}</h1>
            <p>{quote.customer.name} · {portalBrand.name}</p>
          </div>
          {showStatusBadge && (
            <div className="portal-overview-end">
              <div className={`portal-status-pill ${submitted === "accepted" ? "is-accepted" : isExpired ? "is-expired" : ""}`}>
                {statusLabel}
              </div>
            </div>
          )}
          {quote.validUntil && (
            <div className="portal-corner-date">
              <Clock />
              <span>{isExpired ? "Verlopen op" : "Geldig tot"} {formatDate(quote.validUntil)}</span>
            </div>
          )}
        </section>

        {submitted === "accepted" && (
          <AcceptanceSuccess
            quoteTitle={quote.title || quote.category || "Offerte"}
            signerName={signerName}
            isKoolhaas={isKoolhaas}
            selectedChoices={choiceGroups
              .map((group) => {
                const choice = group.choices.find((c) => c.id === selectedChoiceIds[group.id]);
                return choice ? { groupTitle: group.title, choiceTitle: choice.title } : null;
              })
              .filter((c): c is { groupTitle: string; choiceTitle: string } => c !== null)}
            selectedOptions={optionalWork
              .filter((o) => selectedOptionIds.includes(o.id))
              .map((o) => ({ title: o.t }))}
            baseItems={quote.items.filter((i) => !i.hiddenOnQuote).map((i) => ({
              description: i.description,
              unitPrice: Number(i.unitPrice),
              qty: Number(i.qty),
            }))}
            priceLabel={priceLabel}
            displayedTotal={showExVat ? totals.totalExVat : totals.totalIncVat}
            recurringLines={recurringDisplayLines}
            accentColor={isKoolhaas ? "#0e7490" : "#7c3aed"}
            onScrollToQuote={() => documentRef.current?.scrollIntoView({ behavior: "smooth" })}
            shareToken={share.token}
          />
        )}

        <div className={`portal-layout${submitted === "accepted" ? " portal-layout--full" : ""}`}>
          <div className="doc-viewer" id="offerte" ref={documentRef}>
              <QuoteSheetPreview
              quote={quote} 
              companySlug={quote.company.slug} 
              selectedChoiceIds={selectedChoiceIds}
              selectedOptionIds={selectedOptionIds}
            />
          </div>

          <aside className={`sidebar no-print${submitted === "accepted" ? " hidden" : ""}`}>
            <div className="portal-sidebar-content" id="akkoord">
              <div className="portal-card portal-identity-card">
                <div className="portal-meta-list">
                  {[
                    { icon: <FileText />, label: "Offertenummer", value: quote.number },
                    { icon: <Calendar />, label: "Datum", value: formatDate(today) },
                    ...(quote.validUntil
                      ? [{ icon: <Clock />, label: isExpired ? "Verlopen op" : "Geldig tot", value: formatDate(quote.validUntil) }]
                      : []),
                    { icon: <Building2 />, label: "Status", value: statusLabel },
                    {
                      icon: <Euro />,
                      label: "Voorgestelde investering",
                      value: hasRecurring
                        ? `${formatCurrency(Number(displayedTotal))} ${priceLabel} eenmalig + ${recurringMetaSuffix} ${priceLabel}`
                        : `${formatCurrency(Number(displayedTotal))} ${priceLabel}`,
                    },
                    ...(quote.customer.email ? [{ icon: <Mail />, label: "Klant", value: quote.customer.email }] : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="portal-meta-row">
                      <div className="portal-meta-icon">{icon}</div>
                      <div>
                        <p>{label}</p>
                        <b>{value}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="portal-card portal-total-card">
                <div>
                  <p>{hasRecurring ? "Eenmalige investering" : "Totale investering"}</p>
                  <strong>
                    {formatCurrency(Number(displayedTotal))}
                    {" "}
                    <small>{priceLabel}</small>
                  </strong>
                  {recurringDisplayLines.map((line) => (
                    <span key={line.interval} className="portal-total-recurring">
                      daarna {formatCurrency(line.amount)} {line.interval} {priceLabel}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? <Loader2 className="animate-spin" /> : <Download />}
                {downloadingPdf ? "Bezig..." : "Print / PDF"}
              </button>

              {submitted ? (
                <div className={`portal-card portal-result-card ${submitted === "accepted" ? "is-accepted" : ""}`}>
                  {submitted === "accepted" ? null : (
                    <>
                      <div className="portal-result-icon">
                        <XCircle />
                      </div>
                      <h3>Offerte afgewezen</h3>
                      <p>Je reactie is verwerkt. Heb je vragen? Neem gerust contact met ons op.</p>
                    </>
                  )}
                </div>
              ) : isExpired ? (
                <div className="portal-card portal-expired-card">
                  <Clock />
                  <h3>Offerte verlopen</h3>
                  <p>Neem contact op voor een actuele versie voordat je akkoord geeft.</p>
                </div>
              ) : (
                <div className="portal-card portal-action-card">
                  <p className="portal-form-kicker" id="akkoord">Akkoord geven</p>

                  {(choiceGroups.length > 0 || optionalWork.length > 0) && (
                    <div className="portal-composer">
                      <div className="portal-composer-heading">
                        <PackageCheck />
                        <div>
                          <h3>Stel je opdracht samen</h3>
                          <p>Pas de samenstelling aan op jouw wensen en situatie.</p>
                        </div>
                      </div>

                      {choiceGroups.map((group) => (
                        <fieldset key={group.id} className="portal-choice-group">
                          <legend>{group.title}</legend>
                          {group.description && <p className="portal-choice-help">{group.description}</p>}
                          <div className="portal-choice-list">
                            {group.choices.map((choice) => {
                              const selected = selectedChoiceIds[group.id] === choice.id;
                              const exVat = choice.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
                              const incVat = choice.items.reduce((sum, item) => {
                                const line = Number(item.qty) * Number(item.unitPrice);
                                return sum + line * (1 + Number(item.vatRate) / 100);
                              }, 0);
                              const allInIncVat = incVat + baseIncVat;
                              const choiceDisplayTotal = showExVat ? exVat + baseExVat : allInIncVat;
                              const systemDisplayTotal = showExVat ? exVat : incVat;
                              const baseDisplayTotal = showExVat ? baseExVat : baseIncVat;
                              const isRecommended = group.recommendedChoiceId === choice.id;
                              return (
                                <label key={choice.id} className={`portal-select-card ${selected ? "is-selected" : ""}`}>
                                  <input
                                    type="radio"
                                    name={`choice-${group.id}`}
                                    value={choice.id}
                                    checked={selected}
                                    onChange={() => onChoiceSelect(group.id, choice.id)}
                                  />
                                  <span className="portal-select-indicator" />
                                  <span className="portal-select-copy">
                                    {(choice.imageUrl || choice.image) && (
                                      <span className="portal-choice-photo">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={choice.imageUrl || choice.image} alt={choice.title} />
                                      </span>
                                    )}
                                    <span className="portal-select-title">
                                      <b>{choice.title}</b>
                                      {(isRecommended || choice.label) && <em>{choice.label || "Aanbevolen"}</em>}
                                    </span>
                                    {choice.summary && <small>{choice.summary}</small>}
                                    <strong>{formatCurrency(choiceDisplayTotal)} <small>{priceLabel} — compleet</small></strong>
                                    {exVat > 0 && baseExVat > 0 && (
                                      <small>Systeem {formatCurrency(systemDisplayTotal)} · montage &amp; installatie {formatCurrency(baseDisplayTotal)}</small>
                                    )}
                                    {exVat === 0 && <small>Geen meerprijs</small>}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}

                      {includedModules.length > 0 && (
                        <fieldset className="portal-choice-group">
                          <legend>Inbegrepen in dit voorstel</legend>
                          <p className="portal-choice-help">Standaard meegenomen. Vink af wat je niet wilt.</p>
                          <div className="portal-choice-list">
                            {includedModules.map(renderOptionCard)}
                          </div>
                        </fieldset>
                      )}

                      {extraModules.length > 0 && (
                        <fieldset className="portal-choice-group">
                          <legend>{includedModules.length > 0 ? "Extra opties" : "Aanvullende opties"}</legend>
                          <div className="portal-choice-list">
                            {extraModules.map(renderOptionCard)}
                          </div>
                        </fieldset>
                      )}

                      <div className="portal-composer-total">
                        <span>Jouw definitieve investering</span>
                        {oneTimeBreakdown.length > 1 && (
                          <ul className="portal-composer-breakdown">
                            {oneTimeBreakdown.map((line, index) => (
                              <li key={index}>
                                <span>{line.label}</span>
                                <span>{formatCurrency(line.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <b>
                          {formatCurrency(oneTimeTotal)}{" "}
                          <small>{hasRecurring ? "eenmalig" : ""} {priceLabel}</small>
                        </b>
                        {recurringDisplayLines.map((line) => (
                          <b key={line.interval} className="portal-composer-recurring">
                            + {formatCurrency(line.amount)} <small>{line.interval} {priceLabel}</small>
                          </b>
                        ))}
                        <small>Wordt bijgewerkt wanneer je een optie aan- of uitzet.</small>
                      </div>
                    </div>
                  )}

                  {documents.length > 0 && (
                    <fieldset className="portal-choice-group">
                      <legend>Documenten & datasheets</legend>
                      <div className="portal-choice-list">
                        {documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="portal-select-card"
                            style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="portal-select-title" style={{ flex: 1 }}>{doc.name}</span>
                            <Download className="h-4 w-4 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  <div className="portal-field">
                    <label htmlFor="signer-name">Jouw naam</label>
                    <input
                      id="signer-name"
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Volledige naam"
                    />
                  </div>

                  <div className="portal-field">
                    <label htmlFor="message">Vragen of opmerkingen <span>(optioneel)</span></label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Laat hier eventueel een vraag, opmerking of aanvullende afspraak achter."
                    />
                  </div>

                  <label className="portal-check">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>
                      Ik ga akkoord met deze offerte en de{" "}
                      <a
                        href={`/api/legal/${quote.company.slug}/terms`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:opacity-80"
                      >
                        algemene voorwaarden
                      </a>
                      {" "}en het{" "}
                      <a
                        href={`/api/legal/${quote.company.slug}/privacy`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:opacity-80"
                      >
                        privacybeleid
                      </a>
                      .
                    </span>
                  </label>

                  {!showDeclineConfirm ? (
                    <>
                      <button
                        onClick={handleAccept}
                        disabled={submitting || !agreed || !canRespond || !selectionsComplete}
                        className="btn-primary"
                      >
                        {submitting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <CheckCircle2 />
                        )}
                        {selectionsComplete ? "Offerte accepteren" : "Kies eerst een configuratie"}
                      </button>
                      <button
                        onClick={() => setShowDeclineConfirm(true)}
                        disabled={submitting}
                        className="portal-text-button"
                      >
                        Offerte afwijzen
                      </button>
                    </>
                  ) : (
                    <div className="portal-decline-box">
                      <p>Weet je zeker dat je wilt afwijzen?</p>
                      <div>
                        <button
                          onClick={handleDecline}
                          disabled={submitting}
                          className="portal-danger-button"
                        >
                          Ja, afwijzen
                        </button>
                        <button
                          onClick={() => setShowDeclineConfirm(false)}
                          className="portal-cancel-button"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="portal-security-note">
                    <Shield />
                    Beveiligd met SSL-encryptie. Elektronisch akkoord is rechtsgeldig.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>

        {portalAttachments.length > 0 && (
          <section className="portal-previews no-print" aria-label="Voorbeelden en ontwerpen">
            <h2 className="portal-previews-heading">Voorbeelden &amp; ontwerpen</h2>
            <div className="portal-previews-grid">
              {portalAttachments.map((attachment) => {
                const inner = (
                  <div className="portal-preview-card">
                    <div className="portal-preview-img">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL kan een tijdelijke opslag-URL zijn */}
                      <img src={attachment.imageUrl} alt={attachment.title || "Voorbeeldontwerp"} />
                    </div>
                    {(attachment.title || attachment.caption) && (
                      <div className="portal-preview-meta">
                        {attachment.title && <strong>{attachment.title}</strong>}
                        {attachment.caption && <p>{attachment.caption}</p>}
                      </div>
                    )}
                  </div>
                );
                return attachment.liveUrl ? (
                  <a
                    key={attachment.id}
                    href={attachment.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-preview-link"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={attachment.id} className="portal-preview-link">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {canRespond && (
        <div className="portal-mobile-action no-print">
          <div>
            <span>{hasRecurring ? `Eenmalig ${priceLabel}` : `Totaal ${priceLabel}`}</span>
            <b>
              {formatCurrency(Number(displayedTotal))}
              {recurringDisplayLines.length > 0 && (
                <em> + {formatCurrency(recurringDisplayLines[0].amount)} {recurringDisplayLines[0].interval}</em>
              )}
            </b>
          </div>
          <a href="#akkoord" className="btn-primary">
            Bekijk akkoord
          </a>
        </div>
      )}
    </div>
  );
}
