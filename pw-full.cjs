const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 794, height: 6000 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/q/3fdd77f2-a400-4ed9-a43b-9438a4deec54", { waitUntil: "networkidle", timeout: 15000 });
  await page.screenshot({ path: "C:/Users/Daan Koolhaas/Desktop/quote-full.png", fullPage: true });
  process.stdout.write("done\n");
  await browser.close();
})().catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
