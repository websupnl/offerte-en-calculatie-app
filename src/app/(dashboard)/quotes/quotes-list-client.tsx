"use client";

import { roleLabel } from "@/lib/calculation-role";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowUpRight, Calculator, Copy, FileText, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/confirm-provider";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";

type Quote = {
  id: string;
  number: string | null;
  title: string | null;
  status: string;
  validUntil: string | null;
  totalIncVat: string | number;
  createdAt: string;
  sentAt: string | null;
  sendCount: number;
  customer: { id: string; name: string; email: string | null };
  archivedAt: string | null;
  _count: { items: number };
  choiceGroupCount: number;
  linkedCalculations: { id: string; number: string; title: string; role: string }[];
  pricing: {
    hasChoices: boolean;
    minimum: { totalIncVat: number };
    maximum: { totalIncVat: number };
    recommended: { totalIncVat: number };
  };
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "outline",
  VIEWED: "outline",
  ACCEPTED: "default",
  DECLINED: "destructive",
  EXPIRED: "destructive",
};

const statuses = ["open", "DRAFT", "SENT", "VIEWED", "ACCEPTED", "EXPIRED", "DECLINED", "all"] as const;

/** "Open" is het werk dat nog loopt. Geaccepteerd, afgewezen en verlopen is afgehandeld. */
const OPEN_STATUSES = ["DRAFT", "SENT", "VIEWED"];

const FILTER_LABELS: Record<(typeof statuses)[number], string> = {
  open: "Open",
  all: "Alles",
  DRAFT: QUOTE_STATUS_LABELS.DRAFT,
  SENT: QUOTE_STATUS_LABELS.SENT,
  VIEWED: QUOTE_STATUS_LABELS.VIEWED,
  ACCEPTED: "Opdracht",
  EXPIRED: QUOTE_STATUS_LABELS.EXPIRED,
  DECLINED: QUOTE_STATUS_LABELS.DECLINED,
};

function matchesStatus(quote: Quote, filter: (typeof statuses)[number]) {
  if (filter === "all") return true;
  if (filter === "open") return OPEN_STATUSES.includes(quote.status);
  return quote.status === filter;
}

/** Calculaties die samen de prijs van de offerte bepalen, elk klikbaar naar de calculatie. */
function CalculationLabels({ quote }: { quote: Quote }) {
  if (quote.linkedCalculations.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {quote.linkedCalculations.map((calculation) => (
        <Link
          key={calculation.id}
          href={`/calculations/${calculation.id}`}
          title={`${calculation.number}: ${calculation.title}`}
          className="inline-flex max-w-56 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Calculator className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-semibold">{roleLabel(calculation.role)}</span>
          <span className="truncate text-muted-foreground">{calculation.number}</span>
        </Link>
      ))}
    </div>
  );
}

const SENT_STATES = ["SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"];

function SentMarker({ quote }: { quote: Quote }) {
  if (quote.sentAt) {
    return (
      <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
        Verstuurd {formatDate(quote.sentAt)}
        {quote.sendCount > 1 ? ` · ${quote.sendCount}x` : ""}
      </p>
    );
  }
  if (SENT_STATES.includes(quote.status)) {
    return <p className="mt-1 text-sm text-amber-600">Verzendmoment onbekend</p>;
  }
  return null;
}

function quoteAmount(quote: Quote) {
  if (quote.status === "ACCEPTED" || !quote.pricing.hasChoices) return formatCurrency(Number(quote.totalIncVat));
  return `Vanaf ${formatCurrency(quote.pricing.minimum.totalIncVat)}`;
}

export function QuotesListClient({
  initialQuotes,
  showArchived = false,
  initialStatusFilter = "open",
}: {
  initialQuotes: Quote[];
  showArchived?: boolean;
  initialStatusFilter?: (typeof statuses)[number];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statuses)[number]>(initialStatusFilter);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "archive" | "restore" | "delete") {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete") {
      const ok = await confirm({
        title: `${ids.length} offerte${ids.length === 1 ? "" : "s"} verwijderen?`,
        body: "Definitief, inclusief regels en deellinks. Geaccepteerde offertes worden overgeslagen. Archiveren houdt ze bewaard.",
        confirmLabel: "Verwijderen",
        destructive: true,
      });
      if (!ok) return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/quotes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulkactie mislukt");
      const verb =
        action === "archive" ? "gearchiveerd" : action === "restore" ? "teruggezet" : "verwijderd";
      toast.success(
        `${data.affected} offerte${data.affected === 1 ? "" : "s"} ${verb}` +
          (data.skipped ? ` · ${data.skipped} overgeslagen (geaccepteerd)` : ""),
      );
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setBulkBusy(false);
    }
  }

  async function archiveQuote(quote: Quote, archived: boolean) {
    setBusyId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Mislukt");
      toast.success(archived ? "Offerte gearchiveerd" : "Offerte teruggezet");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateQuote(quote: Quote) {
    setBusyId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dupliceren mislukt");
      toast.success(`Gedupliceerd als ${data.number}`);
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
      setBusyId(null);
    }
  }

  async function deleteQuote(quote: Quote) {
    const ok = await confirm({
      title: "Offerte verwijderen?",
      body: `${quote.title || quote.number || "Conceptofferte"} wordt definitief verwijderd, inclusief regels en deellinks. Archiveren houdt hem bewaard.`,
      confirmLabel: "Verwijderen",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      toast.success("Offerte verwijderd");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setBusyId(null);
    }
  }

  function RowMenu({ quote }: { quote: Quote }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Acties"
          disabled={busyId === quote.id}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => router.push(`/quotes/${quote.id}`)}>
            <ArrowUpRight className="h-4 w-4" /> Openen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicateQuote(quote)}>
            <Copy className="h-4 w-4" /> Dupliceren
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {quote.archivedAt ? (
            <DropdownMenuItem onClick={() => archiveQuote(quote, false)}>
              <ArchiveRestore className="h-4 w-4" /> Herstellen
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => archiveQuote(quote, true)}>
              <Archive className="h-4 w-4" /> Archiveren
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => deleteQuote(quote)}>
            <Trash2 className="h-4 w-4" /> Verwijderen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initialQuotes.filter((quote) => {
      const matchesQuery =
        !query ||
        (quote.number ?? "concept").toLowerCase().includes(query) ||
        quote.title?.toLowerCase().includes(query) ||
        quote.customer.name.toLowerCase().includes(query);
      return matchesQuery && matchesStatus(quote, statusFilter);
    });
  }, [initialQuotes, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = {} as Record<(typeof statuses)[number], number>;
    for (const status of statuses) counts[status] = initialQuotes.filter((quote) => matchesStatus(quote, status)).length;
    return counts;
  }, [initialQuotes]);

  const openPricing = initialQuotes
    .filter((quote) => ["SENT", "VIEWED"].includes(quote.status))
    .reduce(
      (totals, quote) => ({
        minimum: totals.minimum + quote.pricing.minimum.totalIncVat,
        maximum: totals.maximum + quote.pricing.maximum.totalIncVat,
      }),
      { minimum: 0, maximum: 0 },
    );
  const openValueLabel =
    openPricing.minimum === openPricing.maximum
      ? formatCurrency(openPricing.minimum)
      : `${formatCurrency(openPricing.minimum)} - ${formatCurrency(openPricing.maximum)}`;

  return (
    <div>
      <PageHeader
        eyebrow="Verkoop"
        title="Offertes"
        description={showArchived
          ? `${initialQuotes.length} gearchiveerde offertes`
          : initialStatusFilter === "EXPIRED"
            ? `${initialQuotes.length} verlopen offertes getoond`
            : `${filtered.length} offertes getoond · ${openValueLabel} open bij de klant`}
        actions={
          <Button nativeButton={false} render={<Link href="/quotes/new" />}>
            <Plus className="h-4 w-4" />
            Nieuwe offerte
          </Button>
        }
      />

      <div className="space-y-3 p-4 sm:p-5 lg:px-8 lg:py-5">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op nummer, titel of klant..."
              className="h-9 rounded-lg border-border bg-background pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {statuses.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "ghost"}
                size="sm"
                disabled={showArchived}
                onClick={() => {
                  if (initialStatusFilter === "EXPIRED" && status !== "EXPIRED") {
                    router.push(`/quotes?status=${status}`);
                    return;
                  }
                  setStatusFilter(status);
                }}
                className={`shrink-0 rounded-full ${statusFilter === status ? "bg-[var(--ws-accent)] hover:bg-[var(--ws-accent-hover)]" : ""}`}
              >
                {FILTER_LABELS[status]}
                {!showArchived && <span className="tabular-nums opacity-70">{statusCounts[status]}</span>}
              </Button>
            ))}
            <Button
              variant={showArchived ? "default" : "ghost"}
              size="sm"
              onClick={() => router.push(showArchived ? "/quotes" : "/quotes?archived=1")}
              className={`shrink-0 rounded-full ${showArchived ? "bg-[var(--ws-accent)] hover:bg-[var(--ws-accent-hover)]" : ""}`}
            >
              <Archive className="h-3.5 w-3.5" />
              Archief
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm text-background shadow-none">
            <span className="font-semibold">
              {selected.size} geselecteerd
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {showArchived ? (
                <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulk("restore")}>
                  <ArchiveRestore className="h-4 w-4" /> Herstellen
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulk("archive")}>
                  <Archive className="h-4 w-4" /> Archiveren
                </Button>
              )}
              <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => runBulk("delete")}>
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-card/10 hover:text-white"
                onClick={() => setSelected(new Set())}
              >
                Annuleren
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {filtered.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-semibold text-foreground">Geen offertes gevonden</p>
                <p className="mt-1 text-sm text-muted-foreground">Pas je zoekopdracht of statusfilter aan.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {filtered.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/quotes/${quote.id}`}
                    className={`block p-4 active:bg-muted/40 ${selected.has(quote.id) ? "bg-[var(--ws-accent-soft)]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Selecteer ${quote.title || quote.number || "concept"}`}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--ws-accent)]"
                          checked={selected.has(quote.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleOne(quote.id);
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{quote.title || quote.number || "Conceptofferte"}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {quote.number ?? "Concept zonder nummer"} · {quote.customer.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-start gap-1 text-right">
                        <div>
                          <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                            {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                          </Badge>
                          <SentMarker quote={quote} />
                        </div>
                        <RowMenu quote={quote} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3 text-sm">
                      <div className="min-w-0 text-muted-foreground">
                        <p className={quote.status === "EXPIRED" ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                          {quote.validUntil ? `${quote.status === "EXPIRED" ? "Verlopen" : "Geldig tot"} ${formatDate(quote.validUntil)}` : formatDate(quote.createdAt)}
                        </p>
                        <p className="truncate text-sm">
                          {quote._count.items} regels
                          {quote.choiceGroupCount > 0 ? ` · ${quote.choiceGroupCount} keuzes` : ""}
                          {quote.linkedCalculations.length > 0
                            ? ` · ${quote.linkedCalculations.map((calculation) => `${roleLabel(calculation.role)} ${calculation.number}`).join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-right font-bold tabular-nums">{quoteAmount(quote)}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-10 pl-4">
                        <input
                          type="checkbox"
                          aria-label="Alles selecteren"
                          className="h-4 w-4 cursor-pointer accent-[var(--ws-accent)] align-middle"
                          checked={filtered.length > 0 && filtered.every((q) => selected.has(q.id))}
                          ref={(el) => {
                            if (el)
                              el.indeterminate =
                                filtered.some((q) => selected.has(q.id)) &&
                                !filtered.every((q) => selected.has(q.id));
                          }}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? new Set(filtered.map((q) => q.id))
                                : new Set(),
                            )
                          }
                        />
                      </TableHead>
                      <TableHead>Offerte</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Geldig tot</TableHead>
                      <TableHead className="text-right">Bedrag incl.</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((quote) => (
                      <TableRow
                        key={quote.id}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open offerte ${quote.title || quote.number || "concept"}`}
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/quotes/${quote.id}`);
                          }
                        }}
                        className={`group cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ws-accent)] ${selected.has(quote.id) ? "bg-[var(--ws-accent-soft)]" : ""}`}
                      >
                        <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Selecteer ${quote.title || quote.number || "concept"}`}
                            className="h-4 w-4 cursor-pointer accent-[var(--ws-accent)] align-middle"
                            checked={selected.has(quote.id)}
                            onChange={() => toggleOne(quote.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link href={`/quotes/${quote.id}`} className="block hover:underline" onClick={(event) => event.stopPropagation()}>
                            <p className="max-w-80 truncate font-semibold text-foreground">{quote.title || quote.number || "Conceptofferte"}</p>
                            <p className="text-sm text-muted-foreground">
                              {quote.number ?? "Concept zonder nummer"} · {quote._count.items} vaste regels
                              {quote.choiceGroupCount > 0 ? ` · ${quote.choiceGroupCount} keuze${quote.choiceGroupCount === 1 ? "" : "s"}` : ""}
                            </p>
                          </Link>
                          <CalculationLabels quote={quote} />
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Link href={`/customers/${quote.customer.id}`} className="block max-w-56 truncate font-medium hover:underline">{quote.customer.name}</Link>
                          <p className="max-w-56 truncate text-sm text-muted-foreground">{quote.customer.email || "Geen e-mail"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                            {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                          </Badge>
                          <SentMarker quote={quote} />
                        </TableCell>
                        <TableCell className={quote.status === "EXPIRED" ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                          {quote.validUntil ? formatDate(quote.validUntil) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {quote.status === "ACCEPTED" || !quote.pricing.hasChoices ? (
                            <span className="font-bold">{formatCurrency(Number(quote.totalIncVat))}</span>
                          ) : (
                            <>
                              <p className="font-bold">Vanaf {formatCurrency(quote.pricing.minimum.totalIncVat)}</p>
                              <p className="text-sm font-normal text-muted-foreground">
                                Advies {formatCurrency(quote.pricing.recommended.totalIncVat)}
                              </p>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <RowMenu quote={quote} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} van {initialQuotes.length} offertes zichtbaar
        </p>
      </div>
    </div>
  );
}
