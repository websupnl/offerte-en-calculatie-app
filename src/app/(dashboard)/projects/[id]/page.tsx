import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectDetailClient } from "./project-detail-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const project = await prisma.project.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      quotes: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, status: true, totalIncVat: true, createdAt: true },
      },
      files: { orderBy: { uploadedAt: "desc" } },
      workOrders: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { lines: true } } },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { lines: true } } },
      },
      purchaseInvoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  return <ProjectDetailClient project={JSON.parse(JSON.stringify(project))} />;
}
