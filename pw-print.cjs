const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  const page = await ctx.newPage();
  
  // Load PDF via print page which renders QuoteSheetPreview (the HTML version)
  await page.goto("http://localhost:3000/print/portal/3fdd77f2-a400-4ed9-a43b-9438a4deec54", { waitUntil: "networkidle", timeout: 15000 });
  
  // Take full page screenshot for comparison
  await page.screenshot({ path: "C:/Users/Daan Koolhaas/Desktop/print-preview.png", fullPage: true });
  process.stdout.write("done\n");
  await browser.close();
})().catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
