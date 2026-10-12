# Dealer Desk

Offline web app for a Powertrac / Farmtrac / Digitrac (Escorts Kubota) tractor dealership.
One data entry produces the Quotation (.docx), Tax Invoice (.xlsx), TR Format + Check List (.xlsx)
and Demo Letter (.docx), plus Customer, Sales and Stock registers.

**Open the app:** https://portfolio.hirerockysolutions.com/dealer-desk/ — on a phone use Chrome → ⋮ → *Add to Home screen*.

- Works on any PC or phone browser (Chrome / Edge recommended), fully offline once loaded.
- Aadhaar QR auto-fill; Aadhaar number / PAN text reading with [Tesseract.js](https://github.com/naptha/tesseract.js),
  bundled inside the page — images never leave the device.
- Data stays in each device's browser (IndexedDB). Optional company cloud: one private Google Sheet shared by all devices
  that open the company link, with a history of who did what (`source/cloud/Code.gs`, setup in Settings).
- No customer data is stored in this repository.

Developer: edit `source/app.html` (model list: `source/models.json`), then
`cd source && npm i && python build.py && node test.js`, and copy `source/dist/Dealer Desk.html` to `index.html`.
See `HOW TO USE.txt` for staff instructions.
