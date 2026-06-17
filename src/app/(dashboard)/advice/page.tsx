import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, ChevronRight, Clock, User } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";

export default async function AdviceListPage() {
  const session = await auth();
  if (!session) return null;

  const companyId = session.user.activeCompanyId;

  const reports = await prisma.adviceDocument.findMany({
    where: { companyId },
    include: {
      customer: { select: { name: true } },
      quote: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Technisch Advies</h1>
          <p className="text-muted-foreground">Onderbouwingen en technische rapportages voor klanten.</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href="/advice/new">
            <Plus className="mr-2 h-4 w-4" />
            Nieuw advies
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="font-bold text-lg">Nog geen adviesrapporten</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">
                Maak je eerste technische onderbouwing om klanten te overtuigen met data.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/advice/new">Start eerste advies</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Link key={report.id} href={`/advice/${report.id}`}>
              <Card className="hover:border-blue-300 transition-colors group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {report.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {report.customer.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDate(report.createdAt.toISOString())}
                        </span>
                        {report.quote && (
                          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                            Gekoppeld aan {report.quote.number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
