import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  FileText,
  FolderKanban,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  INVOICE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
} from "@/lib/format";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const customer = await prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      quotes: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          totalIncVat: true,
          updatedAt: true,
        },
      },
      projects: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          city: true,
          updatedAt: true,
        },
      },
      adviceReports: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, title: true, status: true, updatedAt: true },
      },
      salesInvoices: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          totalIncVat: true,
          invoiceDate: true,
        },
      },
    },
  });

  if (!customer) notFound();

  const totalQuoteValue = customer.quotes.reduce((sum, quote) => sum + Number(quote.totalIncVat), 0);
  const acceptedQuoteValue = customer.quotes
    .filter((quote) => quote.status === "ACCEPTED")
    .reduce((sum, quote) => sum + Number(quote.totalIncVat), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Klantdossier"
        title={customer.name}
        description={[customer.type, customer.city].filter(Boolean).join(" · ") || "Relatie"}
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href="/customers" />}>
              <ArrowLeft className="h-4 w-4" /> Klanten
            </Button>
            <Button nativeButton={false} render={<Link href={`/quotes/new?customerId=${customer.id}`} />}>
              <Plus className="h-4 w-4" /> Nieuwe offerte
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Offertes" value={String(customer.quotes.length)} meta={formatCurrency(totalQuoteValue)} icon={FileText} />
          <Metric label="Opdrachtwaarde" value={formatCurrency(acceptedQuoteValue)} meta="Geaccepteerde offertes" icon={ReceiptText} />
          <Metric label="Projecten" value={String(customer.projects.length)} meta="Actieve en afgeronde dossiers" icon={FolderKanban} />
          <Metric label="Adviezen" value={String(customer.adviceReports.length)} meta="Technische rapportages" icon={Lightbulb} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />Contactgegevens</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ContactLine icon={Mail} value={customer.email} href={customer.email ? `mailto:${customer.email}` : undefined} fallback="Geen e-mail" />
                <ContactLine icon={Phone} value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : undefined} fallback="Geen telefoon" />
                <ContactLine
                  icon={MapPin}
                  value={[customer.address, customer.zipCode, customer.city].filter(Boolean).join(", ")}
                  fallback="Geen adres"
                />
                {customer.kvk && <InfoLine label="KvK" value={customer.kvk} />}
                {customer.vatNumber && <InfoLine label="Btw-nummer" value={customer.vatNumber} />}
                {customer.iban && <InfoLine label="IBAN" value={customer.iban} />}
              </CardContent>
            </Card>
            {customer.notes && (
              <Card>
                <CardHeader><CardTitle>Interne notities</CardTitle></CardHeader>
                <CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{customer.notes}</p></CardContent>
              </Card>
            )}
          </aside>

          <main className="space-y-6">
            <DossierSection title="Projecten" count={customer.projects.length} empty="Nog geen projecten voor deze klant.">
              {customer.projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group flex items-center gap-4 border-b px-4 py-3 last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600"><FolderKanban className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{project.title}</p>
                    <p className="text-xs text-slate-400">{project.number} · {project.city || "Geen plaats"} · {formatDate(project.updatedAt)}</p>
                  </div>
                  <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status] ?? project.status}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-slate-700" />
                </Link>
              ))}
            </DossierSection>

            <DossierSection title="Offertes" count={customer.quotes.length} empty="Nog geen offertes voor deze klant.">
              {customer.quotes.map((quote) => (
                <Link key={quote.id} href={`/quotes/${quote.id}`} className="group flex items-center gap-4 border-b px-4 py-3 last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><FileText className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{quote.title || quote.number}</p>
                    <p className="text-xs text-slate-400">{quote.number} · {formatDate(quote.updatedAt)}</p>
                  </div>
                  <Badge variant="outline">{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</Badge>
                  <strong className="w-28 text-right text-sm tabular-nums">{formatCurrency(Number(quote.totalIncVat))}</strong>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-slate-700" />
                </Link>
              ))}
            </DossierSection>

            <div className="grid gap-6 lg:grid-cols-2">
              <DossierSection title="Facturen" count={customer.salesInvoices.length} empty="Nog geen facturen.">
                {customer.salesInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="group flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-slate-50"
                  >
                    <ReceiptText className="h-4 w-4 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{invoice.number}</p>
                      <p className="text-xs text-slate-400">{formatDate(invoice.invoiceDate)}</p>
                    </div>
                    <Badge variant="secondary">{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
                    <strong className="text-sm">{formatCurrency(Number(invoice.totalIncVat))}</strong>
                  </Link>
                ))}
              </DossierSection>
              <DossierSection title="Technische adviezen" count={customer.adviceReports.length} empty="Nog geen adviezen.">
                {customer.adviceReports.map((advice) => (
                  <Link key={advice.id} href={`/advice/${advice.id}`} className="group flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-slate-50">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{advice.title}</p>
                      <p className="text-xs text-slate-400">{formatDate(advice.updatedAt)}</p>
                    </div>
                    <Badge variant="outline">{advice.status}</Badge>
                    <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-slate-700" />
                  </Link>
                ))}
              </DossierSection>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  meta,
  icon: Icon,
}: {
  label: string;
  value: string;
  meta: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{meta}</p></div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function ContactLine({ icon: Icon, value, href, fallback }: { icon: typeof Mail; value?: string | null; href?: string; fallback: string }) {
  const content = <><Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 break-words">{value || fallback}</span></>;
  return href ? <a href={href} className="flex gap-2 text-[#167f88] hover:underline">{content}</a> : <div className="flex gap-2 text-slate-600">{content}</div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-t pt-3"><span className="text-slate-400">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function DossierSection({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <h2 className="font-bold">{title}</h2><Badge variant="secondary">{count}</Badge>
      </div>
      {count > 0 ? children : <p className="px-4 py-8 text-center text-sm text-slate-400">{empty}</p>}
    </section>
  );
}
