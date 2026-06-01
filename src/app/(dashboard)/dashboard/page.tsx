import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Euro, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  if (!companyId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Selecteer een bedrijf in de zijbalk.</p>
      </div>
    );
  }

  const [quoteStats, recentQuotes, customerCount] = await Promise.all([
    prisma.quote.groupBy({
      by: ["status"],
      where: { companyId },
      _count: true,
      _sum: { totalIncVat: true },
    }),
    prisma.quote.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { customer: true },
    }),
    prisma.customer.count({ where: { companyId } }),
  ]);

  type QuoteStat = { status: string; _count: number; _sum: { totalIncVat: unknown } };
  const totalOpen = (quoteStats as QuoteStat[])
    .filter((s) => ["DRAFT", "SENT", "VIEWED"].includes(s.status))
    .reduce((acc: number, s: QuoteStat) => acc + Number(s._sum.totalIncVat ?? 0), 0);

  const totalAccepted = (quoteStats as QuoteStat[])
    .filter((s) => s.status === "ACCEPTED")
    .reduce((acc: number, s: QuoteStat) => acc + Number(s._sum.totalIncVat ?? 0), 0);

  const totalCount = (quoteStats as QuoteStat[]).reduce((acc: number, s: QuoteStat) => acc + s._count, 0);

  const acceptedCount = (quoteStats as QuoteStat[]).find((s) => s.status === "ACCEPTED")?._count ?? 0;
  const conversionRate = totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 0;

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Concept",
    SENT: "Verstuurd",
    VIEWED: "Bekeken",
    ACCEPTED: "Geaccepteerd",
    DECLINED: "Afgewezen",
    EXPIRED: "Verlopen",
  };

  const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    DRAFT: "secondary",
    SENT: "outline",
    VIEWED: "outline",
    ACCEPTED: "default",
    DECLINED: "destructive",
    EXPIRED: "secondary",
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welkom terug, {session?.user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Openstaande offertes
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOpen)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Geaccepteerd
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAccepted)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totaal offertes
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Klanten
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Conversie: {conversionRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent quotes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recente offertes</CardTitle>
          <Link
            href="/quotes"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Alle offertes →
          </Link>
        </CardHeader>
        <CardContent>
          {recentQuotes.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Nog geen offertes.{" "}
              <Link href="/quotes/new" className="underline">
                Maak je eerste offerte
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {recentQuotes.map((q: { id: string; number: string; status: string; totalIncVat: unknown; customer: { name: string } }) => (
                <Link
                  key={q.id}
                  href={`/quotes/${q.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{q.number}</p>
                    <p className="text-xs text-muted-foreground">{q.customer.name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(q.totalIncVat))}
                    </span>
                    <Badge variant={STATUS_VARIANT[q.status] ?? "outline"}>
                      {STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
