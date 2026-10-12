/* Dealer Desk — company cloud on a Google Sheet.
   Setup (once, by the owner):
     1. Create a new Google Sheet (e.g. "Dealer Desk Data") in the owner's Google account.
     2. Extensions → Apps Script → delete everything there, paste this whole file, Save.
     3. Deploy → New deployment → type "Web app" → Execute as: Me, Who has access: Anyone → Deploy → Authorize.
     4. Copy the Web app URL (https://script.google.com/macros/s/…/exec) into Dealer Desk → Settings → Company cloud.
   The sheet stays private to the owner's Google account; the app talks to it only through this script.
   Tabs: one per record type (readable columns + a "json" column the app reads back), and "History"
   (who did what, from which device, when). Photos go to the Drive folder "Dealer Desk Photos". */

var STORES = {
  customers: ['name', 'rel', 'careOf', 'mobile', 'house', 'street', 'village', 'mandal', 'district', 'pin', 'dob', 'gender', 'aadhaar', 'pan'],
  sales: ['name', 'mobile', 'village', 'mandal', 'district', 'model', 'engine', 'chassis', 'price', 'hyp', 'quoteDate', 'invoiceNo', 'invoiceDate', 'deliveryDate', 'insCo', 'policyNo', 'trNo', 'prNo', 'dueAmt'],
  stock: ['model', 'chassis', 'engine', 'mfg', 'status', 'billingDate', 'recDate', 'companyInv', 'customer', 'dod'],
  demos: ['date', 'model', 'serial', 'village', 'mandal', 'district', 'returned'],
  settings: ['dealerName', 'invPrefix', 'invNext']
};
var BASE = ['id', 'updatedAt', 'savedAt', 'savedBy', 'device', 'deleted'];
var HISTORY = ['time', 'person', 'device', 'action', 'what', 'id', 'details'];
var PHOTOS = 'Dealer Desk Photos';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'history') return out_({ ok: true, history: history_(+p.n || 300) });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return out_({ ok: true, app: 'dealerdesk', sheet: ss.getName(), sheetUrl: ss.getUrl() });
}

function doPost(e) {
  var req = JSON.parse(e.postData.contents);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (req.action === 'history') return out_({ ok: true, history: history_(+req.n || 300) });
    if (req.action !== 'sync') return out_({ ok: false, error: 'unknown action' });
    var now = Date.now(), user = String(req.user || 'Unknown').slice(0, 60), device = String(req.device || '?').slice(0, 80);
    var cache = {}, log = [];
    if (req.hello) log.push([new Date(now), user, device, 'opened the app', '', '', '']);
    (req.changes || []).forEach(function (c) {
      if (!STORES[c.store]) return;
      var act = save_(cache, c, now, user, device);
      if (act) log.push([new Date(now), user, device, act, c.store, String(c.id), summary_(c)]);
    });
    if (log.length) {
      var h = sheet_('History', HISTORY);
      h.getRange(h.getLastRow() + 1, 1, log.length, HISTORY.length).setValues(log);
    }
    return out_({ ok: true, serverTime: now, changes: since_(cache, +req.since || 0) });
  } finally {
    lock.releaseLock();
  }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}

function table_(cache, store) {
  if (!cache[store]) {
    var head = BASE.concat(STORES[store], ['json']), sh = sheet_(store, head), vals = sh.getDataRange().getValues(), idx = {};
    for (var i = 1; i < vals.length; i++) idx[String(vals[i][0])] = i;
    cache[store] = { sh: sh, vals: vals, idx: idx, width: head.length };
  }
  return cache[store];
}

// Saves one record if it is newer than what the sheet has. Returns the history action, or null if nothing changed.
function save_(cache, c, now, user, device) {
  var t = table_(cache, c.store), row = t.idx[String(c.id)], jsonCol = t.width - 1;
  if (row && +t.vals[row][1] >= +c.updatedAt) return null;
  if (c.deleted && row) { try { c.data = JSON.parse(t.vals[row][jsonCol]); } catch (err) {} }  // so History says what was deleted
  var d = c.deleted ? {} : (c.data || {});
  if (!c.deleted && d.imgs) {
    var prev = {};
    try { prev = (row && t.vals[row][jsonCol]) ? (JSON.parse(t.vals[row][jsonCol]).imgs || {}) : {}; } catch (err) {}
    d.imgs = photos_(c.store, c.id, d.imgs, prev);
  }
  var line = [String(c.id), +c.updatedAt, now, user, device, c.deleted ? 'YES' : '']
    .concat(STORES[c.store].map(function (k) { var v = d[k]; return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v); }))
    .concat([c.deleted ? '' : JSON.stringify(d)]);
  if (row) { t.sh.getRange(row + 1, 1, 1, line.length).setValues([line]); t.vals[row] = line; }
  else { t.sh.appendRow(line); t.vals.push(line); t.idx[String(c.id)] = t.vals.length - 1; }
  return c.deleted ? 'deleted' : (row ? 'changed' : 'added');
}

// New photos (data URLs) are stored in Drive; the record keeps "drive:<fileId>". Photos not sent this time keep their old file.
function photos_(store, id, imgs, prev) {
  var out = {}, k;
  for (k in prev) out[k] = prev[k];
  var folder = null;
  for (k in imgs) {
    var v = String(imgs[k] || '');
    if (v.indexOf('data:') !== 0) { if (v) out[k] = v; continue; }
    if (!folder) { var it = DriveApp.getFoldersByName(PHOTOS); folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTOS); }
    var name = store + '-' + id + '-' + k + '.jpg', old = folder.getFilesByName(name);
    while (old.hasNext()) old.next().setTrashed(true);
    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(v.split(',')[1]), 'image/jpeg', name));
    out[k] = 'drive:' + file.getId();
  }
  return out;
}

function since_(cache, t) {
  var out = [];
  Object.keys(STORES).forEach(function (store) {
    var tb = table_(cache, store), jsonCol = tb.width - 1;
    for (var i = 1; i < tb.vals.length; i++) {
      var r = tb.vals[i];
      if (+r[2] <= t) continue;
      var data = null;
      try { data = r[jsonCol] ? JSON.parse(r[jsonCol]) : null; } catch (err) {}
      out.push({ store: store, id: String(r[0]), updatedAt: +r[1], deleted: r[5] === 'YES', data: data });
    }
  });
  return out;
}

function summary_(c) {
  var d = c.data || {};
  return [d.name, d.model, d.invoiceNo ? 'Inv ' + d.invoiceNo : '', d.chassis ? 'Ch ' + d.chassis : '', d.village, c.store === 'settings' ? 'next invoice ' + d.invNext : '']
    .filter(function (x) { return x; }).join(' · ').slice(0, 200);
}

function history_(n) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('History');
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getDataRange().getValues().slice(1).slice(-n).reverse();
  return vals.map(function (r) {
    return { time: r[0] instanceof Date ? r[0].getTime() : +new Date(r[0]), person: r[1], device: r[2], action: r[3], what: r[4], id: r[5], details: r[6] };
  });
}
