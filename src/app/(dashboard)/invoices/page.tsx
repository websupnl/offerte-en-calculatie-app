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

  return (
    <div>
      <PageHeader
        eyebrow="Financieel"
        title="Facturen"
        description="Verkoopfacturen vanuit offertes, werkbonnen en projecten in een centraal overzicht."
        actions={
          <Button nativeButton={false} render={<Link href="/quotes" />}>
            <Plus className="h-4 w-4" /> Vanuit offerte
          </Button>
        }
      />
      <div className="p-4 sm:p-5 lg:p-8">
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
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
                    <Link href={`/invoices/${invoice.id}`} className="font-semibold text-slate-950 hover:text-[#167f88]">
                      {invoice.number}
                    </Link>
                    {invoice.reference && <p className="max-w-72 truncate text-xs text-slate-500">{invoice.reference}</p>}
                  </TableCell>
                  <TableCell>{invoice.customer.name}</TableCell>
                  <TableCell>
                    {invoice.project ? (
                      <>
                        <Link href={`/projects/${invoice.project.id}`} className="font-medium hover:text-[#167f88]">
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
                <p className="mt-1">Maak eerst een offerte of project aan om te factureren.</p>
                <Button nativeButton={false} variant="outline" className="mt-4" render={<Link href="/quotes" />}>
                  <FileText className="h-4 w-4" /> Naar offertes
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
