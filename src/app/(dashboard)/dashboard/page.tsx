import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Users, Euro, TrendingUp, FolderKanban, Plus, ArrowUpRight, Clock3 } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "outline",
  VIEWED: "outline",
  ACCEPTED: "default",
  DECLINED: "destructive",
  EXPIRED: "secondary",
};

export default async function DashboardPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  if (!companyId) {
    return <div className="p-8 text-slate-500">Selecteer een bedrijf in de navigatie.</div>;
  }

  const [quoteStats, recentQuotes, customerCount, projectCount] = await Promise.all([
    prisma.quote.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
      _sum: { totalIncVat: true },
    }),
    prisma.quote.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        totalIncVat: true,
        updatedAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.customer.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId, status: { not: "ARCHIVED" } } }),
  ]);

  const stat = (status: string) => quoteStats.find((item) => item.status === status);
  const totalOpen = quoteStats
    .filter((item) => ["DRAFT", "SENT", "VIEWED"].includes(item.status))
    .reduce((sum, item) => sum + Number(item._sum.totalIncVat ?? 0), 0);
  const totalAccepted = Number(stat("ACCEPTED")?._sum.totalIncVat ?? 0);
  const sentCount = (stat("SENT")?._count ?? 0) + (stat("VIEWED")?._count ?? 0) + (stat("ACCEPTED")?._count ?? 0) + (stat("DECLINED")?._count ?? 0);
  const acceptedCount = stat("ACCEPTED")?._count ?? 0;
  const conversionRate = sentCount > 0 ? Math.round((acceptedCount / sentCount) * 100) : 0;

  const metrics = [
    { label: "Open offertewaarde", value: formatCurrency(totalOpen), meta: `${stat("DRAFT")?._count ?? 0} concepten`, icon: Euro, color: "text-amber-600", surface: "bg-amber-50" },
    { label: "Geaccepteerd", value: formatCurrency(totalAccepted), meta: `${acceptedCount} opdrachten`, icon: TrendingUp, color: "text-emerald-600", surface: "bg-emerald-50" },
    { label: "Actieve projecten", value: String(projectCount), meta: "Niet gearchiveerd", icon: FolderKanban, color: "text-sky-600", surface: "bg-sky-50" },
    { label: "Conversie", value: `${conversionRate}%`, meta: `${customerCount} klanten`, icon: Users, color: "text-violet-600", surface: "bg-violet-50" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Werkoverzicht"
        title={`Goedemorgen${session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}`}
        description="Alles wat aandacht nodig heeft, direct vanuit één werkplek."
        actions={
          <>
            <Button nativeButton={false} variant="outline" render={<Link href="/projects" />}>
              <FolderKanban className="h-4 w-4" /> Projecten
            </Button>
            <Button nativeButton={false} render={<Link href="/quotes/new" />}>
              <Plus className="h-4 w-4" /> Nieuwe offerte
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{metric.meta}</p>
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${metric.surface} ${metric.color}`}>
                  <metric.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-bold text-slate-900">Recent bijgewerkt</h2>
                <p className="text-xs text-slate-400">Laatste offertes binnen het actieve bedrijf</p>
              </div>
              <Link href="/quotes" className="text-xs font-semibold text-[#167f88] hover:underline">Alle offertes</Link>
            </div>
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">Offerte</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Waarde</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQuotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="pl-4">
                      <p className="max-w-72 truncate font-semibold">{quote.title || quote.number}</p>
                      <p className="text-xs text-slate-400">{quote.number} · {formatDate(quote.updatedAt)}</p>
                    </TableCell>
                    <TableCell className="font-medium">{quote.customer.name}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>{QUOTE_STATUS_LABELS[quote.status]}</Badge></TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(Number(quote.totalIncVat))}</TableCell>
                    <TableCell><Link href={`/quotes/${quote.id}`} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100"><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {recentQuotes.length === 0 && (
              <div className="grid min-h-56 place-items-center text-center text-sm text-slate-400">
                <div><FileText className="mx-auto mb-2 h-8 w-8" />Nog geen offertes.</div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-[#0b1628] p-5 text-white shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300">Snel starten</p>
              <h2 className="mt-2 text-lg font-bold">Van aanvraag naar opdracht</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">Maak eerst de relatie en het project aan. Voeg daarna artikelen toe aan de offerte.</p>
              <div className="mt-4 space-y-2">
                <Link href="/customers" className="flex items-center justify-between rounded-lg bg-white/7 px-3 py-2 text-sm hover:bg-white/12"><span>1. Klant kiezen</span><ArrowUpRight className="h-4 w-4" /></Link>
                <Link href="/projects" className="flex items-center justify-between rounded-lg bg-white/7 px-3 py-2 text-sm hover:bg-white/12"><span>2. Project openen</span><ArrowUpRight className="h-4 w-4" /></Link>
                <Link href="/quotes/new" className="flex items-center justify-between rounded-lg bg-[#167f88] px-3 py-2 text-sm font-semibold hover:bg-[#116b73]"><span>3. Offerte maken</span><ArrowUpRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-slate-400" /> Werkvoorraad</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Conceptoffertes</span><strong>{stat("DRAFT")?._count ?? 0}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Verstuurd</span><strong>{stat("SENT")?._count ?? 0}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Bekeken</span><strong>{stat("VIEWED")?._count ?? 0}</strong></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
