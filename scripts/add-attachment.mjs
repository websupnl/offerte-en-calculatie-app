import { prisma } from './db.mjs';

const quoteId = 'cmrxih3z4000amhfplfpbafpx';
const imageUrl = 's3://koolhaas-bestanden/offertes/cmpv4v78x00017kubf2jpv6n4/cc4b5872-23f7-4716-9690-2a44b7d5292e.png';

const existing = await prisma.quoteAttachment.findFirst({ where: { quoteId } });
if (existing) {
  console.log('Attachment bestaat al:', existing.id);
} else {
  const att = await prisma.quoteAttachment.create({
    data: {
      quoteId,
      title: 'Voorbeeld Growatt-opstelling',
      imageUrl,
      caption: 'Indicatie van de Growatt APX-batterij met omvormer',
      sortOrder: 0,
    },
  });
  console.log('Attachment toegevoegd:', att.id);
}
await prisma.$disconnect();
