import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma";

function authorized(req: NextRequest) {
  const key = req.headers.get("x-cli-key");
  return key && key === process.env.CLI_API_KEY;
}

const productSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  category: z.string().optional().nullable(),
  specs: z.record(z.string(), z.unknown()).optional().default({}),
  price: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
});

const bodySchema = z.object({
  companySlug: z.string().min(1),
  products: z.array(productSchema).min(1),
});

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companySlug, products } = parsed.data;

  const company = await prisma.company.findFirst({ where: { slug: companySlug } });
  if (!company) {
    return NextResponse.json({ error: `Bedrijf '${companySlug}' niet gevonden` }, { status: 404 });
  }

  const results = { saved: 0, updated: 0, errors: [] as string[] };

  for (const p of products) {
    try {
      const existing = await prisma.datasheet.findFirst({
        where: { companyId: company.id, brand: p.brand, model: p.model },
      });

      if (existing) {
        await prisma.datasheet.update({
          where: { id: existing.id },
          data: {
            category: p.category ?? existing.category,
            specs: (p.specs ?? existing.specs) as Prisma.InputJsonValue,
            price: p.price ?? existing.price,
            notes: p.notes ?? existing.notes,
            sourceUrl: p.sourceUrl ?? existing.sourceUrl,
          },
        });
        results.updated++;
      } else {
        await prisma.datasheet.create({
          data: {
            companyId: company.id,
            brand: p.brand,
            model: p.model,
            category: p.category ?? null,
            specs: (p.specs ?? {}) as Prisma.InputJsonValue,
            price: p.price ?? null,
            notes: p.notes ?? null,
            sourceUrl: p.sourceUrl ?? null,
          },
        });
        results.saved++;
      }
    } catch (e) {
      results.errors.push(`${p.brand} ${p.model}: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  return NextResponse.json(results);
}
