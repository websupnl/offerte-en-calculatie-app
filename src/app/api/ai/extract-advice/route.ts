import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OpenAI } from "openai";
import { z } from "zod";

const schema = z.object({
  prompt: z.string().min(1),
  customerId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const settings = (company.settings ?? {}) as Record<string, any>;
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenAI API key missing" }, { status: 500 });

  const openai = new OpenAI({ apiKey });

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { prompt, customerId } = parsed.data;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    const systemPrompt = `
      Je bent een expert energie-adviseur voor ${company.name || "Koolhaas Installaties"}.
      Je stelt een professioneel Energie-advies Thuisbatterij op voor de klant ${customer?.name || "de klant"}.
      
      Je analyseert verbruiksgegevens en opwekgegevens om een technisch-commercieel advies te vormen.
      
      RETOURNEER UITSLUITEND JSON in dit formaat:
      {
        "title": "Energie-advies Thuisbatterij",
        "consumption": {
          "annualKwh": 0,
          "nightKwh": 0,
          "solarWp": 0,
          "exportedKwh": 0,
          "phase": 3
        },
        "summary": "Korte krachtige samenvatting van het advies",
        "analysis": "Diepe technische analyse van de huidige situatie",
        "calculation": {
          "steps": ["Stap 1: Nachtverbruik", "Stap 2: Verliezen", "Stap 3: Reserve"],
          "resultKwh": 0
        },
        "scenarios": [
          { "name": "Basis", "capacityKwh": 0, "goal": "Zelfconsumptie" },
          { "name": "Comfort", "capacityKwh": 0, "goal": "Zelfconsumptie + Reserve" },
          { "name": "Maximaal", "capacityKwh": 0, "goal": "Dynamisch handelen" }
        ],
        "recommendation": "Gedetailleerde onderbouwing van het voorkeurs-scenario",
        "financial": {
          "conservative": 0,
          "realistic": 0,
          "optimistic": 0,
          "explanation": "Toelichting bij de jaarlijkse waarde"
        },
        "ems": {
          "recommended": true,
          "benefits": ["Voordeel 1", "Voordeel 2"],
          "explanation": "Waarom wel/geen EMS"
        },
        "backup": {
          "possible": true,
          "reservePercent": 20,
          "explanation": "Wat kan er op de noodstroom"
        },
        "currentDevs": [
          "Salderingsregeling afbouw vanaf 2027",
          "Batterij ondersteunt dynamische sturing"
        ]
      }

      Wees technisch accuraat. Bereken de benodigde capaciteit op basis van nachtverbruik (gemiddeld 5-10 kWh).
      Schrijf namens ${session.user.name || "Daan Koolhaas"} in de ik-vorm.
      Geen verkooppraat, maar technische bewijsvoering.
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

    const data = JSON.parse(content);
    
    // Save to database
    const doc = await prisma.adviceDocument.create({
      data: {
        companyId,
        customerId,
        title: data.title,
        consumption: data.consumption,
        summary: data.summary,
        analysis: data.analysis,
        calculation: data.calculation,
        scenarios: data.scenarios,
        recommendation: data.recommendation,
        financial: data.financial,
        ems: data.ems,
        backup: data.backup,
        currentDevs: data.currentDevs,
      }
    });

    return NextResponse.json({ id: doc.id, ...data });
  } catch (error: any) {
    console.error("AI Advice Error:", error);
    return NextResponse.json({ error: "AI kon het advies niet genereren." }, { status: 500 });
  }
}
