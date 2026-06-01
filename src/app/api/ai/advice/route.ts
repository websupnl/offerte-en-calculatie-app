import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAdviceDocument } from "@/lib/openai";
import { DEFAULT_SETTINGS } from "@/lib/branding";
import { z } from "zod";

const schema = z.object({
  quoteId: z.string(),
  type: z.enum(["BATTERY", "EMS", "SOLAR", "ELECTRICAL", "CAMERA", "HEATPUMP"]),
  customerData: z.record(z.string(), z.unknown()),
  productIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { quoteId, type, customerData, productIds } = parsed.data;

  // Verify quote belongs to this company
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: session.user.activeCompanyId },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const company = await prisma.company.findUnique({
    where: { id: session.user.activeCompanyId },
  });

  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const apiKey = settings.openaiApiKey as string | undefined;
  const prompts = (settings.aiSystemPrompts as Record<string, string>) ?? DEFAULT_SETTINGS.aiSystemPrompts;
  const systemPrompt = prompts[type] ?? DEFAULT_SETTINGS.aiSystemPrompts[type as keyof typeof DEFAULT_SETTINGS.aiSystemPrompts] ?? "";

  // Fetch products if specified
  const products = productIds?.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, companyId: session.user.activeCompanyId },
      })
    : [];

  const content = await generateAdviceDocument(
    systemPrompt,
    customerData,
    products.map((p) => ({ name: p.name, specs: p.specs as Record<string, unknown> })),
    apiKey
  );

  // Save advice document
  const doc = await prisma.adviceDocument.create({
    data: {
      quoteId,
      type,
      inputData: JSON.parse(JSON.stringify(customerData)),
      content,
    },
  });

  return NextResponse.json({ id: doc.id, content });
}
