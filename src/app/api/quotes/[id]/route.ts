import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateAndStorePdf } from "@/lib/pdf/generate-and-store";
import {
  calculateQuotePriceSummary,
  quoteChoiceGroupSchema,
  quoteOptionSchema,
} from "@/lib/quote-selection";
import { calculateLine, calculateTotals } from "@/lib/calculation";
import { normalizeQuoteCopyValue } from "@/lib/quote-copy";
import {
  getQuoteAttachmentStorageKey,
  resolveQuoteAttachmentImages,
} from "@/lib/quote-attachments";
import { deleteObject, isStorageConfigured } from "@/lib/storage";

const itemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(1),
  qty: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().nullable().optional(),
  vatRate: z.coerce.number().default(21),
  indent: z.coerce.number().int().min(0).max(1).default(0),
  type: z.string().optional().default("main"),
  hiddenOnQuote: z.boolean().default(false),
});

const attachmentSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional().nullable(),
  imageUrl: z.string().optional().default(""),
  liveUrl: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  section: z.string().optional().nullable(),
}).refine((attachment) => attachment.imageUrl.trim() || attachment.liveUrl?.trim(), {
  message: "Voeg een screenshot of live link toe",
});

const schema = z.object({
  customerId: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  tagline: z.string().optional(),
  itemsHeader: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
  quoteType: z.string().optional(),
  validUntil: z.string().nullable().optional().transform((v) => (v === "" ? null : v)),
  intro: z.string().optional(),
  outro: z.string().optional(),
  notes: z.string().optional(),
  flow: z.any().optional(),
  approach: z.any().optional(),
  options: z.array(quoteOptionSchema).optional(),
  exclusions: z.any().optional(),
  assumptions: z.any().optional(),
  technicalNotes: z.any().optional(),
  customerResponsibilities: z.any().optional(),
  planning: z.any().optional(),
  commercial: z.any().optional(),
  batteryAdvice: z.any().optional(),
  choiceGroups: z.array(quoteChoiceGroupSchema).optional(),
  internalAdvice: z.string().nullable().optional(),
  items: z.array(itemSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { sortOrder: "asc" } },
      adviceDocuments: true,
      share: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const attachments = await resolveQuoteAttachmentImages(quote.attachments, {
    expiresIn: 21600,
    includeStorageRef: true,
  });
  return NextResponse.json({ ...quote, attachments });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existingQuote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: {
      status: true,
      choiceGroups: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          qty: true,
          unitPrice: true,
          costPrice: true,
          vatRate: true,
          total: true,
          indent: true,
          type: true,
          productId: true,
          hiddenOnQuote: true,
        },
      },
      attachments: {
        select: { imageUrl: true },
      },
    },
  });
  if (!existingQuote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existingQuote.status === "ACCEPTED") {
    return NextResponse.json({ error: "Een geaccepteerde offerte is vergrendeld." }, { status: 409 });
  }
  const body = normalizeQuoteCopyValue(await req.json());
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const effectiveItemCount = parsed.data.items === undefined ? existingQuote.items.length : parsed.data.items.length;
  const effectiveChoiceGroups = parsed.data.choiceGroups === undefined
    ? (Array.isArray(existingQuote.choiceGroups) ? existingQuote.choiceGroups : [])
    : parsed.data.choiceGroups;
  if (effectiveItemCount === 0 && effectiveChoiceGroups.length === 0) {
    return NextResponse.json({ error: "Voeg minimaal één offerteregel of configuratie toe." }, { status: 400 });
  }

  const { items, attachments, ...rest } = parsed.data;
  const attachmentPrefix = `offertes/${session.user.activeCompanyId}/`;
  if (attachments?.some((attachment) => {
    const key = getQuoteAttachmentStorageKey(attachment.imageUrl);
    return key !== null && !key.startsWith(attachmentPrefix);
  })) {
    return NextResponse.json(
      { error: "Een offerte-afbeelding hoort niet bij het actieve bedrijf." },
      { status: 400 },
    );
  }
  const removedAttachmentKeys = attachments
    ? existingQuote.attachments
        .map((attachment) => getQuoteAttachmentStorageKey(attachment.imageUrl))
        .filter((key): key is string => Boolean(key))
        .filter((key) => !attachments.some(
          (attachment) => getQuoteAttachmentStorageKey(attachment.imageUrl) === key,
        ))
    : [];

  if (rest.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: rest.customerId, companyId: session.user.activeCompanyId },
      select: { id: true },
    });
    if (!customer) return NextResponse.json({ error: "Klant bestaat niet binnen het actieve bedrijf." }, { status: 400 });
  }
  if (items || parsed.data.choiceGroups !== undefined) {
    const effectiveGroupsForValidation = parsed.data.choiceGroups ??
      (z.array(quoteChoiceGroupSchema).safeParse(existingQuote.choiceGroups ?? []).data ?? []);
    const productIds = [...new Set([
      ...(items ?? []).map((item) => item.productId),
      ...effectiveGroupsForValidation.flatMap((group) =>
        group.choices.flatMap((choice) => choice.items.map((item) => item.productId)),
      ),
    ].filter((productId): productId is string => Boolean(productId)))];
    if (productIds.length > 0) {
      const productCount = await prisma.product.count({
        where: { id: { in: productIds }, companyId: session.user.activeCompanyId, active: true },
      });
      if (productCount !== productIds.length) {
        return NextResponse.json({ error: "Een of meer gekoppelde artikelen bestaan niet binnen het actieve bedrijf." }, { status: 400 });
      }
    }
  }

  let updateData: Record<string, unknown> = { ...rest, pdfUrl: null };

  if (items || parsed.data.choiceGroups !== undefined) {
    const effectiveItems = items ?? existingQuote.items.map((item) => ({
      ...item,
      qty: Number(item.qty),
      unitPrice: Number(item.unitPrice),
      costPrice: item.costPrice == null ? null : Number(item.costPrice),
      vatRate: Number(item.vatRate),
      total: Number(item.total),
    }));
    const parsedExistingGroups = z.array(quoteChoiceGroupSchema).safeParse(existingQuote.choiceGroups ?? []);
    const effectiveGroups =
      parsed.data.choiceGroups ??
      (parsedExistingGroups.success ? parsedExistingGroups.data : []);
    const totals = effectiveGroups.length
      ? calculateQuotePriceSummary(effectiveItems, effectiveGroups).recommended
      : calculateTotals(effectiveItems);

    updateData = {
      ...updateData,
      totalExVat: "totalExVat" in totals ? totals.totalExVat : totals.revenueExVat,
      totalVat: "totalVat" in totals ? totals.totalVat : totals.vat,
      totalIncVat: "totalIncVat" in totals ? totals.totalIncVat : totals.revenueIncVat,
    };
  }

  if (items) {
    const itemsWithTotals = items.map((item, i) => {
      return { ...item, total: calculateLine(item).revenueExVat, sortOrder: i };
    });

    // Replace items
    await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
    await prisma.quoteItem.createMany({
      data: itemsWithTotals.map((item) => ({
        quoteId: id,
        productId: item.productId,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        vatRate: item.vatRate,
        total: item.total,
        sortOrder: item.sortOrder,
        indent: item.indent,
        type: item.type,
        hiddenOnQuote: item.hiddenOnQuote,
      })),
    });
  }

  if (attachments) {
    await prisma.quoteAttachment.deleteMany({ where: { quoteId: id } });
    if (attachments.length) {
      await prisma.quoteAttachment.createMany({
        data: attachments.map((attachment, sortOrder) => ({
          quoteId: id,
          title: attachment.title,
          imageUrl: attachment.imageUrl,
          liveUrl: attachment.liveUrl,
          caption: attachment.caption,
          section: attachment.section,
          sortOrder,
        })),
      });
    }
  }

  // Handle validUntil date conversion
  if (updateData.validUntil) {
    updateData.validUntil = new Date(updateData.validUntil as string);
  }

  await prisma.quote.update({
    where: { id, companyId: session.user.activeCompanyId },
    data: updateData,
  });

  if (isStorageConfigured() && removedAttachmentKeys.length > 0) {
    await Promise.all(
      removedAttachmentKeys.map((key) =>
        deleteObject(key).catch((error) => {
          console.error("[QUOTE ATTACHMENT] S3 cleanup failed:", error);
        }),
      ),
    );
  }

  // Auto-generate PDF in background after response is sent
  const host = req.headers.get("host") ?? "localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";
  after(async () => {
    await generateAndStorePdf(id, host, cookie);
  });

  return NextResponse.json({ ok: true });
}

import { del } from "@vercel/blob";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.user.activeCompanyId },
    select: {
      pdfUrl: true,
      attachments: { select: { imageUrl: true } },
    },
  });

  if (quote?.pdfUrl) {
    try {
      await del(quote.pdfUrl);
    } catch (err) {
      console.error("[DELETE] Failed to delete blob:", err);
    }
  }

  await prisma.quote.deleteMany({
    where: { id, companyId: session.user.activeCompanyId },
  });

  if (quote && isStorageConfigured()) {
    const keys = quote.attachments
      .map((attachment) => getQuoteAttachmentStorageKey(attachment.imageUrl))
      .filter((key): key is string => Boolean(key));
    await Promise.all(
      keys.map((key) =>
        deleteObject(key).catch((error) => {
          console.error("[DELETE] Failed to delete quote attachment:", error);
        }),
      ),
    );
  }

  return NextResponse.json({ ok: true });
}
