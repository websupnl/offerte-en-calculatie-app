import Link from "next/link";
import { FileText, Plus, ReceiptText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONCEPT: "secondary",
  VERZONDEN: "outline",
  BETAALD: "default",
  VERVALLEN: "destructive",
};

export default async function InvoicesPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const invoices = companyId
    ? await prisma.salesInvoice.findMany({
        where: { companyId },
        orderBy: [{ invoiceDate: "desc" }, { updatedAt: "desc" }],
        include: {
          customer: { select: { name: true } },
          project: { select: { id: true, number: true, title: true } },
          _count: { select: { lines: true } },
        },
        take: 200,
      })
    : [];

  const today = new Date(new Date().toDateString());
  const sum = (list: typeof invoices) => list.reduce((t, i) => t + Number(i.totalIncVat), 0);
  const open = invoices.filter((i) => i.status === "VERZONDEN");
  const overdue = open.filter((i) => i.dueDate && i.dueDate < today);
  const concepts = invoices.filter((i) => i.status === "CONCEPT");
  const stats = [
    { label: "Openstaand", amount: sum(open), count: open.length, tone: "text-slate-950" },
    { label: "Over de vervaldatum", amount: sum(overdue), count: overdue.length, tone: overdue.length ? "text-red-600" : "text-slate-950" },
    { label: "Concepten", amount: sum(concepts), count: concepts.length, tone: "text-slate-500" },
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
      <div className="space-y-5 p-4 sm:p-5 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((st) => (
            <div key={st.label} className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{st.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${st.tone}`}>{formatCurrency(st.amount)}</p>
              <p className="text-xs text-slate-500">{st.count} {st.count === 1 ? "factuur" : "facturen"}</p>
            </div>
          ))}
        </div>
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
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
                    <p>{formatDate(invoice.invoiceDate)}</p>
                    <p className="truncate text-xs">{invoice.project?.number ?? "Geen project"}</p>
                  </div>
                  <p className="text-right font-bold tabular-nums">{formatCurrency(Number(invoice.totalIncVat))}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-4">Factuur</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
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
                  <TableCell>
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
                  <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
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
                <p className="font-semibold text-slate-800">Nog geen facturen</p>
                <p className="mt-1">Maak je eerste factuur vanuit een offerte, werkbon of met losse regels.</p>
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
