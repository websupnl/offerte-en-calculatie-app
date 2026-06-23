import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignDownload, isStorageConfigured } from "@/lib/storage";
import { WorkOrderDetailClient } from "./workorder-detail-client";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, companyId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      project: { select: { id: true, number: true, title: true, customer: true } },
    },
  });
  if (!workOrder) notFound();

  const signatureUrl =
    workOrder.signatureKey && isStorageConfigured()
      ? await presignDownload(workOrder.signatureKey, 3600)
      : null;

  return (
    <WorkOrderDetailClient
      workOrder={JSON.parse(JSON.stringify(workOrder))}
      signatureUrl={signatureUrl}
    />
  );
}
