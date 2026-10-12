/* Dealer Desk offline cache, build f1300b3fcf: every part is stored on the device after the first visit. */
const V='dd-f1300b3fcf', PRE=["./", "lib/jsQR.js?v=f1300b3fcf", "lib/pako.min.js?v=f1300b3fcf", "lib/index.min.js?v=f1300b3fcf", "lib/tesseract.min.js?v=f1300b3fcf", "lib/pizzip.min.js?v=f1300b3fcf", "lib/docxtemplater.min.js?v=f1300b3fcf", "lib/exceljs.min.js?v=f1300b3fcf", "lib/pdf-lib.min.js?v=f1300b3fcf", "lib/fontkit.umd.min.js?v=f1300b3fcf", "assets/quotation.docx?v=f1300b3fcf", "assets/demo.docx?v=f1300b3fcf", "assets/invoice.xlsx?v=f1300b3fcf", "assets/tr.xlsx?v=f1300b3fcf", "assets/letterhead.pdf?v=f1300b3fcf", "assets/Carlito-Bold.ttf?v=f1300b3fcf", "assets/signature.png?v=f1300b3fcf", "ocr/core.txt?v=f1300b3fcf", "ocr/worker.txt?v=f1300b3fcf", "ocr/eng.txt?v=f1300b3fcf", "assets/icon-192.png?v=f1300b3fcf", "assets/icon-512.png?v=f1300b3fcf", "manifest.webmanifest"];
self.addEventListener('install',e=>{ self.skipWaiting(); e.waitUntil(caches.open(V).then(c=>c.addAll(PRE))); });
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return; const u=new URL(r.url); if(u.origin!==location.origin) return;
  if(r.mode==='navigate'){   // the app page: show the saved copy at once, fetch the newest in the background
    e.respondWith(caches.open(V).then(async c=>{ const hit=await c.match('./'); const net=fetch(r).then(res=>{ if(res.ok) c.put('./',res.clone()); return res; }).catch(()=>hit); return hit||net; })); return; }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{ if(res.ok){ const cl=res.clone(); caches.open(V).then(c=>c.put(r,cl)); } return res; })));
});
