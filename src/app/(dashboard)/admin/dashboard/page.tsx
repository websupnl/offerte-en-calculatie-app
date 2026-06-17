import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session) return null;

  const companyId = session.user.activeCompanyId;

  const quotes = await prisma.quote.findMany({
    where: { companyId },
    include: {
      items: true,
    },
  });

  const stats = {
    total: quotes.length,
    accepted: quotes.filter(q => q.status === "ACCEPTED"),
    open: quotes.filter(q => ["SENT", "VIEWED", "DRAFT"].includes(q.status)),
    declined: quotes.filter(q => q.status === "DECLINED"),
  };

  const calculateMargin = (quoteList: typeof quotes) => {
    let revenue = 0;
    let cost = 0;
    
    quoteList.forEach(q => {
      q.items.forEach(item => {
        revenue += Number(item.total);
        cost += Number(item.qty) * Number(item.costPrice || 0);
      });
    });

    return { revenue, cost, profit: revenue - cost };
  };

  const actualMargin = calculateMargin(stats.accepted);
  const potentialMargin = calculateMargin(stats.open);
  
  const totalMarginPercent = actualMargin.revenue > 0 
    ? (actualMargin.profit / actualMargin.revenue) * 100 
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">The Accountant</h1>
        <p className="text-slate-500">Inzicht in je winst, marges en sales-performance.</p>
      </div>

      {/* ─── Key Metrics ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-none shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" /> Gerealiseerde Winst
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(actualMargin.profit)}</div>
            <p className="text-xs text-slate-400 mt-1">Van {stats.accepted.length} geaccepteerde offertes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" /> Gem. Marge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{totalMarginPercent.toFixed(1)}%</div>
            <p className="text-xs text-slate-400 mt-1">Op basis van netto omzet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" /> Potentiële Winst
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">{formatCurrency(potentialMargin.profit)}</div>
            <p className="text-xs text-slate-400 mt-1">In {stats.open.length} openstaande offertes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-purple-500" /> Conversie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">
              {stats.total > 0 ? ((stats.accepted.length / (stats.total - stats.open.filter(q => q.status === "DRAFT").length)) * 100).toFixed(0) : 0}%
            </div>
            <p className="text-xs text-slate-400 mt-1">Van verzonden offertes</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Detailed Breakdown ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Financieel Overzicht (Netto)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-500 uppercase">Totale Omzet</p>
                  <p className="text-xl font-black">{formatCurrency(actualMargin.revenue)}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-green-500 opacity-20" />
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-500 uppercase">Totale Inkoop</p>
                  <p className="text-xl font-black">{formatCurrency(actualMargin.cost)}</p>
                </div>
                <ArrowDownRight className="h-8 w-8 text-red-500 opacity-20" />
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
                <p className="text-sm font-bold text-slate-900">Netto Resultaat</p>
                <p className="text-2xl font-black text-green-600">{formatCurrency(actualMargin.profit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Status Verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "Geaccepteerd", count: stats.accepted.length, color: "bg-green-500", icon: CheckCircle },
                { label: "Openstaand", count: stats.open.length, color: "bg-orange-500", icon: Clock },
                { label: "Afgewezen", count: stats.declined.length, color: "bg-red-500", icon: AlertCircle },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${item.color.replace('500', '100')} text-${item.color.replace('bg-', '')}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold">{item.label}</span>
                      <span className="text-slate-500">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`${item.color} h-full transition-all`} 
                        style={{ width: `${(item.count / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
