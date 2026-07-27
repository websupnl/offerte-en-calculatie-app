import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured, presignDownload } from "@/lib/storage";
import { ContractDetailClient } from "./contract-detail-client";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) return null;

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, number: true, title: true } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!contract) notFound();

  const signatureUrl =
    contract.signatureKey && isStorageConfigured()
      ? await presignDownload(contract.signatureKey, 3600).catch(() => null)
      : null;

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";

  return (
    <ContractDetailClient
      contract={JSON.parse(JSON.stringify(contract))}
      signatureUrl={signatureUrl}
      shareUrl={contract.shareToken ? `${base}/c/${contract.shareToken}` : null}
    />
  );
}
