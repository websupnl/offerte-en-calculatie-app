import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdviceBuilder } from "@/components/forms/advice-builder";
import { redirect } from "next/navigation";

export default async function NewAdvicePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const companyId = session.user.activeCompanyId;
  const customers = await prisma.customer.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  return (
    <AdviceBuilder 
      customers={customers} 
      companyName={company?.name || "Koolhaas Installaties"} 
      companySlug={company?.slug || "koolhaas"}
    />
  );
}
