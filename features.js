/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — الوظائف المضافة
   الأرشيف التلقائي · تبليغ الفني · لوحة الفني · التقييم
   عدّاد الزوار · تصدير Excel · الإعلانات · QR
   ══════════════════════════════════════════════════════════════ */

/* ── 1. الإرسال: الأرشيف أولاً، وواتساب الإدارة معاه ───────── */

const ADMIN_WA = () => String((CFG.intake && CFG.intake.whatsapp) || '').replace(/\D/g, '');
const techById = (id) => (CFG.technicians || []).find((t) => t.id === id);

/* pick the technician whose trades cover this service */
function autoTech(svcId) {
  const list = CFG.technicians || [];
  return list.find((t) => (t.svcs || []).indexOf(svcId) > -1) || null;
}

/* the whole delivery path for one new request */
async function deliver(r) {
  let archived = false;

  const light = Object.assign({}, r, { shots: [] });   // photos stay on the device

  if (DB.ready()) {
    try { await DB.addRequest(r); archived = true; }
    catch (e) { QUEUE.add(light); }
  } else {
    QUEUE.add(light);
  }

  /* الإسناد مبقاش تلقائي: الطلب بيوصل للإدارة في «الطلبات المستلمة»
     مع إشعار، والإدارة هي اللي بتختار فني (أو أكتر) من فنيي القسم. */
  return { archived, tech: null };
}

function waLink(number, text) {
  return 'https://wa.me/' + number + '?text=' + encodeURIComponent(text);
}

/* message for the technician — short and actionable */
function techText(r) {
  const s = svcById(r.svc), p = CFG.priorities[r.prio] || CFG.priorities.normal;
  return [
    '*' + T('wa.techHead') + '*',
    '',
    T('wa.wo') + ': ' + r.wo,
    T('wa.no') + ': ' + r.no,
    T('wa.svc') + ': ' + C(s, 'name'),
    T('wa.prio') + ': ' + C(p, 'label') + ' (' + C(p, 'sla') + ')',
    T('wa.loc') + ': ' + r.area + ' ' + T('lbl.building') + ' ' + r.block +
      (r.floor ? ' / ' + T('lbl.floor') + ' ' + r.floor : '') + ' / ' + T('lbl.flat') + ' ' + r.flat,
    (r.spot ? T('wa.spot') + ': ' + r.spot : ''),
    T('wa.desc') + ': ' + (r.desc || '—'),
    (r.name ? 'مقدّم الطلب: ' + r.name : ''),
    T('wa.contact') + ': ' + r.phone
  ].filter(Boolean).join(String.fromCharCode(10));
}

/* ── 2. عدّاد الزوار والطلبات في الفوتر ────────────────────── */

async function paintFooter() {
  const fn = $('#fName');
  if (fn) fn.textContent = C(CFG.brand, 'company') + ' · ' + C(CFG.brand, 'tagline');

  const sync = $('#fSync');
  const q = QUEUE.all().length;
  if (sync) {
    sync.textContent = !DB.ready() ? T('foot.local')
      : q ? T('foot.queued').replace('{n}', num(q))
      : T('foot.synced');
    sync.className = 'foot-sync' + (q ? ' warn' : '');
  }

  if (!DB.ready()) {
    $('#fVisits').textContent = num(store.get('visitsLocal', 0));
    $('#fReqs').textContent   = num(requests.length);
    return;
  }

  /* one visit per browser session */
  let v = store.get('visitsSeen', null);
  if (!sessionStorage.getItem('nawah.visited')) {
    sessionStorage.setItem('nawah.visited', '1');
    v = await DB.bumpVisits();
    store.set('visitsSeen', v);
  }
  if (v == null) { const m = await DB.stats(); v = m && m.visits; }
  $('#fVisits').textContent = v == null ? '—' : num(v);

  $('#fReqs').textContent = num(await countRequests());
}

async function countRequests() {
  try {
    const out = await DB.req('rpc/request_count', { method: 'POST', body: '{}' });
    return typeof out === 'number' ? out : 0;
  } catch (e) { return requests.length; }
}

/* ── 3. لوحة الفني ─────────────────────────────────────────── */

let TECH = null;   // the signed-in technician

async function askTech() {
  /* الوضع الآمن: أسماء الفنيين من السيرفر (من غير أرقامهم السرية) */
  let list = null;
  if (DB.ready() && DB.secure !== false) {
    try { list = await DB.sec('tech_list', {}, () => null); } catch (e) { list = null; }
  }
  if (!list) list = (CFG.technicians || []).filter((t) => t.name);
  if (!list.length) { toast(T('tech.none')); return; }
  $('#techPick').innerHTML = list.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  $('#techPin').value = '';
  $('#techErr').hidden = true;
  $('#techSheet').hidden = false;
}

async function techLogin() {
  const id = $('#techPick').value;
  const pin = String($('#techPin').value).trim();
  const fail = (msg) => {
    $('#techErr').textContent = msg || T('tech.bad');
    $('#techErr').hidden = false;
    $('#techPin').value = '';
  };
  let t = null;
  if (DB.ready() && DB.secure !== false) {
    try {
      const res = await DB.sec('tech_login', { p_id: id, p_pin: pin }, () => null);
      if (res && res.status === 'ok') t = { id, name: res.name, token: res.token, svcs: res.svcs || [] };
      else if (res && res.status === 'locked') return fail('محاولات كتير غلط — استنى ربع ساعة وجرّب تاني.');
      else if (res) return fail();
    } catch (e) { return fail(T('err.net')); }
  }
  if (!t) {
    const c = techById(id);
    if (!c || pin !== String(c.pin)) return fail();
    t = c;
  }
  TECH = t;
  sessionStorage.setItem('nawah.tech', JSON.stringify({ id: t.id, name: t.name, token: t.token || '', svcs: t.svcs || [] }));
  $('#techSheet').hidden = true;
  $('#techTab').hidden = false;
  document.body.classList.add('is-tech');
  if (DB.ready()) DB.live(onLiveChange);
  go('tech');
}

async function renderTech() {
  if (!TECH) { askTech(); return; }
  $('#techWho').textContent = TECH.name;
  const box = $('#techBody');
  box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`;

  let rows = [];
  if (DB.ready()) {
    try { rows = (await DB.techRequests(TECH.id)).map(fromRow); }
    catch (e) { rows = []; }
  } else {
    rows = requests.concat(Object.values(WO_POOL))
      .filter((r, k, all) => all.findIndex((y) => y.no === r.no) === k)
      .filter((r) => techIdsOf(r).indexOf(TECH.id) > -1 && r.stage < 4);
  }

  $('#techDot').hidden = !rows.length;
  rows.forEach((r) => { if (!requests.find((x) => x.no === r.no)) WO_POOL[r.no] = r; });

  if (!rows.length) {
    box.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m5 12.5 5 5L19 7"/></svg>
      <b>${esc(T('tech.clear'))}</b><p>${esc(T('tech.clearB'))}</p></div>`;
    return;
  }

  box.innerHTML = rows.map((r) => {
    const s = svcById(r.svc), c = colorOf(s), p = CFG.priorities[r.prio] || CFG.priorities.normal;
    const next = r.stage < 4 ? r.stage + 1 : null;
    return `<section class="card task" data-p="${esc(r.prio)}">
      <div class="task-top">
        <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(s))}</span>
        <div class="task-h">
          <b>${esc(C(s, 'name'))}</b>
          <span>${esc(r.no)} · ${esc(r.wo || '')}</span>
        </div>
        <span class="d-pill ${esc(r.prio)}">${esc(C(p, 'label'))}</span>
      </div>
      <dl class="kv">
        <dt>${esc(T('det.location'))}</dt><dd>${esc(r.area)} ${esc(T('lbl.building'))} ${num(esc(r.block))} / ${esc(T('lbl.flat'))} ${num(esc(r.flat))}${r.spot ? ' · ' + esc(r.spot) : ''}</dd>
        <dt>${esc(T('det.contact'))}</dt><dd><a href="tel:${esc(r.phone)}">${num(esc(r.phone))}</a></dd>
      </dl>
      ${r.desc ? `<p class="desc">${esc(r.desc)}</p>` : ''}
      <div class="task-ops">
        <a class="btn btn-quiet" href="tel:${esc(r.phone)}">${esc(T('tech.call'))}</a>
        <button class="btn btn-quiet" type="button" data-wo="pdf" data-no="${esc(r.no)}">أمر الشغل PDF</button>
        ${next != null ? `<button class="btn btn-primary" type="button" data-adv="${esc(r.no)}" data-stage="${next}">${esc(T('tech.adv' + next))}</button>` : ''}
      </div>
      <div class="task-steps">${[0,1,2,3,4].map((i) =>
        `<i class="${i <= r.stage ? 'on' : ''}"></i>`).join('')}</div>
    </section>`;
  }).join('');
}

async function advance(no, stage) {
  if (DB.ready()) {
    try { await DB.setStage(no, stage); } catch (e) { toast(T('err.net')); return; }
  }
  const local = requests.find((x) => x.no === no);
  if (local) { local.stage = stage; store.set('requests', requests); }
  toast(T('tech.updated'));
  renderTech();
  renderCounters();
}

/* ── 4. التقييم بعد الإصلاح ────────────────────────────────── */

let rateFor = null, rateStars = 0;

function askRate(no) {
  rateFor = no; rateStars = 0;
  paintStars();
  $('#rateNote').value = '';
  $('#rateSheet').hidden = false;
}

function paintStars() {
  $('#stars').innerHTML = [1,2,3,4,5].map((i) =>
    `<button type="button" class="star ${i <= rateStars ? 'on' : ''}" data-star="${i}" aria-label="${i}">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9Z"/></svg>
    </button>`).join('');
}

async function sendRate() {
  if (!rateStars) { toast(T('rate.pick')); return; }
  const note = $('#rateNote').value.trim();
  const local = requests.find((x) => x.no === rateFor);
  if (DB.ready()) { try { await DB.rate(rateFor, rateStars, note, local && local.phone); } catch (e) {} }
  if (local) { local.rating = rateStars; local.rating_note = note; store.set('requests', requests); }
  $('#rateSheet').hidden = true;
  toast(T('rate.thanks'));
  renderList();
}

/* ── 5. تصدير Excel بفترة تاريخ ────────────────────────────── */

async function exportRange(fromStr, toStr) {
  const from = new Date(fromStr + 'T00:00:00');
  const to   = new Date(toStr   + 'T23:59:59');
  if (isNaN(from) || isNaN(to) || from > to) { toast(T('exp.badRange')); return; }

  let rows = [];
  if (DB.ready()) {
    try { rows = (await DB.between(from.toISOString(), to.toISOString())).map(fromRow); }
    catch (e) { toast(T('err.net')); return; }
  } else {
    rows = requests.filter((r) => { const d = new Date(r.at); return d >= from && d <= to; });
  }

  if (!rows.length) { toast(T('exp.none')); return; }

  const head = [T('exp.no'), T('exp.wo'), T('exp.date'), T('exp.svc'), T('exp.prio'),
                T('exp.area'), T('exp.block'), T('exp.floor'), T('exp.flat'), T('exp.spot'),
                T('exp.desc'), T('exp.phone'), T('exp.stage'), T('exp.tech'), T('exp.rating')];

  const body = rows.map((r) => {
    const s = svcById(r.svc), p = CFG.priorities[r.prio] || CFG.priorities.normal;
    return [r.no, r.wo || '', new Date(r.at).toLocaleString(locale()), C(s, 'name'), C(p, 'label'),
            r.area || '', r.block || '', r.floor || '', r.flat || '', r.spot || '',
            (r.desc || '').replace(/\s+/g, ' '), r.phone || '',
            T('stg.' + Math.min(r.stage || 0, 4) + 't'), r.tech_name || '', r.rating || ''];
  });

  downloadXLS(head, body, 'nawah-' + fromStr + '_' + toStr);
  toast(T('exp.ok').replace('{n}', num(rows.length)));
}

/* Excel-readable XML spreadsheet — opens natively in Excel, no library */
function downloadXLS(head, rows, name) {
  const cell = (v) => {
    const t = typeof v === 'number' ? 'Number' : 'String';
    const s = String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<Cell><Data ss:Type="${t}">${s}</Data></Cell>`;
  };
  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/>
  <Interior ss:Color="#1E2A72" ss:Pattern="Solid"/>
  <Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
</Styles>
<Worksheet ss:Name="${T('exp.sheet')}">
<Table>
<Row ss:Height="24">${head.map((x) => `<Cell ss:StyleID="h"><Data ss:Type="String">${x}</Data></Cell>`).join('')}</Row>
${rows.map((r) => `<Row>${r.map(cell).join('')}</Row>`).join('\n')}
</Table>
</Worksheet>
</Workbook>`;

  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '.xls';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ── 6. QR لكل عمارة ───────────────────────────────────────── */
/* draws a QR for  <site>/?block=14  so a resident scans and the
   building number is already filled in.                          */

function buildingURL(block) {
  return location.origin + location.pathname + '?block=' + encodeURIComponent(block);
}

/* QR: rendered from the public goqr.me image API, with the URL shown
   underneath so it can always be typed by hand if the image is blocked. */
function drawQR(block) {
  const url = buildingURL(block);
  const src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data='
            + encodeURIComponent(url);
  $('#qrBox').innerHTML = `
    <div class="qr-card">
      <img src="${src}" alt="QR" width="280" height="280" loading="lazy">
      <b>${esc(T('lbl.building'))} ${esc(num(block))}</b>
      <span class="ltr">${esc(url)}</span>
      <a class="btn btn-quiet" href="${src}" target="_blank" rel="noopener">${esc(T('adm.download'))}</a>
    </div>`;
}
