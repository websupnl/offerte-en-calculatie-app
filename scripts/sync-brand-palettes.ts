import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_BRANDING } from "../src/lib/branding";

config({ path: ".env.local", quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const companies = await tx.company.findMany({ where: { slug: { in: ["websup", "koolhaas"] } }, select: { id: true, slug: true, branding: true } });
      for (const company of companies) {
        const palette = DEFAULT_BRANDING[company.slug];
        const branding = {
          ...((company.branding ?? {}) as Record<string, unknown>),
          primaryColor: palette.primaryColor, accentColor: palette.accentColor,
          backgroundColor: palette.backgroundColor, textColor: palette.textColor,
          gradient: { ...palette.gradient },
        };
        await tx.company.update({ where: { id: company.id }, data: { branding } });
        await tx.quote.updateMany({ where: { companyId: company.id }, data: { pdfUrl: null } });
        await tx.quoteShare.updateMany({ where: { quote: { companyId: company.id } }, data: { portalPdfUrl: null } });
      }
      return companies.map((company) => company.slug);
    });
    console.log(`Websitepaletten opgeslagen: ${updated.join(", ")}. Logo's, fonts en overige instellingen behouden.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
