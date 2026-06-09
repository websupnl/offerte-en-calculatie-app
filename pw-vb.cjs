const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  const page = await ctx.newPage();
  
  // Screenshot vb.pdf via file:// URL
  await page.goto("file:///C:/Users/Daan Koolhaas/Desktop/vb.pdf", { timeout: 10000 });
  await page.screenshot({ path: "C:/Users/Daan Koolhaas/Desktop/vb-p1.png", fullPage: false });
  process.stdout.write("done\n");
  await browser.close();
})().catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
