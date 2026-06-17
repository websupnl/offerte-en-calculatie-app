import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OpenAI } from "openai";
import { z } from "zod";

const schema = z.object({
  prompt: z.string().min(1),
  customerName: z.string().optional().default("de klant"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const settings = (company.settings ?? {}) as Record<string, any>;
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key missing" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { prompt, customerName } = parsed.data;
    const userName = session.user.name || "Daan Koolhaas";
    const companyName = company.name || "WebsUp.nl";

    const systemPrompt = `
      Je bent een expert in het opstellen van professionele offertes en technisch advies voor ${companyName}.
      De gebruiker geeft je ruwe aantekeningen, een ChatGPT gesprek of projectdetails.
      
      Je taak is om TWEE dingen te genereren:
      1. Een heldere klantofferte (commercieel).
      2. Een diepgaand intern technisch advies (voor ${userName}).

      RETOURNEER UITSLUITEND JSON volgens dit schema:
      {
        "quoteType": "GENERAL | BATTERY | SOLAR | WEB",
        "title": "Projecttitel",
        "category": "Hoofdcategorie",
        "tagline": "Drie kernwoorden gescheiden door dots",
        "choiceGroups": [
          { "id": "g1", "title": "Kies uw oplossing", "type": "SINGLE_SELECT" }
        ],
        "items": [
          { 
            "description": "Omschrijving", 
            "qty": 1, 
            "unitPrice": 0, 
            "costPrice": 0, 
            "vatRate": 21,
            "type": "main | option",
            "choiceGroupId": "g1 (optioneel, indien onderdeel van een keuze-blok)" 
          }
        ],
        "options": [{ "t": "Titel", "d": "Beschrijving", "tag": "Prijs" }],
        "exclusions": ["Wat is niet inbegrepen"],
        "assumptions": ["Technische aannames"],
        "internalAdvice": "Technisch advies blok...",
        "outro": "Afsluitend slotwoord"
      }

      TIP: Als de klant vraagt om opties of als er verschillende batterij-groottes zinvol zijn, maak dan gebruik van 'choiceGroups' en koppel de relevante items via 'choiceGroupId'.

      Context:
      Klantnaam: ${customerName}
      Bedrijf: ${companyName} (${userName})
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Lege respons van AI");

    return NextResponse.json(JSON.parse(content));
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    return NextResponse.json({ error: "AI kon de gegevens niet extraheren." }, { status: 500 });
  }
}

