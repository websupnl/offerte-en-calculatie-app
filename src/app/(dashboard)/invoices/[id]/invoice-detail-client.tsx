"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Eye,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { INVOICE_STATUS_LABELS, formatCurrency, formatDate } from "@/lib/format";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { INVOICE_STATUSES, isInvoiceEditable } from "@/lib/invoice-status";

type Line = {
  groupLabel: string;
  description: string;
  detail: string;
  qty: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  reference: string | null;
  notes: string | null;
  subject: string | null;
  intro: string | null;
  invoiceDate: string;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  sentAt: string | null;
  paidAt: string | null;
  lines: {
    id: string;
    groupLabel: string | null;
    description: string;
    detail: string | null;
    qty: string | number;
    unit: string | null;
    unitPrice: string | number;
    vatRate: string | number;
  }[];
  customer: { name: string } | null;
  project: { id: string; number: string; title: string } | null;
  quote: { id: string; number: string | null } | null;
};

/** Datum voor een <input type="date">. Tijdstempels lokaal, pure datums (periode) in UTC. */
function dateInput(value: string | null, utc = false): string {
  if (!value) return "";
  const d = new Date(value);
  if (utc) return d.toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function InvoiceDetailClient({ invoice, missingSettings }: { invoice: Invoice; missingSettings: string[] }) {
  const router = useRouter();
  const [savedStatus, setSavedStatus] = useState(invoice.status);
  const [status, setStatus] = useState(invoice.status);
  const [fields, setFields] = useState({
    subject: invoice.subject ?? "",
    reference: invoice.reference ?? "",
    intro: invoice.intro ?? "",
    notes: invoice.notes ?? "",
    invoiceDate: dateInput(invoice.invoiceDate),
    dueDate: dateInput(invoice.dueDate),
    periodStart: dateInput(invoice.periodStart, true),
    periodEnd: dateInput(invoice.periodEnd, true),
  });
  const [lines, setLines] = useState<Line[]>(
    invoice.lines.map((l) => ({
      groupLabel: l.groupLabel ?? "",
      description: l.description,
      detail: l.detail ?? "",
      qty: Number(l.qty),
      unit: l.unit ?? "stuk",
      unitPrice: Number(l.unitPrice),
      vatRate: Number(l.vatRate),
    })),
  );
  const [saving, setSaving] = useState(false);

  const locked = !isInvoiceEditable(savedStatus);
  const totals = computeInvoiceTotals(lines);
  const groupNames = [...new Set(lines.map((l) => l.groupLabel.trim()).filter(Boolean))];

  const set = (patch: Partial<typeof fields>) => setFields((f) => ({ ...f, ...patch }));

  function addLine() {
    setLines((prev) => [
      ...prev,
      // Een nieuwe regel komt in dezelfde groep als de vorige: zo bouw je een maand of categorie snel op.
      { groupLabel: prev.at(-1)?.groupLabel ?? "", description: "", detail: "", qty: 1, unit: "stuk", unitPrice: 0, vatRate: 21 },
    ]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveLine(i: number, dir: -1 | 1) {
    setLines((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function patch(body: object) {
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === "string" ? data.error : "Opslaan mislukt");
    }
  }

  async function save() {
    if (!locked && lines.some((l) => !l.description.trim())) {
      toast.error("Elke regel heeft een omschrijving nodig");
      return;
    }
    setSaving(true);
    try {
      // Eerst de inhoud (zolang het nog een concept is), dan pas de status:
      // na "Verzonden" ligt de inhoud vast.
      if (!locked) await patch({ ...fields, lines });
      if (status !== savedStatus) await patch({ status });
      setSavedStatus(status);
      toast.success("Factuur opgeslagen");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      {invoice.project ? (
        <Link
          href={`/projects/${invoice.project.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {invoice.project.number} · {invoice.project.title}
        </Link>
      ) : (
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Facturen
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-sm text-muted-foreground">{invoice.number}</span>
          <h1 className="text-xl font-bold">{fields.subject || "Factuur"}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.customer?.name ?? ""}
            {invoice.quote?.number ? ` · offerte ${invoice.quote.number}` : ""}
            {invoice.sentAt ? ` · verstuurd ${formatDate(invoice.sentAt)}` : ""}
            {invoice.paidAt ? ` · betaald ${formatDate(invoice.paidAt)}` : ""}
          </p>
        </div>
        <Badge variant="secondary">{INVOICE_STATUS_LABELS[savedStatus] ?? savedStatus}</Badge>
      </div>

      {missingSettings.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Op de factuur ontbreekt nog: {missingSettings.join(", ")}. Vul dit in bij{" "}
            <Link href="/admin/settings" className="font-semibold underline">
              Instellingen
            </Link>{" "}
            voordat je hem verstuurt.
          </p>
        </div>
      )}

      {locked && (
        <div className="flex gap-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Deze factuur is verstuurd en ligt vast. Je kunt alleen de status nog wijzigen. Moet er iets anders op? Zet
            hem terug naar concept.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-subject">Onderwerp</Label>
            <Input
              id="inv-subject"
              disabled={locked}
              placeholder="Bijv. Renovatie elektrische installatie"
              value={fields.subject}
              onChange={(e) => set({ subject: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-date">Factuurdatum</Label>
            <Input id="inv-date" type="date" disabled={locked} value={fields.invoiceDate}
              onChange={(e) => set({ invoiceDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-due">Vervaldatum</Label>
            <Input id="inv-due" type="date" disabled={locked} value={fields.dueDate}
              onChange={(e) => set({ dueDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-pstart">Periode vanaf</Label>
            <Input id="inv-pstart" type="date" disabled={locked} value={fields.periodStart}
              onChange={(e) => set({ periodStart: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-pend">Periode tot en met, of leverdatum</Label>
            <Input id="inv-pend" type="date" disabled={locked} value={fields.periodEnd}
              onChange={(e) => set({ periodEnd: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inv-ref">Referentie van de klant</Label>
            <Input id="inv-ref" disabled={locked} placeholder="Bijv. een inkoopnummer" value={fields.reference}
              onChange={(e) => set({ reference: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inv-intro">Persoonlijke zin bovenaan</Label>
            <Textarea
              id="inv-intro"
              rows={2}
              disabled={locked}
              placeholder="Bijv. Hoi Sanne, de website staat live. Hieronder de specificatie."
              value={fields.intro}
              onChange={(e) => set({ intro: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Houd het op twee regels, anders gaat het ten koste van de specificatie op pagina 1.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Regels</h2>
            {!locked && (
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" /> Regel
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Regels met dezelfde groep staan op de factuur onder één kop, zoals een maand of Materialen en Arbeid.
          </p>

          <datalist id="invoice-groups">
            {groupNames.map((g) => <option key={g} value={g} />)}
          </datalist>

          {lines.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nog geen regels.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <fieldset key={i} disabled={locked} className="space-y-2 rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <div>
                      <Label className="text-xs">Groep</Label>
                      <Input list="invoice-groups" placeholder="Geen groep" value={l.groupLabel}
                        onChange={(e) => updateLine(i, { groupLabel: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Omschrijving</Label>
                      <Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                    </div>
                    {!locked && (
                      <div className="flex items-end gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Omhoog" onClick={() => moveLine(i, -1)} disabled={i === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Omlaag" onClick={() => moveLine(i, 1)} disabled={i === lines.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Regel verwijderen" onClick={() => removeLine(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Toelichting (grijze tweede regel, optioneel)</Label>
                    <Input value={l.detail} onChange={(e) => updateLine(i, { detail: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <Label className="text-xs">Aantal</Label>
                      <Input type="number" step="0.01" value={l.qty}
                        onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Eenheid</Label>
                      <Input value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Prijs excl. btw</Label>
                      <Input type="number" step="0.01" value={l.unitPrice}
                        onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Btw %</Label>
                      <Input type="number" step="1" value={l.vatRate}
                        onChange={(e) => updateLine(i, { vatRate: Number(e.target.value) })} />
                    </div>
                  </div>
                  <p className="text-right text-sm text-muted-foreground">{formatCurrency(l.qty * l.unitPrice)}</p>
                </fieldset>
              ))}
            </div>
          )}

          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotaal excl. btw</span>
              <span>{formatCurrency(totals.totalExVat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Btw</span>
              <span>{formatCurrency(totals.totalVat)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Totaal</span>
              <span>{formatCurrency(totals.totalIncVat)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <Label htmlFor="inv-notes">Afsluitende zin</Label>
          <Textarea id="inv-notes" disabled={locked} value={fields.notes} onChange={(e) => set({ notes: e.target.value })}
            placeholder="Bijv. Vragen over een regel? Bel of app gerust." />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Opslaan
        </Button>
        <Button variant="outline" nativeButton={false}
          render={<a href={`/print/invoices/${invoice.id}`} target="_blank" rel="noopener noreferrer" />}>
          <Eye className="mr-1 h-4 w-4" /> Voorbeeld
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={`/api/invoices/${invoice.id}/pdf`} />}>
          <Download className="mr-1 h-4 w-4" /> PDF downloaden
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Voorbeeld en PDF tonen de laatst opgeslagen versie.</p>
    </div>
  );
}
