"""Builds two versions of the app from app.html:
  dist/Dealer Desk.html  single file, everything inline (works offline from a PC folder / file://)
  dist/web/              the website: a small index.html + parts loaded on first use, cached by sw.js
                         (copy dist/web/* to the repo root to deploy)."""
import base64, hashlib, json, os, shutil
LIBS = {  # groups the app loads on demand with need('<group>')
    "scan": ["node_modules/jsqr/dist/jsQR.js", "node_modules/pako/dist/pako.min.js", "node_modules/@zxing/library/umd/index.min.js", "node_modules/tesseract.js/dist/tesseract.min.js"],
    "docx": ["node_modules/pizzip/dist/pizzip.min.js", "node_modules/docxtemplater/build/docxtemplater.min.js"],
    "xlsx": ["node_modules/exceljs/dist/exceljs.min.js"],
    "pdf": ["node_modules/pdf-lib/dist/pdf-lib.min.js", "node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js"],
}
ASSETS = {"quotation": "tpl/quotation.docx", "demo": "tpl/demo.docx", "invoice": "tpl/invoice.xlsx", "tr": "tpl/tr.xlsx",
          "letterhead": "assets/letterhead.pdf", "font": "assets/Carlito-Bold.ttf", "signature": "assets/signature.png"}
OCR = {"core": "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "worker": "node_modules/tesseract.js/dist/worker.min.js",
       "eng": "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"}

def js(path):
    s = open(path, encoding="utf-8").read()
    return "\n".join(x for x in s.split("\n") if not x.startswith("//# sourceMappingURL"))
def b64(path): return base64.b64encode(open(path, "rb").read()).decode()
ocr_text = {"core": js(OCR["core"]), "worker": js(OCR["worker"]), "eng": b64(OCR["eng"])}
app = open("app.html", encoding="utf-8").read()
common = {"__MODELS_JSON__": json.dumps(json.load(open("models.json", encoding="utf-8"))),
          "__GAS_SCRIPT__": json.dumps(open("cloud/Code.gs", encoding="utf-8").read()).replace("</", "<\\/")}
def fill(h, extra):
    for k, v in {**common, **extra}.items(): h = h.replace(k, v)
    return h
os.makedirs("dist", exist_ok=True)

# ---- single file ----
tags = "".join("<script>\n" + js(f).replace("</script", "<\\/script") + "\n</script>\n" for g in LIBS.values() for f in g)
tags += "".join(f'<script type="text/x-ocr" id="ocr_{k}">{v.replace("</script", "<\\/script")}</script>\n' for k, v in ocr_text.items())
single = fill(app, {"<!--LIBS-->": tags, "<!--WEBHEAD-->": "", "__TPL_JSON__": json.dumps({k: b64(f) for k, f in ASSETS.items()}),
                    "__BUILD_JSON__": json.dumps({"web": False})})
open("dist/Dealer Desk.html", "w", encoding="utf-8").write(single)

# ---- website ----
W = "dist/web"; shutil.rmtree(W, ignore_errors=True)
files = {}  # published path -> bytes
for g, fs in LIBS.items():
    for f in fs: files["lib/" + os.path.basename(f)] = js(f).encode()
for k, f in ASSETS.items(): files["assets/" + os.path.basename(f)] = open(f, "rb").read()
for k, v in ocr_text.items(): files[f"ocr/{k}.txt"] = v.encode()
for n in ("icon-192.png", "icon-512.png"): files["assets/" + n] = open("assets/" + n, "rb").read()
files["manifest.webmanifest"] = json.dumps({"name": "Dealer Desk", "short_name": "Dealer Desk", "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#f4f5f0", "theme_color": "#14532d",
    "icons": [{"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png"}]}).encode()
build = {"web": True,
         "libs": {g: ["lib/" + os.path.basename(f) for f in fs] for g, fs in LIBS.items()},
         "assets": {k: "assets/" + os.path.basename(f) for k, f in ASSETS.items()},
         "ocr": {k: f"ocr/{k}.txt" for k in ocr_text}}
page = fill(app, {"<!--LIBS-->": "", "__TPL_JSON__": "{}",
                  "<!--WEBHEAD-->": '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="assets/icon-192.png"><link rel="apple-touch-icon" href="assets/icon-192.png">'})
v = hashlib.sha1(page.encode() + b"".join(files[k] for k in sorted(files))).hexdigest()[:10]
build["v"] = v
files["index.html"] = page.replace("__BUILD_JSON__", json.dumps(build)).encode()
# service worker: precache every part (versioned), open instantly from cache, refresh the page in the background
pre = ["./"] + [f"{p}?v={v}" for p in files if p.startswith(("lib/", "assets/tpl", "ocr/")) or p.startswith("assets/")] + ["manifest.webmanifest"]
files["sw.js"] = f"""/* Dealer Desk offline cache, build {v}: every part is stored on the device after the first visit. */
const V='dd-{v}', PRE={json.dumps(pre)};
self.addEventListener('install',e=>{{ self.skipWaiting(); e.waitUntil(caches.open(V).then(c=>c.addAll(PRE))); }});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{{
  const r=e.request; if(r.method!=='GET') return; const u=new URL(r.url); if(u.origin!==location.origin) return;
  if(r.mode==='navigate'){{   // the app page: show the saved copy at once, fetch the newest in the background
    e.respondWith(caches.open(V).then(async c=>{{ const hit=await c.match('./'); const net=fetch(r).then(res=>{{ if(res.ok) c.put('./',res.clone()); return res; }}).catch(()=>hit); return hit||net; }})); return; }}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{{ if(res.ok){{ const cl=res.clone(); caches.open(V).then(c=>c.put(r,cl)); }} return res; }})));
}});
""".encode()
for pth, data in files.items():
    os.makedirs(os.path.dirname(os.path.join(W, pth)) or W, exist_ok=True); open(os.path.join(W, pth), "wb").write(data)
print(f"single file {len(single)//1024} KB | web page {len(files['index.html'])//1024} KB + {len(files)-1} parts | build {v}")
