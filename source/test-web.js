// Website build test: serves dist/web locally, times the first load on throttled phone 4G, checks every
// on-demand part (OCR, PDF, Excel, Word) works, then checks the app opens and works with NO internet.
const { chromium, devices } = require('playwright'); const http=require('http'), fs=require('fs'), path=require('path');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? {executablePath:'/opt/pw-browsers/chromium'} : {};
const ROOT=path.resolve('dist/web'), TYPES={'.html':'text/html','.js':'text/javascript','.txt':'text/plain','.png':'image/png','.pdf':'application/pdf','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(new URL(q.url,'http://x').pathname); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
  if(!p.startsWith(ROOT)||!fs.existsSync(p)){ r.writeHead(404); return r.end(); } r.writeHead(200,{'content-type':TYPES[path.extname(p)]||'application/octet-stream','cache-control':'max-age=600'}); fs.createReadStream(p).pipe(r); });
const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1; };
srv.listen(8765, async()=>{
  const b=await chromium.launch(exe); const ctx=await b.newContext({...devices['Pixel 7'],acceptDownloads:true}); const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  const cdp=await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:9*1024*1024/8,uploadThroughput:2*1024*1024/8});
  let t=Date.now(); await p.goto('http://localhost:8765/'); await p.waitForSelector('.tile'); const first=(Date.now()-t)/1000;
  ok(first<6, `first visit on phone 4G: home screen in ${first.toFixed(1)}s (was ~29s)`);
  const dl=async(click)=>{ const w=p.waitForEvent('download',{timeout:120000}); await click(); return (await w).suggestedFilename(); };
  await p.tap('nav button:has-text("New sale")'); await p.fill('[data-f="name"]','WEB TEST'); await p.fill('[data-f="village"]','RAVIPADU');
  await p.evaluate(()=>setStep(1)); await p.fill('[data-f="model"]','POWERTRAC EURO 50'); await p.fill('[data-f="chassis"]','CH1'); await p.fill('[data-f="engine"]','EN1');
  await p.evaluate(()=>setStep(2)); await p.fill('[data-f="price"]','7,90,000');
  t=Date.now(); ok(/\.pdf$/.test(await dl(()=>p.click('.actionbar button:has-text("Quotation")'))), `PDF quotation works (first time incl. loading PDF tools: ${((Date.now()-t)/1000).toFixed(1)}s)`);
  ok(/Tax Invoice\.xlsx$/.test(await dl(()=>p.click('.actionbar button:has-text("Tax invoice")'))), 'Tax invoice (Excel) works');
  await p.evaluate(()=>setStep(4)); ok(/\.docx$/.test(await dl(()=>p.click('button:has-text("Word")'))), 'Word quotation works');
  await p.evaluate(()=>setStep(0)); const fc=p.waitForEvent('filechooser'); await p.click('button:has-text("PAN card")'); (await fc).setFiles('pan.png');
  await p.waitForFunction(()=>/PAN found|failed|Could not|could not/.test(document.querySelector('#scanStatus').textContent),null,{timeout:180000});
  ok(/ABCPD1234E/.test(await p.textContent('#scanStatus')), 'text reader (OCR) loads on demand and reads the PAN');
  // offline cache
  await p.waitForFunction(async()=>{ const r=await navigator.serviceWorker.getRegistration(); if(!r||!r.active) return false; const c=await caches.keys(); if(!c.length) return false; return (await (await caches.open(c[0])).keys()).length>=22; },null,{timeout:240000,polling:1000});
  ok(true,'all parts saved on the device by the offline cache');
  await ctx.setOffline(true);
  t=Date.now(); await p.reload(); await p.waitForSelector('.tile'); const rep=(Date.now()-t)/1000;
  ok(rep<3, `repeat visit with NO internet opens in ${rep.toFixed(1)}s`);
  await p.tap('nav button:has-text("Sales register")'); await p.waitForTimeout(300);
  ok(/Sales Register.*\.xlsx$/.test(await dl(()=>p.click('button:has-text("Excel")'))), 'offline: Excel export still works');
  await p.tap('nav button:has-text("Demo letter")'); await p.fill('#dm_model','EURO 50'); await p.fill('#dm_village','RAVIPADU');
  ok(/Demo Letter/.test(await dl(()=>p.click('button:has-text("Generate demo letter")'))), 'offline: demo letter (Word) still works');
  await b.close(); srv.close();
});
