import { NextResponse } from "next/server";
import {
  QUOTE_IMPORT_AI_SYSTEM_PROMPT,
  QUOTE_IMPORT_CONTRACT_VERSION,
  quoteImportJsonSchema,
} from "@/lib/quote-import";

export function GET() {
  return NextResponse.json({
    version: QUOTE_IMPORT_CONTRACT_VERSION,
    systemPrompt: QUOTE_IMPORT_AI_SYSTEM_PROMPT,
    jsonSchema: quoteImportJsonSchema,
    rules: {
      items: "Vaste basis van de offerte; nooit alternatieve systemen of optioneel meerwerk.",
      configurations: "Volledige onderling exclusieve systemen; klant kiest exact één per groep bij akkoord.",
      optionalWork: "Los selecteerbaar meerwerk met expliciete prijs exclusief btw.",
      totals: "Nooit door AI aanleveren; de app berekent alle totalen.",
    },
  });
}
