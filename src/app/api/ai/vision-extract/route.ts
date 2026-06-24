import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OpenAI } from "openai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const settings = (company.settings ?? {}) as Record<string, unknown>;
  const apiKey = typeof settings.openaiApiKey === "string" && settings.openaiApiKey
    ? settings.openaiApiKey
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key missing" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const systemPrompt = `
      Je bent een expert installateur en technisch adviseur voor ${company.name || "Koolhaas Installaties"}.
      Analyseer de geüploade foto van een technische installatie (bijv. een meterkast, omvormer of warmtepomp).
      
      Identificeer de volgende onderdelen:
      1. Componenten (groepen, schakelaars, aardlekschakelaars, meters).
      2. Merken (bijv. ABB, Hager, Eaton, Schneider).
      3. Technische specificaties (aantal fasen, ampèrage, type).
      4. Benodigdheden voor een uitbreiding (bijv. voor een laadpaal of batterij).

      RETOURNEER UITSLUITEND JSON in dit formaat:
      {
        "findings": ["Korte technische observatie 1", "2"],
        "suggestedItems": [
          { "description": "Omschrijving van het onderdeel", "qty": 1, "unitPrice": 0 }
        ],
        "brand": "Geïdentificeerd merk"
      }

      Wees accuraat. Als je iets niet zeker weet, zet het bij de findings maar niet in de items.
      Schrijf in het Nederlands.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyseer deze installatie en stel de benodigde materialen op voor een offerte." },
            {
              type: "image_url",
              image_url: { url: dataUrl }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Lege respons van AI");

    return NextResponse.json(JSON.parse(content));
  } catch (error: unknown) {
    console.error("AI Vision Error:", error);
    return NextResponse.json({ error: "AI kon de foto niet analyseren." }, { status: 500 });
  }
}
