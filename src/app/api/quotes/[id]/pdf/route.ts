import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel serverless max duration (seconds)
export const maxDuration = 60;

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    const executablePath = await chromium.executablePath(
      // Hosted chromium pack — Vercel downloads this at runtime
      process.env.CHROMIUM_PACK_URL ??
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
    );

    return puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });
  }

  // Local dev: use the playwright chromium binary
  const puppeteer = (await import("puppeteer-core")).default;
  const path = await import("path");
  const os = await import("os");

  // Walk common local-dev playwright chromium locations
  const candidates = [
    process.env.CHROMIUM_EXECUTABLE_PATH,
    path.join(os.homedir(), "AppData", "Local", "ms-playwright", "chromium-1223", "chrome-win64", "chrome.exe"),
    path.join(os.homedir(), "AppData", "Local", "ms-playwright", "chromium-1148", "chrome-win64", "chrome.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean) as string[];

  const fs = await import("fs");
  const executablePath = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!executablePath) throw new Error("No Chromium found for local dev. Set CHROMIUM_EXECUTABLE_PATH.");

  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/quotes/${id}`;
  const cookie = req.headers.get("cookie") ?? "";

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({ cookie });
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 800));

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
