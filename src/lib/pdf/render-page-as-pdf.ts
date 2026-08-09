import path from "path";
import os from "os";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    // De pack-URL moet exact overeenkomen met de geïnstalleerde @sparticuz/chromium-min
    // versie (zie package.json) — sinds v137 heet het asset "…-pack.x64.tar" i.p.v.
    // "…-pack.tar", en een oudere/verkeerde pack laat chromium.executablePath() stil falen.
    // require.resolve i.p.v. een subpath-require: het package's "exports" map staat
    // alleen "." toe, dus "@sparticuz/chromium-min/package.json" faalt bij Turbopack.
    const chromiumEntry = require.resolve("@sparticuz/chromium-min");
    const chromiumPkgPath = path.join(chromiumEntry.slice(0, chromiumEntry.indexOf("build")), "package.json");
    const chromiumVersion = (JSON.parse(fs.readFileSync(chromiumPkgPath, "utf8")) as { version: string }).version;
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
  }
  candidates.push("/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium");

  const executablePath = candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!executablePath) throw new Error("No Chromium found. Run: npx playwright install chromium  — or set CHROMIUM_EXECUTABLE_PATH.");

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
 */
export async function renderPageAsPdf(url: string, cookie?: string): Promise<Buffer | null> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    if (cookie) await page.setExtraHTTPHeaders({ cookie });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
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
