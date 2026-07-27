import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContractSignClient } from "./contract-sign-client";

export const dynamic = "force-dynamic";

export default async function ContractSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contract = await prisma.contract.findUnique({
    where: { shareToken: token },
    include: {
      customer: { select: { name: true } },
      company: { select: { name: true, slug: true, branding: true } },
    },
  });

  // Een concept hoort nog niet zichtbaar te zijn, ook niet met de link.
  if (!contract || contract.status === "CONCEPT") notFound();

  if (!contract.viewedAt) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        viewedAt: new Date(),
        events: { create: { type: "VIEWED", actor: contract.customer.name } },
      },
    });
  }

  return (
    <ContractSignClient
      token={token}
      contract={{
        number: contract.number,
        title: contract.title,
        body: contract.body ?? "",
        startDate: contract.startDate?.toISOString() ?? null,
        endDate: contract.endDate?.toISOString() ?? null,
        recurringAmount: contract.recurringAmount ? Number(contract.recurringAmount) : null,
        recurringPeriod: contract.recurringPeriod,
        noticePeriodDays: contract.noticePeriodDays,
        signedAt: contract.signedAt?.toISOString() ?? null,
        signedBy: contract.signedBy,
      }}
      company={{
        name: contract.company.name,
        slug: contract.company.slug,
        branding: contract.company.branding as Record<string, string>,
      }}
      customerName={contract.customer.name}
    />
  );
}
