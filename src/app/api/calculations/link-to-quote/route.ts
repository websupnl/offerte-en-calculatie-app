import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CalculationLinkError, validateCalculationLinks } from '@/lib/calculation-link';
import { syncQuoteTotalsFromCalculations } from '@/lib/quote-totals';
import { createDocumentProject } from '@/lib/document-project';

const schema = z.object({
  calculations: z.array(z.object({ id: z.string().min(1), role: z.enum(['BASE', 'VARIANT', 'OPTION']).optional(), sortOrder: z.number().int().min(0).optional() })).min(1).max(200),
  quoteId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  recommendedCalculationId: z.string().min(1).optional(),
  copyItems: z.literal(false).optional(),
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
      const selected = input.calculations.map(c => {
        const existingRole = calculations.find(existing => existing.id === c.id)?.role;
        return { ...c, role: c.role ?? (existingRole === 'VARIANT' || existingRole === 'OPTION' ? existingRole : 'BASE' as const) };
      });
      validateCalculationLinks(selected, calculations, quote, quote.calculations);
      let nextOrder = Math.max(-1, ...quote.calculations.map(c => c.sortOrder)) + 1;
      for (const calculation of selected) {
        const existing = quote.calculations.find(c => c.id === calculation.id);
        await tx.calculation.update({ where: { id: calculation.id }, data: {
          // Relationship metadata only. Never change source items, prices, totals,
          // customer/project or status when linking an existing calculation.
          quoteId: quote.id, role: calculation.role,
          sortOrder: calculation.sortOrder ?? existing?.sortOrder ?? nextOrder++,
        } });
      }
      if (input.recommendedCalculationId) {
        const variants = await tx.calculation.findMany({ where: { quoteId: quote.id, companyId, archivedAt: null, role: 'VARIANT' }, orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }], select: { id: true } });
        const recommended = variants.find(c => c.id === input.recommendedCalculationId);
        if (!recommended || variants.length < 2) throw new CalculationLinkError('De aanbevolen calculatie moet een van minimaal twee gekoppelde varianten zijn.', 400);
        const ordered = [recommended, ...variants.filter(c => c.id !== recommended.id)];
        for (const [sortOrder, calculation] of ordered.entries()) await tx.calculation.update({ where: { id: calculation.id }, data: { sortOrder } });
      }
      await syncQuoteTotalsFromCalculations(quote.id, tx);
      const linked = await tx.calculation.findMany({ where: { quoteId: quote.id, companyId, archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }], select: { id: true, number: true, title: true, totalSalesPrice: true, role: true, sortOrder: true } });
      return { quoteId: quote.id, quoteLabel: quote.number ?? quote.title ?? `Concept ${quote.id}`, affected: input.calculations.length, calculations: linked };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CalculationLinkError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[LINK CALCULATIONS]', error);
    return NextResponse.json({ error: 'Toevoegen aan offerte mislukt.' }, { status: 500 });
  }
}
