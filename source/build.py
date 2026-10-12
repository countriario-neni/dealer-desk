import base64, json
libs=["node_modules/pizzip/dist/pizzip.min.js","node_modules/docxtemplater/build/docxtemplater.min.js","node_modules/exceljs/dist/exceljs.min.js","node_modules/jsqr/dist/jsQR.js","node_modules/pako/dist/pako.min.js","node_modules/@zxing/library/umd/index.min.js","node_modules/tesseract.js/dist/tesseract.min.js","node_modules/pdf-lib/dist/pdf-lib.min.js","node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js"]
def js(path):
    s=open(path,encoding="utf-8").read().replace("</script","<\\/script")
    return "\n".join(x for x in s.split("\n") if not x.startswith("//# sourceMappingURL"))
tags="".join("<script>\n"+js(l)+"\n</script>\n" for l in libs)
# OCR runs fully offline: tesseract worker + WASM core + English data are embedded as inert blocks,
# assembled into a Blob worker only when a scan needs OCR (see ocrWorkerURL in app.html).
ocr=[("ocr_core","text/x-js",js("node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js")),
     ("ocr_worker","text/x-js",js("node_modules/tesseract.js/dist/worker.min.js")),
     ("ocr_eng","text/x-b64",base64.b64encode(open("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz","rb").read()).decode())]
tags+="".join(f'<script type="{t}" id="{i}">{s}</script>\n' for i,t,s in ocr)
tpl={k:base64.b64encode(open(f"tpl/{k}.{e}","rb").read()).decode() for k,e in [("quotation","docx"),("demo","docx"),("invoice","xlsx"),("tr","xlsx")]}
# PDF quotation: scanned letterhead page + Carlito Bold (OFL, metric-compatible with Calibri)
tpl.update({k:base64.b64encode(open(f,"rb").read()).decode() for k,f in [("letterhead","assets/letterhead.pdf"),("font","assets/Carlito-Bold.ttf"),("signature","assets/signature.png")]})
models=json.load(open("models.json",encoding="utf-8"))
h=open("app.html",encoding="utf-8").read().replace("<!--LIBS-->",tags).replace("__TPL_JSON__",json.dumps(tpl)).replace("__MODELS_JSON__",json.dumps(models)).replace("__GAS_SCRIPT__",json.dumps(open("cloud/Code.gs",encoding="utf-8").read()).replace("</","<\\/"))
import os; os.makedirs("dist",exist_ok=True); open("dist/Dealer Desk.html","w",encoding="utf-8").write(h)
print(len(h)//1024,"KB")
