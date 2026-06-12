"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  FileText,
  Calendar,
  Clock,
  Shield,
  Building2,
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
        logo: <img src="/logos/koolhaas-white.png" alt="Koolhaas Installaties" style={{ height: 28, width: "auto" }} />,
      }
    : {
        name: "WebsUp.nl",
        website: "websup.nl",
        logo: <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "#fff" }}>Webs<span className="grad-text">Up.</span></span>,
      };
  const [signerName, setSignerName] = useState(quote.customer.name);
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<"accepted" | "declined" | null>(
    share.acceptedAt ? "accepted" : share.declinedAt ? "declined" : null
  );
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  async function handleAccept() {
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

  const today = new Date().toISOString();

  return (
    <div className={`portal-container ${isKoolhaas ? "portal-koolhaas" : "portal-websup"}`}>
      {/* ── Topbar ── */}
      <header
        style={{
          backgroundColor: "#06040c",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {portalBrand.logo}
          <span
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Offerte portaal
          </span>
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "5px" }}>
          <Shield style={{ width: "11px", height: "11px" }} />
          Beveiligde verbinding
        </div>
      </header>

      {/* ── Page layout ── */}
      <div
        style={{
          maxWidth: "1760px",
          margin: "0 auto",
          padding: "32px 20px 64px",
          display: "flex",
          gap: "48px",
          alignItems: "flex-start",
        }}
        className="portal-layout"
      >
        {/* ── Document viewer (The 5-sheet template) ── */}
        <div className="doc-viewer">
          <QuoteSheetPreview quote={quote} companySlug={quote.company.slug} />
        </div>

        {/* ── Sidebar (The App Logic Toolbar) ── */}
        <aside className="sidebar">
          <div className="sticky-sidebar">

            {/* Meta card */}
            <div className="card">
              <div style={{ marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
                {isKoolhaas ? (
                  <img src="/logos/koolhaas-logo.png" alt="Koolhaas Installaties" style={{ height: 34, width: "auto", maxWidth: "100%" }} />
                ) : (
                  <span style={{ fontWeight: 800, fontSize: "1.4rem" }}>
                    Webs<span className="grad-text">Up.</span>
                  </span>
                )}
                <p style={{ fontSize: "0.72rem", color: "var(--on-s)", marginTop: "2px" }}>{portalBrand.website}</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { icon: <FileText style={{ width: "14px", height: "14px", color: "var(--on-s)" }} />, label: "Offertenummer", value: quote.number },
                  { icon: <Calendar style={{ width: "14px", height: "14px", color: "var(--on-s)" }} />, label: "Datum", value: formatDate(today) },
                  ...(quote.validUntil
                    ? [{ icon: <Clock style={{ width: "14px", height: "14px", color: "var(--on-s)" }} />, label: "Geldig tot", value: formatDate(quote.validUntil) }]
                    : []),
                  { icon: <Building2 style={{ width: "14px", height: "14px", color: "var(--on-s)" }} />, label: "Status", value: QUOTE_STATUS_LABELS[quote.status] ?? quote.status },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flexShrink: 0 }}>{icon}</div>
                    <div>
                      <p style={{ fontSize: "0.62rem", color: "var(--on-s)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</p>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total card */}
            <div className="card card-dark">
              <div style={{ position: "relative", zIndex: 1 }}>
                <p style={{ fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>
                  Totaalinvestering
                </p>
                <p style={{ fontWeight: 800, fontSize: "1.875rem", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                  <span className="grad-text">{formatCurrency(Number(quote.totalIncVat))}</span>
                </p>
                <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.38)", marginTop: "4px" }}>
                  incl. {formatCurrency(Number(quote.totalVat))} BTW
                </p>
              </div>
            </div>

            {/* Print / PDF export */}
            <a
              href={`/print/portal/${share.token}?auto=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <Download style={{ width: "16px", height: "16px" }} />
              Print / PDF
            </a>

            {/* Sign / Action card */}
            {submitted ? (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  padding: "28px 20px",
                  borderColor: submitted === "accepted" ? "rgba(34,197,94,0.3)" : "var(--border)",
                }}
              >
                {submitted === "accepted" ? (
                  <>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <CheckCircle2 style={{ width: "24px", height: "24px", color: "#16a34a" }} />
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "8px" }}>Akkoord ontvangen</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--on-m)", lineHeight: 1.5 }}>
                      {isKoolhaas
                        ? "Bedankt! Ik plan de uitvoering in en stuur de vervolgstappen voor de installatie."
                        : "Bedankt! We hebben uw akkoord ontvangen en nemen zo spoedig mogelijk contact met u op."}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-in)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <XCircle style={{ width: "24px", height: "24px", color: "var(--on-s)" }} />
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "8px" }}>Offerte afgewezen</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--on-m)", lineHeight: 1.5 }}>
                      Uw reactie is verwerkt. Heeft u vragen? Neem gerust contact met ons op.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="card">
                <p style={{ fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "var(--on-s)", marginBottom: "20px" }}>
                  Akkoord geven
                </p>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--on-m)", marginBottom: "6px" }}>
                    Uw naam
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Volledige naam"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--border-str)",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--on-m)", marginBottom: "6px" }}>
                    Opmerking <span style={{ color: "var(--on-s)", fontWeight: 400 }}>(optioneel)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Heeft u nog vragen of opmerkingen?"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--border-str)",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    marginBottom: "20px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    style={{ marginTop: "3px", width: "16px", height: "16px", flexShrink: 0, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "12.5px", color: "var(--on-m)", lineHeight: 1.5 }}>
                    Ik ga akkoord met de offerte en de algemene voorwaarden.
                  </span>
                </label>

                {!showDeclineConfirm ? (
                  <>
                    <button
                      onClick={handleAccept}
                      disabled={submitting || !agreed}
                      className="btn-primary"
                    >
                      {submitting ? (
                        <Loader2 className="animate-spin" style={{ width: "18px", height: "18px" }} />
                      ) : (
                        <CheckCircle2 style={{ width: "18px", height: "18px" }} />
                      )}
                      Offerte accepteren
                    </button>
                    <button
                      onClick={() => setShowDeclineConfirm(true)}
                      disabled={submitting}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "none",
                        border: "none",
                        color: "var(--on-s)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginTop: "8px"
                      }}
                    >
                      Offerte afwijzen
                    </button>
                  </>
                ) : (
                  <div style={{ padding: "16px", background: "rgba(239,68,68,0.05)", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p style={{ fontSize: "12px", color: "#ef4444", marginBottom: "12px", fontWeight: 600 }}>
                      Weet u zeker dat u wilt afwijzen?
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={handleDecline}
                        disabled={submitting}
                        style={{
                          flex: 1,
                          padding: "8px",
                          background: "#ef4444",
                          border: "none",
                          borderRadius: "6px",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Ja, afwijzen
                      </button>
                      <button
                        onClick={() => setShowDeclineConfirm(false)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          background: "#fff",
                          border: "1px solid var(--border-str)",
                          borderRadius: "6px",
                          color: "var(--on-m)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: "10px", color: "var(--on-s)", marginTop: "16px", lineHeight: 1.5, display: "flex", gap: "6px" }}>
                  <Shield style={{ width: "12px", height: "12px", marginTop: "1px", flexShrink: 0 }} />
                  Beveiligd met SSL-encryptie. Elektronisch akkoord is rechtsgeldig.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
