import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeCompanyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) return NextResponse.json({ results: [] });

  const companyId = session.user.activeCompanyId;
  const [quotes, projects, customers, products] = await Promise.all([
    prisma.quote.findMany({
      where: {
        companyId,
        archivedAt: null,
        OR: [
          { number: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: { id: true, number: true, title: true, customer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.project.findMany({
      where: {
        companyId,
        OR: [
          { number: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: { id: true, number: true, title: true, customer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, city: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.product.findMany({
      where: {
        companyId,
        active: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, category: true, basePrice: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  return NextResponse.json({
    results: [
      ...quotes.map((quote) => ({
        id: quote.id,
        type: "quote",
        title: quote.title || quote.number,
        subtitle: `${quote.number} · ${quote.customer.name}`,
        href: `/quotes/${quote.id}`,
      })),
      ...projects.map((project) => ({
        id: project.id,
        type: "project",
        title: project.title,
        subtitle: `${project.number} · ${project.customer.name}`,
        href: `/projects/${project.id}`,
      })),
      ...customers.map((customer) => ({
        id: customer.id,
        type: "customer",
        title: customer.name,
        subtitle: customer.email || customer.city || "Klant",
        href: `/customers/${customer.id}`,
      })),
      ...products.map((product) => ({
        id: product.id,
        type: "product",
        title: product.name,
        subtitle: `${product.category} · € ${Number(product.basePrice).toFixed(2)}`,
        href: `/admin/products?product=${product.id}`,
      })),
    ],
  });
}
