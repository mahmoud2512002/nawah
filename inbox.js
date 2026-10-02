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
    INBOX.locked = false;
    if (DB.ready() && !canAssign()) {
      rows = []; INBOX.locked = true;                           // البيانات للأجهزة المعتمدة بس
    } else if (DB.ready()) {
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
  if (!canAssign()) { inboxLoad(); return; }       // جهاز مش معتمد: القائمة بس، من غير إشعارات
  unlockSound();
  if (DEVICE_OK) enablePush(false);                // جدّد عنوان الإشعارات بهدوء
  if (DEVICE_OK) { loadServerTechs(); loadPendingDevices().then(refreshInboxUI); }
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
  /* كل ٥ دقايق: الجهاز لسه معتمد؟ */
  if (DEVICE_OK && VERIFY_TICK % 3 === 2) {
    const had = PENDING_DEVS.length;
    await loadPendingDevices();
    if (PENDING_DEVS.length > had) { chime(true); refreshInboxUI(); }
  }
  if (DEVICE && DB.ready() && ++VERIFY_TICK % 15 === 0) {
    const v = await verifyDevice();
    if (v === 'revoked') { dropAdmin('الجهاز ده اتلغى اعتماده من الإدارة'); return; }
  }
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
      tag: 'req-' + r.no, requireInteraction: urgent,
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
    /* صوت أعلى وأوضح: نغمة بثلاث درجات بتتكرر، ومضخّم يرفع الصوت من غير تشويش */
    const out = AC.createDynamicsCompressor();
    out.threshold.value = -18; out.knee.value = 8; out.ratio.value = 6;
    const master = AC.createGain();
    master.gain.value = 2.2;
    out.connect(master); master.connect(AC.destination);
    const tune = urgent ? [1047, 784, 1047, 784, 1319] : [784, 988, 1319];
    const rounds = urgent ? 3 : 2;
    let t = AC.currentTime + 0.02;
    for (let k = 0; k < rounds; k++) {
      tune.forEach((f) => {
        [1, 2].forEach((h) => {                       // النغمة + درجة أعلى منها عشان تبان
          const o = AC.createOscillator(), g = AC.createGain();
          o.type = h === 1 ? 'triangle' : 'sine';
          o.frequency.value = f * h;
          const peak = h === 1 ? 0.9 : 0.25;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
          o.connect(g); g.connect(out);
          o.start(t); o.stop(t + 0.28);
        });
        t += 0.2;
      });
      t += 0.25;
    }
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
  if (DEVICES_ON === null && !DEVICE_OK) await probeDevices();
  if (canAssign()) startAdminWatch();
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
  } else if (perm === 'granted' && store.get('admNotify', true) && PUSH_STATE === 'ok') {
    main = `<b>🔔 الإشعارات شغالة على الجهاز ده — حتى لو الموقع مقفول</b>
      <p>أي طلب جديد يوصلك إشعار على الشاشة، ولو اللوحة مفتوحة كمان صوت تنبيه.</p>`;
  } else if (perm === 'granted' && store.get('admNotify', true)) {
    main = `<b>🔔 الإشعارات شغالة طول ما لوحة الإدارة مفتوحة</b>
      <p>${DEVICE_OK ? esc(pushLine()) : 'عشان توصلك وهي مقفولة كمان، اعتمد الجهاز من تبويب «أجهزة الإدارة».'}</p>
      ${DEVICE_OK && PUSH_STATE !== 'ios' && PUSH_STATE !== 'unsupported' ? '<button class="btn btn-primary btn-block mt" type="button" data-anot="on">تفعيل الإشعارات وهو مقفول</button>' : ''}`;
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
    ${pendingCard()}
    ${!canAssign() ? approveCard(false) : notifCard()}
    ${INBOX.err ? `<div class="note-box warn"><b>${esc(T('err.net'))}</b><p>بيتعرض آخر نسخة اتحمّلت.</p></div>` : ''}
    ${INBOX.locked ? '' : ''}
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
        ${!canAssign() ? approveCard(true) : `<button class="btn btn-primary btn-block mt" type="button" data-aw="assign" ${sel.length ? '' : 'disabled'}>
          ${assigned.length ? (changed ? 'حفظ الإسناد الجديد وتحديث أمر الشغل' : 'مُسند — إعادة إصدار أمر الشغل') : 'إسناد وإصدار أمر الشغل'}
          ${sel.length ? ' (' + num(sel.length) + ')' : ''}</button>`}
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
  if (!canAssign()) { toast('اعتمد الجهاز ده للإدارة الأول'); return; }
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
    await ensureTechCards(ids);        // كل فني مكلّف لازم يبقى ليه رقم كارنيه قبل الإصدار
    const rec = await archiveWO(r);
    if (rec.cloud) r.wo_pdf = rec.cloud;
    toast(rec.cloud ? 'تم الإسناد — وأمر الشغل اتحفظ في الأرشيف' : 'تم الإسناد — وأمر الشغل اتحفظ على الجهاز');
  } catch (e) {
    toast('تم الإسناد — بس تعذّر إصدار PDF، استخدم «طباعة»');
  }
  renderAReq(no);
  refreshInboxUI();
}

/* ══════════ أجهزة الإدارة المعتمدة ══════════
   أي جهاز يدخل بكلمة المرور ويضغط «اعتماد الجهاز ده» بيبقى جهاز إدارة:
   بيفضل داخل على طول، ويوصله إشعار بكل طلب جديد حتى لو الموقع مقفول،
   ويقدر يسند الطلبات. الأجهزة متسجلة في قاعدة البيانات (admin-devices.sql)
   وتقدر تلغي أي جهاز من تبويب «أجهزة الإدارة». */

const VAPID_PUBLIC = 'BHIqB3pVag2MUkyICBali4IcdywB7h8FgtPgn160myWg2ZmCCFFVtOfHdJvvQgVLLJRX2I6Eap0d1lWNo2X5xPA';

let DEVICE = store0('adminDevice');      // { id, token, name }
let DEVICE_OK = false;                   // معتمد ومتأكدين من السيرفر
let DEVICES_ON = null;                   // السيرفر فيه جدول الأجهزة؟ (null = لسه معرفناش)
let PUSH_STATE = '';                     // ok | denied | default | unsupported | ios | error
let VERIFY_TICK = 0;
let DEVICE_PENDING = false;              // الجهاز طلب اعتماد ومستني موافقة جهاز معتمد
let PENDING_DEVS = [];                   // أجهزة مستنية موافقة (بتظهر للأجهزة المعتمدة)
let PENDING_TIMER = null;
let TECHS_ON_SERVER = [];                // الفنيين من السيرفر المؤمَّن

/* الفنيين محفوظين في السيرفر المؤمَّن؟ */
function techServer() { return DB.secure === true && DEVICE_OK; }

function newPin() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
  return String(n);
}

function store0(k) { try { return JSON.parse(localStorage.getItem('nawah.' + k)); } catch (e) { return null; } }
const missingFn = (e) => /http-404/.test(String(e && e.message));

/* الجهاز ده يقدر يسند ويستقبل الإشعارات؟ */
function canAssign() { return DEVICE_OK || DEVICES_ON === false || !DB.ready(); }

async function verifyDevice() {
  DEVICE = store.get('adminDevice', null);
  if (!DEVICE || !DEVICE.id || !DEVICE.token) { DEVICE_OK = false; return false; }
  if (!DB.ready()) { DEVICE_OK = true; return true; }
  try {
    const st = await DB.sec('device_state', { dev_id: DEVICE.id, dev_token: DEVICE.token },
      async () => ((await DB.deviceOk(DEVICE.id, DEVICE.token)) === true ? 'ok' : 'none'));
    DEVICES_ON = true;
    if (st === 'ok') { DEVICE_OK = true; DEVICE_PENDING = false; return true; }
    if (st === 'pending') { DEVICE_OK = false; DEVICE_PENDING = true; watchPending(); return 'pending'; }
    store.del('adminDevice');                                  // الإدارة لغت اعتماده
    DEVICE = null; DEVICE_OK = false; DEVICE_PENDING = false;
    return 'revoked';
  } catch (e) {
    if (missingFn(e)) DEVICES_ON = false;
    DEVICE_OK = true;                                          // النت فاصل — نثق في الجهاز
    return true;
  }
}

/* السيرفر عنده خاصية الأجهزة؟ (لجهاز لسه مش معتمد) */
async function probeDevices() {
  if (DEVICES_ON !== null || !DB.ready()) return DEVICES_ON;
  try { await DB.deviceOk('probe', 'probe'); DEVICES_ON = true; }
  catch (e) { if (missingFn(e)) DEVICES_ON = false; }
  if (DEVICES_ON && DB.secure === null) {
    try { await DB.sec('device_state', { dev_id: 'probe', dev_token: 'probe' }, async () => null); } catch (e) {}
  }
  return DEVICES_ON;
}

function newDeviceId() {
  try { if (crypto.randomUUID) return 'dev-' + crypto.randomUUID(); } catch (e) {}
  return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

function guessDeviceName() {
  const ua = navigator.userAgent || '';
  const kind = /iPhone/.test(ua) ? 'آيفون' : /iPad/.test(ua) ? 'آيباد' : /Android/.test(ua) ? 'موبايل أندرويد'
             : /Windows/.test(ua) ? 'كمبيوتر ويندوز' : /Mac/.test(ua) ? 'ماك' : 'جهاز';
  return kind;
}

async function approveDevice(name, btn) {
  if (!DB.ready()) { toast(T('foot.local')); return false; }
  if (!ADMIN_PIN) { toast('اكتب كلمة مرور الإدارة الأول'); askPassword(); return false; }
  const id = (DEVICE && DEVICE.id) || newDeviceId();
  const was = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الاعتماد…'; }
  const nm = name || guessDeviceName();
  try {
    const res = await DB.sec('request_device', { pass: ADMIN_PIN, dev_id: id, dev_name: nm },
      async () => ({ status: 'approved', token: await DB.approveDevice(ADMIN_PIN, id, nm) }));
    DEVICES_ON = true;
    if (!res || res.status === 'bad') { toast('كلمة المرور غلط'); return false; }
    if (res.status === 'locked') { toast('محاولات كتير غلط — استنى ربع ساعة'); return false; }
    if (res.status === 'busy')   { toast('طلبات اعتماد كتير من نفس الشبكة — جرّب تاني بعد ساعة'); return false; }
    DEVICE = { id, token: String(res.token), name: nm };
    store.set('adminDevice', DEVICE);
    if (res.status === 'pending') {
      /* الاعتماد الفوري (instant-approve.sql): كلمة المرور + «اعتماد الجهاز ده» تكفي،
         والجهاز بيتعتمد في نفس اللحظة — نتأكد من السيرفر ونكمّل على طول */
      let st = '';
      try { st = await DB.deviceState(id, DEVICE.token); } catch (e) { /* نكمّل تحت */ }
      if (st !== 'ok') {
        DEVICE_OK = false; DEVICE_PENDING = true;
        toast('الجهاز اتسجّل بس لسه مش متعتمد — شغّل ملف الاعتماد الفوري في قاعدة البيانات');
        watchPending();
        return false;
      }
    }
    await becomeApproved();
    toast('تم اعتماد الجهاز ده للإدارة');
    return true;
  } catch (e) {
    if (missingFn(e)) { DEVICES_ON = false; toast('لازم تشغّل ملف أجهزة الإدارة في قاعدة البيانات الأول'); }
    else if (/unauthorized/.test(String(e.message))) toast('كلمة المرور غلط');
    else toast(T('err.net'));
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = was; }
    refreshAdminViews();
  }
}

async function becomeApproved() {
  DEVICE_OK = true; DEVICE_PENDING = false; DEVICES_ON = true;
  clearInterval(PENDING_TIMER); PENDING_TIMER = null;
  isAdmin = true;
  sessionStorage.setItem('nawah.admin', '1');
  $('#adminTab').hidden = false;
  document.body.classList.add('is-admin');
  stopAdminWatch();
  startAdminWatch();
  await enablePush(true);
  refreshAdminViews();
}

/* الجهاز مستني موافقة: نسأل كل ١٥ ثانية */
function watchPending() {
  if (PENDING_TIMER) return;
  PENDING_TIMER = setInterval(async () => {
    if (!DEVICE || !DEVICE_PENDING) { clearInterval(PENDING_TIMER); PENDING_TIMER = null; return; }
    try {
      const st = await DB.deviceState(DEVICE.id, DEVICE.token);
      if (st === 'ok') { await becomeApproved(); toast('تمت الموافقة على الجهاز ده — أهلاً بيك في الإدارة'); }
      else if (st === 'none') {
        clearInterval(PENDING_TIMER); PENDING_TIMER = null;
        await forgetThisDevice();
        toast('طلب اعتماد الجهاز ده اترفض');
        refreshAdminViews();
      }
    } catch (e) { /* نحاول تاني */ }
  }, 15000);
}

/* الأجهزة اللي مستنية موافقة (للأجهزة المعتمدة) */
async function loadPendingDevices() {
  if (!DEVICE_OK || DB.secure !== true) { PENDING_DEVS = []; return; }
  try {
    const list = (await DB.listDevices(DEVICE.id, DEVICE.token, null)) || [];
    PENDING_DEVS = list.filter((d) => d.approved === false);
  } catch (e) { /* نحاول بعدين */ }
}

async function acceptDevice(id, btn) {
  if (btn) btn.disabled = true;
  try { await DB.approvePending(id); toast('تم اعتماد الجهاز'); }
  catch (e) { toast(T('err.net')); }
  await loadPendingDevices();
  refreshAdminViews();
}

function pendingCard() {
  if (!PENDING_DEVS.length) return '';
  return PENDING_DEVS.map((d) => `<div class="note-box warn dev-pending">
      <b>🔐 جهاز جديد بيطلب دخول الإدارة: «${esc(d.name || 'جهاز')}»</b>
      <p>طلب ${esc(ago(d.last_seen || d.created_at))}. لو ده جهازك أو جهاز حد من الإدارة وافق عليه، غير كده ارفضه.</p>
      <div class="dev-row">
        <button class="btn btn-primary" type="button" data-dev="accept" data-id="${esc(d.id)}">موافقة</button>
        <button class="btn btn-quiet" type="button" data-dev="remove" data-id="${esc(d.id)}" data-name="${esc(d.name || '')}">رفض</button>
      </div>
    </div>`).join('');
}

/* ── الفنيين في السيرفر المؤمَّن ── */
async function loadServerTechs() {
  if (!techServer()) return false;
  try {
    const rows = (await DB.adminTechs()) || [];
    TECHS_ON_SERVER = rows.map((t) => ({ id: t.id, name: t.name || '', phone: t.phone || '', pin: t.pin || '', svcs: t.svcs || [] }));
    if (TECHS_ON_SERVER.length) CFG.technicians = TECHS_ON_SERVER.map((t) => Object.assign({}, t));
    syncTechCards();                 // أرقام الكارنيهات اللي على الجهاز ده ← السيرفر
    return true;
  } catch (e) { return false; }
}

const TECH_SAVE = {};
function saveTechSoon(t) {
  clearTimeout(TECH_SAVE[t.id]);
  TECH_SAVE[t.id] = setTimeout(async () => {
    try {
      await DB.saveTech(t);
      const k = TECHS_ON_SERVER.findIndex((x) => x.id === t.id);
      if (k > -1) TECHS_ON_SERVER[k] = Object.assign({}, t); else TECHS_ON_SERVER.push(Object.assign({}, t));
      ensureTechCards([t.id]);         // فني جديد ← رقم كارنيه تلقائي
    } catch (e) { toast(/pin/.test(String(e.message)) ? 'الرقم السري لازم ٤ أرقام على الأقل' : T('err.net')); }
  }, 700);
}

async function importTechs(btn) {
  const list = ((REMOTE && REMOTE.technicians) || []).filter((t) => t.name);
  if (!list.length) return;
  if (btn) { btn.disabled = true; btn.textContent = 'جاري النقل…'; }
  let n = 0;
  for (const t of list) {
    try { await DB.saveTech({ id: t.id, name: t.name, phone: t.phone || '', pin: newPin(), svcs: t.svcs || [] }); n++; }
    catch (e) { /* نكمّل */ }
  }
  await loadServerTechs();
  saveDraft();                              // عشان «نشر» يشيلهم من ملف الإعدادات العام
  toast('اتنقل ' + num(n) + ' فنيين بأرقام سرية جديدة — اعمل «نشر» عشان يتشالوا من الملف العام');
  renderAdmin();
}

/* إلغاء اعتماد جهاز (أي جهاز، أو الجهاز ده نفسه) */
async function removeDevice(target) {
  try {
    await DB.removeDevice(DEVICE && DEVICE.id, DEVICE && DEVICE.token, ADMIN_PIN, target);
  } catch (e) { toast(T('err.net')); return false; }
  if (DEVICE && target === DEVICE.id) await forgetThisDevice();
  return true;
}

async function forgetThisDevice() {
  try {
    const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
    const sub = reg && reg.pushManager && await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (e) {}
  store.del('adminDevice');
  DEVICE = null; DEVICE_OK = false; DEVICE_PENDING = false; PUSH_STATE = '';
}

/* ── الإشعار وهو مقفول (Web Push) ── */
function b64uToBytes(s) {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function enablePush(ask) {
  if (!DEVICE_OK || !DEVICE || !DB.ready()) return (PUSH_STATE = '');
  const ios = /iPhone|iPad/.test(navigator.userAgent || '');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return (PUSH_STATE = ios && !standalone ? 'ios' : 'unsupported');
  }
  let perm = Notification.permission;
  if (perm === 'default' && ask) { try { perm = await Notification.requestPermission(); } catch (e) {} }
  if (perm !== 'granted') return (PUSH_STATE = perm);
  store.set('admNotify', true);
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((ok) => setTimeout(() => ok(null), 8000))
    ]);
    if (!reg) return (PUSH_STATE = 'error');
    let sub = await reg.pushManager.getSubscription();
    const key = b64uToBytes(VAPID_PUBLIC);
    if (sub && sub.options && sub.options.applicationServerKey) {
      const old = new Uint8Array(sub.options.applicationServerKey);
      if (old.length !== key.length || old.some((b, i) => b !== key[i])) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await DB.savePush(DEVICE.id, DEVICE.token, sub.toJSON());
    return (PUSH_STATE = 'ok');
  } catch (e) {
    return (PUSH_STATE = missingFn(e) ? 'nofn' : 'error');
  }
}

/* الإدارة اتسحبت من الجهاز ده (اعتماده اتلغى من جهاز تاني) */
function dropAdmin(msg) {
  isAdmin = false; ADMIN_PIN = '';
  sessionStorage.removeItem('nawah.admin'); sessionStorage.removeItem('nawah.pin');
  $('#adminTab').hidden = true;
  document.body.classList.remove('is-admin');
  stopAdminWatch();
  if (msg) toast(msg);
  if (!$('#v-admin').hidden || !$('#v-areq').hidden) go('home');
}

function refreshAdminViews() {
  if (!$('#v-admin').hidden) renderAdmin();
  const open = $('#v-areq');
  if (open && !open.hidden && open.dataset.no) renderAReq(open.dataset.no);
}

/* كارت «اعتماد الجهاز ده» */
function approveCard(compact) {
  if (DEVICE_PENDING) {
    return `<div class="note-box warn dev-approve">
      <b>⏳ الجهاز ده مستني موافقة الإدارة</b>
      <p>اتسجّل باسم «${esc((DEVICE && DEVICE.name) || '')}» بس لسه مش متعتمد.
      اتأكد إن ملف الاعتماد الفوري اتشغّل في قاعدة البيانات — وبعدها الزرار هيرجع وتعتمده بضغطة واحدة.</p>
    </div>`;
  }
  return `<div class="note-box warn dev-approve">
    <b>الجهاز ده مش معتمد للإدارة لسه</b>
    <p>${compact ? 'اعتمده عشان تقدر تسند الطلبات من عليه.'
      : 'اعتمده مرة واحدة ويفضل داخل على طول: يوصله إشعار بكل طلب جديد حتى لو الموقع مقفول، ويقدر يسند الطلبات للفنيين.'}</p>
    <div class="dev-row">
      <input class="dev-name" value="${esc(guessDeviceName())}" placeholder="اسم الجهاز — مثلاً: موبايل عبدالعزيز" aria-label="اسم الجهاز">
      <button class="btn btn-primary" type="button" data-dev="approve">اعتماد الجهاز ده</button>
    </div>
  </div>`;
}

/* ── تبويب «أجهزة الإدارة» ── */
async function admDevices(box) {
  await probeDevices();
  if (DEVICES_ON === false) {
    box.innerHTML = `<div class="note-box warn"><b>خاصية الأجهزة مش متفعلة في قاعدة البيانات</b>
      <p>شغّل ملف أجهزة الإدارة مرة واحدة في قاعدة البيانات (الخطوات في ملف «إعداد الإشعارات»)،
      وبعدها ارجع هنا واعتمد أجهزتك.</p></div>`;
    return;
  }
  let list = [];
  let err = false;
  if (DEVICE_OK || DB.secure === false) {
    try { list = (await DB.listDevices(DEVICE && DEVICE.id, DEVICE && DEVICE.token, ADMIN_PIN)) || []; }
    catch (e) { err = true; }
  }
  const mine = DEVICE && DEVICE.id;
  box.innerHTML = `
    <p class="fine mb">أي جهاز يدخل بكلمة المرور ويضغط «اعتماد الجهاز ده» بيبقى جهاز إدارة: يوصله الإشعارات
      ويقدر يسند الطلبات. تقدر تلغي أي جهاز من هنا — بيخرج من الإدارة فوراً ويبطّل يوصله إشعارات.</p>
    ${DEVICE_OK ? `<div class="note-box ok"><b>✓ الجهاز ده معتمد: ${esc((DEVICE && DEVICE.name) || '')}</b>
        <p>${pushLine()}</p>
        ${PUSH_STATE !== 'ok' ? '<button class="btn btn-primary btn-block mt" type="button" data-anot="on">🔔 تفعيل الإشعارات على الجهاز ده</button>' : ''}
      </div>` : approveCard(false)}
    ${err ? `<div class="note-box warn"><b>${esc(T('err.net'))}</b></div>` : ''}
    <h4 class="adm-h">أجهزة الإدارة (${num(list.length)})</h4>
    <div class="adm-list">${list.length ? list.map((d) => `
      <div class="adm-item dev-item">
        <div class="dev-t">
          <b>${esc(d.name || 'جهاز')}${d.id === mine ? ' <em class="st st-new">الجهاز ده</em>' : ''}${d.approved === false ? ' <em class="st st-hot">مستني موافقة</em>' : ''}</b>
          <span>اتعتمد ${esc(fmtDate(new Date(d.created_at), false))} · آخر ظهور ${esc(d.last_seen ? ago(d.last_seen) : '—')}
            · ${d.has_push ? '🔔 الإشعارات شغالة' : '🔕 الإشعارات مش متفعلة'}</span>
        </div>
        ${d.approved === false
          ? `<button class="btn btn-primary btn-sm" type="button" data-dev="accept" data-id="${esc(d.id)}">موافقة</button>
             <button class="btn btn-quiet btn-sm" type="button" data-dev="remove" data-id="${esc(d.id)}" data-name="${esc(d.name || '')}">رفض</button>`
          : `<button class="btn btn-quiet btn-sm" type="button" data-dev="remove" data-id="${esc(d.id)}" data-name="${esc(d.name || '')}">إلغاء</button>`}
      </div>`).join('') : `<p class="fine">${DEVICE_OK || DB.secure === false ? 'مفيش أجهزة معتمدة لسه.' : 'القائمة بتظهر على الأجهزة المعتمدة بس.'}</p>`}</div>`;
}

function pushLine() {
  return PUSH_STATE === 'ok' ? '🔔 الإشعارات شغالة حتى لو الموقع أو المتصفح مقفول.'
    : PUSH_STATE === 'ios' ? 'على الآيفون: ثبّت التطبيق على الشاشة الرئيسية وافتحه منها، وبعدين فعّل الإشعارات.'
    : PUSH_STATE === 'denied' ? 'الإشعارات مقفولة من إعدادات المتصفح — افتحها من إعدادات الموقع (رمز القفل جنب اللينك).'
    : PUSH_STATE === 'unsupported' ? 'المتصفح ده مش بيدعم الإشعارات وهو مقفول — استخدم كروم.'
    : PUSH_STATE === 'nofn' ? 'قاعدة البيانات محتاجة ملف أجهزة الإدارة عشان الإشعارات توصل وهو مقفول.'
    : PUSH_STATE === 'error' ? 'تعذّر تفعيل الإشعارات على الجهاز ده — جرّب تاني.'
    : 'الإشعارات مش متفعلة على الجهاز ده لسه.';
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
      if (k === 'on' && DEVICE_OK) {
        n.disabled = true;
        const st = await enablePush(true);
        toast(st === 'ok' ? 'تم — الإشعارات هتوصلك حتى لو الموقع مقفول' : pushLine());
        if (st === 'ok') sysNotify('الإشعارات شغالة', 'هيوصلك إشعار مع كل طلب جديد.', { tag: 'adm-test' });
        refreshAdminViews();
        return;
      }
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

    const dv = e.target.closest('[data-dev]');
    if (dv) {
      if (dv.dataset.dev === 'approve') {
        const inp = dv.closest('.dev-approve') && dv.closest('.dev-approve').querySelector('.dev-name');
        const nm = (inp && inp.value.trim()) || guessDeviceName();
        await approveDevice(nm, dv);
        return;
      }
      if (dv.dataset.dev === 'accept') { await acceptDevice(dv.dataset.id, dv); return; }
      if (dv.dataset.dev === 'remove') {
        const self = DEVICE && dv.dataset.id === DEVICE.id;
        if (!confirm(self ? 'إلغاء اعتماد الجهاز ده؟ هيخرج من الإدارة ويبطّل يوصله إشعارات.'
                          : 'إلغاء اعتماد «' + (dv.dataset.name || 'الجهاز') + '»؟ هيخرج من الإدارة فوراً.')) return;
        dv.disabled = true;
        const ok = await removeDevice(dv.dataset.id);
        if (ok && self) { dropAdmin('تم إلغاء اعتماد الجهاز ده'); return; }
        if (ok) toast('تم إلغاء اعتماد الجهاز');
        refreshAdminViews();
      }
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
      if (e.data && e.data.type === 'push-new' && isAdmin) admPoll();      // وصل إشعار — حدّث القائمة فوراً
    });
  }
}
