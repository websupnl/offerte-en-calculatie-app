"use client";

import { useState } from "react";
import Link from "next/link";
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
import { ArrowLeft, Plus, Trash2, Loader2, Save, Printer } from "lucide-react";
import { INVOICE_STATUS_LABELS, formatCurrency, formatDate } from "@/lib/format";
import { computeInvoiceTotals } from "@/lib/invoice-totals";

type Line = {
  description: string;
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
  invoiceDate: string;
  dueDate: string | null;
  lines: {
    id: string;
    description: string;
    qty: string | number;
    unit: string | null;
    unitPrice: string | number;
    vatRate: string | number;
  }[];
  customer: { name: string; address: string | null; city: string | null; zipCode: string | null } | null;
  project: { id: string; number: string; title: string } | null;
};

const STATUSES = ["CONCEPT", "VERZONDEN", "BETAALD", "VERVALLEN"];

export function InvoiceDetailClient({ invoice }: { invoice: Invoice }) {
  const [status, setStatus] = useState(invoice.status);
  const [reference, setReference] = useState(invoice.reference ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    invoice.lines.map((l) => ({
      description: l.description,
      qty: Number(l.qty),
      unit: l.unit ?? "stuk",
      unitPrice: Number(l.unitPrice),
      vatRate: Number(l.vatRate),
    })),
  );
  const [saving, setSaving] = useState(false);

  const totals = computeInvoiceTotals(lines);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { description: "", qty: 1, unit: "stuk", unitPrice: 0, vatRate: 21 },
    ]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reference, notes, lines }),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      toast.success("Factuur opgeslagen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {invoice.project && (
        <Link
          href={`/projects/${invoice.project.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {invoice.project.number} · {invoice.project.title}
        </Link>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <span className="text-xs font-mono text-muted-foreground">{invoice.number}</span>
          <h1 className="text-xl font-bold">Factuur</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.customer?.name ?? ""} · {formatDate(invoice.invoiceDate)}
            {invoice.dueDate ? ` · vervalt ${formatDate(invoice.dueDate)}` : ""}
          </p>
        </div>
        <Badge variant="secondary">{INVOICE_STATUS_LABELS[status] ?? status}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Referentie / PO</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Regels</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" /> Regel
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nog geen regels.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Input
                      placeholder="Omschrijving"
                      value={l.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
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
                      <Label className="text-xs">Prijs</Label>
                      <Input type="number" step="0.01" value={l.unitPrice}
                        onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Btw %</Label>
                      <Input type="number" step="1" value={l.vatRate}
                        onChange={(e) => updateLine(i, { vatRate: Number(e.target.value) })} />
                    </div>
                  </div>
                  <p className="text-right text-sm text-muted-foreground">
                    {formatCurrency(l.qty * l.unitPrice)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotaal (excl. btw)</span>
              <span>{formatCurrency(totals.totalExVat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Btw</span>
              <span>{formatCurrency(totals.totalVat)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Totaal</span>
              <span>{formatCurrency(totals.totalIncVat)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label>Opmerkingen</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Tekst onderaan de factuur (optioneel)" />
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Opslaan
        </Button>
        <a href={`/print/invoices/${invoice.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-1" /> PDF / print
          </Button>
        </a>
      </div>
    </div>
  );
}
