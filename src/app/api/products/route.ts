import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().default("stuk"),
  basePrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).default(21),
  specs: z.record(z.string(), z.unknown()).optional().default({}),
  active: z.boolean().default(true),
  datasheetId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = session.user.activeCompanyId;
  const category = req.nextUrl.searchParams.get("category");

  const products = await prisma.product.findMany({
    where: {
      companyId,
      active: true,
      category: category || undefined,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const datasheet = parsed.data.datasheetId
    ? await prisma.datasheet.findFirst({
        where: { id: parsed.data.datasheetId, companyId: session.user.activeCompanyId },
        include: { product: { select: { id: true } } },
      })
    : null;
  if (parsed.data.datasheetId && !datasheet) {
    return NextResponse.json({ error: "Leveranciersprijs bestaat niet binnen het actieve bedrijf." }, { status: 400 });
  }
  if (datasheet?.product) {
    return NextResponse.json({ error: "Deze leveranciersprijs is al aan een artikel gekoppeld." }, { status: 409 });
  }

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      costPrice: datasheet?.price ?? parsed.data.costPrice,
      specs: JSON.parse(JSON.stringify(parsed.data.specs ?? {})),
      companyId: session.user.activeCompanyId,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
