import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContractsClient } from "./contracts-client";

export default async function ContractsPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const [contracts, customers, projects] = companyId
    ? await Promise.all([
        prisma.contract.findMany({
          where: { companyId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, name: true } },
            project: { select: { id: true, number: true, title: true } },
          },
          take: 300,
        }),
        prisma.customer.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 500,
        }),
        prisma.project.findMany({
          where: { companyId, status: { not: "ARCHIVED" } },
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, title: true },
          take: 200,
        }),
      ])
    : [[], [], []];

  return (
    <ContractsClient
      initialContracts={JSON.parse(JSON.stringify(contracts))}
      customers={customers}
      projects={projects}
    />
  );
}
