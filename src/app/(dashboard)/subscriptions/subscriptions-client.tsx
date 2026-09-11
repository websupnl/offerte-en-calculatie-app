"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Repeat, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

type Subscription = {
  id: string;
  clientRef: string | null;
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
  sourceQuoteId: string | null;
  migrationPending: boolean;
  notes: string | null;
};

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "per maand",
  QUARTERLY: "per kwartaal",
  YEARLY: "per jaar",
};
const CYCLE_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  CANCELLED: "Opgezegd",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  CANCELLED: "outline",
};

const euro = (cents: number) => formatCurrency(cents / 100);

export function SubscriptionsClient({
  initialSubscriptions,
  due,
  customers,
}: {
  initialSubscriptions: Subscription[];
  due: Subscription[];
  customers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [dueList, setDueList] = useState(due);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [invoicing, setInvoicing] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const mrrCents = useMemo(
    () =>
      subscriptions
        .filter((s) => s.status === "ACTIVE")
        .reduce((sum, s) => sum + Math.round(s.priceCents / CYCLE_MONTHS[s.billingCycle]), 0),
    [subscriptions],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subscriptions.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!query) return true;
      return (
        s.clientName.toLowerCase().includes(query) ||
        s.serviceName.toLowerCase().includes(query)
      );
    });
  }, [subscriptions, search, statusFilter]);

  async function markInvoiced(id: string) {
    setInvoicing(id);
    try {
      const res = await fetch(`/api/subscriptions/${id}/invoiced`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Mislukt");
      if (result.status === "already_invoiced") {
        toast.info("Deze periode was al gefactureerd.");
      } else {
        toast.success("Genoteerd als gefactureerd. Volgende datum verschoven.");
      }
      const updated: Subscription = result.subscription;
      setSubscriptions((rows) => rows.map((r) => (r.id === id ? updated : r)));
      setDueList((rows) => rows.filter((r) => r.id !== id));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis");
    } finally {
      setInvoicing(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Abonnementen"
        description={
          mrrCents > 0
            ? `Hosting, domeinen en service-afspraken. ${euro(mrrCents)} terugkerend per maand.`
            : "Hosting, domeinen en service-afspraken met verlengdata."
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nieuw abonnement
          </Button>
        }
      />

      {dueList.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="mb-1 text-base font-semibold text-amber-900 dark:text-amber-200">
            Te factureren — {dueList.length} {dueList.length === 1 ? "abonnement" : "abonnementen"}
          </h2>
          <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
            Volgende factuurdatum binnen 30 dagen, nog niet gefactureerd voor die periode.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead>Dienst</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Factuurdatum</TableHead>
                  <TableHead className="text-right">Actie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueList.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.clientName}</TableCell>
                    <TableCell>{s.serviceName}</TableCell>
                    <TableCell>
                      {euro(s.priceCents)} <span className="text-muted-foreground">{CYCLE_LABEL[s.billingCycle]}</span>
                    </TableCell>
                    <TableCell>{formatDate(s.nextBillingDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={invoicing === s.id}
                        onClick={() => markInvoiced(s.id)}
                      >
                        {invoicing === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Gefactureerd
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek op klant of dienst"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle statussen</SelectItem>
            <SelectItem value="ACTIVE">Actief</SelectItem>
            <SelectItem value="PAUSED">Gepauzeerd</SelectItem>
            <SelectItem value="CANCELLED">Opgezegd</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Repeat className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <p>Nog geen abonnementen. Ze ontstaan automatisch bij een geaccepteerde offerte met een terugkerende regel, of maak er hier handmatig een aan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klant</TableHead>
                <TableHead>Dienst</TableHead>
                <TableHead>Bedrag</TableHead>
                <TableHead>Cyclus</TableHead>
                <TableHead>Volgende factuur</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/subscriptions/${s.id}`)}
                >
                  <TableCell className="font-medium">{s.clientName}</TableCell>
                  <TableCell>
                    {s.serviceName}
                    {s.migrationPending && (
                      <Badge variant="outline" className="ml-2 text-[11px]">
                        migratie
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{euro(s.priceCents)}</TableCell>
                  <TableCell className="text-muted-foreground">{CYCLE_LABEL[s.billingCycle]}</TableCell>
                  <TableCell>{formatDate(s.nextBillingDate)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customers={customers}
        onCreated={(sub) => {
          setSubscriptions((rows) => [sub, ...rows]);
          router.refresh();
        }}
      />
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  customers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: { id: string; name: string }[];
  onCreated: (sub: Subscription) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    clientName: "",
    serviceName: "",
    priceEuro: "",
    billingCycle: "YEARLY" as "MONTHLY" | "QUARTERLY" | "YEARLY",
    startDate: new Date().toISOString().slice(0, 10),
    nextBillingDate: "",
    notes: "",
  });

  async function submit() {
    const priceCents = Math.round(Number(form.priceEuro.replace(",", ".")) * 100);
    if (!form.serviceName.trim() || !Number.isFinite(priceCents) || priceCents < 0) {
      toast.error("Vul een dienst en een geldig bedrag in.");
      return;
    }
    if (!form.customerId && !form.clientName.trim()) {
      toast.error("Kies een klant of vul een naam in.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId || null,
          clientName: form.clientName.trim() || undefined,
          serviceName: form.serviceName.trim(),
          priceCents,
          billingCycle: form.billingCycle,
          startDate: form.startDate,
          nextBillingDate: form.nextBillingDate || undefined,
          notes: form.notes.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.formErrors?.[0] || result.error || "Mislukt");
      onCreated(result);
      onOpenChange(false);
      toast.success("Abonnement aangemaakt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er ging iets mis");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuw abonnement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Klant</Label>
            <Select
              value={form.customerId}
              onValueChange={(v) => setForm((f) => ({ ...f, customerId: v ?? "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Bestaande klant (of laat leeg en vul naam in)" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!form.customerId && (
            <div>
              <Label>Klantnaam (legacy, geen klantrecord)</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              />
            </div>
          )}
          <div>
            <Label>Dienst</Label>
            <Input
              value={form.serviceName}
              placeholder="Hosting & Beheer, Domein websup.nl, ..."
              onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bedrag per periode (ex btw)</Label>
              <Input
                value={form.priceEuro}
                inputMode="decimal"
                placeholder="120,00"
                onChange={(e) => setForm((f) => ({ ...f, priceEuro: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cyclus</Label>
              <Select
                value={form.billingCycle}
                onValueChange={(v) =>
                  v && setForm((f) => ({ ...f, billingCycle: v as "MONTHLY" | "QUARTERLY" | "YEARLY" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">per maand</SelectItem>
                  <SelectItem value="QUARTERLY">per kwartaal</SelectItem>
                  <SelectItem value="YEARLY">per jaar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Volgende factuurdatum (leeg = start + 1 cyclus)</Label>
              <Input
                type="date"
                value={form.nextBillingDate}
                onChange={(e) => setForm((f) => ({ ...f, nextBillingDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Notitie</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
