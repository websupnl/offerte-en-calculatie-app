import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CalculatieExportClient } from "./calculatie-export-client";

export default async function QuoteCalculatiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) notFound();

  const quote = await prisma.quote.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) notFound();

  const serialized = JSON.parse(JSON.stringify(quote));

  return <CalculatieExportClient quote={serialized} />;
}
