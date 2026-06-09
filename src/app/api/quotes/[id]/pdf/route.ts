import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Construct the print page URL from the incoming request host
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/quotes/${id}`;

  // Forward the session cookie so the print page can authenticate
  const cookie = req.headers.get("cookie") ?? "";

  let browser: import("playwright-core").Browser | null = null;
  try {
    const { chromium } = await import("playwright-core");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const ctx = await browser.newContext({
      extraHTTPHeaders: { cookie },
    });
    const page = await ctx.newPage();

    await page.goto(printUrl, { waitUntil: "networkidle", timeout: 20000 });

    // Wait for fonts and images to be fully loaded
    await page.waitForTimeout(800);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await browser.close();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="offerte-${id}.pdf"`,
      },
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
