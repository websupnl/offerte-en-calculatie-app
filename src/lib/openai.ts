import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAI(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key niet geconfigureerd");
  if (!_client || apiKey) {
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  apiKey?: string
): Promise<string> {
  const client = getOpenAI(apiKey);
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function generateAdviceDocument(
  systemPrompt: string,
  customerData: Record<string, unknown>,
  products: { name: string; specs: Record<string, unknown> }[],
  apiKey?: string
): Promise<string> {
  const userPrompt = `
Klantgegevens:
${JSON.stringify(customerData, null, 2)}

Aanbevolen producten:
${products.map((p) => `- ${p.name}: ${JSON.stringify(p.specs)}`).join("\n")}

Schrijf nu het volledige adviesdocument in Markdown-formaat met kopjes, bullet points en berekeningen waar relevant.
`;
  return generateText(systemPrompt, userPrompt, apiKey);
}
