import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await aiStatus());
}
