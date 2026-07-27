import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotesClient } from "./notes-client";

export default async function NotesPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const userId = session?.user?.id;

  if (!userId) return null;

  const where = companyId ? { companyId } : { companyId: null, ownerId: userId };

  const [notes, projects] = await Promise.all([
    prisma.note.findMany({
      where: { ...where, deletedAt: null },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      include: {
        project: { select: { id: true, number: true, title: true } },
        customer: { select: { id: true, name: true } },
        _count: { select: { attachments: true } },
      },
      take: 300,
    }),
    companyId
      ? prisma.project.findMany({
          where: { companyId, status: { not: "ARCHIVED" } },
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, title: true },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  return (
    <NotesClient
      initialNotes={JSON.parse(JSON.stringify(notes))}
      projects={projects}
      hasCompany={Boolean(companyId)}
    />
  );
}
