import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CalculationLinkError } from '@/lib/calculation-link';
import { syncQuoteTotalsFromCalculations } from '@/lib/quote-totals';

const schema = z.object({ quoteId: z.string().min(1), calculationId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { quoteId, calculationId } = parsed.data;
  const companyId = session.user.activeCompanyId;
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
      const quote = await tx.quote.findFirst({ where: { id: quoteId, companyId }, select: { status: true, items: { select: { id: true }, take: 1 } } });
      if (!quote) throw new CalculationLinkError('Offerte niet gevonden.', 404);
      if (quote.status !== 'DRAFT') throw new CalculationLinkError('Ontkoppelen kan alleen bij een conceptofferte.');
      const calculation = await tx.calculation.findFirst({ where: { id: calculationId, companyId }, select: { quoteId: true } });
      if (!calculation) throw new CalculationLinkError('Calculatie niet gevonden.', 404);
      if (calculation.quoteId && calculation.quoteId !== quoteId) throw new CalculationLinkError('Deze calculatie hoort bij een andere offerte.');
      const affected = calculation.quoteId ? 1 : 0;
      if (affected) await tx.calculation.update({ where: { id: calculationId }, data: { quoteId: null } });
      const remaining = await tx.calculation.findMany({ where: { quoteId, companyId, archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }], select: { id: true, number: true, title: true, totalSalesPrice: true, role: true, sortOrder: true } });
      if (remaining.length) await syncQuoteTotalsFromCalculations(quoteId, tx);
      else if (!quote.items.length) await tx.quote.update({ where: { id: quoteId }, data: { totalExVat: 0, totalVat: 0, totalIncVat: 0, pdfUrl: null } });
      return { quoteId, calculationId, affected, calculations: remaining, warning: remaining.filter(c => c.role === 'VARIANT').length === 1 ? 'Er is nog één variant. Die telt als inbegrepen werk totdat een tweede variant wordt gekoppeld.' : null };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CalculationLinkError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[UNLINK CALCULATION]', error);
    return NextResponse.json({ error: 'Ontkoppelen mislukt.' }, { status: 500 });
  }
}
