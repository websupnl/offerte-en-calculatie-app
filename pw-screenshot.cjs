const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/q/3fdd77f2-a400-4ed9-a43b-9438a4deec54", { waitUntil: "networkidle", timeout: 15000 });
  const sections = [
    { y: 0, name: "qs1" },
    { y: 1123, name: "qs2" },
    { y: 2246, name: "qs3" },
    { y: 3369, name: "qs4" },
    { y: 4492, name: "qs5" },
  ];
  for (const s of sections) {
    await page.screenshot({
      path: `C:/Users/Daan Koolhaas/Desktop/${s.name}.png`,
      clip: { x: 0, y: s.y, width: 794, height: 1123 }
    });
    process.stdout.write("saved " + s.name + "\n");
  }
  await browser.close();
})().catch(e => { process.stderr.write(e.message); process.exit(1); });
