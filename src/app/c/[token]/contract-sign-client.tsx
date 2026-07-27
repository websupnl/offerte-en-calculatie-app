"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { CONTRACT_PERIOD_LABELS, formatCurrency, formatDate } from "@/lib/format";

type Contract = {
  number: string; title: string; body: string;
  startDate: string | null; endDate: string | null;
  recurringAmount: number | null; recurringPeriod: string | null;
  noticePeriodDays: number | null;
  signedAt: string | null; signedBy: string | null;
};

/** Heel lichte markdown → HTML. Alleen kopjes, lijstjes, vet en alinea's. */
function renderBody(body: string): string {
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return escape(body)
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^###\s/.test(trimmed)) return `<h3>${trimmed.replace(/^###\s/, "")}</h3>`;
      if (/^##\s/.test(trimmed)) return `<h2>${trimmed.replace(/^##\s/, "")}</h2>`;
      if (/^#\s/.test(trimmed)) return `<h2>${trimmed.replace(/^#\s/, "")}</h2>`;
      if (/^[-*]\s/m.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .filter((line) => /^[-*]\s/.test(line.trim()))
          .map((line) => `<li>${line.trim().replace(/^[-*]\s/, "")}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function ContractSignClient({
  token,
  contract,
  company,
  customerName,
}: {
  token: string;
  contract: Contract;
  company: { name: string; slug: string; branding: Record<string, string> };
  customerName: string;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(Boolean(contract.signedAt));

  async function sign() {
    if (!signature) return toast.error("Zet eerst je handtekening");
    if (name.trim().length < 2) return toast.error("Vul je naam in");
    if (!agreed) return toast.error("Vink aan dat je akkoord gaat");

    setSaving(true);
    try {
      const response = await fetch(`/api/contracts/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: signature, signedBy: name.trim(), agreed: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Ondertekenen mislukt");
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ondertekenen mislukt");
    } finally {
      setSaving(false);
    }
  }

  const accent = company.branding?.primaryColor ?? "#0f766e";

  if (done) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-950/[0.06]">
          <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: accent }} />
          <h1 className="mt-4 text-xl font-bold text-slate-950">Ondertekend</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Bedankt. Je krijgt een bevestiging van {company.name}. Je kunt dit scherm sluiten.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            {contract.number} · {contract.signedBy ?? name}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-950/[0.06]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
            {company.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{contract.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {contract.number} · voor {customerName}
          </p>

          <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
            {contract.startDate && (
              <div>
                <dt className="text-xs font-semibold text-slate-400">Ingangsdatum</dt>
                <dd className="font-semibold text-slate-900">{formatDate(contract.startDate)}</dd>
              </div>
            )}
            {contract.endDate && (
              <div>
                <dt className="text-xs font-semibold text-slate-400">Loopt tot</dt>
                <dd className="font-semibold text-slate-900">{formatDate(contract.endDate)}</dd>
              </div>
            )}
            {contract.recurringAmount !== null && (
              <div>
                <dt className="text-xs font-semibold text-slate-400">Bedrag</dt>
                <dd className="font-semibold text-slate-900">
                  {formatCurrency(contract.recurringAmount)}{" "}
                  {contract.recurringPeriod ? CONTRACT_PERIOD_LABELS[contract.recurringPeriod] : ""}
                </dd>
              </div>
            )}
            {contract.noticePeriodDays !== null && (
              <div>
                <dt className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                  <CalendarClock className="h-3 w-3" /> Opzegtermijn
                </dt>
                <dd className="font-semibold text-slate-900">{contract.noticePeriodDays} dagen</dd>
              </div>
            )}
          </dl>
        </header>

        <article
          className="contract-body rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-950/[0.06]"
          dangerouslySetInnerHTML={{ __html: renderBody(contract.body) }}
        />

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-950/[0.06]">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
            <FileSignature className="h-4 w-4" style={{ color: accent }} /> Ondertekenen
          </h2>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sign-name">Je naam</Label>
              <Input
                id="sign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Voor- en achternaam"
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Handtekening</Label>
              <SignaturePad onChange={setSignature} />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>Ik ga akkoord met de inhoud van dit contract en onderteken het namens {customerName}.</span>
            </label>

            <Button
              onClick={sign}
              disabled={saving || !signature || !agreed || name.trim().length < 2}
              className="w-full"
              style={{ backgroundColor: accent }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ondertekenen"}
            </Button>
          </div>
        </section>

        <p className="pb-8 text-center text-xs text-slate-400">
          Vragen over dit contract? Neem contact op met {company.name}.
        </p>
      </div>

      <style>{`
        .contract-body { color: #334155; font-size: 15px; line-height: 1.75; }
        .contract-body h2 { font-size: 17px; font-weight: 700; color: #020617; margin: 20px 0 8px; }
        .contract-body h2:first-child { margin-top: 0; }
        .contract-body h3 { font-size: 15px; font-weight: 700; color: #020617; margin: 16px 0 6px; }
        .contract-body p { margin: 0 0 12px; }
        .contract-body ul { margin: 0 0 12px; padding-left: 20px; list-style: disc; }
        .contract-body li { margin-bottom: 4px; }
      `}</style>
    </main>
  );
}
