const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const pdfBytes = fs.readFileSync("C:/Users/Daan Koolhaas/Desktop/vb.pdf");
  const b64 = pdfBytes.toString("base64");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  const page = await ctx.newPage();
  
  // Render via embed in HTML
  await page.setContent(`
    <html><body style="margin:0;padding:0;background:#fff">
      <embed src="data:application/pdf;base64,${b64}" type="application/pdf" width="900" height="1200" />
    </body></html>
  `);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "C:/Users/Daan Koolhaas/Desktop/vb-p1.png" });
  process.stdout.write("done\n");
  await browser.close();
})().catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
