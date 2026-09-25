import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createWorkOrderFrom, ensureProject } from "@/lib/convert";

const schema = z.object({
  from: z.object({ type: z.enum(["quote", "calculation"]), id: z.string().min(1) }),
  make: z.enum(["project", "workorder"]),
});

/** Offerte of calculatie doorzetten naar project of werkbon. Zie src/lib/convert.ts. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const companyId = session.user.activeCompanyId;

  if (parsed.data.make === "project") {
    const r = await ensureProject(parsed.data.from, companyId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ projectId: r.projectId, created: r.created });
  }
  const r = await createWorkOrderFrom(parsed.data.from, companyId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r, { status: 201 });
}
