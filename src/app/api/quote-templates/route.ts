import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quoteDocumentSchema, sanitizeDocumentForTemplate } from "@/lib/quote-document";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1_000).optional(),
  category: z.string().trim().max(80).optional(),
  document: quoteDocumentSchema,
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await prisma.quoteTemplate.findMany({
    where: { companyId: session.user.activeCompanyId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.quoteTemplate.findUnique({
    where: { companyId_name: { companyId: session.user.activeCompanyId, name: parsed.data.name } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Er bestaat al een template met deze naam." }, { status: 409 });

  const template = await prisma.quoteTemplate.create({
    data: {
      companyId: session.user.activeCompanyId,
      createdById: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      document: sanitizeDocumentForTemplate(parsed.data.document),
    },
  });
  return NextResponse.json(template, { status: 201 });
}
