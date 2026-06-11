import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KnowledgeClient } from "./knowledge-client";

export default async function KnowledgePage() {
  const session = await auth();
  if (!session) return null;

  const [datasheets, findings] = await Promise.all([
    prisma.datasheet.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.researchFinding.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { quote: { select: { id: true, number: true, title: true } } },
    }),
  ]);

  return (
    <KnowledgeClient
      initialDatasheets={JSON.parse(JSON.stringify(datasheets))}
      initialFindings={JSON.parse(JSON.stringify(findings))}
    />
  );
}
