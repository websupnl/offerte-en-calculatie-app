import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;

  const [projects, customers] = companyId
    ? await Promise.all([
        prisma.project.findMany({
          where: { companyId },
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, name: true } },
            _count: { select: { quotes: true, files: true } },
          },
          take: 200,
        }),
        prisma.customer.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 500,
        }),
      ])
    : [[], []];

  return (
    <ProjectsClient
      initialProjects={JSON.parse(JSON.stringify(projects))}
      customers={customers}
    />
  );
}
