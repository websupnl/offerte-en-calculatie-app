"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, CreditCard, Eye, Loader2, Printer, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABELS, formatCurrency, formatDate } from "@/lib/format";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import { InvoiceLinesEditor, stripKeys, toEditable, type EditableLine } from "@/components/invoices/invoice-lines-editor";

type Invoice = {
  id: string;
  number: string;
  status: string;
  reference: string | null;
  notes: string | null;
  invoiceDate: string;
  dueDate: string | null;
  molliePaymentUrl: string | null;
  molliePaymentMode: string | null;
  molliePaidAt: string | null;
  lines: { id: string; description: string; qty: string | number; unit: string | null; unitPrice: string | number; vatRate: string | number }[];
  customer: { name: string; email: string | null; address: string | null; city: string | null; zipCode: string | null } | null;
  project: { id: string; number: string; title: string } | null;
  quote: { id: string; number: string } | null;
  workOrder: { id: string; number: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  CONCEPT: "bg-slate-100 text-slate-700",
  GEREED: "bg-amber-100 text-amber-900",
  VERZENDEN: "bg-amber-100 text-amber-900",
  VERZONDEN: "bg-sky-100 text-sky-800",
  BETAALD: "bg-emerald-100 text-emerald-800",
  VERVALLEN: "bg-red-100 text-red-700",
};

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function InvoiceDetailClient({ invoice, missingCompanyData, mollieConfigured, mollieLive }: { invoice: Invoice; missingCompanyData: string[]; mollieConfigured: boolean; mollieLive: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(invoice.status);
  const [reference, setReference] = useState(invoice.reference ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [invoiceDate, setInvoiceDate] = useState(toDateInput(invoice.invoiceDate));
  const [dueDate, setDueDate] = useState(toDateInput(invoice.dueDate));
  const [lines, setLines] = useState<EditableLine[]>(() => toEditable(invoice.lines));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(invoice.molliePaymentUrl);
  const [paymentMode, setPaymentMode] = useState(invoice.molliePaymentMode);
  const [creatingLink, setCreatingLink] = useState(false);
  const [sending, setSending] = useState(false);

  const locked = status !== "CONCEPT";
  const totals = computeInvoiceTotals(lines);
  const overdue = status === "VERZONDEN" && dueDate && new Date(dueDate) < new Date(new Date().toDateString());

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  async function save(nextStatus?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locked && nextStatus ? { status: nextStatus } : {
          status: nextStatus ?? status,
          reference,
          notes,
          invoiceDate: invoiceDate || undefined,
          dueDate: dueDate || null,
          lines: stripKeys(lines),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Opslaan mislukt");
      }
      if (nextStatus) setStatus(nextStatus);
      setDirty(false);
      toast.success(nextStatus ? `Gemarkeerd als ${INVOICE_STATUS_LABELS[nextStatus].toLowerCase()}` : "Factuur opgeslagen");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  async function createPaymentLink() {
    setCreatingLink(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payment-link`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Betaallink maken mislukt");
      setPaymentUrl(body.url);
      setPaymentMode(body.mode);
      toast.success("Betaallink toegevoegd aan de factuur");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Betaallink maken mislukt");
    } finally {
      setCreatingLink(false);
    }
  }

  async function sendInvoice() {
    if (dirty) return toast.error("Sla de factuur eerst op voordat je hem verstuurt");
    if (!c?.email) return toast.error("Vul eerst een e-mailadres bij de klant in");
    if (!confirm(`Factuur ${invoice.number} naar ${c.email} versturen?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Factuur versturen mislukt");
      setStatus("VERZONDEN");
      setPaymentUrl(body.paymentUrl);
      setPaymentMode("live");
      toast.success(`Factuur met PDF en betaallink verstuurd naar ${body.to}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Factuur versturen mislukt");
      const current = await fetch(`/api/invoices/${invoice.id}`).then((res) => res.ok ? res.json() : null).catch(() => null);
      if (current) {
        setStatus(current.status);
        setPaymentUrl(current.molliePaymentUrl);
        setPaymentMode(current.molliePaymentMode);
      }
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!confirm(`Concept ${invoice.number} verwijderen?`)) return;
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Alleen concepten kunnen verwijderd worden");
    toast.success("Concept verwijderd");
    router.push("/invoices");
  }

  const c = invoice.customer;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5 lg:p-8">
      <Link
        href={invoice.project ? `/projects/${invoice.project.id}` : "/invoices"}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> {invoice.project ? `${invoice.project.number} · ${invoice.project.title}` : "Facturen"}
      </Link>

      {/* Kop met het bedrag als hoofdzaak */}
      <header className="overflow-hidden rounded-2xl bg-slate-950 text-white">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-white/60">{invoice.number}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>
                {INVOICE_STATUS_LABELS[status] ?? status}
              </span>
              {overdue && <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">Over de vervaldatum</span>}
            </div>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-tight">{c?.name ?? "Onbekende klant"}</h1>
            <p className="mt-1 text-sm text-white/60">
              {[c?.address, [c?.zipCode, c?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Geen adres bekend"}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">Te betalen</p>
            <p className="text-3xl font-bold tabular-nums sm:text-4xl">{formatCurrency(totals.totalIncVat)}</p>
            <p className="text-xs text-white/50">{formatCurrency(totals.totalExVat)} excl. btw</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 bg-white/[0.03] px-5 py-3 sm:px-6">
          {["CONCEPT", "GEREED", "VERZONDEN"].includes(status) && (
            <Button size="sm" onClick={sendInvoice} disabled={saving || sending || dirty || !mollieLive || !c?.email} className="bg-[var(--ws-accent)] text-white hover:opacity-90">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Factuur wordt verstuurd" : status === "VERZONDEN" ? "Factuur mailen" : "Verstuur factuur"}
            </Button>
          )}
          {status === "CONCEPT" && (
            <Button size="sm" variant="secondary" onClick={() => save("GEREED")} disabled={saving || sending}>
              Maak definitief
            </Button>
          )}
          {(status === "VERZONDEN" || status === "VERVALLEN") && (
            <Button size="sm" onClick={() => save("BETAALD")} disabled={saving} className="bg-emerald-500 text-white hover:bg-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Handmatig betaald
            </Button>
          )}
          {["GEREED", "VERZONDEN", "VERVALLEN"].includes(status) && !paymentUrl && mollieConfigured && (
            <Button size="sm" variant="secondary" onClick={createPaymentLink} disabled={creatingLink || dirty}>
              {creatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Betaallink maken
            </Button>
          )}
          {paymentUrl && status !== "BETAALD" && (
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary"><CreditCard className="h-4 w-4" /> {paymentMode === "test" ? "Testbetaallink" : "Betaallink"}</Button>
            </a>
          )}
          <a href={`/print/invoices/${invoice.id}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary"><Eye className="h-4 w-4" /> Bekijken</Button>
          </a>
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary"><Printer className="h-4 w-4" /> PDF / print</Button>
          </a>
          {status === "GEREED" && !paymentUrl && (
            <Button size="sm" variant="ghost" onClick={() => save("CONCEPT")} disabled={saving || sending}>Terug naar concept</Button>
          )}
          {status === "CONCEPT" && (
            <Button size="sm" variant="ghost" onClick={remove} className="ml-auto text-white/60 hover:bg-white/10 hover:text-white">
              <Trash2 className="h-4 w-4" /> Verwijderen
            </Button>
          )}
        </div>
      </header>

      {missingCompanyData.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Op de factuur ontbreekt nog: <strong>{missingCompanyData.join(", ")}</strong>. Dat is wettelijk verplicht.{" "}
          <Link href="/admin/settings" className="font-semibold underline">Vul het in bij Inrichting</Link>.
        </div>
      )}

      {!mollieConfigured && status !== "BETAALD" && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          Online betalen is voor dit bedrijf nog niet ingesteld. Voeg de bijbehorende Mollie-key toe aan de serverconfiguratie.
        </div>
      )}
      {mollieConfigured && !mollieLive && status !== "BETAALD" && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-950 ring-1 ring-amber-200">
          Facturen mailen kan pas met een live Mollie-key voor dit bedrijf. Testbetalingen gaan niet naar klanten.
        </div>
      )}
      {dirty && <p className="text-base text-slate-700">Sla je wijzigingen op voordat je de factuur verstuurt.</p>}
      {status === "VERZENDEN" && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-950 ring-1 ring-amber-200">
          De verzending wordt verwerkt. Blijft dit staan? Controleer dan eerst in Brevo of de mail is verzonden.
        </div>
      )}
      {paymentMode === "test" && invoice.molliePaidAt && (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          Testbetaling gelukt. Deze factuur blijft open totdat er een echte betaling is ontvangen.
        </div>
      )}

      {locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          <span>Deze factuur is {INVOICE_STATUS_LABELS[status].toLowerCase()}. De regels zijn vergrendeld zodat hij gelijk blijft aan wat de klant heeft.</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
          <InvoiceLinesEditor lines={lines} onChange={touch(setLines)} readOnly={locked} />
        </section>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <p className="text-base font-semibold text-slate-800">{INVOICE_STATUS_LABELS[status] ?? status}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Factuurdatum</Label>
              <Input type="date" value={invoiceDate} disabled={locked} onChange={(e) => touch(setInvoiceDate)(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vervaldatum</Label>
              <Input type="date" value={dueDate} disabled={locked} onChange={(e) => touch(setDueDate)(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Referentie</Label>
              <Input value={reference} disabled={locked} onChange={(e) => touch(setReference)(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Opmerking op factuur</Label>
              <Textarea rows={3} value={notes} disabled={locked} onChange={(e) => touch(setNotes)(e.target.value)} placeholder="Optioneel" />
            </div>
          </section>

          {(invoice.quote || invoice.workOrder || invoice.project) && (
            <section className="space-y-1.5 rounded-2xl bg-white p-4 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Gekoppeld</p>
              {invoice.quote && <Link className="block hover:text-[var(--ws-accent)]" href={`/quotes/${invoice.quote.id}`}>Offerte {invoice.quote.number}</Link>}
              {invoice.workOrder && <Link className="block hover:text-[var(--ws-accent)]" href={`/workorders/${invoice.workOrder.id}`}>Werkbon {invoice.workOrder.number}</Link>}
              {invoice.project && <Link className="block hover:text-[var(--ws-accent)]" href={`/projects/${invoice.project.id}`}>Project {invoice.project.number}</Link>}
            </section>
          )}
          <p className="px-1 text-xs text-slate-400">Aangemaakt op {formatDate(invoice.invoiceDate)}</p>
        </aside>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={() => save()} disabled={saving || !dirty} className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {dirty ? "Wijzigingen opslaan" : "Opgeslagen"}
        </Button>
      </div>
    </div>
  );
}
