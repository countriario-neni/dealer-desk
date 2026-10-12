const { chromium } = require('playwright');
const zlib=require('zlib'), QR=require('qrcode'), fs=require('fs'), path=require('path');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? {executablePath:'/opt/pw-browsers/chromium'} : {};
(async()=>{
  ['shots','out'].forEach(d=>fs.mkdirSync(d,{recursive:true}));
  // synthetic secure QR
  const f=['V2','3','4321'+'20190101120000000','RAVI KUMAR GOGINENI','11-08-1990','M','S/O: Janardhana Rao','West Godavari','Near Temple','1-23','Ravipadu','534156','Ravipadu','Andhra Pradesh','Main Street','Pentapadu','Ravipadu','1234'];
  const parts=[]; f.forEach(x=>{parts.push(Buffer.from(x)); parts.push(Buffer.from([255]));});
  const gz=zlib.gzipSync(Buffer.concat(parts)); const big=BigInt('0x'+gz.toString('hex')).toString();
  await QR.toFile('qr.png', big, {width:900, margin:4});
  const b=await chromium.launch(exe); const ctx=await b.newContext({acceptDownloads:true, viewport:{width:390,height:844}});
  // synthetic PAN-card-like image for the OCR test
  const pp=await ctx.newPage(); await pp.setContent('<div style="padding:30px;font:bold 34px Arial;background:#fff;width:700px">INCOME TAX DEPARTMENT<br>RAVI KUMAR<br>11/08/1990<br>Permanent Account Number<br>ABCPD1234E</div>');
  await pp.locator('div').screenshot({path:'pan.png'}); await pp.close();
  // offline guarantee: any non-file request is blocked and reported
  const external=[]; await ctx.route(/^(?!file:|blob:|data:).*/, r=>{ external.push(r.request().url()); r.abort(); });
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text()) }); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file:///'+path.resolve('dist/Dealer Desk.html').replace(/\\/g,'/'));
  await p.waitForTimeout(800);
  await p.screenshot({path:'shots/home.png',fullPage:true});
  // add stock via model picker
  await p.click('nav button:has-text("Stock register")');
  await p.click('button:has-text("Browse")'); await p.fill('#mq','euro 50 4wd'); await p.screenshot({path:'shots/picker.png'});
  await p.click('.mcard:has-text("POWERTRAC EURO 50 4WD")');
  await p.fill('[data-s="chassis"]','T000000000XX'); await p.fill('[data-s="engine"]','TEST0001'); await p.fill('[data-s="mfg"]','03/26');
  await p.click('button:has-text("Save")'); await p.waitForTimeout(300);
  await p.click('nav button:has-text("New sale")'); await p.waitForTimeout(300);
  // scan QR
  let fc=p.waitForEvent('filechooser'); await p.click('button:has-text("Aadhaar (QR")'); (await fc).setFiles('qr.png');
  await p.waitForFunction(()=>document.querySelector('[data-f="name"]').value.length>0,null,{timeout:20000});
  await p.waitForTimeout(500);
  // PAN via embedded OCR (no network)
  fc=p.waitForEvent('filechooser'); await p.click('button:has-text("PAN card")'); (await fc).setFiles('pan.png');
  await p.waitForFunction(()=>/PAN found|OCR failed|Could not/.test(document.querySelector('#scanStatus').textContent),null,{timeout:120000});
  console.log('PAN STATUS', await p.textContent('#scanStatus'), '| field:', await p.inputValue('[data-f="pan"]'));
  await p.fill('[data-f="mobile"]','9000000000'); await p.fill('[data-f="aadhaar"]','5836 6793 4321');
  await p.screenshot({path:'shots/sale1.png',fullPage:true});
  await p.click('#nextBtn'); await p.waitForTimeout(300);
  const sel=await p.$$eval('[data-f="stockId"] option',o=>o.map(x=>x.value)); await p.selectOption('[data-f="stockId"]',sel[1]); await p.waitForTimeout(300);
  await p.click('#nextBtn');
  console.log('PRICE', await p.inputValue('[data-f="price"]'));
  await p.fill('[data-f="hyp"]','AXIS BANK LIMITED'); await p.fill('[data-f="item2"]','TROLLEY'); await p.fill('[data-f="item2amt"]','150000');
  await p.screenshot({path:'shots/sale3.png',fullPage:true});
  await p.click('#nextBtn');
  await p.fill('[data-f="deliveryDate"]','2026-10-12'); await p.fill('[data-f="trNo"]','AP39TR1234');
  await p.click('#nextBtn'); await p.waitForTimeout(300);
  await p.screenshot({path:'shots/sale5.png',fullPage:true});
  const dls=[]; p.on('download',d=>dls.push(d));
  await p.click('.actionbar button:has-text("Generate all")'); await p.waitForTimeout(4000);
  for(const d of dls){ await d.saveAs('out/'+d.suggestedFilename()); console.log('DL',d.suggestedFilename()); }
  console.log('TOAST', await p.textContent('#toast'));
  // demo
  await p.click('nav button:has-text("Demo letter")'); await p.fill('#dm_model','EURO439E3'); await p.fill('#dm_serial','T000000001XX'); await p.fill('#dm_village','THORREDU'); await p.fill('#dm_mandal','RAJAHMUNDRY RURAL'); await p.fill('#dm_district','EAST GODAVARI');
  await p.click('button:has-text("Generate demo letter")'); await p.waitForTimeout(2000);
  for(const d of dls.slice(3)){ await d.saveAs('out/'+d.suggestedFilename()); console.log('DL',d.suggestedFilename()); }
  await p.click('nav button:has-text("Sales register")'); await p.waitForTimeout(400); await p.screenshot({path:'shots/register.png',fullPage:true});
  await p.click('button:has-text("Excel")'); await p.waitForTimeout(1500);
  for(const d of dls.slice(4)){ await d.saveAs('out/'+d.suggestedFilename()); console.log('DL',d.suggestedFilename()); }
  await p.click('nav button:has-text("Settings")'); await p.waitForTimeout(400); await p.screenshot({path:'shots/settings.png'});
  await p.click('nav button:has-text("Home")'); await p.waitForTimeout(400); await p.screenshot({path:'shots/home2.png',fullPage:true});
  // address parser cases
  console.log('ADDR', JSON.stringify(await p.evaluate(()=>[
    'Address: S/O: Suresh Babu, 2-45, Temple Street, Lakshmipuram, Tiruvuru, Krishna, Andhra Pradesh - 521235',
    'Address:\nW/O Ramesh,\n1-23, Main Road,\nThorredu, PO: Thorredu,\nRajahmundry Rural, East Godavari,\nAndhra Pradesh, 533294',
    'Address: S/O: Suresh Babu, 2-45, Temple Street, Near Ramalayam, VTC: Lakshmipuram, PO: Lakshmipuram, Sub District: Tiruvuru, District: Krishna, State: Andhra Pradesh, PIN Code: 521235, Mobile: 9848012345',
    'ఎవరు చిరునామా ¥ ®\nAddres: S/0 Suresh Babu, 2-45,\nTemple Street, Lakshmipuram,\nTiruvuru, Krishria,\nAndhra Pradesh - 521 235\n2345 6789 0124'].map(parseAadhaarAddress).map(o=>Object.entries(o).map(([k,v])=>k+'='+v).join(' | '))), null, 1));
  // reported bugs: model fills an editable price; amounts take commas; dropdown lists all options; mobile is kept
  await p.click('nav button:has-text("New sale")'); await p.waitForTimeout(300);
  await p.fill('[data-f="name"]','BUG CHECK'); await p.fill('[data-f="mobile"]','98480 12345');
  await p.click('[data-f="district"]'); await p.waitForTimeout(150);
  console.log('DISTRICT DROPDOWN items:', await p.$$eval('#combo div',d=>d.length), '| first:', await p.$$eval('#combo div',d=>d.slice(0,3).map(x=>x.textContent).join(', ')));
  await p.fill('[data-f="district"]',''); await p.type('[data-f="district"]','ntr'); await p.waitForTimeout(150);
  await p.click('#combo div:has-text("NTR")'); console.log('DISTRICT picked:', await p.inputValue('[data-f="district"]'));
  await p.click('#nextBtn'); await p.click('button:has-text("Browse")'); await p.click('.mcard:has-text("FARMTRAC 60 POWERMAXX")'); await p.click('#nextBtn');
  console.log('PRICE from model:', await p.inputValue('[data-f="price"]'), '|', await p.textContent('.pnote'));
  await p.fill('[data-f="price"]',''); await p.type('[data-f="price"]','8,45,000'); await p.press('[data-f="price"]','Tab');
  console.log('PRICE typed:', await p.inputValue('[data-f="price"]'), '| total shown:', await p.textContent('.calc .tot:last-child'));
  await p.click('[data-f="hyp"]'); await p.waitForTimeout(150); console.log('BANK DROPDOWN items:', await p.$$eval('#combo div',d=>d.length));
  await p.click('#combo div:has-text("STATE BANK")'); console.log('BANK picked:', await p.inputValue('[data-f="hyp"]'));
  await p.click('.actionbar button:has-text("Save")'); await p.waitForTimeout(400);
  console.log('SAVED', JSON.stringify(await p.evaluate(async()=>{ const s=(await DB.all('sales')).find(x=>x.name==='BUG CHECK'); const m=S.models.find(x=>x.name==='FARMTRAC 60 POWERMAXX'); return {mobile:s.mobile, price:s.price, district:s.district, learned:m.price}; })));
  await p.screenshot({path:'shots/price.png'});
  // customer edit (mobile) updates their sales
  await p.click('nav button:has-text("Customers")'); await p.click('tr:has-text("BUG CHECK") button:has-text("Edit")');
  await p.fill('[data-c="mobile"]','9000011111'); await p.click('#ecSave'); await p.waitForTimeout(400);
  console.log('EDITED', await p.evaluate(async()=>(await DB.all('sales')).find(x=>x.name==='BUG CHECK').mobile));
  // remembered place: known village fills mandal / district / PIN
  await p.click('nav button:has-text("New sale")'); await p.waitForTimeout(300);
  await p.fill('[data-f="village"]','RAVIPADU'); await p.press('[data-f="village"]','Tab'); await p.waitForTimeout(200);
  console.log('PLACE', await p.inputValue('[data-f="mandal"]'), '|', await p.inputValue('[data-f="district"]'), '|', await p.inputValue('[data-f="pin"]'));
  // Aadhaar back side without QR -> OCR address
  await p.click('button:has-text("New")'); await p.waitForTimeout(300);
  const ap=await ctx.newPage(); await ap.setContent('<div style="padding:30px;font:28px Arial;background:#fff;width:900px;line-height:1.5">Address:<br>S/O: Suresh Babu, 2-45, Temple Street,<br>Lakshmipuram, Tiruvuru, Krishna,<br>Andhra Pradesh - 521235<br><b style="font-size:40px">2345 6789 0124</b></div>');
  await ap.locator('div').screenshot({path:'aback.png'}); await ap.close();
  fc=p.waitForEvent('filechooser'); await p.click('button:has-text("Aadhaar back")'); (await fc).setFiles('aback.png');
  await p.waitForFunction(()=>/Check yellow|OCR:|type it/.test(document.querySelector('#scanStatus').textContent),null,{timeout:120000});
  console.log('BACK', await p.textContent('#scanStatus'));
  console.log('BACK FIELDS', await p.evaluate(()=>['careOf','house','street','village','mandal','district','pin'].map(k=>k+'='+document.querySelector(`[data-f="${k}"]`).value).join(' | ')));
  await p.screenshot({path:'shots/back.png',fullPage:true});
  console.log('EXTERNAL REQUESTS', external.length? external : 'none');
  await b.close();
})();
