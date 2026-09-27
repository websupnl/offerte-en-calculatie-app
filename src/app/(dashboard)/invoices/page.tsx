import Link from "next/link";
import { FileText, Plus, ReceiptText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { markOverdueInvoices } from "@/lib/invoice-overdue";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONCEPT: "secondary",
  GEREED: "secondary",
  VERZENDEN: "secondary",
  VERZONDEN: "outline",
  BETAALD: "default",
  VERVALLEN: "destructive",
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const requestedView = (await searchParams).view;
  const view = requestedView === "overdue" || requestedView === "ready" ? requestedView : "all";

  if (companyId) await markOverdueInvoices(companyId);

  const [invoices, invoiceStats] = companyId
    ? await Promise.all([
      prisma.salesInvoice.findMany({
        where: { companyId, ...(view === "overdue" ? { status: "VERVALLEN" } : view === "ready" ? { status: "GEREED" } : {}) },
        orderBy: view === "overdue" ? [{ dueDate: "asc" }] : [{ invoiceDate: "desc" }, { updatedAt: "desc" }],
        include: {
          customer: { select: { name: true } },
          project: { select: { id: true, number: true, title: true } },
          _count: { select: { lines: true } },
        },
        take: 200,
      }),
      prisma.salesInvoice.groupBy({
        by: ["status"],
        where: { companyId },
        _count: true,
        _sum: { totalIncVat: true },
      }),
    ])
    : [[], []];

  const invoiceStat = (status: string) => invoiceStats.find((row) => row.status === status);
  const count = (status: string) => invoiceStat(status)?._count ?? 0;
  const amount = (status: string) => Number(invoiceStat(status)?._sum.totalIncVat ?? 0);
  const stats = [
    { label: "Openstaand", amount: amount("VERZONDEN") + amount("VERVALLEN"), count: count("VERZONDEN") + count("VERVALLEN"), tone: "text-foreground" },
    { label: "Vervallen", amount: amount("VERVALLEN"), count: count("VERVALLEN"), tone: "text-red-600 dark:text-red-400" },
    { label: "Klaar om te versturen", amount: amount("GEREED"), count: count("GEREED"), tone: "text-foreground" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Financieel"
        title="Facturen"
        description="Factureer vanuit een offerte, calculatie, werkbon of met losse artikelen en vrije regels."
        actions={
          <Button nativeButton={false} render={<Link href="/invoices/new" />}>
            <Plus className="h-4 w-4" /> Nieuwe factuur
          </Button>
        }
      />
      <div className="space-y-3 p-4 sm:p-5 lg:px-8 lg:py-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
          {stats.map((st) => (
            <div key={st.label} className="flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground">{st.label}</span>
              <strong className={`tabular-nums ${st.tone}`}>{formatCurrency(st.amount)}</strong>
              <span className="text-sm text-muted-foreground">({st.count})</span>
            </div>
          ))}
        </div>
        <nav aria-label="Facturen filteren" className="flex flex-wrap gap-2 text-base">
          {([
            { value: "all", label: "Alle facturen", href: "/invoices" },
            { value: "overdue", label: `Vervallen (${count("VERVALLEN")})`, href: "/invoices?view=overdue" },
            { value: "ready", label: `Klaar om te versturen (${count("GEREED")})`, href: "/invoices?view=ready" },
          ] as const).map((filter) => (
            <Link key={filter.value} href={filter.href} aria-current={view === filter.value ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 font-medium transition-colors ${view === filter.value ? "border-[var(--ws-accent)] bg-[var(--ws-accent-soft)] text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {filter.label}
            </Link>
          ))}
        </nav>
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y md:hidden">
            {invoices.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="block p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{invoice.number}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{invoice.customer.name}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[invoice.status] ?? "outline"}>
                    {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 text-sm">
                  <div className="min-w-0 text-slate-500">
                    <p className={invoice.status === "VERVALLEN" ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                      {invoice.dueDate ? `Vervalt ${formatDate(invoice.dueDate)}` : formatDate(invoice.invoiceDate)}
                    </p>
                    <p className="truncate text-xs">{invoice.project?.number ?? "Geen project"}</p>
                  </div>
                  <p className="text-right font-bold tabular-nums">{formatCurrency(Number(invoice.totalIncVat))}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-4">Factuur</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead className="hidden lg:table-cell">Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vervaldatum</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="pl-4">
                    <Link href={`/invoices/${invoice.id}`} className="font-semibold text-slate-950 hover:text-[var(--ws-accent)]">
                      {invoice.number}
                    </Link>
                    {invoice.reference && <p className="max-w-72 truncate text-xs text-slate-500">{invoice.reference}</p>}
                  </TableCell>
                  <TableCell>{invoice.customer.name}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {invoice.project ? (
                      <>
                        <Link href={`/projects/${invoice.project.id}`} className="font-medium hover:text-[var(--ws-accent)]">
                          {invoice.project.number}
                        </Link>
                        <p className="max-w-64 truncate text-xs text-slate-500">{invoice.project.title}</p>
                      </>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[invoice.status] ?? "outline"}>
                      {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={invoice.status === "VERVALLEN" ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                    {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(Number(invoice.totalIncVat))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {invoices.length === 0 && (
            <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-slate-500">
              <div>
                <ReceiptText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                <p className="font-semibold text-foreground">{view === "overdue" ? "Geen vervallen facturen" : view === "ready" ? "Geen facturen klaar voor verzending" : "Nog geen facturen"}</p>
                <p className="mt-1">{view === "all" ? "Maak je eerste factuur vanuit een offerte, werkbon of met losse regels." : "Kies Alle facturen om de rest te bekijken."}</p>
                <Button nativeButton={false} variant="outline" className="mt-4" render={<Link href="/invoices/new" />}>
                  <FileText className="h-4 w-4" /> Nieuwe factuur
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
