import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { OpenAI } from "openai";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, customerName } = await req.json();

    const systemPrompt = `
      Je bent een expert in het opstellen van zakelijke offertes voor WebsUp.nl. 
      De gebruiker geeft je ruwe aantekeningen, een ChatGPT gesprek of projectdetails.
      Extraheer en genereer alle benodigde velden voor een korte, duidelijke offerte.
      Schrijf voor niet-technische klanten: verkoop het resultaat en het probleem dat wordt opgelost, niet alleen de techniek.
      Koppel website-onderdelen aan klantwaarde, bijvoorbeeld: bezoekers kunnen sneller vinden wat beschikbaar is,
      eenvoudiger vergelijken/contact opnemen, en de klant kan zelf zonder gedoe content of voorraad beheren.
      Gebruik de taal van de klant (Nederlands).

      RETOURNEER UITSLUITEND JSON in dit formaat:
      {
        "title": "Projecttitel (bijv. Maatwerk website voor...)",
        "category": "Categorie (bijv. Webdevelopment / WordPress)",
        "tagline": "Drie kernwoorden gescheiden door dots (bijv. Ontwerp · Bouw · SEO)",
        "intro": "Een persoonlijke inleidende brief aan de klant. Benoem doel, waarde en praktische uitkomst.",
        "itemsHeader": "Klantgerichte titel voor wat inbegrepen is",
        "items": [
          { "description": "Onderdeel omschrijving met klantwaarde, niet alleen technische feature", "qty": 1, "unitPrice": 0 }
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

      Vermijd:
      - een lange proces/werkwijze-sectie;
      - technische opsommingen zonder uitleg wat de klant eraan heeft;
      - woorden als database of beheerpaneel zonder praktische betekenis.
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
