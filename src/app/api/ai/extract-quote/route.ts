import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, customerName } = await req.json();

    const systemPrompt = `
      Je bent een expert in het opstellen van zakelijke offertes voor WebsUp.nl. 
      De gebruiker geeft je ruwe aantekeningen, een ChatGPT gesprek of projectdetails.
      Extraheer en genereer alle benodigde velden voor een professionele 5-pagina offerte.
      Gebruik de taal van de klant (Nederlands).

      RETOURNEER UITSLUITEND JSON in dit formaat:
      {
        "title": "Projecttitel (bijv. Maatwerk website voor...)",
        "category": "Categorie (bijv. Webdevelopment / WordPress)",
        "tagline": "Drie kernwoorden gescheiden door dots (bijv. Ontwerp · Bouw · SEO)",
        "intro": "Een persoonlijke inleidende brief aan de klant",
        "itemsHeader": "Titel voor de deliverables sectie",
        "items": [
          { "description": "Onderdeel omschrijving", "qty": 1, "unitPrice": 0 }
        ],
        "flow": [
          { "n": 1, "t": "Titel stap", "d": "Beschrijving stap" }
        ],
        "approach": [
          { "n": "01", "t": "Fase titel", "d": "Fase beschrijving" }
        ],
        "options": [
          { "t": "Optie titel", "d": "Beschrijving", "tag": "Prijs indicatie" }
        ],
        "exclusions": ["Uitsluiting 1", "Uitsluiting 2"],
        "outro": "Een afsluitend slotwoord"
      }

      Context:
      Klantnaam: ${customerName}
      Bedrijf: WebsUp.nl (Daan Koolhaas)
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
