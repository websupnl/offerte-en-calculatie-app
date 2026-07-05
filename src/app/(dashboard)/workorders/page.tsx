import Link from "next/link";
import { ClipboardList, FolderKanban, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, WORKORDER_STATUS_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CONCEPT: "secondary",
  GEPLAND: "outline",
  UITGEVOERD: "default",
  GEFACTUREERD: "default",
};

export default async function WorkOrdersPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const workOrders = companyId
    ? await prisma.workOrder.findMany({
        where: { companyId },
        orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              number: true,
              title: true,
              customer: { select: { name: true } },
            },
          },
          _count: { select: { lines: true } },
        },
        take: 200,
      })
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Operatie"
        title="Werkbonnen"
        description="Overzicht van geplande en uitgevoerde werkzaamheden binnen het actieve bedrijf."
        actions={
          <Button nativeButton={false} render={<Link href="/projects" />}>
            <Plus className="h-4 w-4" /> Via project aanmaken
          </Button>
        }
      />
      <div className="p-4 sm:p-5 lg:p-8">
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/[0.06]">
          <div className="divide-y md:hidden">
            {workOrders.map((workOrder) => (
              <Link key={workOrder.id} href={`/workorders/${workOrder.id}`} className="block p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{workOrder.number}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{workOrder.title}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[workOrder.status] ?? "outline"}>
                    {WORKORDER_STATUS_LABELS[workOrder.status] ?? workOrder.status}
                  </Badge>
                </div>
                <div className="mt-3 text-sm">
                  <p className="truncate font-medium">{workOrder.project.customer.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {workOrder.project.number} · {workOrder.scheduledAt
                      ? formatDate(workOrder.scheduledAt)
                      : workOrder.executedAt
                        ? formatDate(workOrder.executedAt)
                        : "Geen datum"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-4">Werkbon</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Monteur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((workOrder) => (
                <TableRow key={workOrder.id}>
                  <TableCell className="pl-4">
                    <Link href={`/workorders/${workOrder.id}`} className="font-semibold text-slate-950 hover:text-[var(--ws-accent)]">
                      {workOrder.number}
                    </Link>
                    <p className="max-w-80 truncate text-xs text-slate-500">{workOrder.title}</p>
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${workOrder.project.id}`} className="font-medium hover:text-[var(--ws-accent)]">
                      {workOrder.project.number}
                    </Link>
                    <p className="max-w-64 truncate text-xs text-slate-500">{workOrder.project.title}</p>
                  </TableCell>
                  <TableCell>{workOrder.project.customer.name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[workOrder.status] ?? "outline"}>
                      {WORKORDER_STATUS_LABELS[workOrder.status] ?? workOrder.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {workOrder.scheduledAt
                      ? formatDate(workOrder.scheduledAt)
                      : workOrder.executedAt
                        ? formatDate(workOrder.executedAt)
                        : "-"}
                  </TableCell>
                  <TableCell>{workOrder.technicianName ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {workOrders.length === 0 && (
            <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-slate-500">
              <div>
                <ClipboardList className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                <p className="font-semibold text-slate-800">Nog geen werkbonnen</p>
                <p className="mt-1">Open een project om de eerste werkbon aan te maken.</p>
                <Button nativeButton={false} variant="outline" className="mt-4" render={<Link href="/projects" />}>
                  <FolderKanban className="h-4 w-4" /> Naar projecten
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
