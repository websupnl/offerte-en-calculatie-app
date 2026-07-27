import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { portalAccessByToken, portalScopeWhere, setPortalCookie, touchPortalAccess } from "@/lib/portal";
import { PortalClient } from "./portal-client";

export const dynamic = "force-dynamic";

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await portalAccessByToken(token);
  if (!access) notFound();

  await setPortalCookie(token);
  await touchPortalAccess(access.id);

  const scope = portalScopeWhere(access);

  const [company, customer, project, feedback, quotes, contracts] = await Promise.all([
    prisma.company.findUnique({
      where: { id: access.companyId },
      select: { name: true, slug: true, branding: true },
    }),
    prisma.customer.findUnique({
      where: { id: access.customerId },
      select: { id: true, name: true },
    }),
    access.projectId
      ? prisma.project.findUnique({
          where: { id: access.projectId },
          select: { id: true, number: true, title: true, status: true, description: true },
        })
      : null,
    // Alleen wat expliciet gedeeld is. Standaard staat alles op INTERNAL.
    prisma.task.findMany({
      where: { ...scope, visibility: "SHARED", deletedAt: null },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, title: true, description: true, status: true, createdAt: true,
        source: true, pin: true,
        comments: {
          where: { visibility: "SHARED" },
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, authorName: true, createdAt: true, authorUserId: true },
        },
      },
      take: 200,
    }),
    prisma.quote.findMany({
      where: {
        companyId: access.companyId,
        customerId: access.customerId,
        ...(access.projectId ? { projectId: access.projectId } : {}),
        status: { in: ["SENT", "VIEWED", "ACCEPTED"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, title: true, status: true, totalIncVat: true, share: { select: { token: true } } },
      take: 20,
    }),
    prisma.contract.findMany({
      where: {
        companyId: access.companyId,
        customerId: access.customerId,
        deletedAt: null,
        status: { in: ["VERZONDEN", "GETEKEND", "ACTIEF"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, title: true, status: true, shareToken: true, signedAt: true },
      take: 20,
    }),
  ]);

  if (!company || !customer) notFound();

  return (
    <PortalClient
      access={{ name: access.name, canComment: access.canComment, canUpload: access.canUpload }}
      company={{ name: company.name, slug: company.slug, branding: company.branding as Record<string, string> }}
      customer={customer}
      project={project}
      feedback={JSON.parse(JSON.stringify(feedback))}
      quotes={JSON.parse(JSON.stringify(quotes))}
      contracts={JSON.parse(JSON.stringify(contracts))}
    />
  );
}
