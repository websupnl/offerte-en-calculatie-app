import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CalculationLinkError, validateCalculationLinks } from '@/lib/calculation-link';
import { syncQuoteTotalsFromCalculations } from '@/lib/quote-totals';
import { createDocumentProject } from '@/lib/document-project';

const schema = z.object({
  calculations: z.array(z.object({ id: z.string().min(1), role: z.enum(['BASE', 'VARIANT']) })).min(1).max(200),
  quoteId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  title: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige selectie', details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const companyId = session.user.activeCompanyId;
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
      const calculations = await tx.calculation.findMany({ where: { id: { in: input.calculations.map(c => c.id) }, companyId, archivedAt: null } });
      let quote = input.quoteId ? await tx.quote.findFirst({ where: { id: input.quoteId, companyId }, include: { items: { select: { id: true }, take: 1 }, calculations: { where: { archivedAt: null }, select: { id: true, role: true, sortOrder: true } } } }) : null;
      if (input.quoteId && !quote) throw new CalculationLinkError('Offerte niet gevonden.', 404);
      if (!quote) {
        const customerIds = [...new Set(calculations.map(c => c.customerId).filter(Boolean))];
        const customerId = input.customerId || (customerIds.length === 1 ? customerIds[0] : null);
        if (!customerId) throw new CalculationLinkError('Kies een klant voor de nieuwe offerte.', 400);
        const customer = await tx.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } });
        if (!customer) throw new CalculationLinkError('Klant niet gevonden.', 404);
        const title = input.title || calculations.map(c => c.title).join(' + ');
        const project = await createDocumentProject(tx, { companyId, customerId, title });
        quote = await tx.quote.create({ data: { companyId, customerId, projectId: project.id, createdById: session.user.id, title }, include: { items: { select: { id: true }, take: 1 }, calculations: { select: { id: true, role: true, sortOrder: true } } } });
      }
      validateCalculationLinks(input.calculations, calculations, quote, quote.calculations);
      let nextOrder = Math.max(-1, ...quote.calculations.map(c => c.sortOrder)) + 1;
      for (const selected of input.calculations) {
        const existing = quote.calculations.find(c => c.id === selected.id);
        await tx.calculation.update({ where: { id: selected.id }, data: {
          quoteId: quote.id, customerId: quote.customerId, projectId: quote.projectId,
          role: selected.role, status: 'QUOTED', sortOrder: existing?.sortOrder ?? nextOrder++,
        } });
      }
      await syncQuoteTotalsFromCalculations(quote.id, tx);
      return { quoteId: quote.id, affected: input.calculations.length };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CalculationLinkError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[LINK CALCULATIONS]', error);
    return NextResponse.json({ error: 'Toevoegen aan offerte mislukt.' }, { status: 500 });
  }
}
