/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — الطلبات المستلمة (لوحة الإدارة)

   ١) كل طلب جديد يوصل للإدارة هنا مع إشعار فوري:
      صوت + اهتزاز + إشعار على الشاشة + رقم على زرار «الإدارة».
      الإشعار بيشتغل طول ما لوحة الإدارة مفتوحة، حتى لو في الخلفية.
   ٢) الإدارة تفتح الطلب: بيانات الساكن كاملة (الاسم والموبايل)
      وفنيين القسم بتاعه بس — تختار فني أو أكتر وتسند.
   ٣) مع الإسناد يصدر أمر الشغل PDF باسم الفني ويتحفظ في الأرشيف،
      والإدارة تطبعه أو تحمّله أو تبعته للفني على واتساب.
   الساكن مبيشوفش أمر الشغل — بيتابع برقم البحث بس.
   ══════════════════════════════════════════════════════════════ */

let PENDING_REQ = '';                  // طلب مستني الإدارة تدخل بكلمة المرور

const INBOX = {
  rows: [],
  loadedAt: 0,
  filter: 'new',                       // new | work | done | all
  q: '',
  err: false,
  busy: null
};

const AREQ_SEL = {};                   // الفنيين المختارين لكل طلب قبل الحفظ
let ADM_TIMER = null;
let ADM_FIRST_POLL = true;

/* الطلب «جديد» = لسه في مرحلة الاستلام ومحدش اتسند له */
const isNewReq = (r) => (r.stage | 0) === 0 && !techIdsOf(r).length;

const lastId   = () => Number(store.get('admLastId', 0)) || 0;
const setLastId = (id) => { if (Number(id) > lastId()) store.set('admLastId', Number(id)); };

/* الطلبات اللي اتبلّغ عنها قبل كده — عشان الإشعار ميتكررش */
let NOTIFIED = null;
const notified = {
  set() { if (!NOTIFIED) NOTIFIED = new Set(store.get('admNotified', [])); return NOTIFIED; },
  has(no) { return this.set().has(no); },
  add(no) { this.set().add(no); }
};
function markNotified(no) {
  notified.add(no);
  store.set('admNotified', Array.from(notified.set()).slice(-300));
}

/* ── أرقام وتواريخ ───────────────────────────────────────── */
function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!(ms >= 0)) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return 'منذ ' + num(m) + ' د';
  const h = Math.floor(m / 60);
  if (h < 24) return 'منذ ' + num(h) + ' س';
  const d = Math.floor(h / 24);
  return 'منذ ' + num(d) + ' يوم';
}

/* رقم موبايل مصري → صيغة واتساب الدولية */
function waNum(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (/^01\d{9}$/.test(d)) d = '2' + d;
  return d;
}

const deptTechs = (svcId) => (CFG.technicians || []).filter((t) => (t.svcs || []).indexOf(svcId) > -1);

/* ══════════ التحميل ══════════ */
async function inboxLoad() {
  if (INBOX.busy) return INBOX.busy;
  INBOX.busy = (async () => {
    let rows;
    if (DB.ready()) {
      try { rows = (await DB.allRequests(400)).map(fromRow); INBOX.err = false; }
      catch (e) { INBOX.err = true; rows = INBOX.rows.length ? INBOX.rows : requests.slice(); }
    } else {
      rows = requests.slice();
    }
    INBOX.rows = rows;
    INBOX.loadedAt = Date.now();
    rows.forEach((r) => { WO_POOL[r.no] = r; });

    /* أول مرة خالص على الجهاز ده: منبلّغش عن الطلبات القديمة */
    const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    if (DB.ready() && !INBOX.err && lastId() > maxId) store.set('admLastId', maxId);   // قاعدة بيانات جديدة
    if (!lastId() && maxId) setLastId(maxId);
    if (!store.get('admNotified', null)) rows.forEach((r) => notified.add(r.no));

    paintAdminBadge();
    return rows;
  })();
  try { return await INBOX.busy; } finally { INBOX.busy = null; }
}

function inboxRow(no) {
  return INBOX.rows.find((x) => x.no === no) || null;
}

/* تحديث صف في الذاكرة بعد أي تعديل من الإدارة */
function inboxTouch(no, fields) {
  const r = inboxRow(no) || WO_POOL[no];
  if (r) Object.assign(r, fields || {});
  refreshInboxUI();
}

/* ══════════ المراقبة: لحظي + فحص كل ٢٠ ثانية ══════════ */
function startAdminWatch() {
  if (ADM_TIMER) return;
  unlockSound();
  ADM_FIRST_POLL = true;
  inboxLoad().then(admPoll);
  if (DB.ready()) DB.live(onLiveChange);
  ADM_TIMER = setInterval(admPoll, 20000);
  document.addEventListener('visibilitychange', admOnVisible);
}

function stopAdminWatch() {
  clearInterval(ADM_TIMER);
  ADM_TIMER = null;
  document.removeEventListener('visibilitychange', admOnVisible);
  if (!TECH) DB.unlive();
  document.title = document.title.replace(/^\(\S+\)\s/, '');
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
}

function admOnVisible() { if (!document.hidden) admPoll(); }

async function admPoll() {
  if (!isAdmin) return;
  if (!DB.ready()) {                                   // وضع محلي: طلبات الجهاز نفسه
    requests.forEach((r) => { if (!inboxRow(r.no)) inboxArrived(Object.assign({}, r), true); });
    return;
  }
  try {
    const rows = ((await DB.newAfter(lastId())) || []).map(fromRow);
    const fresh = [];
    rows.forEach((r) => {
      setLastId(r.id);
      const known = inboxRow(r.no);
      if (known) Object.assign(known, r); else INBOX.rows.unshift(r);
      WO_POOL[r.no] = known || r;
      if (!notified.has(r.no) && isNewReq(r)) fresh.push(r);
      markNotified(r.no);
    });
    /* لو الإدارة كانت قافلة ووصل كذا طلب — إشعار واحد يلخّصهم */
    if (fresh.length > 1 && ADM_FIRST_POLL) alertMany(fresh);
    else fresh.forEach(alertNewRequest);
    ADM_FIRST_POLL = false;
    if (rows.length) refreshInboxUI();
  } catch (e) { /* النت فصل — نحاول تاني بعد ٢٠ ثانية */ }
}

/* بيتنادى من onLiveChange لما السيرفر يبعت تغيير لحظي */
function inboxLive(payload, rec) {
  if (!rec || !rec.no || !rec.svc) return;             // صف ناقص من الـ polling — نتجاهله
  const type = String(payload.type || payload.eventType || '').toUpperCase();
  const r = fromRow(rec);
  if (rec.id) setLastId(rec.id);
  const known = inboxRow(r.no);
  if (known) Object.assign(known, r); else INBOX.rows.unshift(r);
  WO_POOL[r.no] = known || r;
  if (type === 'INSERT' && !notified.has(r.no)) { markNotified(r.no); if (isNewReq(r)) alertNewRequest(r); }
  refreshInboxUI();
}

/* وضع محلي بس */
function inboxArrived(r, quiet) {
  INBOX.rows.unshift(r);
  WO_POOL[r.no] = r;
  if (!quiet && !notified.has(r.no)) { markNotified(r.no); alertNewRequest(r); }
  refreshInboxUI();
}

function refreshInboxUI() {
  paintAdminBadge();
  if (!$('#v-admin').hidden && adminTab === 'inbox') paintInbox();
  const open = $('#v-areq');
  if (open && !open.hidden && open.dataset.no) renderAReq(open.dataset.no, true);
}

/* ══════════ التنبيه ══════════ */
function alertNewRequest(r) {
  const s = svcById(r.svc), p = CFG.priorities[r.prio] || CFG.priorities.normal;
  const urgent = r.prio === 'urgent';
  const title = (urgent ? '🚨 ' : '') + 'طلب جديد ' + r.no + ' — ' + AN(s, 'name');
  const body = [r.name || '', 'عمارة ' + (r.block || '—') + ' / شقة ' + (r.flat || '—'), AN(p, 'label')]
    .filter(Boolean).join(' · ');

  chime(urgent);
  if (navigator.vibrate) { try { navigator.vibrate(urgent ? [220, 90, 220, 90, 320] : [180, 80, 180]); } catch (e) {} }
  if (store.get('admNotify', true)) {
    sysNotify(title, body, {
      tag: 'req-' + r.no, renotify: true, requireInteraction: urgent,
      data: { no: r.no, url: './?req=' + encodeURIComponent(r.no) }
    });
  }
  showAdmBanner(r.no, title, body, urgent);
}

function alertMany(list) {
  const title = 'وصلك ' + num(list.length) + ' طلبات جديدة';
  const body = list.slice(0, 4).map((r) => r.no + ' ' + AN(svcById(r.svc), 'name')).join(' · ');
  const urgent = list.some((r) => r.prio === 'urgent');
  chime(urgent);
  if (store.get('admNotify', true)) sysNotify(title, body, { tag: 'req-many', renotify: true, data: { url: './#admin' } });
  showAdmBanner('', title, body, urgent);
}

/* شريط أعلى الشاشة داخل التطبيق */
let bannerTimer = null;
function showAdmBanner(no, title, body, urgent) {
  const el = $('#admAlert');
  if (!el) return;
  el.className = 'adm-alert' + (urgent ? ' urgent' : '');
  el.innerHTML = `
    <span class="aa-ic" aria-hidden="true">${svg('M6 8a6 6 0 1 1 12 0c0 7 3 8.5 3 8.5H3S6 15 6 8ZM10 20a2.2 2.2 0 0 0 4 0', 1.9)}</span>
    <span class="aa-t"><b>${esc(title)}</b><span>${esc(body)}</span></span>
    <button class="btn btn-volt" type="button" data-aa="${esc(no)}">فتح</button>
    <button class="aa-x" type="button" data-aa-x aria-label="إغلاق">✕</button>`;
  el.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.hidden = true; }, urgent ? 30000 : 15000);
}

/* صوت التنبيه — بيتعمل بالمتصفح نفسه، من غير ملفات */
let AC = null;
function unlockSound() {
  const go1 = () => {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
    } catch (e) {}
  };
  go1();
  document.addEventListener('pointerdown', go1, { once: true });
  document.addEventListener('keydown', go1, { once: true });
}

function chime(urgent) {
  if (store.get('admSound', true) === false) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const notes = urgent ? [988, 740, 988, 740, 988] : [740, 988];
    notes.forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain();
      const t0 = AC.currentTime + i * 0.19;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
      o.connect(g); g.connect(AC.destination);
      o.start(t0); o.stop(t0 + 0.18);
    });
  } catch (e) {}
}

/* العدد على زرار «الإدارة» وعلى عنوان الصفحة وأيقونة التطبيق */
function paintAdminBadge() {
  const n = INBOX.rows.filter(isNewReq).length;
  const txt = n > 99 ? '99+' : num(n);
  [$('#admCount'), $('#inboxCount')].forEach((el) => {
    if (!el) return;
    el.hidden = !n;
    el.textContent = txt;
  });
  const base = document.title.replace(/^\(\S+\)\s/, '');
  document.title = (n && isAdmin ? '(' + txt + ') ' : '') + base;
  try {
    if (isAdmin && n && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
    else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch (e) {}
}

/* ══════════ تبويب «الطلبات المستلمة» ══════════ */
async function admInbox(box) {
  const stale = Date.now() - INBOX.loadedAt > 15000;
  if (INBOX.loadedAt) paintInbox();
  if (stale || !INBOX.loadedAt) { await inboxLoad(); paintInbox(); }
}

function notifCard() {
  const has = 'Notification' in window;
  const perm = has ? Notification.permission : 'unsupported';
  const sound = store.get('admSound', true) !== false;
  let main;
  if (!has) {
    main = `<b>التنبيه على الجهاز ده بالصوت بس</b>
      <p>المتصفح ده مش بيدعم الإشعارات. افتح اللوحة من كروم أو ثبّت التطبيق على الشاشة الرئيسية.</p>`;
  } else if (perm === 'granted' && store.get('admNotify', true)) {
    main = `<b>🔔 إشعارات الطلبات الجديدة شغالة على الجهاز ده</b>
      <p>أي طلب جديد يوصلك إشعار وصوت طول ما لوحة الإدارة مفتوحة، حتى لو التطبيق في الخلفية.</p>`;
  } else if (perm === 'denied') {
    main = `<b>الإشعارات مقفولة من المتصفح</b>
      <p>افتحها من إعدادات الموقع في المتصفح (رمز القفل جنب اللينك) ← الإشعارات ← سماح.</p>`;
  } else {
    main = `<b>فعّل إشعارات الطلبات الجديدة</b>
      <p>عشان يوصلك إشعار على الموبايل أو الكمبيوتر أول ما ساكن يسجّل طلب.</p>
      <button class="btn btn-primary btn-block mt" type="button" data-anot="on">🔔 تفعيل الإشعارات</button>`;
  }
  return `<div class="note-box ${perm === 'granted' ? 'ok' : 'warn'} inb-notif">${main}
    <div class="inb-notif-ops">
      <button class="trade ${sound ? 'on' : ''}" type="button" data-anot="sound">${sound ? '🔊 الصوت شغال' : '🔇 الصوت مقفول'}</button>
      <button class="trade" type="button" data-anot="test">تجربة التنبيه</button>
    </div></div>`;
}

function paintInbox() {
  const box = $('#admBody');
  if (!box || adminTab !== 'inbox' || $('#v-admin').hidden) return;
  const rows = INBOX.rows;
  const cnt = {
    new:  rows.filter(isNewReq).length,
    work: rows.filter((r) => !isNewReq(r) && (r.stage | 0) < 3).length,
    done: rows.filter((r) => (r.stage | 0) >= 3).length,
    all:  rows.length
  };
  const hadSearch = document.activeElement && document.activeElement.id === 'inbSearch';

  box.innerHTML = `<div class="inbox">
    ${notifCard()}
    ${INBOX.err ? `<div class="note-box warn"><b>${esc(T('err.net'))}</b><p>بيتعرض آخر نسخة اتحمّلت.</p></div>` : ''}
    ${!DB.ready() ? `<div class="note-box warn"><b>${esc(T('foot.local'))}</b><p>بتظهر هنا طلبات الجهاز ده بس لحد ما قاعدة البيانات تتربط.</p></div>` : ''}
    <div class="arch-stats inb-filters" role="tablist">
      ${[['new', 'جديدة — محتاجة إسناد'], ['work', 'جارية'], ['done', 'تم الإصلاح'], ['all', 'الكل']].map(([k, label]) =>
        `<button type="button" role="tab" class="${INBOX.filter === k ? 'on' : ''} ${k === 'new' && cnt.new ? 'hot' : ''}" data-inf="${k}">
          <b>${num(cnt[k])}</b><span>${label}</span></button>`).join('')}
    </div>
    <div class="track-row">
      <input id="inbSearch" value="${esc(INBOX.q)}" placeholder="بحث: رقم الطلب، الاسم، الموبايل، العمارة" autocomplete="off">
      <button class="btn btn-quiet" type="button" data-inf="reload" title="تحديث">↻</button>
    </div>
    <div class="arch-list" id="inbList"></div>
  </div>`;
  paintInboxList();
  if (hadSearch) { const i = $('#inbSearch'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

function paintInboxList() {
  const el = $('#inbList');
  if (!el) return;
  const q = INBOX.q.trim().toUpperCase();
  const f = INBOX.filter;
  const rows = INBOX.rows
    .filter((r) => f === 'all' ? true
      : f === 'new' ? isNewReq(r)
      : f === 'work' ? !isNewReq(r) && (r.stage | 0) < 3
      : (r.stage | 0) >= 3)
    .filter((r) => !q
      || String(r.no).toUpperCase().indexOf(q) > -1
      || String(r.name || '').toUpperCase().indexOf(q) > -1
      || String(r.phone || '').indexOf(q) > -1
      || String(r.block || '') === q)
    .sort((a, b) => {
      /* الجديد والطارئ الأول */
      const w = (r) => (isNewReq(r) ? 0 : 10) + (r.prio === 'urgent' ? 0 : r.prio === 'high' ? 1 : 2);
      return f === 'new' ? w(a) - w(b) || new Date(b.at) - new Date(a.at) : new Date(b.at) - new Date(a.at);
    });

  if (!rows.length) {
    el.innerHTML = `<div class="empty small">
      ${svg('m5 12.5 5 5L19 7', 1.4)}
      <b>${f === 'new' && !q ? 'مفيش طلبات جديدة محتاجة إسناد' : 'لا توجد طلبات هنا'}</b>
      <p>${f === 'new' && !q ? 'أول ما ساكن يسجّل طلب هيظهر هنا ويوصلك إشعار.' : 'جرّب تصنيف تاني أو امسح البحث.'}</p></div>`;
    return;
  }

  el.innerHTML = rows.slice(0, 150).map((r) => {
    const sv = svcById(r.svc), c = colorOf(sv), p = CFG.priorities[r.prio] || CFG.priorities.normal;
    const fresh = isNewReq(r);
    const who = r.tech_name ? '👷 ' + r.tech_name : '';
    return `<button class="arch inb ${fresh ? 'is-new' : ''}" type="button" data-p="${esc(r.prio)}" data-areq="${esc(r.no)}">
      <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(sv))}</span>
      <span class="arch-t">
        <b><span class="ltr">${esc(r.no)}</span> · ${esc(C(sv, 'name'))} · ${esc(T('lbl.building'))} ${num(esc(r.block))}/${num(esc(r.flat))}</b>
        <span>${esc(r.name || '—')} · <span class="ltr">${esc(r.phone || '')}</span>${who ? ' · ' + esc(who) : ''}</span>
      </span>
      <span class="inb-r">
        ${fresh ? `<em class="st st-hot">جديد</em>` : stageChip(r.stage | 0)}
        <small>${esc(C(p, 'label'))} · ${esc(ago(r.at))}</small>
      </span>
    </button>`;
  }).join('');
}

/* ══════════ شاشة الطلب عند الإدارة ══════════ */
function openAReq(no) {
  if (!no) { go('admin'); return; }
  if (!isAdmin) { PENDING_REQ = no; askPassword(); return; }
  go('areq', no);
}

async function renderAReq(no, soft) {
  const view = $('#v-areq');
  const box = $('#areqBox');
  no = String(no || view.dataset.no || '').toUpperCase();
  view.dataset.no = no;

  let r = inboxRow(no) || WO_POOL[no] || null;
  if (!r && DB.ready()) {
    box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`;
    try { const row = await DB.one(no); if (row) { r = fromRow(row); INBOX.rows.unshift(r); WO_POOL[no] = r; } }
    catch (e) { /* نكمّل بالمحلي */ }
  }
  if (!r) r = requests.find((x) => x.no === no) || null;
  if (!r) {
    box.innerHTML = `<div class="note-box warn"><b>الطلب ${esc(no)} مش موجود</b><p>اتأكد من الرقم أو حدّث القائمة.</p></div>
      <button class="btn btn-quiet btn-block mt" type="button" data-go="admin">رجوع للطلبات</button>`;
    return;
  }
  WO_POOL[r.no] = r;

  /* لو المستخدم بيكتب أو مختار حاجة، التحديث اللحظي ميبوظش اللي بيعمله */
  if (soft && box.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;

  await needQR();
  const s = svcById(r.svc), c = colorOf(s), p = CFG.priorities[r.prio] || CFG.priorities.normal;
  const assigned = techIdsOf(r);
  if (!AREQ_SEL[r.no]) AREQ_SEL[r.no] = assigned.slice();
  const sel = AREQ_SEL[r.no];
  const dept = deptTechs(r.svc);
  const extra = assigned.filter((id) => !dept.find((t) => t.id === id)).map(techById).filter(Boolean);
  const pool = dept.concat(extra);
  const changed = sel.slice().sort().join('|') !== assigned.slice().sort().join('|');
  const local = await PDFDB.get(r.no);
  const pdfState = r.wo_pdf ? '☁ محفوظ في الأرشيف السحابي'
                 : local ? '✓ محفوظ على الجهاز ده'
                 : assigned.length ? 'لم يُحفظ بعد — اضغط «تحميل PDF»' : 'يصدر مع الإسناد';
  const assignedTechs = assigned.map(techById).filter(Boolean);
  const d = new Date(r.at);

  box.innerHTML = `
    <div class="d-top areq-top">
      <div class="d-no ltr">${esc(r.no)}</div>
      <h3>${esc(C(s, 'name'))}</h3>
      <div class="d-meta">
        <span class="d-pill ${esc(r.prio)}">${esc(C(p, 'label'))} · ${esc(C(p, 'sla'))}</span>
        <span class="d-pill">${num(fmtDate(d, true))} · ${esc(ago(r.at))}</span>
        <span class="d-pill">${esc(T('stg.' + Math.min(r.stage | 0, 4) + 't'))}</span>
      </div>
    </div>

    <section class="card">
      <h3>مقدّم الطلب</h3>
      <dl class="kv">
        <dt>الاسم</dt><dd>${esc(r.name || '—')}</dd>
        <dt>الموبايل</dt><dd><a class="ltr" href="tel:${esc(r.phone)}">${esc(r.phone || '—')}</a></dd>
      </dl>
      <div class="areq-ops">
        <a class="btn btn-quiet" href="tel:${esc(r.phone)}">📞 اتصال</a>
        <a class="btn btn-wa" href="${waLink(waNum(r.phone), 'بخصوص طلب الصيانة رقم ' + r.no + ' — ' + C(CFG.brand, 'company'))}" target="_blank" rel="noopener">واتساب</a>
      </div>
    </section>

    <section class="card">
      <h3>مكان العطل</h3>
      <dl class="kv">
        <dt>${esc(T('det.location'))}</dt><dd>${esc(r.area || '')} ${esc(T('lbl.building'))} ${num(esc(r.block))}${r.floor ? ' / ' + esc(T('lbl.floor')) + ' ' + num(esc(r.floor)) : ''} / ${esc(T('lbl.flat'))} ${num(esc(r.flat))}</dd>
        ${r.spot ? `<dt>${esc(T('det.spot'))}</dt><dd>${esc(r.spot)}</dd>` : ''}
      </dl>
      ${r.desc ? `<p class="desc">${esc(r.desc)}</p>` : '<p class="fine">لم يكتب الساكن وصفاً.</p>'}
      <p class="fine">لو الساكن صوّر العطل، الصور على موبايله — اطلبها منه على واتساب.</p>
    </section>

    <section class="card areq-assign">
      <h3>الإسناد — فنيين قسم ${esc(C(s, 'name'))}</h3>
      ${pool.length ? `
        <p class="fine mb">اختار فني أو أكتر، وبعدين اضغط الزرار.</p>
        <div class="tpicks">${pool.map((t) => {
          const on = sel.indexOf(t.id) > -1;
          return `<button type="button" class="tpick ${on ? 'on' : ''}" data-pick="${esc(t.id)}" aria-pressed="${on}">
            <i>${on ? '✓' : ''}</i><b>${esc(t.name || 'بدون اسم')}</b>${t.phone ? `<small class="ltr">${esc(t.phone)}</small>` : ''}</button>`;
        }).join('')}</div>
        <button class="btn btn-primary btn-block mt" type="button" data-aw="assign" ${sel.length ? '' : 'disabled'}>
          ${assigned.length ? (changed ? 'حفظ الإسناد الجديد وتحديث أمر الشغل' : 'مُسند — إعادة إصدار أمر الشغل') : 'إسناد وإصدار أمر الشغل'}
          ${sel.length ? ' (' + num(sel.length) + ')' : ''}</button>
        ${assigned.length ? `<p class="fine center mt">مُسند حالياً إلى: <b>${esc(r.tech_name || assignedTechs.map((t) => t.name).join('، '))}</b></p>` : ''}`
      : `<div class="note-box warn"><b>مفيش فنيين مضافين لقسم ${esc(C(s, 'name'))}</b>
          <p>ضيف فنيين القسم من تبويب «الفنيين» وارجع هنا.</p></div>
         <button class="btn btn-quiet btn-block mt" type="button" data-aw="gotech">+ إضافة فنيين للقسم</button>`}
    </section>

    <section class="card">
      <h3>أمر الشغل <span class="ltr fine">${esc(r.wo || '')}</span></h3>
      <p class="fine" id="areqPdfState">${esc(pdfState)}</p>
      ${!assigned.length ? '<p class="fine">تقدر تطبعه دلوقتي، بس الأفضل تسند الأول عشان اسم الفني يطلع في الورقة.</p>' : ''}
      <div class="pp-bar">
        <button class="btn btn-primary" type="button" data-aw="pdf">تحميل PDF</button>
        <button class="btn btn-quiet" type="button" data-aw="print">طباعة</button>
        ${navigator.canShare ? '<button class="btn btn-quiet" type="button" data-aw="share">مشاركة</button>' : ''}
      </div>
      ${assignedTechs.filter((t) => t.phone).length ? `<div class="areq-ops mt">${assignedTechs.filter((t) => t.phone).map((t) =>
        `<a class="btn btn-wa" href="${waLink(waNum(t.phone), techText(r) + String.fromCharCode(10) + 'أمر الشغل: ' + (r.wo || ''))}" target="_blank" rel="noopener">واتساب للفني ${esc(t.name)}</a>`).join('')}</div>` : ''}
    </section>

    <section class="card">
      <h3>مرحلة الطلب</h3>
      <div class="areq-stage">${stageSelect(r)}<span class="fine">الفني بيحدّثها من «مهامي»، وتقدر تعدّلها من هنا.</span></div>
    </section>

    <h2 class="sec"><span>معاينة أمر الشغل</span></h2>
    <div class="pp-stage"><div class="pp-fit">${woSheet(r)}</div></div>`;

  fitPaper();
  box.querySelectorAll('.pp-fit img').forEach((im) => im.addEventListener('load', fitPaper, { once: true }));
}

/* ── الإسناد ── */
async function areqAssign(no, btn) {
  const r = inboxRow(no) || WO_POOL[no];
  const ids = (AREQ_SEL[no] || []).slice();
  const techs = ids.map(techById).filter(Boolean);
  if (!r || !techs.length) { toast('اختار فني واحد على الأقل'); return; }

  const stage = Math.max(1, r.stage | 0);
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'جاري الإسناد…';
  try {
    if (DB.ready()) await DB.assignMany(no, techs, stage);
  } catch (e) {
    toast(T('err.net'));
    btn.disabled = false; btn.textContent = was;
    return;
  }

  const fields = { tech_id: packTechs(ids), tech_name: techs.map((t) => t.name).join('، '), stage };
  Object.assign(r, fields);
  const mine = requests.find((x) => x.no === no);
  if (mine) { Object.assign(mine, fields); store.set('requests', requests); }
  paintAdminBadge();

  btn.textContent = 'جاري إصدار أمر الشغل…';
  try {
    const rec = await archiveWO(r);
    if (rec.cloud) r.wo_pdf = rec.cloud;
    toast(rec.cloud ? 'تم الإسناد — وأمر الشغل اتحفظ في الأرشيف' : 'تم الإسناد — وأمر الشغل اتحفظ على الجهاز');
  } catch (e) {
    toast('تم الإسناد — بس تعذّر إصدار PDF، استخدم «طباعة»');
  }
  renderAReq(no);
  refreshInboxUI();
}

/* ══════════ التوصيل ══════════ */
function initInbox() {
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-areq]');
    if (a) { openAReq(a.dataset.areq); return; }

    const f = e.target.closest('[data-inf]');
    if (f) {
      if (f.dataset.inf === 'reload') { f.disabled = true; await inboxLoad(); paintInbox(); return; }
      INBOX.filter = f.dataset.inf;
      paintInbox();
      return;
    }

    const n = e.target.closest('[data-anot]');
    if (n) {
      const k = n.dataset.anot;
      if (k === 'on') {
        if (!('Notification' in window)) { toast(T('notif.unsupported')); return; }
        const perm = await Notification.requestPermission();
        store.set('admNotify', perm === 'granted');
        if (perm === 'granted') { toast('تم تفعيل الإشعارات'); sysNotify('الإشعارات شغالة', 'هيوصلك إشعار مع كل طلب جديد.', { tag: 'adm-test' }); }
        else toast(T('notif.off'));
      }
      if (k === 'sound') store.set('admSound', store.get('admSound', true) === false);
      if (k === 'test') {
        unlockSound();
        alertNewRequest({ no: 'S0', svc: (CFG.services[0] || {}).id, prio: 'high', name: 'تجربة التنبيه', block: '١٤', flat: '٣٠٢', stage: 0 });
      }
      paintInbox();
      return;
    }

    const aa = e.target.closest('[data-aa]');
    if (aa) { $('#admAlert').hidden = true; aa.dataset.aa && aa.dataset.aa !== 'S0' ? openAReq(aa.dataset.aa) : go('admin'); return; }
    if (e.target.closest('[data-aa-x]')) { $('#admAlert').hidden = true; return; }

    const pk = e.target.closest('[data-pick]');
    if (pk) {
      const no = $('#v-areq').dataset.no;
      const list = AREQ_SEL[no] = AREQ_SEL[no] || [];
      const k = list.indexOf(pk.dataset.pick);
      if (k > -1) list.splice(k, 1); else list.push(pk.dataset.pick);
      renderAReq(no);
      return;
    }

    const w = e.target.closest('[data-aw]');
    if (w) {
      const no = $('#v-areq').dataset.no;
      const r = inboxRow(no) || WO_POOL[no];
      const act = w.dataset.aw;
      if (act === 'assign') { areqAssign(no, w); return; }
      if (act === 'gotech') { adminTab = 'tech'; go('admin'); return; }
      if (!r) return;
      if (act === 'print') { await needQR(); printPaper(woSheet(r), 'امر-شغل-' + r.no); return; }
      const was = w.textContent;
      w.disabled = true; w.textContent = '…';
      try {
        const blob = await woPDF(r, true);
        if (act === 'share') { const ok = await shareBlob(blob, woFile(r), 'أمر شغل ' + r.no); if (!ok) saveBlob(blob, woFile(r)); }
        else saveBlob(blob, woFile(r));
        const st = $('#areqPdfState');
        if (st) st.textContent = r.wo_pdf ? '☁ محفوظ في الأرشيف السحابي' : '✓ محفوظ على الجهاز ده';
      } catch (err) {
        toast('تعذّر إنشاء الملف — استخدم «طباعة» ثم «حفظ كـ PDF».');
      } finally {
        w.disabled = false; w.textContent = was;
      }
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'inbSearch') { INBOX.q = e.target.value; paintInboxList(); }
  });

  /* الضغط على الإشعار بيفتح الطلب */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'open-req' && e.data.no) openAReq(e.data.no);
    });
  }
}
