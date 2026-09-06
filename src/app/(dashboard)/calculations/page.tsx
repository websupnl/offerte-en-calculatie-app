import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CalculationsClient } from "./calculations-client";

export default async function CalculationsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const companyId = session.user.activeCompanyId;
  const showArchived = (await searchParams).archived === "1";
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true, name: true },
  });

  const [calculations, customers, projects] = await Promise.all([
    prisma.calculation.findMany({
      where: { companyId, archivedAt: showArchived ? { not: null } : null },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, number: true, title: true } },
        quote: { select: { id: true, number: true, status: true } },
        items: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { companyId },
      select: { id: true, number: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serializedCalculations = calculations.map((calc) => ({
    ...calc,
    vatRate: Number(calc.vatRate),
    totalCostPrice: Number(calc.totalCostPrice),
    totalSalesPrice: Number(calc.totalSalesPrice),
    marginAmount: Number(calc.marginAmount),
    marginPercent: Number(calc.marginPercent),
    archivedAt: calc.archivedAt ? calc.archivedAt.toISOString() : null,
    createdAt: calc.createdAt.toISOString(),
    updatedAt: calc.updatedAt.toISOString(),
  }));

  return (
    <CalculationsClient
      key={showArchived ? "archived" : "active"}
      initialCalculations={serializedCalculations}
      customers={customers}
      projects={projects}
      companySlug={company?.slug ?? "koolhaas"}
      showArchived={showArchived}
    />
  );
}
