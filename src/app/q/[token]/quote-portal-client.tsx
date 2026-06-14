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
} from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import "./portal.css";
import { QuoteSheetPreview } from "@/components/quote-sheet-preview";

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
};

type Share = {
  id: string;
  token: string;
  acceptedAt: string | null;
  declinedAt: string | null;
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
  const isKoolhaas = quote.company.slug === "koolhaas";
  const portalBrand = isKoolhaas
    ? {
        name: "Koolhaas Installaties",
        website: "koolhaasinstallaties.nl",
        logo: <img src="/logos/koolhaas-white.png" alt="Koolhaas Installaties" />,
      }
    : {
        name: "WebsUp.nl",
        website: "websup.nl",
        logo: (
          <span className="portal-topbar-wordmark">
            Webs<span className="grad-text">Up.</span>
          </span>
        ),
      };

  const [signerName, setSignerName] = useState(quote.customer.name);
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<"accepted" | "declined" | null>(
    share.acceptedAt ? "accepted" : share.declinedAt ? "declined" : null
  );
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const isExpired = quote.validUntil
    ? new Date(quote.validUntil).setHours(23, 59, 59, 999) < Date.now()
    : false;
  const canRespond = !submitted && !isExpired;
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
        body: JSON.stringify({ message, signerName }),
      });
      if (!res.ok) throw new Error();
      setSubmitted("accepted");
      toast.success("Offerte geaccepteerd!");
    } catch {
      toast.error("Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

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
              <b>{formatCurrency(Number(quote.totalIncVat))}</b>
            </div>
            <div className="portal-stat">
              <Clock />
              <span>{isExpired ? "Verlopen op" : "Geldig tot"}</span>
              <b>{quote.validUntil ? formatDate(quote.validUntil) : "In overleg"}</b>
            </div>
            <div className={`portal-status-pill ${submitted === "accepted" ? "is-accepted" : isExpired ? "is-expired" : ""}`}>
              {statusLabel}
            </div>
          </div>
        </section>

        <div className="portal-layout">
          <div className="doc-viewer">
            <QuoteSheetPreview quote={quote} companySlug={quote.company.slug} />
          </div>

          <aside className="sidebar no-print">
            <div className="sticky-sidebar" id="akkoord">
              <div className="portal-card portal-identity-card">
                <div className="portal-card-head">
                  {isKoolhaas ? (
                    <img src="/logos/koolhaas-logo.png" alt="Koolhaas Installaties" />
                  ) : (
                    <span className="portal-wordmark">
                      Webs<span className="grad-text">Up.</span>
                    </span>
                  )}
                  <p>{portalBrand.website}</p>
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
                  <p>Totaalinvestering</p>
                  <strong>
                    <span className="grad-text">{formatCurrency(Number(quote.totalIncVat))}</span>
                  </strong>
                  <span>incl. {formatCurrency(Number(quote.totalVat))} BTW</span>
                </div>
              </div>

              <a
                href={`/print/portal/${share.token}?auto=1`}
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
                        disabled={submitting || !agreed || !canRespond}
                        className="btn-primary"
                      >
                        {submitting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <CheckCircle2 />
                        )}
                        Offerte accepteren
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
            <b>{formatCurrency(Number(quote.totalIncVat))}</b>
          </div>
          <a href="#akkoord" className="btn-primary">
            Bekijk akkoord
          </a>
        </div>
      )}
    </div>
  );
}
