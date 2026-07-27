import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured, presignDownload } from "@/lib/storage";
import { ReviewBoardClient } from "./review-board-client";

export default async function ReviewBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const session = await auth();
  const companyId = session?.user?.activeCompanyId;
  if (!companyId) return null;

  const { boardId } = await params;
  const board = await prisma.reviewBoard.findFirst({
    where: { id: boardId, companyId },
    include: {
      project: { select: { id: true, number: true, title: true } },
      pins: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, title: true, description: true, status: true, pin: true,
          createdAt: true, source: true,
          _count: { select: { comments: true } },
        },
      },
    },
  });
  if (!board) notFound();

  const imageUrl =
    board.imageKey && isStorageConfigured()
      ? await presignDownload(board.imageKey, 3600).catch(() => null)
      : null;

  return (
    <ReviewBoardClient
      board={JSON.parse(JSON.stringify({ ...board, imageKey: undefined }))}
      imageUrl={imageUrl}
    />
  );
}
