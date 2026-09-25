import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { linesFromSource } from "@/lib/invoice-sources";
import { invoiceSourceSchema } from "../lines-schema";

/** Regels uit een bron ophalen zonder iets op te slaan, om ze eerst te bewerken. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = invoiceSourceSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const result = await linesFromSource(parsed.data, session.user.activeCompanyId);
  if (!result) return NextResponse.json({ error: "Bron niet gevonden" }, { status: 404 });
  return NextResponse.json(result);
}
