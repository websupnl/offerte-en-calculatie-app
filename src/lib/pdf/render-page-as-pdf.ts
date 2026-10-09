import path from "path";
import os from "os";
import fs from "fs";

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    // De pack-URL moet exact overeenkomen met de geïnstalleerde @sparticuz/chromium-min
    // versie (zie package.json) — sinds v137 heet het asset "…-pack.x64.tar" i.p.v.
    // "…-pack.tar", en een oudere/verkeerde pack laat chromium.executablePath() stil falen.
    // Hardcoded i.p.v. dynamisch opgezocht: het package's "exports" map staat geen
    // "package.json"-subpath toe (Turbopack build-fout), en require.resolve() levert
    // in een gebundelde build geen bestandspad maar een numerieke module-id terug
    // (runtime TypeError "<nummer>.indexOf is not a function"). Bij het upgraden van
    // @sparticuz/chromium-min in package.json moet deze versie mee-updaten.
    const chromiumVersion = "149.0.0";
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const executablePath = await chromium.executablePath(
      process.env.CHROMIUM_PACK_URL ??
        `https://github.com/Sparticuz/chromium/releases/download/v${chromiumVersion}/chromium-v${chromiumVersion}-pack.${arch}.tar`
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

  // Windows: search all installed playwright chromium versions dynamically
  const candidates: string[] = [];
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    candidates.push(process.env.CHROMIUM_EXECUTABLE_PATH);
  }
  if (process.platform === "win32") {
    const playwrightDir = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
    try {
      const entries = fs.readdirSync(playwrightDir).filter((e) => e.startsWith("chromium-"));
      for (const entry of entries) {
        candidates.push(path.join(playwrightDir, entry, "chrome-win64", "chrome.exe"));
        candidates.push(path.join(playwrightDir, entry, "chrome-win", "chrome.exe"));
      }
    } catch { /* dir doesn't exist */ }
    candidates.push(
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
    );
  }
  candidates.push("/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium");

  const executablePath = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!executablePath) throw new Error("No Chromium found. Run: npx playwright install chromium, or set CHROMIUM_EXECUTABLE_PATH.");

  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    executablePath,
    headless: true,
  });
}

/**
 * Renders a Next.js print page as PDF via headless Chromium.
 * @param url     Full URL of the print page (e.g. http://localhost:3001/print/portal/abc123)
 * @param cookie  Optional session cookie string for authenticated pages
 * @param expectedSelector  Element that must exist before accepting the PDF
 */
export async function renderQuotePreview(url: string, cookie: string, startPage = 0, limit = 4) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1 });
    if (cookie) await page.setExtraHTTPHeaders({ cookie });
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!response?.ok() || new URL(page.url()).pathname !== new URL(url).pathname) throw new Error("De klantweergave is niet bereikbaar");
    await page.waitForSelector(".sheet", { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const sheets = await page.$$(".sheet");
    const images: string[] = [];
    for (const sheet of sheets.slice(startPage, startPage + limit)) {
      images.push(Buffer.from(await sheet.screenshot({ type: "png" })).toString("base64"));
    }
    const text = await page.evaluate(() => Array.from(document.querySelectorAll(".sheet")).map((sheet) => (sheet as HTMLElement).innerText));
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll(".sheet")).map((sheet, index) => ({ page: index + 1, overflow: sheet.scrollHeight > sheet.clientHeight + 2 })).filter((row) => row.overflow));
    return { pageCount: sheets.length, startPage, images, text, overflow };
  } finally { await browser.close().catch(() => {}); }
}

export async function renderPageAsPdf(url: string, cookie?: string, expectedSelector?: string): Promise<Buffer | null> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    if (cookie) await page.setExtraHTTPHeaders({ cookie });
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    if (!response?.ok() || new URL(page.url()).pathname !== new URL(url).pathname) {
      const requested = new URL(url);
      const landed = new URL(page.url());
      // Geen querystring of cookies loggen: print-URL's kunnen geheime tokens bevatten.
      throw new Error(
        `Print page is unavailable or redirected (HTTP ${response?.status() ?? "no response"}; ` +
        `${requested.host}${requested.pathname} -> ${landed.host}${landed.pathname})`,
      );
    }
    if (expectedSelector) await page.waitForSelector(expectedSelector, { timeout: 5000 });
    await page.evaluate(() => document.fonts.ready);
    // Extra settle time for fonts / images
    await new Promise((r) => setTimeout(r, 800));
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(buffer);
  } catch (err) {
    console.error("[PDF] renderPageAsPdf failed:", err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
