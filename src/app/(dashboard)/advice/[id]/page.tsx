import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdviceBuilder } from "@/components/forms/advice-builder";
import { notFound, redirect } from "next/navigation";

export default async function EditAdvicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const companyId = session.user.activeCompanyId;
  
  const [customers, adviceReport] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.adviceDocument.findUnique({
      where: { id, companyId },
      include: { customer: true }
    })
  ]);

  if (!adviceReport) notFound();

  const serializedAdvice = JSON.parse(JSON.stringify(adviceReport));

  return (
    <AdviceBuilder 
      customers={customers} 
      initialAdvice={serializedAdvice}
    />
  );
}
