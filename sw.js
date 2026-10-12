/* Dealer Desk offline cache, build dd74c1d76d: every part is stored on the device after the first visit. */
const V='dd-dd74c1d76d', PRE=["./", "lib/jsQR.js?v=dd74c1d76d", "lib/pako.min.js?v=dd74c1d76d", "lib/index.min.js?v=dd74c1d76d", "lib/tesseract.min.js?v=dd74c1d76d", "lib/pizzip.min.js?v=dd74c1d76d", "lib/docxtemplater.min.js?v=dd74c1d76d", "lib/exceljs.min.js?v=dd74c1d76d", "lib/pdf-lib.min.js?v=dd74c1d76d", "lib/fontkit.umd.min.js?v=dd74c1d76d", "assets/quotation.docx?v=dd74c1d76d", "assets/demo.docx?v=dd74c1d76d", "assets/invoice.xlsx?v=dd74c1d76d", "assets/tr.xlsx?v=dd74c1d76d", "assets/letterhead.pdf?v=dd74c1d76d", "assets/Carlito-Bold.ttf?v=dd74c1d76d", "assets/signature.png?v=dd74c1d76d", "ocr/core.txt?v=dd74c1d76d", "ocr/worker.txt?v=dd74c1d76d", "ocr/eng.txt?v=dd74c1d76d", "assets/icon-192.png?v=dd74c1d76d", "assets/icon-512.png?v=dd74c1d76d", "manifest.webmanifest"];
self.addEventListener('install',e=>{ self.skipWaiting(); e.waitUntil(caches.open(V).then(c=>c.addAll(PRE))); });
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return; const u=new URL(r.url); if(u.origin!==location.origin) return;
  if(r.mode==='navigate'){   // the app page: show the saved copy at once, fetch the newest in the background
    e.respondWith(caches.open(V).then(async c=>{ const hit=await c.match('./'); const net=fetch(r).then(res=>{ if(res.ok) c.put('./',res.clone()); return res; }).catch(()=>hit); return hit||net; })); return; }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{ if(res.ok){ const cl=res.clone(); caches.open(V).then(c=>c.put(r,cl)); } return res; })));
});
