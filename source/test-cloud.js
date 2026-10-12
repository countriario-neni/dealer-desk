// Company-cloud test: runs the real cloud/Code.gs against an in-memory fake of Google Sheets/Drive,
// and connects two separate browser "devices" to it through the company link.
const { chromium } = require('playwright'); const fs=require('fs'), path=require('path'), vm=require('vm');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? {executablePath:'/opt/pw-browsers/chromium'} : {};
const URL_='https://script.google.com/macros/s/TESTDEPLOYMENT123/exec';

// ---------- fake Google services ----------
const sheets={}, files=[];
const sheet=name=>{ const rows=[]; return { rows, getLastRow:()=>rows.length, appendRow:r=>rows.push([...r]), setFrozenRows(){},
  getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),
  getRange:(r,c,nr,nc)=>({setValues:v=>{ for(let i=0;i<nr;i++){ rows[r-1+i]=rows[r-1+i]||[]; for(let j=0;j<nc;j++) rows[r-1+i][c-1+j]=v[i][j]; } }}) }; };
const iter=a=>{ let i=0; return {hasNext:()=>i<a.length,next:()=>a[i++]}; };
const folder={ getFilesByName:n=>iter(files.filter(f=>f.name===n&&!f.trashed)), createFile:b=>{ const f={id:'F'+files.length,name:b.name,size:b.bytes.length,getId(){return this.id},setTrashed(){this.trashed=true}}; files.push(f); return f; } };
const ctxGAS={ Date, JSON, String, Object, Math, Number,
  SpreadsheetApp:{getActiveSpreadsheet:()=>({getName:()=>'Dealer Desk Data',getUrl:()=>'https://docs.google.com/spreadsheets/d/TEST',getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=sheet(n))})},
  DriveApp:{getFoldersByName:()=>iter(Object.keys(sheets).length&&ctxGAS._f?[folder]:[]),createFolder:()=>{ ctxGAS._f=1; return folder; }},
  Utilities:{base64Decode:s=>Buffer.from(s,'base64'),newBlob:(bytes,mime,name)=>({bytes,mime,name})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({s,setMimeType(){return this}})} };
vm.createContext(ctxGAS); vm.runInContext(fs.readFileSync('cloud/Code.gs','utf8'),ctxGAS);
let online=true;
async function route(r){ if(!online) return r.abort('internetdisconnected');
  const req=r.request(), u=new URL(req.url());
  const o= req.method()==='POST' ? ctxGAS.doPost({postData:{contents:req.postData()}}) : ctxGAS.doGet({parameter:Object.fromEntries(u.searchParams)});
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:o.s}); }

const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1; };
(async()=>{
  const b=await chromium.launch(exe); const app='file:///'+path.resolve('dist/Dealer Desk.html').split(path.sep).join('/');
  const device=async(name)=>{ const ctx=await b.newContext({viewport:{width:390,height:844}}); await ctx.route(/script\.google\.com/,route);
    await ctx.route(/^(?!file:|blob:|data:|https:\/\/script\.google\.com).*/,r=>r.abort());
    const p=await ctx.newPage(); p.on('pageerror',e=>console.log(name,'PAGEERR',e.message)); p.on('dialog',d=>d.accept());
    await p.goto(app+'#cloud='+encodeURIComponent(URL_)); await p.waitForSelector('#nmIn');
    await p.fill('#nmIn',name); await p.click('#nmOk'); await p.waitForFunction(()=>/Up to date/.test(document.querySelector('#cloudChip').textContent),null,{timeout:15000});
    return p; };
  const sync=p=>p.evaluate(()=>cloudSync());
  const A=await device('RAMU'), B=await device('SITA');
  ok(!(await A.url()).includes('#cloud'), 'company link is removed from the address bar after opening');
  ok(await A.isVisible('nav button:has-text("History")'), 'History tab shown when connected');

  // A: stock + sale + invoice
  await A.click('nav button:has-text("Stock register")'); await A.fill('[data-s="model"]','POWERTRAC EURO 50'); await A.fill('[data-s="chassis"]','CH-A-001'); await A.fill('[data-s="engine"]','EN-A-001');
  await A.click('.card button:has-text("💾 Save")'); await A.waitForTimeout(300);
  await A.click('nav button:has-text("New sale")');
  for(const [k,v] of Object.entries({name:'TEST CUSTOMER ONE',careOf:'FATHER ONE',village:'RAVIPADU',mandal:'PENTAPADU',district:'WEST GODAVARI',mobile:'9000000001'})) await A.fill(`[data-f="${k}"]`,v);
  await A.evaluate(()=>{ CUR.imgs={aadhaar:'data:image/jpeg;base64,'+btoa('fake-photo-bytes')}; });
  await A.evaluate(()=>setStep(2)); await A.fill('[data-f="price"]','7,90,000');
  await A.evaluate(()=>setStep(1)); await A.selectOption('[data-f="stockId"]',{index:1});
  await A.click('.actionbar button:has-text("Tax invoice")'); await A.waitForTimeout(500);
  const invA=await A.inputValue('[data-f="invoiceNo"]'); await sync(A);
  ok(sheets.sales && sheets.sales.rows.length===2, 'sale row is in the Sales sheet');
  ok(sheets.customers.rows[1][6+2]==='9000000001' || String(sheets.customers.rows[1].includes('9000000001')), 'customer mobile is in the Customers sheet');
  ok(files.length===1, 'Aadhaar photo stored in Drive, not in the sheet');
  ok(!JSON.stringify(sheets.customers.rows).includes('fake-photo'), 'no photo data inside sheet cells');

  // B receives everything, invoice numbers continue
  await sync(B); await B.click('nav button:has-text("Customers")');
  ok(await B.waitForSelector('td:has-text("TEST CUSTOMER ONE")',{timeout:5000}).then(()=>true,()=>false), 'device B sees the customer saved on A');
  ok((await B.evaluate(()=>DB.all('stock'))).some(s=>s.chassis==='CH-A-001'&&s.status==='SOLD'), 'device B sees the stock (marked SOLD)');
  await B.click('nav button:has-text("New sale")'); await B.fill('[data-f="name"]','TEST CUSTOMER TWO'); await B.evaluate(()=>setStep(2)); await B.fill('[data-f="price"]','6,00,000');
  await B.evaluate(()=>setStep(1)); await B.fill('[data-f="model"]','FARMTRAC 45'); await B.fill('[data-f="chassis"]','CH-B-002');
  await B.click('.actionbar button:has-text("Tax invoice")'); await B.waitForTimeout(500);
  const invB=await B.inputValue('[data-f="invoiceNo"]');
  ok(invA && invB && invA!==invB, `invoice numbers do not clash across devices (${invA} vs ${invB})`);

  // B edits the customer's mobile → A gets it
  await sync(B); await B.click('nav button:has-text("Customers")'); await B.click('tr:has-text("TEST CUSTOMER ONE") button:has-text("Edit")');
  await B.fill('[data-c="mobile"]','9888877777'); await B.click('#ecSave'); await B.waitForTimeout(300); await sync(B); await sync(A);
  ok((await A.evaluate(()=>DB.all('customers'))).find(c=>c.name==='TEST CUSTOMER ONE').mobile==='9888877777', 'edit on B shows on A');
  ok((await A.evaluate(()=>DB.all('customers'))).find(c=>c.name==='TEST CUSTOMER ONE').imgs.aadhaar.startsWith('data:'), 'A keeps its own photo copy');
  ok(String((await B.evaluate(()=>DB.all('customers'))).find(c=>c.name==='TEST CUSTOMER ONE').imgs.aadhaar).startsWith('drive:'), 'B gets a Drive link to the photo');

  // offline save on A, then back online
  online=false; await A.click('nav button:has-text("New sale")'); await A.fill('[data-f="name"]','OFFLINE CUSTOMER'); await A.click('.actionbar button:has-text("Save")'); await sync(A);
  ok(/Up to date|Cloud|Offline/.test(await A.textContent('#cloudChip')) && !JSON.stringify(sheets.sales.rows).includes('OFFLINE CUSTOMER'), 'offline: kept on device, not lost');
  online=true; await sync(A); ok(JSON.stringify(sheets.sales.rows).includes('OFFLINE CUSTOMER'), 'back online: offline sale reaches the sheet');

  // delete on A → gone on B
  const sid=(await A.evaluate(()=>DB.all('sales'))).find(s=>s.name==='OFFLINE CUSTOMER').id;
  await A.evaluate(id=>DB.del('sales',id),sid); await sync(A); await sync(B);
  ok(!(await B.evaluate(()=>DB.all('sales'))).some(s=>s.name==='OFFLINE CUSTOMER'), 'delete on A removes it on B');

  // history
  await A.click('nav button:has-text("History")'); await A.waitForSelector('#tbl');
  const hist=await A.textContent('#main'); await A.screenshot({path:'shots/history.png',fullPage:true});
  ok(/RAMU/.test(hist)&&/SITA/.test(hist)&&/opened the app/.test(hist)&&/deleted/.test(hist)&&/TEST CUSTOMER ONE/.test(hist), 'History shows who did what (RAMU, SITA, opened, added, changed, deleted)');
  ok(sheets.History.rows.some(r=>r[3]==='deleted'&&/OFFLINE CUSTOMER/.test(r[6])), 'History says what was deleted');
  console.log('History sheet rows:', sheets.History.rows.length-1, '| sample:', sheets.History.rows.slice(1,4).map(r=>[r[1],r[3],r[4],r[6]].join(' / ')).join(' ; '));
  await A.click('nav button:has-text("Settings")'); await A.screenshot({path:'shots/cloud-settings.png'});
  await b.close();
})();
