import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create companies
  const websup = await prisma.company.upsert({
    where: { slug: "websup" },
    update: {},
    create: {
      name: "WebsUp.nl",
      slug: "websup",
      branding: {
        primaryColor: "#0F172A",
        accentColor: "#6366F1",
        backgroundColor: "#F8FAFC",
        font: "Inter",
        tagline: "Websites, apps & systemen die groeien",
      },
      settings: {
        defaultVatRate: 21,
        quoteValidDays: 30,
        quoteIntroDefault: "Hartelijk dank voor uw interesse in onze diensten. Hierbij ontvangt u onze offerte.",
        quoteOutroDefault: "Wij hopen u hiermee een passend aanbod te hebben gedaan. Neem gerust contact op voor vragen.",
        paymentTerms: "Betaling binnen 14 dagen na factuurdatum. Prijzen zijn excl. BTW.",
        aiSystemPrompts: {},
      },
    },
  });

  const koolhaas = await prisma.company.upsert({
    where: { slug: "koolhaas" },
    update: {},
    create: {
      name: "Koolhaas Installaties",
      slug: "koolhaas",
      branding: {
        primaryColor: "#0F2818",
        accentColor: "#16A34A",
        backgroundColor: "#F0FDF4",
        font: "Inter",
        tagline: "Persoonlijk · Technisch sterk · Friesland",
      },
      settings: {
        defaultVatRate: 21,
        quoteValidDays: 30,
        quoteIntroDefault: "Dank voor uw interesse. Naar aanleiding van ons gesprek sturen wij u graag onze offerte toe.",
        quoteOutroDefault: "Heeft u vragen? Neem gerust contact op. Wij staan voor u klaar.",
        paymentTerms: "Betaling binnen 14 dagen na factuurdatum.",
        aiSystemPrompts: {},
      },
    },
  });

  console.log(`Companies created: ${websup.name}, ${koolhaas.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash("Admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "daan@websup.nl" },
    update: {},
    create: {
      name: "Daan Koolhaas",
      email: "daan@websup.nl",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // Link admin to both companies
  await prisma.companyUser.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: websup.id } },
    update: {},
    create: { userId: admin.id, companyId: websup.id, role: "ADMIN" },
  });

  await prisma.companyUser.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: koolhaas.id } },
    update: {},
    create: { userId: admin.id, companyId: koolhaas.id, role: "ADMIN" },
  });

  console.log(`Admin user created: ${admin.email} (wachtwoord: Admin123!)`);

  // Seed WebsUp sample products
  const websupProducts = [
    { category: "Website / Webdesign", name: "Starter website (5 pagina's)", basePrice: 1250, unit: "project" },
    { category: "Website / Webdesign", name: "Business website (10 pagina's)", basePrice: 2250, unit: "project" },
    { category: "Website / Webdesign", name: "Maatwerk website", basePrice: 4500, unit: "project" },
    { category: "Webshop", name: "Starter webshop (WooCommerce)", basePrice: 2500, unit: "project" },
    { category: "Webshop", name: "Business webshop", basePrice: 4500, unit: "project" },
    { category: "SEO & Marketing", name: "SEO setup & optimalisatie", basePrice: 850, unit: "project" },
    { category: "SEO & Marketing", name: "SEO maandelijks beheer", basePrice: 250, unit: "maand" },
    { category: "Hosting & Onderhoud", name: "Hosting starter", basePrice: 25, unit: "maand" },
    { category: "Hosting & Onderhoud", name: "Hosting business", basePrice: 55, unit: "maand" },
    { category: "Hosting & Onderhoud", name: "Maandelijks onderhoud", basePrice: 95, unit: "maand" },
    { category: "Maatwerk Module", name: "Offerte tool / calculator", basePrice: 1500, unit: "project" },
    { category: "Maatwerk Module", name: "Klantportaal", basePrice: 2500, unit: "project" },
  ];

  for (const p of websupProducts) {
    await prisma.product.upsert({
      where: { id: `websup-${p.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `websup-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
        companyId: websup.id,
        ...p,
        vatRate: 21,
        specs: {},
      },
    });
  }

  // Seed Koolhaas sample products
  const koolhaasProducts = [
    { category: "Thuisbatterij", name: "BYD Battery-Box Premium HVS 5.1 kWh", basePrice: 2450, unit: "stuk", specs: { merk: "BYD", capaciteit_kwh: 5.1, type: "Lithium" } },
    { category: "Thuisbatterij", name: "BYD Battery-Box Premium HVS 10.2 kWh", basePrice: 4200, unit: "stuk", specs: { merk: "BYD", capaciteit_kwh: 10.2 } },
    { category: "Thuisbatterij", name: "Pylontech Force H2 10 kWh", basePrice: 3800, unit: "stuk", specs: { merk: "Pylontech", capaciteit_kwh: 10 } },
    { category: "Thuisbatterij", name: "Installatie thuisbatterij (inclusief bekabeling)", basePrice: 650, unit: "project" },
    { category: "EMS & Energiemanagement", name: "Solarman EMS module", basePrice: 450, unit: "stuk" },
    { category: "EMS & Energiemanagement", name: "Victron Venus GX", basePrice: 350, unit: "stuk" },
    { category: "EMS & Energiemanagement", name: "Installatie EMS systeem", basePrice: 350, unit: "project" },
    { category: "Zonnepanelen", name: "Zonnepaneel 430 Wp (per stuk)", basePrice: 185, unit: "stuk", specs: { vermogen_wp: 430 } },
    { category: "Zonnepanelen", name: "Omvormer SolarEdge 5000W", basePrice: 1100, unit: "stuk" },
    { category: "Zonnepanelen", name: "Installatie zonnepanelen", basePrice: 95, unit: "stuk" },
    { category: "Verdeelkast & Elektra", name: "Verdeelkast vervangen (1-fase)", basePrice: 850, unit: "project" },
    { category: "Verdeelkast & Elektra", name: "Verdeelkast vervangen (3-fase)", basePrice: 1250, unit: "project" },
    { category: "Verdeelkast & Elektra", name: "Extra groep aanleggen", basePrice: 175, unit: "stuk" },
    { category: "Camera's & Advies", name: "IP camera buiten (Hikvision)", basePrice: 195, unit: "stuk" },
    { category: "Camera's & Advies", name: "NVR recorder 8-kanaals", basePrice: 350, unit: "stuk" },
    { category: "Camera's & Advies", name: "Installatie camerasysteem", basePrice: 85, unit: "uur" },
  ];

  for (const p of koolhaasProducts) {
    const id = `koolhaas-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`;
    await prisma.product.upsert({
      where: { id },
      update: {},
      create: {
        id,
        companyId: koolhaas.id,
        category: p.category,
        name: p.name,
        basePrice: p.basePrice,
        unit: p.unit,
        vatRate: 21,
        specs: p.specs ?? {},
      },
    });
  }

  console.log("Sample products created");
  console.log("\n✅ Seed complete!");
  console.log("Login: daan@websup.nl / Admin123!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
