import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { price, notes } = body;

  const updated = await prisma.datasheet.update({
    where: { id },
    data: {
      ...(price !== undefined && { price }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.datasheet.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
