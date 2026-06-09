const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const pdfBytes = fs.readFileSync("C:/Users/Daan Koolhaas/Desktop/new-offerte.pdf");
  const b64 = pdfBytes.toString("base64");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  const page = await ctx.newPage();
  await page.setContent(`<!DOCTYPE html><html><head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head><body style="margin:0;background:#fff"><canvas id="c"></canvas><script>
const data=atob("${b64}");const bytes=new Uint8Array(data.length);
for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
pdfjsLib.getDocument({data:bytes}).promise.then(pdf=>{
  window._pdf=pdf;window._total=pdf.numPages;
  pdf.getPage(1).then(p=>{const vp=p.getViewport({scale:1.5});const c=document.getElementById("c");
  c.width=vp.width;c.height=vp.height;
  p.render({canvasContext:c.getContext("2d"),viewport:vp}).promise.then(()=>{window._ready=true;});});});
</script></body></html>`);
  await page.waitForFunction(()=>window._ready===true,{timeout:20000});
  const total = await page.evaluate(()=>window._total);
  for(let i=1;i<=total;i++){
    await page.evaluate((n)=>{
      window._ready=false;
      window._pdf.getPage(n).then(p=>{const vp=p.getViewport({scale:1.5});const c=document.getElementById("c");
      c.width=vp.width;c.height=vp.height;
      p.render({canvasContext:c.getContext("2d"),viewport:vp}).promise.then(()=>{window._ready=true;});});
    },i);
    await page.waitForFunction(()=>window._ready===true,{timeout:15000});
    await page.screenshot({path:`C:/Users/Daan Koolhaas/Desktop/check-p${i}.png`,clip:{x:0,y:0,width:794,height:1123}});
  }
  await browser.close();
  process.stdout.write("done " + total + " pages\n");
})().catch(e=>{process.stderr.write(e.message+"\n");process.exit(1);});
