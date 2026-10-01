import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import { markExpiredQuotes } from "@/lib/quote-expiry";
import { markOverdueInvoices } from "@/lib/invoice-overdue";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Plus, ReceiptText } from "lucide-react";

type AttentionItem = {
  id: string;
  href: string;
  kind: "Vervallen factuur" | "Verlopen offerte" | "Factuur klaar";
  title: string;
  customer: string;
  date: Date | null;
  amount?: number;
  tone: "urgent" | "normal";
};

export default async function DashboardPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) {
    return <div className="p-8 text-base text-muted-foreground">Selecteer een bedrijf in de navigatie.</div>;
  }

  await Promise.all([markExpiredQuotes(companyId), markOverdueInvoices(companyId)]);

  const [quoteStats, invoiceStats, overdueInvoices, expiredQuotes, readyInvoices, recentQuotes] = await Promise.all([
    prisma.quote.groupBy({
      by: ["status"],
      where: { companyId, archivedAt: null },
      _count: true,
    }),
    prisma.salesInvoice.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
      _sum: { totalIncVat: true },
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, status: "VERVALLEN" },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: { id: true, number: true, dueDate: true, totalIncVat: true, customer: { select: { name: true } } },
    }),
    prisma.quote.findMany({
      where: { companyId, archivedAt: null, status: "EXPIRED" },
      orderBy: { validUntil: "asc" },
      take: 5,
      select: { id: true, number: true, title: true, validUntil: true, customer: { select: { name: true } } },
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, status: "GEREED" },
      orderBy: { invoiceDate: "asc" },
      take: 3,
      select: { id: true, number: true, invoiceDate: true, totalIncVat: true, customer: { select: { name: true } } },
    }),
    prisma.quote.findMany({
      where: { companyId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, number: true, title: true, status: true, updatedAt: true, customer: { select: { name: true } } },
    }),
  ]);

  const quoteCount = (status: string) => quoteStats.find((row) => row.status === status)?._count ?? 0;
  const invoiceRow = (status: string) => invoiceStats.find((row) => row.status === status);
  const invoiceCount = (status: string) => invoiceRow(status)?._count ?? 0;
  const invoiceAmount = (status: string) => Number(invoiceRow(status)?._sum.totalIncVat ?? 0);
  const overdueCount = invoiceCount("VERVALLEN");
  const expiredCount = quoteCount("EXPIRED");
  const readyCount = invoiceCount("GEREED");
  const attentionCount = overdueCount + expiredCount + readyCount;

  const metrics = [
    {
      label: "Openstaande facturen",
      value: formatCurrency(invoiceAmount("VERZONDEN") + invoiceAmount("VERVALLEN")),
      detail: `${invoiceCount("VERZONDEN") + overdueCount} nog niet betaald`,
      href: "/invoices",
    },
    {
      label: "Over de vervaldatum",
      value: formatCurrency(invoiceAmount("VERVALLEN")),
      detail: `${overdueCount} factuur${overdueCount === 1 ? "" : "en"} opvolgen`,
      href: "/invoices?view=overdue",
      urgent: overdueCount > 0,
    },
    {
      label: "Offertes bij klant",
      value: String(quoteCount("SENT") + quoteCount("VIEWED")),
      detail: "Verstuurd of bekeken",
      href: "/quotes",
    },
    {
      label: "Verlopen offertes",
      value: String(expiredCount),
      detail: "Prijs en inhoud opnieuw controleren",
      href: "/quotes?status=EXPIRED",
      urgent: expiredCount > 0,
    },
  ];

  const attention: AttentionItem[] = [
    ...overdueInvoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      href: `/invoices/${invoice.id}`,
      kind: "Vervallen factuur" as const,
      title: invoice.number,
      customer: invoice.customer.name,
      date: invoice.dueDate,
      amount: Number(invoice.totalIncVat),
      tone: "urgent" as const,
    })),
    ...expiredQuotes.map((quote) => ({
      id: `quote-${quote.id}`,
      href: `/quotes/${quote.id}`,
      kind: "Verlopen offerte" as const,
      title: quote.title || quote.number || "Conceptofferte",
      customer: `${quote.number ?? "Concept"} · ${quote.customer.name}`,
      date: quote.validUntil,
      tone: "urgent" as const,
    })),
    ...readyInvoices.map((invoice) => ({
      id: `ready-${invoice.id}`,
      href: `/invoices/${invoice.id}`,
      kind: "Factuur klaar" as const,
      title: invoice.number,
      customer: invoice.customer.name,
      date: invoice.invoiceDate,
      amount: Number(invoice.totalIncVat),
      tone: "normal" as const,
    })),
  ].slice(0, 8);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow="Start"
        title="Werkoverzicht"
        description="Wat aandacht vraagt, met bedragen en vervaldatums uit je administratie."
        actions={
          <Button nativeButton={false} render={<Link href="/quotes/new" />}>
            <Plus className="h-4 w-4" /> Nieuwe offerte
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-5 lg:px-8 lg:py-5">
        <section aria-label="Kerncijfers" className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Link key={metric.label} href={metric.href} className="group min-w-0 border-b border-border p-4 transition-colors hover:bg-muted/50 sm:border-r sm:p-5 xl:border-b-0">
              <p className="text-sm font-semibold text-muted-foreground">{metric.label}</p>
              <p className={`mt-2 truncate text-[26px] font-bold leading-tight tabular-nums tracking-tight ${metric.urgent ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
            </Link>
          ))}
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Nu opvolgen</h2>
                <p className="text-sm text-muted-foreground">{attentionCount} {attentionCount === 1 ? "post vraagt" : "posten vragen"} aandacht</p>
              </div>
              <Link href="/invoices?view=overdue" className="text-sm font-semibold text-[var(--ws-accent)] hover:underline">Vervallen facturen</Link>
            </div>
            {attention.length === 0 ? (
              <div className="px-5 py-10 text-base text-muted-foreground">
                Geen vervallen posten of facturen klaar voor verzending. Je werkvoorraad is bijgewerkt.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {attention.map((item) => (
                  <Link key={item.id} href={item.href} className="group flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.tone === "urgent" ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-muted text-foreground"}`}>
                      {item.kind === "Verlopen offerte" ? <FileText className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-foreground">{item.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{item.customer}</span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      <span className={`block text-sm font-semibold ${item.tone === "urgent" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{item.kind}</span>
                      <span className="block text-sm text-muted-foreground">{item.date ? formatDate(item.date) : "Geen datum"}</span>
                    </span>
                    {item.amount !== undefined && <strong className="hidden min-w-28 text-right text-base tabular-nums text-foreground md:block">{formatCurrency(item.amount)}</strong>}
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            )}
            {attentionCount > attention.length && (
              <div className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
                Nog {attentionCount - attention.length} posten. Bekijk de gefilterde offerte- en factuurlijsten voor het volledige overzicht.
              </div>
            )}
          </section>

          <aside className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <h2 className="text-lg font-bold text-foreground">Recent bijgewerkt</h2>
              <p className="text-sm text-muted-foreground">De laatste offertes binnen dit bedrijf</p>
            </div>
            {recentQuotes.length === 0 ? (
              <p className="px-5 py-6 text-base text-muted-foreground">Nog geen offertes.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentQuotes.map((quote) => (
                  <Link key={quote.id} href={`/quotes/${quote.id}`} className="block px-4 py-3 hover:bg-muted/50 sm:px-5">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-base font-semibold text-foreground">{quote.title || quote.number || "Conceptofferte"}</span>
                      <Badge variant={quote.status === "EXPIRED" || quote.status === "DECLINED" ? "destructive" : "outline"} className="shrink-0">
                        {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                      </Badge>
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">{quote.number ?? "Concept zonder nummer"} · {quote.customer.name} · {formatDate(quote.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/quotes" className="flex items-center justify-between border-t border-border px-4 py-3 text-sm font-semibold text-[var(--ws-accent)] hover:bg-muted/50 sm:px-5">
              Alle offertes <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
