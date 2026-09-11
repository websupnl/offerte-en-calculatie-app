"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

type Subscription = {
  id: string;
  clientName: string;
  serviceName: string;
  priceCents: number;
  vatRate: number;
  currency: string;
  billingCycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
  startDate: string;
  nextBillingDate: string;
  lastInvoicedAt: string | null;
  status: string;
  migrationPending: boolean;
  notes: string | null;
};

type HistoryEvent = {
  type: string;
  detail: string | null;
  amountCents: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  actor: string | null;
  occurredAt: string;
};

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "per maand",
  QUARTERLY: "per kwartaal",
  YEARLY: "per jaar",
};
const METHOD_LABEL: Record<string, string> = {
  DIGITAL: "Digitaal akkoord (portaal)",
  VERBAL_CONFIRMED: "Mondeling bevestigd",
  EMAIL_ACCEPTANCE: "Akkoord via betaling",
};
const EVENT_LABEL: Record<string, string> = {
  CREATED: "Aangemaakt",
  INVOICED: "Gefactureerd",
  PRICE_CHANGED: "Prijs gewijzigd",
  PAUSED: "Gepauzeerd",
  RESUMED: "Hervat",
  CANCELLED: "Opgezegd",
  NOTE: "Notitie",
};

const euro = (cents: number) => formatCurrency(cents / 100);

export function SubscriptionDetailClient({
  subscription,
  history,
  quote,
  customer,
  agreementLogs,
}: {
  subscription: Subscription;
  history: HistoryEvent[];
  quote: { id: string; number: string; title: string | null } | null;
  customer: { id: string; name: string; email: string | null } | null;
  agreementLogs: { occurredAt: string; method: string; avVersion: string | null; ip: string | null }[];
}) {
  const router = useRouter();
  const [sub, setSub] = useState(subscription);
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [priceEuro, setPriceEuro] = useState((subscription.priceCents / 100).toFixed(2));
  const [nextBillingDate, setNextBillingDate] = useState(subscription.nextBillingDate);
  const [notes, setNotes] = useState(subscription.notes ?? "");

  async function patch(body: Record<string, unknown>, successMsg: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Mislukt");
      setSub(result);
      toast.success(successMsg);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  async function markInvoiced() {
    setInvoicing(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/invoiced`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Mislukt");
      if (result.status === "already_invoiced") {
        toast.info("Deze periode was al gefactureerd.");
      } else {
        toast.success("Genoteerd als gefactureerd.");
      }
      setSub(result.subscription);
      setNextBillingDate(result.subscription.nextBillingDate);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis");
    } finally {
      setInvoicing(false);
    }
  }

  return (
    <div>
      <Link
        href="/subscriptions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Alle abonnementen
      </Link>

      <PageHeader
        eyebrow="Abonnement"
        title={sub.serviceName}
        description={`${sub.clientName} · ${euro(sub.priceCents)} ${CYCLE_LABEL[sub.billingCycle]} (ex btw)`}
        actions={
          sub.status !== "CANCELLED" && (
            <Button onClick={markInvoiced} disabled={invoicing}>
              {invoicing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Gefactureerd
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Gegevens
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Bedrag per periode (ex btw)</Label>
                <div className="flex gap-2">
                  <Input value={priceEuro} inputMode="decimal" onChange={(e) => setPriceEuro(e.target.value)} />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      patch(
                        { priceCents: Math.round(Number(priceEuro.replace(",", ".")) * 100) },
                        "Prijs bijgewerkt",
                      )
                    }
                  >
                    Opslaan
                  </Button>
                </div>
              </div>
              <div>
                <Label>Volgende factuurdatum</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={nextBillingDate}
                    onChange={(e) => setNextBillingDate(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => patch({ nextBillingDate }, "Datum bijgewerkt")}
                  >
                    Opslaan
                  </Button>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={sub.status}
                  onValueChange={(v) => v && patch({ status: v }, "Status bijgewerkt")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Actief</SelectItem>
                    <SelectItem value="PAUSED">Gepauzeerd</SelectItem>
                    <SelectItem value="CANCELLED">Opgezegd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cyclus</Label>
                <Input value={CYCLE_LABEL[sub.billingCycle]} disabled />
              </div>
            </div>
            <div className="mt-3">
              <Label>Notitie</Label>
              <div className="flex gap-2">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => patch({ notes }, "Notitie opgeslagen")}
                >
                  Opslaan
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Historie
            </h2>
            <ol className="space-y-3">
              {history.map((event, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                  <div>
                    <p className="font-medium">
                      {EVENT_LABEL[event.type] ?? event.type}
                      {event.amountCents != null && ` — ${euro(event.amountCents)}`}
                    </p>
                    {event.detail && <p className="text-muted-foreground">{event.detail}</p>}
                    {event.periodStart && event.periodEnd && (
                      <p className="text-xs text-muted-foreground">
                        Periode {formatDate(event.periodStart)} – {formatDate(event.periodEnd)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.occurredAt)}
                      {event.actor && ` · ${event.actor}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Herkomst
            </h2>
            {customer && (
              <p>
                Klant:{" "}
                <Link href={`/customers/${customer.id}`} className="underline">
                  {customer.name}
                </Link>
              </p>
            )}
            {quote ? (
              <p>
                Offerte:{" "}
                <Link href={`/quotes/${quote.id}`} className="underline">
                  {quote.number}
                </Link>
              </p>
            ) : (
              <p className="text-muted-foreground">Handmatig aangemaakt (geen offerte).</p>
            )}
            <p className="mt-1 text-muted-foreground">Gestart op {formatDate(sub.startDate)}</p>
            {sub.lastInvoicedAt && (
              <p className="text-muted-foreground">
                Laatst gefactureerd {formatDateTime(sub.lastInvoicedAt)}
              </p>
            )}
          </section>

          <section className="rounded-xl border p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Akkoord
            </h2>
            {agreementLogs.length === 0 ? (
              <p className="text-muted-foreground">
                Geen formeel akkoord vastgelegd voor de bronofferte.
              </p>
            ) : (
              agreementLogs.map((log, i) => (
                <div key={i} className="mb-2">
                  <Badge variant="secondary">{METHOD_LABEL[log.method] ?? log.method}</Badge>
                  <p className="mt-1 text-muted-foreground">
                    {formatDateTime(log.occurredAt)}
                    {log.avVersion && ` · AV ${log.avVersion}`}
                    {log.ip && ` · ${log.ip}`}
                  </p>
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
