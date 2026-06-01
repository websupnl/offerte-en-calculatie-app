import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/openai";
import { DEFAULT_SETTINGS } from "@/lib/branding";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["intro", "outro", "item_description"]),
  context: z.object({
    companyName: z.string(),
    customerName: z.string(),
    items: z.array(z.object({ description: z.string(), qty: z.number(), unitPrice: z.number() })).optional(),
    itemName: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { type, context } = parsed.data;

  const company = await prisma.company.findUnique({
    where: { id: session.user.activeCompanyId },
  });

  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const apiKey = settings.openaiApiKey as string | undefined;
  const prompts = (settings.aiSystemPrompts as Record<string, string>) ?? DEFAULT_SETTINGS.aiSystemPrompts;

  const systemPrompt = type === "intro"
    ? prompts.quote_intro ?? DEFAULT_SETTINGS.aiSystemPrompts.quote_intro
    : prompts.quote_outro ?? DEFAULT_SETTINGS.aiSystemPrompts.quote_outro;

  const userPrompt = type === "intro"
    ? `Schrijf een offerte-intro voor: Bedrijf: ${context.companyName}, Klant: ${context.customerName}, Diensten: ${context.items?.map((i) => i.description).join(", ")}`
    : `Schrijf een offerte-afsluittekst voor: Bedrijf: ${context.companyName}, Klant: ${context.customerName}`;

  const text = await generateText(systemPrompt, userPrompt, apiKey);
  return NextResponse.json({ text });
}
