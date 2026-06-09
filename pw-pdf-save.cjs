const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 10000 });
  await page.fill("input[name=email]", "daan@websup.nl");
  await page.fill("input[name=password]", "Admin123!");
  await page.click("button[type=submit]");
  await page.waitForNavigation({ timeout: 8000 }).catch(() => {});
  
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.goto("http://localhost:3000/api/quotes/cmq49idzi000088l6awp8xa5p/pdf"),
  ]);
  await download.saveAs("C:/Users/Daan Koolhaas/Desktop/test-offerte.pdf");
  process.stdout.write("PDF saved\n");
  await browser.close();
})().catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
