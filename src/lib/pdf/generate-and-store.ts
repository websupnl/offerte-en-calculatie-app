import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    const executablePath = await chromium.executablePath(
      process.env.CHROMIUM_PACK_URL ??
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
    );
    return puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultViewport: (chromium as any).defaultViewport ?? { width: 1280, height: 800 },
      executablePath,
      headless: true,
    });
  }

  const puppeteer = (await import("puppeteer-core")).default;
  const path = await import("path");
  const os = await import("os");
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

  if (!executablePath) throw new Error("No Chromium found. Set CHROMIUM_EXECUTABLE_PATH.");

  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });
}

export async function generateAndStorePdf(
  quoteId: string,
  host: string,
  cookie: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[PDF] BLOB_READ_WRITE_TOKEN not set — skipping PDF pre-generation");
    return null;
  }

  const proto = host.startsWith("localhost") ? "http" : "https";
  const printUrl = `${proto}://${host}/print/quotes/${quoteId}`;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ cookie });
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await browser.close();
    browser = null;

    const blob = await put(`pdfs/offerte-${quoteId}.pdf`, Buffer.from(pdfBuffer), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    await prisma.quote.update({
      where: { id: quoteId },
      data: { pdfUrl: blob.url },
    });

    console.log(`[PDF] Generated and stored: ${blob.url}`);
    return blob.url;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("[PDF] Background generation failed:", err);
    return null;
  }
}
