const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  const page = await ctx.newPage();
  // First login
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 10000 });
  await page.fill("input[name=email]", "daan@websup.nl");
  await page.fill("input[name=password]", "Admin123!");
  await page.click("button[type=submit]");
  await page.waitForNavigation({ timeout: 8000 }).catch(() => {});
  // Now open the PDF
  const resp = await page.goto("http://localhost:3000/api/quotes/cmq49idzi000088l6awp8xa5p/pdf", { timeout: 15000 });
  process.stdout.write("PDF status: " + (resp ? resp.status() : "no response") + "\n");
  await browser.close();
})().catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
