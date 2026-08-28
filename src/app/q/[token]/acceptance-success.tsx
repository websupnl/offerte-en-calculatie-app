"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Sparkles, Download, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { filenameFromResponse } from "@/lib/download-filename";

interface AcceptanceSuccessProps {
  quoteTitle: string;
  signerName: string;
  isKoolhaas: boolean;
  selectedChoices: Array<{ groupTitle: string; choiceTitle: string }>;
  selectedOptions: Array<{ title: string }>;
  baseItems: Array<{ description: string; unitPrice: number; qty: number }>;
  priceLabel: string;
  displayedTotal: number;
  onScrollToQuote: () => void;
  accentColor: string;
  shareToken: string;
}

export function AcceptanceSuccess({
  quoteTitle,
  signerName,
  isKoolhaas,
  selectedChoices,
  selectedOptions,
  baseItems,
  priceLabel,
  displayedTotal,
  onScrollToQuote,
  accentColor,
  shareToken,
}: AcceptanceSuccessProps) {
  const firedRef = useRef(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/portal/${shareToken}/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromResponse(res, "offerte.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    import("canvas-confetti").then(({ default: confetti }) => {
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 70,
        zIndex: 9999,
        colors: ["#7c3aed", "#ec4899", "#f97316", "#06b6d4", "#10b981", "#fbbf24"],
      };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      // First burst — center
      confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.55 } });

      // Side cannons with delay
      setTimeout(() => {
        confetti({ ...defaults, particleCount: 50, angle: 60, spread: 80, origin: { x: 0, y: 0.6 } });
        confetti({ ...defaults, particleCount: 50, angle: 120, spread: 80, origin: { x: 1, y: 0.6 } });
      }, 300);

      // Slow rain
      const interval = setInterval(() => {
        confetti({
          particleCount: randomInRange(8, 16),
          angle: randomInRange(55, 125),
          spread: randomInRange(50, 70),
          origin: { x: randomInRange(0.2, 0.8), y: 0 },
          ticks: 120,
          startVelocity: randomInRange(20, 40),
          gravity: 0.8,
          colors: ["#7c3aed", "#ec4899", "#f97316", "#06b6d4", "#10b981", "#fbbf24", "#fff"],
          zIndex: 9999,
        });
      }, 200);

      setTimeout(() => clearInterval(interval), 3200);
    });
  }, []);

  const firstName = signerName.split(" ")[0];
  const outro = isKoolhaas
    ? "Ik plan de uitvoering in en neem snel contact op over de vervolgstappen."
    : "Ik neem zo snel mogelijk contact op om de samenwerking te starten.";

  return (
    <div className="acceptance-success">
      {/* Background glow */}
      <div className="acceptance-success__glow" style={{ background: accentColor }} />

      {/* Check animation */}
      <div className="acceptance-success__icon">
        <svg viewBox="0 0 52 52" className="acceptance-check-svg">
          <circle className="acceptance-check-circle" cx="26" cy="26" r="24" />
          <path className="acceptance-check-tick" d="M14 27l8 8 16-16" />
        </svg>
      </div>

      {/* Heading */}
      <div className="acceptance-success__heading">
        <h1>Gefeliciteerd, {firstName}!</h1>
        <p>{outro}</p>
      </div>

      {/* Summary card */}
      <div className="acceptance-success__card">
        <div className="acceptance-success__card-header">
          <Sparkles className="acceptance-success__sparkle" />
          <span>Jouw opdracht</span>
        </div>

        <ul className="acceptance-success__list">
          {/* Base — toon alleen als er items zijn en ze relevant zijn */}
          {baseItems.length > 0 && (
            <li className="acceptance-success__list-item acceptance-success__list-item--base">
              <span className="acceptance-success__list-label">{quoteTitle}</span>
              <span className="acceptance-success__list-price">
                {formatCurrency(baseItems.reduce((sum, i) => sum + Number(i.qty) * Number(i.unitPrice), 0))}
              </span>
            </li>
          )}

          {selectedChoices.map((c, i) => (
            <li key={i} className="acceptance-success__list-item">
              <span className="acceptance-success__list-label">{c.groupTitle}: <b>{c.choiceTitle}</b></span>
            </li>
          ))}

          {selectedOptions.map((o, i) => (
            <li key={i} className="acceptance-success__list-item acceptance-success__list-item--option">
              <span className="acceptance-success__list-badge">+</span>
              <span className="acceptance-success__list-label">{o.title}</span>
            </li>
          ))}
        </ul>

        <div className="acceptance-success__total">
          <span>{priceLabel === "excl. btw" ? "Totaal excl. btw" : "Totaal incl. btw"}</span>
          <strong>{formatCurrency(displayedTotal)}</strong>
        </div>
      </div>

      {/* CTAs */}
      <div className="acceptance-success__actions">
        <button
          type="button"
          className="acceptance-success__cta"
          onClick={onScrollToQuote}
        >
          <ArrowDown className="h-4 w-4" />
          Bekijk de volledige offerte
        </button>
        <button
          type="button"
          className="acceptance-success__download"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "PDF wordt gegenereerd..." : "Download offerte (PDF)"}
        </button>
      </div>

      <p className="acceptance-success__signed">
        Ondertekend door <b>{signerName}</b>
      </p>
    </div>
  );
}
