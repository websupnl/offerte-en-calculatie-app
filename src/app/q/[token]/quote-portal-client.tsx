"use client";

import { useState } from "react";
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
  ChevronDown,
  PackageCheck,
} from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import "./portal.css";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";
import {
  calculateQuoteSelectionTotals,
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
};

type FlowItem = { n: number; t: string; d: string };
type ApproachStep = { n: string; t: string; d: string };
type QuoteAttachment = { id: string; title: string | null; imageUrl: string; caption: string | null };

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
  totalExVat: string | number;
  totalVat: string | number;
  totalIncVat: string | number;
  items: QuoteItem[];
  customer: { name: string; email: string | null; address: string | null; city: string | null };
  company: { name: string; slug: string };
  flow?: FlowItem[];
  approach?: ApproachStep[];
  options?: QuoteOption[];
  exclusions?: string[];
  attachments?: QuoteAttachment[];
  adviceDocuments: { id: string; type: string }[];
  choiceGroups?: QuoteChoiceGroup[];
};

type Share = {
  id: string;
  token: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  signerName?: string | null;
  selectedChoiceIds?: Record<string, string> | null;
  selectedOptionIds?: string[] | null;
  acceptedTotalIncVat?: string | number | null;
};

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
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Record<string, string>>(share.selectedChoiceIds ?? {});
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(share.selectedOptionIds ?? []);
  const totals = calculateQuoteSelectionTotals(quote.items, choiceGroups, optionalWork, {
    selectedChoiceIds,
    selectedOptionIds,
  });
  const displayedTotal = share.acceptedTotalIncVat ?? totals.totalIncVat;
  // Vaste werkzaamheden zitten in elke configuratie → per optie tonen we een all-in prijs (systeem + basis).
  const baseIncVat = quote.items.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.unitPrice) * (1 + Number(item.vatRate) / 100),
    0,
  );

  const isKoolhaas = quote.company.slug === "koolhaas";
  const portalBrand = isKoolhaas
    ? {
        name: "Koolhaas Installaties",
        website: "koolhaasinstallaties.nl",
        logo: <img src="/logos/koolhaas-lockup-white.png" alt="Koolhaas Installaties" />,
      }
    : {
        name: "WebsUp.nl",
        website: "websup.nl",
        logo: <img src="/logos/websup-lockup-white.png" alt="WebsUp.nl" />,
      };

  const [signerName, setSignerName] = useState(quote.customer.name);
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const today = new Date().toISOString();
  const statusLabel = submitted === "accepted"
    ? "Geaccepteerd"
    : submitted === "declined"
      ? "Afgewezen"
      : isExpired
        ? "Verlopen"
        : QUOTE_STATUS_LABELS[quote.status] ?? quote.status;

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
      toast.error("Vul uw naam in om te ondertekenen");
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
    setSelectedOptionIds((current) => current.includes(optionId)
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
          <div className="portal-overview-grid">
            <div className="portal-stat">
              <Euro />
              <span>Totaal incl. btw</span>
              <b>{formatCurrency(Number(displayedTotal))}</b>
            </div>
            {quote.validUntil && (
              <div className="portal-stat">
                <Clock />
                <span>{isExpired ? "Verlopen op" : "Geldig tot"}</span>
                <b>{formatDate(quote.validUntil)}</b>
              </div>
            )}
            <div className={`portal-status-pill ${submitted === "accepted" ? "is-accepted" : isExpired ? "is-expired" : ""}`}>
              {statusLabel}
            </div>
          </div>
        </section>

        <div className="portal-layout">
          <div className="doc-viewer">
              <QuoteSheetPreview
              quote={quote} 
              companySlug={quote.company.slug} 
              selectedChoiceIds={selectedChoiceIds}
              selectedOptionIds={selectedOptionIds}
            />
          </div>

          <aside className="sidebar no-print">
            <div className="sticky-sidebar" id="akkoord">
              <div className="portal-card portal-identity-card">
                <div className="portal-card-head">
                  {isKoolhaas ? (
                    <img src="/logos/koolhaas-logo-tight.png" alt="Koolhaas Installaties" />
                  ) : (
                    <img src="/logos/websup-cover.png" alt="WebsUp.nl" />
                  )}
                </div>

                <div className="portal-meta-list">
                  {[
                    { icon: <FileText />, label: "Offertenummer", value: quote.number },
                    { icon: <Calendar />, label: "Datum", value: formatDate(today) },
                    ...(quote.validUntil
                      ? [{ icon: <Clock />, label: isExpired ? "Verlopen op" : "Geldig tot", value: formatDate(quote.validUntil) }]
                      : []),
                    { icon: <Building2 />, label: "Status", value: statusLabel },
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
                  <p>Totale investering</p>
                  <strong>
                    {formatCurrency(Number(displayedTotal))}
                    {" "}
                    <small>incl. btw</small>
                  </strong>
                </div>
              </div>

              <a
                href={`/print/portal/${share.token}?auto=1&choices=${encodeURIComponent(JSON.stringify(selectedChoiceIds))}&options=${encodeURIComponent(JSON.stringify(selectedOptionIds))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <Download />
                Print / PDF
              </a>

              {submitted ? (
                <div className={`portal-card portal-result-card ${submitted === "accepted" ? "is-accepted" : ""}`}>
                  {submitted === "accepted" ? (
                    <>
                      <div className="portal-result-icon">
                        <CheckCircle2 />
                      </div>
                      <h3>Akkoord ontvangen</h3>
                      <p>
                        {isKoolhaas
                          ? "Bedankt! Ik plan de uitvoering in en stuur de vervolgstappen voor de installatie."
                          : "Bedankt! We hebben uw akkoord ontvangen en nemen zo spoedig mogelijk contact met u op."}
                      </p>
                      <div className="portal-result-selection">
                        {choiceGroups.map((group) => {
                          const choice = group.choices.find((item) => item.id === selectedChoiceIds[group.id]);
                          return choice ? <span key={group.id}>{group.title}: <b>{choice.title}</b></span> : null;
                        })}
                        {optionalWork.filter((option) => selectedOptionIds.includes(option.id)).map((option) => (
                          <span key={option.id}>Meerwerk: <b>{option.t}</b></span>
                        ))}
                        <strong>{formatCurrency(Number(displayedTotal))} incl. btw</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="portal-result-icon">
                        <XCircle />
                      </div>
                      <h3>Offerte afgewezen</h3>
                      <p>Uw reactie is verwerkt. Heeft u vragen? Neem gerust contact met ons op.</p>
                    </>
                  )}
                </div>
              ) : isExpired ? (
                <div className="portal-card portal-expired-card">
                  <Clock />
                  <h3>Offerte verlopen</h3>
                  <p>Neem contact op voor een actuele versie voordat u akkoord geeft.</p>
                </div>
              ) : (
                <div className="portal-card portal-action-card">
                  <p className="portal-form-kicker">Akkoord geven</p>

                  {(choiceGroups.length > 0 || optionalWork.length > 0) && (
                    <div className="portal-composer">
                      <div className="portal-composer-heading">
                        <PackageCheck />
                        <div>
                          <h3>Uw samenstelling</h3>
                          <p>Kies eerst wat onderdeel wordt van uw definitieve opdracht.</p>
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
                                    <span className="portal-select-title">
                                      <b>{choice.title}</b>
                                      {(isRecommended || choice.label) && <em>{choice.label || "Aanbevolen"}</em>}
                                    </span>
                                    {choice.summary && <small>{choice.summary}</small>}
                                    <strong>{formatCurrency(allInIncVat)} <small>incl. btw — compleet</small></strong>
                                    {exVat > 0 && baseIncVat > 0 && (
                                      <small>Systeem {formatCurrency(incVat)} · montage &amp; installatie {formatCurrency(baseIncVat)}</small>
                                    )}
                                    {exVat === 0 && <small>Geen meerprijs</small>}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}

                      {optionalWork.length > 0 && (
                        <fieldset className="portal-choice-group">
                          <legend>Optioneel meerwerk</legend>
                          <p className="portal-choice-help">Alleen selecteren waar het technisch en praktisch meerwaarde heeft.</p>
                          <div className="portal-choice-list">
                            {optionalWork.map((option) => {
                              const selected = selectedOptionIds.includes(option.id);
                              const incVat = option.price == null ? null : option.price * (1 + option.vatRate / 100);
                              return (
                                <div key={option.id} className={`portal-select-card portal-option-card ${selected ? "is-selected" : ""}`}>
                                  <label>
                                    <input type="checkbox" checked={selected} onChange={() => toggleOption(option.id)} />
                                    <span className="portal-select-indicator" />
                                    <span className="portal-select-copy">
                                      <span className="portal-select-title"><b>{option.t}</b><em>{option.tag}</em></span>
                                      <small>{option.d}</small>
                                      <strong>{incVat == null ? "Prijs op aanvraag" : <>+ {formatCurrency(incVat)} <small>incl. btw</small></>}</strong>
                                    </span>
                                  </label>
                                  {(option.details.length > 0 || option.technicalCondition) && (
                                    <details>
                                      <summary><ChevronDown /> Technische details</summary>
                                      {option.technicalCondition && <p>{option.technicalCondition}</p>}
                                      {option.details.length > 0 && <ul>{option.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </fieldset>
                      )}

                      <div className="portal-composer-total">
                        <span>Definitieve investering</span>
                        <b>{formatCurrency(totals.totalIncVat)} <small>incl. btw</small></b>
                      </div>
                    </div>
                  )}

                  <div className="portal-field">
                    <label htmlFor="signer-name">Uw naam</label>
                    <input
                      id="signer-name"
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Volledige naam"
                    />
                  </div>

                  <div className="portal-field">
                    <label htmlFor="message">Opmerking <span>(optioneel)</span></label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Heeft u nog vragen of opmerkingen?"
                    />
                  </div>

                  <label className="portal-check">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>Ik ga akkoord met de offerte en de algemene voorwaarden.</span>
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
                      <p>Weet u zeker dat u wilt afwijzen?</p>
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
      </main>

      {canRespond && (
        <div className="portal-mobile-action no-print">
          <div>
            <span>Totaal incl. btw</span>
            <b>{formatCurrency(Number(displayedTotal))}</b>
          </div>
          <a href="#akkoord" className="btn-primary">
            Bekijk akkoord
          </a>
        </div>
      )}
    </div>
  );
}
