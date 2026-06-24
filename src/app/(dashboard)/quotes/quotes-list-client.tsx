"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";

type Quote = {
  id: string;
  number: string;
  title: string | null;
  status: string;
  totalIncVat: string | number;
  createdAt: string;
  customer: { id: string; name: string; email: string | null };
  _count: { items: number };
  choiceGroupCount: number;
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
  EXPIRED: "secondary",
};

const statuses = ["all", "DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED"] as const;

export function QuotesListClient({ initialQuotes }: { initialQuotes: Quote[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statuses)[number]>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return initialQuotes.filter((quote) => {
      const matchesQuery =
        !query ||
        quote.number.toLowerCase().includes(query) ||
        quote.title?.toLowerCase().includes(query) ||
        quote.customer.name.toLowerCase().includes(query);
      return matchesQuery && (statusFilter === "all" || quote.status === statusFilter);
    });
  }, [initialQuotes, search, statusFilter]);

  const openPricing = initialQuotes
    .filter((quote) => ["DRAFT", "SENT", "VIEWED"].includes(quote.status))
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
      : `${formatCurrency(openPricing.minimum)} – ${formatCurrency(openPricing.maximum)}`;

  return (
    <div>
      <PageHeader
        eyebrow="Verkoop"
        title="Offertes"
        description={`${initialQuotes.length} offertes · ${openValueLabel} openstaand`}
        actions={
          <Button nativeButton={false} render={<Link href="/quotes/new" />}>
            <Plus className="h-4 w-4" />
            Nieuwe offerte
          </Button>
        }
      />

      <div className="space-y-4 p-5 lg:p-8">
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Zoek op nummer, titel of klant…"
              className="h-9 border-slate-200 bg-slate-50 pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {statuses.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? "bg-[#167f88] hover:bg-[#116b73]" : ""}
              >
                {status === "all" ? "Alle" : QUOTE_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-semibold text-slate-700">Geen offertes gevonden</p>
                <p className="mt-1 text-sm text-slate-400">Pas je zoekopdracht of statusfilter aan.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">Offerte</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
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
                    aria-label={`Open offerte ${quote.title || quote.number}`}
                    onClick={() => router.push(`/quotes/${quote.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/quotes/${quote.id}`);
                      }
                    }}
                    className="group cursor-pointer focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#167f88]"
                  >
                    <TableCell className="pl-4">
                      <Link href={`/quotes/${quote.id}`} className="block" onClick={(event) => event.stopPropagation()}>
                        <p className="max-w-80 truncate font-semibold text-slate-900">{quote.title || quote.number}</p>
                        <p className="text-xs text-slate-400">
                          {quote.number} · {quote._count.items} vaste regels
                          {quote.choiceGroupCount > 0 ? ` · ${quote.choiceGroupCount} keuze${quote.choiceGroupCount === 1 ? "" : "s"}` : ""}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-56 truncate font-medium">{quote.customer.name}</p>
                      <p className="max-w-56 truncate text-xs text-slate-400">{quote.customer.email || "Geen e-mail"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>
                        {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{formatDate(quote.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {quote.status === "ACCEPTED" || !quote.pricing.hasChoices ? (
                        <span className="font-bold">{formatCurrency(Number(quote.totalIncVat))}</span>
                      ) : (
                        <>
                          <p className="font-bold">Vanaf {formatCurrency(quote.pricing.minimum.totalIncVat)}</p>
                          <p className="text-xs font-normal text-slate-400">
                            Advies {formatCurrency(quote.pricing.recommended.totalIncVat)}
                          </p>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/quotes/${quote.id}`} onClick={(event) => event.stopPropagation()} className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="text-xs text-slate-400">{filtered.length} van {initialQuotes.length} offertes zichtbaar</p>
      </div>
    </div>
  );
}
