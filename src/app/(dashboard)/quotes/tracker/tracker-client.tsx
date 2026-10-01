"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Eye, MailCheck, ThumbsDown, ThumbsUp, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, QUOTE_STATUS_LABELS } from "@/lib/format";

type TrackedQuote = {
  id: string;
  number: string | null;
  title: string | null;
  status: string;
  sentAt: string;
  lastSentAt: string | null;
  sendCount: number;
  customer: { id: string; name: string; email: string | null };
  share: {
    viewedAt: string | null;
    lastViewedAt: string | null;
    viewCount: number;
    acceptedAt: string | null;
    declinedAt: string | null;
  } | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SENT: "outline",
  VIEWED: "outline",
  ACCEPTED: "default",
  DECLINED: "destructive",
  EXPIRED: "secondary",
};

const filters = ["all", "unopened", "waiting", "ACCEPTED", "DECLINED"] as const;
const FILTER_LABELS: Record<(typeof filters)[number], string> = {
  all: "Alle",
  unopened: "Nog niet geopend",
  waiting: "Wacht op reactie",
  ACCEPTED: "Geaccepteerd",
  DECLINED: "Afgewezen",
};

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function TrackerClient({ initialQuotes }: { initialQuotes: TrackedQuote[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");

  const filtered = useMemo(() => {
    return initialQuotes.filter((quote) => {
      if (filter === "all") return true;
      if (filter === "unopened") return !quote.share?.viewCount && !quote.share?.acceptedAt && !quote.share?.declinedAt;
      if (filter === "waiting") return quote.status === "SENT" || quote.status === "VIEWED";
      return quote.status === filter;
    });
  }, [initialQuotes, filter]);

  const totalSent = initialQuotes.length;
  const totalOpened = initialQuotes.filter((q) => (q.share?.viewCount ?? 0) > 0).length;
  const totalAccepted = initialQuotes.filter((q) => q.status === "ACCEPTED").length;
  const totalWaiting = initialQuotes.filter((q) => q.status === "SENT" || q.status === "VIEWED").length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const conversionRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;

  const metrics = [
    { label: "Verstuurd", value: String(totalSent), meta: "offertes per e-mail", icon: MailCheck, color: "text-primary", surface: "bg-primary/10" },
    { label: "Geopend", value: `${openRate}%`, meta: `${totalOpened} van ${totalSent} bekeken`, icon: Eye, color: "text-primary", surface: "bg-primary/10" },
    { label: "Wacht op reactie", value: String(totalWaiting), meta: "nog geen antwoord", icon: TimerReset, color: "text-amber-600", surface: "bg-amber-50" },
    { label: "Conversie", value: `${conversionRate}%`, meta: `${totalAccepted} geaccepteerd`, icon: ThumbsUp, color: "text-emerald-700 dark:text-emerald-400", surface: "bg-emerald-500/10" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Verkoop"
        title="Verzendtracker"
        description="Volg per verstuurde offerte of, en hoe vaak, de klant heeft gekeken."
      />

      <div className="space-y-4 p-4 sm:p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${metric.surface} ${metric.color}`}>
                  <metric.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">{metric.label}</p>
              </div>
              <p className="mt-4 text-[26px] font-bold leading-none tracking-tight text-foreground">{metric.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{metric.meta}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
          {filters.map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full ${filter === f ? "bg-[var(--ws-accent)] hover:bg-[var(--ws-accent-hover)]" : ""}`}
            >
              {FILTER_LABELS[f]}
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-border">
          {filtered.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <MailCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-semibold text-foreground">Geen offertes in dit filter</p>
                <p className="mt-1 text-sm text-muted-foreground">Verstuur een offerte per e-mail om hem hier te zien verschijnen.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {filtered.map((quote) => {
                  const opened = !!quote.share?.viewCount;
                  const idle = !opened && !quote.share?.acceptedAt && !quote.share?.declinedAt && daysSince(quote.sentAt) >= 3;
                  return (
                    <Link key={quote.id} href={`/quotes/${quote.id}`} className="block p-4 active:bg-muted/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{quote.title || quote.number || "Conceptofferte"}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {quote.number ?? "Concept zonder nummer"} · {quote.customer.name}
                          </p>
                        </div>
                        <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                          {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3 text-sm">
                        <div className="min-w-0 text-muted-foreground">
                          <p>Verstuurd {formatDate(quote.sentAt)}</p>
                          <p className="truncate text-sm">
                            {opened ? `${quote.share?.viewCount}x bekeken` : idle ? `${daysSince(quote.sentAt)} dagen niet geopend` : "Nog niet geopend"}
                          </p>
                        </div>
                        {idle && <Badge variant="outline" className="border-amber-300 text-amber-700">Follow-up</Badge>}
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="pl-4">Offerte</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Verstuurd</TableHead>
                      <TableHead>Geopend</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((quote) => {
                      const opened = !!quote.share?.viewCount;
                      const idle = !opened && !quote.share?.acceptedAt && !quote.share?.declinedAt && daysSince(quote.sentAt) >= 3;
                      return (
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
                          className="group cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ws-accent)]"
                        >
                          <TableCell className="pl-4">
                            <Link href={`/quotes/${quote.id}`} className="block" onClick={(event) => event.stopPropagation()}>
                              <p className="max-w-72 truncate font-semibold text-foreground">{quote.title || quote.number || "Conceptofferte"}</p>
                              <p className="text-sm text-muted-foreground">{quote.number ?? "Concept zonder nummer"}</p>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-56 truncate font-medium">{quote.customer.name}</p>
                            <p className="max-w-56 truncate text-sm text-muted-foreground">{quote.customer.email || "Geen e-mail"}</p>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <p>{formatDate(quote.sentAt)}</p>
                            {quote.sendCount > 1 && <p className="text-sm text-muted-foreground">{quote.sendCount}x verstuurd</p>}
                          </TableCell>
                          <TableCell>
                            {opened ? (
                              <div className="flex items-center gap-1.5 text-foreground">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                                <span>{quote.share?.viewCount}x</span>
                                {quote.share?.lastViewedAt && (
                                  <span className="text-sm text-muted-foreground">· {formatDateTime(quote.share.lastViewedAt)}</span>
                                )}
                              </div>
                            ) : idle ? (
                              <Badge variant="outline" className="border-amber-300 text-amber-700">
                                {daysSince(quote.sentAt)}d niet geopend
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Nog niet geopend</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                                {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                              </Badge>
                              {quote.status === "DECLINED" && <ThumbsDown className="h-3.5 w-3.5 text-rose-500" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/quotes/${quote.id}`} onClick={(event) => event.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} van {initialQuotes.length} verstuurde offertes zichtbaar
        </p>
      </div>
    </div>
  );
}
