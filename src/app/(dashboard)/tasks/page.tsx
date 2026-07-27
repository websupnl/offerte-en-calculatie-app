import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks";
import { TasksClient } from "./tasks-client";

/**
 * Standaard opent de zakelijke scope van het actieve bedrijf. Privé wordt
 * client-side bijgeladen — dat houdt de twee werelden ook in de datastroom
 * gescheiden.
 */
export default async function TasksPage() {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  const userId = session?.user?.id;

  if (!userId) return null;

  const where = companyId ? { companyId } : { companyId: null, ownerId: userId };

  const [tasks, lists, projects] = await Promise.all([
    prisma.task.findMany({
      where: { ...where, deletedAt: null, status: { in: [...ACTIVE_TASK_STATUSES] } },
      orderBy: [{ priority: "desc" }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      include: {
        list: { select: { id: true, name: true, kind: true } },
        project: { select: { id: true, number: true, title: true } },
        customer: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true } },
      },
      take: 500,
    }),
    prisma.taskList.findMany({
      where: { ...where, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { tasks: { where: { deletedAt: null, status: { in: [...ACTIVE_TASK_STATUSES] } } } } },
      },
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
    <TasksClient
      initialTasks={JSON.parse(JSON.stringify(tasks))}
      initialLists={JSON.parse(JSON.stringify(lists))}
      projects={projects}
      hasCompany={Boolean(companyId)}
    />
  );
}
