/* ══════════════════════════════════════════════════════════════
   نواة المستقبل للخدمات المتكاملة — تطبيق الصيانة
   مدينة الضبعة السكنية

   ── لتخصيص التطبيق، عدّل CONFIG بالأسفل فقط ───────────────────
   ══════════════════════════════════════════════════════════════ */

const CONFIG = {
  /* ضع الأرقام الحقيقية هنا وستظهر لكل من يفتح التطبيق.
     اتركها فارغة "" لتظهر رسالة «لم يُضف بعد» ويمكن للإدارة
     إدخالها من شاشة الإعدادات على الجهاز.                    */
  lines: [
    { id: 'hot',    name: 'الخط الساخن للصيانة', desc: 'كل أعمال الصيانة داخل المدينة', tel: '', hot: true },
    { id: 'power',  name: 'أعطال الكهرباء',       desc: 'انقطاع التيار · ماس كهربائي',   tel: '' },
    { id: 'water',  name: 'المياه والتسريبات',    desc: 'قطع المياه · كسر ماسورة',       tel: '' },
    { id: 'sewer',  name: 'الصرف الصحي',          desc: 'طفح · انسداد',                  tel: '' },
    { id: 'fire',   name: 'الحريق والإنقاذ',      desc: 'بلاغات الحريق',                 tel: '' },
    { id: 'guard',  name: 'الأمن — بوابة المدينة', desc: 'بلاغات أمنية · تصاريح',        tel: '' }
  ],
  company: 'شركة نواة المستقبل للخدمات المتكاملة',
  city: 'المدينة السكنية — الضبعة'
};

/* ── service catalogue (icons are drawn inline, no icon font) ── */
const SVC = [
  { id:'plumb', name:'سباكة',  tint:'#E8EDFB', ink:'#2E3C96',
    d:'M8 3v5M8 5.5h8a3 3 0 0 1 3 3V12M19 16.5a2.5 2.5 0 1 1-5 0c0-1.6 2.5-4.5 2.5-4.5S19 14.9 19 16.5ZM5.5 3h5M4 12h8M6 12v5a3 3 0 0 0 3 3h1' },
  { id:'elec',  name:'كهرباء', tint:'#FCF0DC', ink:'#B86F14',
    d:'M13.5 2 5 13h6l-1.5 9L19 11h-6l.5-9Z' },
  { id:'ac',    name:'تكييف',  tint:'#E4F5EF', ink:'#12805F',
    d:'M3.5 5.5h17a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 11V7a1.5 1.5 0 0 1 1.5-1.5ZM6 9h.01M9.5 9h5M6.5 16c0 1.6 1.2 2 1.2 3.4M12 16c0 1.6 1.2 2 1.2 3.4M17.5 16c0 1.6 1.2 2 1.2 3.4' },
  { id:'carp',  name:'نجارة',  tint:'#F3EEE6', ink:'#8A6A38',
    d:'M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5M9.5 11h5' },
  { id:'sewer', name:'صرف صحي',tint:'#E8EDFB', ink:'#2E3C96',
    d:'M4 8h16M6 8v9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8M9 4h6v4H9zM10.5 12v4M13.5 12v4' },
  { id:'clean', name:'نظافة',  tint:'#E4F5EF', ink:'#12805F',
    d:'M8 3h3v7H8zM6.5 10h6l1.2 10H5.3ZM15 6h5M15 10h4M15 14h5' },
  { id:'lift',  name:'أسانسير',tint:'#FBE7EA', ink:'#C0304A',
    d:'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM12 3v18M8.5 9.5 7 7.5 5.5 9.5M8.5 14.5 7 16.5 5.5 14.5M15 8.5h3.5M15 12h3.5M15 15.5h3.5' },
  { id:'other', name:'أخرى',   tint:'#EFF1F8', ink:'#6B7492',
    d:'M11 2.5h2l.4 2.3a7.4 7.4 0 0 1 1.9.8l1.9-1.4 1.4 1.4-1.4 1.9c.36.6.63 1.24.8 1.9l2.3.4v2l-2.3.4a7.4 7.4 0 0 1-.8 1.9l1.4 1.9-1.4 1.4-1.9-1.4c-.6.36-1.24.63-1.9.8L13 21.5h-2l-.4-2.3a7.4 7.4 0 0 1-1.9-.8l-1.9 1.4-1.4-1.4 1.4-1.9a7.4 7.4 0 0 1-.8-1.9l-2.3-.4v-2l2.3-.4c.17-.66.44-1.3.8-1.9L5.4 5.6 6.8 4.2l1.9 1.4c.6-.36 1.24-.63 1.9-.8ZM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z' }
];

const PRIO = {
  normal: { label:'عادي',  sla:'خلال ٤٨ ساعة' },
  high:   { label:'هام',   sla:'خلال ٨ ساعات' },
  urgent: { label:'طارئ',  sla:'خلال ساعة واحدة' }
};

/* the fixed path every request walks, straight from the letter:
   استلام → إسناد لفني بأمر شغل → تنفيذ → إنجاز → غلق */
const STAGES = [
  { k:'new',      t:'تم استلام الطلب',        s:'سُجِّل الطلب لدى إدارة الصيانة' },
  { k:'assigned', t:'إسناد لفني بأمر شغل',    s:'يصدر أمر شغل رسمي معتمد من الشركة' },
  { k:'work',     t:'جاري التنفيذ',           s:'الفني في الموقع' },
  { k:'fixed',    t:'تم الإصلاح',             s:'انتهاء أعمال الصيانة' },
  { k:'closed',   t:'غلق الطلب',              s:'بعد تأكيد الساكن' }
];

/* ── tiny helpers ───────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const svg = (d, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const svcById = (id) => SVC.find((s) => s.id === id) || SVC[SVC.length - 1];

const store = {
  get(k, dflt) {
    try { const v = localStorage.getItem('nawah.' + k); return v ? JSON.parse(v) : dflt; }
    catch (e) { return dflt; }
  },
  set(k, v) {
    try { localStorage.setItem('nawah.' + k, JSON.stringify(v)); return true; }
    catch (e) { toast('مساحة التخزين ممتلئة'); return false; }
  }
};

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ══════════ state ══════════ */
let requests = store.get('requests', []);
let profile  = store.get('profile', {});
let lines    = store.get('lines', {});          // admin-entered numbers, keyed by id
let draft    = { svc:'', prio:'', shots:[] };
let listFilter = 'all';

const telOf = (l) => (lines[l.id] || l.tel || '').trim();

/* ══════════ navigation ══════════ */
const VIEWS = ['home', 'new', 'list', 'detail', 'emergency', 'settings'];

function go(name, arg) {
  VIEWS.forEach((v) => { const el = $('#v-' + v); if (el) el.hidden = (v !== name); });
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.go === name));
  window.scrollTo(0, 0);

  if (name === 'list')      renderList();
  if (name === 'detail')    renderDetail(arg);
  if (name === 'emergency') renderEmergency();
  if (name === 'settings')  renderSettings();
  if (name === 'home')      renderCounters();

  // re-trigger the entrance animation
  const v = $('#v-' + name);
  if (v) { v.style.animation = 'none'; void v.offsetWidth; v.style.animation = ''; }
}

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { go(g.dataset.go); return; }
  const c = e.target.closest('[data-close]');
  if (c) { const w = c.closest('.sheet-wrap'); if (w) w.hidden = true; }
});

/* ══════════ home ══════════ */
function renderServices() {
  $('#svcGrid').innerHTML = SVC.map((s) => `
    <button class="svc" type="button" data-svc="${s.id}">
      <span class="ic" style="background:${s.tint};color:${s.ink}">${svg(s.d)}</span>
      <b>${esc(s.name)}</b>
    </button>`).join('');

  $('#pickSvc').innerHTML = SVC.map((s) => `
    <button class="pick" type="button" role="radio" aria-checked="false" data-svc="${s.id}">
      <span class="ic" style="background:${s.tint};color:${s.ink}">${svg(s.d)}</span>
      <b>${esc(s.name)}</b>
    </button>`).join('');

  $('#svcGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-svc]');
    if (!b) return;
    pickSvc(b.dataset.svc);
    go('new');
  });

  $('#pickSvc').addEventListener('click', (e) => {
    const b = e.target.closest('[data-svc]');
    if (b) pickSvc(b.dataset.svc);
  });
}

function pickSvc(id) {
  draft.svc = id;
  $$('#pickSvc .pick').forEach((p) => p.setAttribute('aria-checked', String(p.dataset.svc === id)));
  $('#errSvc').hidden = true;
}

function renderCounters() {
  const open = requests.filter((r) => r.stage < 2).length;
  const work = requests.filter((r) => r.stage === 2).length;
  const done = requests.filter((r) => r.stage >= 3).length;
  $('#cOpen').textContent = AR(open);
  $('#cWork').textContent = AR(work);
  $('#cDone').textContent = AR(done);
  $('#tabDot').hidden = requests.length === 0;
}

/* ══════════ new request ══════════ */
$('#pickPrio').addEventListener('click', (e) => {
  const b = e.target.closest('.prio-op');
  if (!b) return;
  draft.prio = b.dataset.v;
  $$('#pickPrio .prio-op').forEach((p) => p.setAttribute('aria-checked', String(p === b)));
  $('#errPrio').hidden = true;
});

/* photos: downscale in a canvas so localStorage stays small */
$('#fShots').addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []).slice(0, 3 - draft.shots.length);
  files.forEach((f) => {
    if (!f.type.startsWith('image/')) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc);
        cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        draft.shots.push(cv.toDataURL('image/jpeg', 0.62));
        renderShots();
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  });
  e.target.value = '';
});

function renderShots() {
  $('#shotList').innerHTML = draft.shots.map((s, i) => `
    <div class="shot"><img src="${s}" alt="صورة العطل ${AR(i + 1)}">
      <button type="button" data-rm="${i}" aria-label="حذف الصورة">&times;</button></div>`).join('');
}

$('#shotList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rm]');
  if (!b) return;
  draft.shots.splice(Number(b.dataset.rm), 1);
  renderShots();
});

$('#reqForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const area  = $('#fArea').value.trim();
  const block = $('#fBlock').value.trim();
  const flat  = $('#fFlat').value.trim();
  const phone = $('#fPhone').value.replace(/\D/g, '');

  let bad = null;
  $('#errSvc').hidden   = !!draft.svc;
  $('#errPrio').hidden  = !!draft.prio;
  $('#errLoc').hidden   = !!(area && block && flat);
  $('#errPhone').hidden = phone.length === 11;

  if (!draft.svc)  bad = bad || '#errSvc';
  if (!(area && block && flat)) bad = bad || '#errLoc';
  if (!draft.prio) bad = bad || '#errPrio';
  if (phone.length !== 11) bad = bad || '#errPhone';

  if (bad) {
    $(bad).closest('.step').scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('أكمل البيانات الناقصة');
    return;
  }

  const now = new Date();
  const seq = requests.length + 1;
  const no = 'NW-' + String(now.getDate()).padStart(2, '0')
                   + String(now.getMonth() + 1).padStart(2, '0')
                   + '-' + String(seq).padStart(4, '0');

  const req = {
    no, svc: draft.svc, prio: draft.prio,
    area, block, flat,
    floor: $('#fFloor').value.trim(),
    spot:  $('#fSpot').value.trim(),
    desc:  $('#fDesc').value.trim(),
    phone, shots: draft.shots.slice(),
    stage: 0,
    wo: 'WO-' + now.getFullYear() + '-' + String(1000 + seq),
    at: now.toISOString()
  };

  requests.unshift(req);
  if (!store.set('requests', requests)) { requests.shift(); return; }

  /* remember the resident so the next request is one tap shorter */
  profile = Object.assign({}, profile, { phone, block, flat, area });
  store.set('profile', profile);

  $('#doneNo').textContent = no;
  $('#doneSla').textContent = 'الأولوية: ' + PRIO[req.prio].label + ' — الاستجابة المستهدفة ' + PRIO[req.prio].sla;
  $('#doneSheet').hidden = false;
  $('#btnDoneTrack').onclick = () => { $('#doneSheet').hidden = true; go('detail', no); };

  e.target.reset();
  draft = { svc: '', prio: '', shots: [] };
  $$('#pickSvc .pick').forEach((p) => p.setAttribute('aria-checked', 'false'));
  $$('#pickPrio .prio-op').forEach((p) => p.setAttribute('aria-checked', 'false'));
  renderShots();
  renderCounters();
});

/* ══════════ my requests ══════════ */
$('#filters').addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  listFilter = c.dataset.f;
  $$('#filters .chip').forEach((x) => x.classList.toggle('on', x === c));
  renderList();
});

function stageChip(stage) {
  if (stage >= 3) return '<span class="st st-done">تم الإصلاح</span>';
  if (stage === 2) return '<span class="st st-work">جاري التنفيذ</span>';
  return '<span class="st st-new">قيد المراجعة</span>';
}

function renderList() {
  const rows = requests.filter((r) =>
    listFilter === 'all' ? true : listFilter === 'open' ? r.stage < 3 : r.stage >= 3);

  if (!rows.length) {
    $('#reqList').innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V7.6Z"/>
          <path d="M14 3v4.6h4.6M9 13h6M9 16.6h4"/>
        </svg>
        <b>${requests.length ? 'لا توجد طلبات في هذا التصنيف' : 'لا توجد طلبات بعد'}</b>
        <p>${requests.length ? 'جرّب تصنيفاً آخر.' : 'سجّل أول عطل وسيصلك رقم الطلب فوراً مع متابعة كل خطوة.'}</p>
        ${requests.length ? '' : '<button class="btn btn-primary" data-go="new" type="button">طلب صيانة جديد</button>'}
      </div>`;
    return;
  }

  $('#reqList').innerHTML = rows.map((r) => {
    const s = svcById(r.svc);
    const d = new Date(r.at);
    return `<button class="req" type="button" data-no="${esc(r.no)}" data-p="${r.prio}">
      <span class="ic" style="background:${s.tint};color:${s.ink}">${svg(s.d)}</span>
      <span class="t">${esc(s.name)} — عمارة ${AR(esc(r.block))} / شقة ${AR(esc(r.flat))}</span>
      <span class="s">${esc(r.no)} · ${AR(d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }))}</span>
      ${stageChip(r.stage)}
    </button>`;
  }).join('');

  $$('#reqList .req').forEach((b) => {
    b.addEventListener('click', () => go('detail', b.dataset.no));
  });
}

/* ══════════ detail ══════════ */
function renderDetail(no) {
  const r = requests.find((x) => x.no === no) || requests[0];
  if (!r) { go('list'); return; }
  const s = svcById(r.svc);
  const d = new Date(r.at);

  const timeline = STAGES.map((st, i) => {
    const cls = i < r.stage ? 'done' : i === r.stage ? 'now' : '';
    const tick = i < r.stage
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 5 5L19 7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>';
    return `<li class="tl ${cls}">
      <span class="node">${tick}</span>
      <b>${esc(st.t)}</b>
      ${i < STAGES.length - 1 ? '<span class="rail"></span>' : '<span></span>'}
      <span>${i === r.stage ? esc(st.s) + ' — الاستجابة المستهدفة ' + PRIO[r.prio].sla : esc(st.s)}</span>
    </li>`;
  }).join('');

  $('#detail').innerHTML = `
    <div class="d-top">
      <div class="d-no">${esc(r.no)}</div>
      <h3>${esc(s.name)}</h3>
      <div class="d-meta">
        <span class="d-pill ${r.prio}">${esc(PRIO[r.prio].label)}</span>
        <span class="d-pill">${esc(PRIO[r.prio].sla)}</span>
        <span class="d-pill">${AR(d.toLocaleDateString('ar-EG', { day:'numeric', month:'long', year:'numeric' }))}</span>
      </div>
    </div>

    <section class="card">
      <h3>متابعة الحالة</h3>
      <ul class="timeline">${timeline}</ul>
    </section>

    <section class="card">
      <h3>بيانات الطلب</h3>
      <dl class="kv">
        <dt>الموقع</dt><dd>${esc(r.area)} — عمارة ${AR(esc(r.block))}${r.floor ? ' / الدور ' + AR(esc(r.floor)) : ''} / شقة ${AR(esc(r.flat))}</dd>
        ${r.spot ? `<dt>مكان العطل</dt><dd>${esc(r.spot)}</dd>` : ''}
        <dt>أمر الشغل</dt><dd style="direction:ltr;text-align:start">${esc(r.wo)}</dd>
        <dt>للتواصل</dt><dd><a href="tel:${esc(r.phone)}">${AR(esc(r.phone))}</a></dd>
      </dl>
      ${r.desc ? `<p style="margin-top:12px;color:var(--ink)">${esc(r.desc)}</p>` : ''}
      ${r.shots && r.shots.length
        ? `<div class="d-shots" style="margin-top:12px">${r.shots.map((x, i) => `<img src="${x}" alt="صورة العطل ${AR(i + 1)}">`).join('')}</div>`
        : ''}
    </section>

    <section class="card">
      <h3>تنبيه</h3>
      <p>لا تسمح لأي فني بمباشرة العمل قبل التأكد من بطاقة التعريف الشخصية والزي الموحد وأمر الشغل المعتمد. رقم أمر الشغل الخاص بطلبك موضّح بالأعلى.</p>
    </section>`;
}

/* ══════════ emergency ══════════ */
function renderEmergency() {
  $('#emgList').innerHTML = CONFIG.lines.map((l) => {
    const tel = telOf(l);
    const EXTRA = {
      fire:  { tint:'#FBE7EA', ink:'#C0304A',
               d:'M12 2.5s5.5 4.6 5.5 9.3a5.5 5.5 0 0 1-11 0c0-1.6.7-3 1.6-4.2.3 1.3 1.1 2.2 2.1 2.2 1.6 0 2.2-1.6 1.8-7.3ZM12 21a2.6 2.6 0 0 0 2.6-2.6c0-1.6-2.6-3.7-2.6-3.7s-2.6 2.1-2.6 3.7A2.6 2.6 0 0 0 12 21Z' },
      guard: { tint:'#E8EDFB', ink:'#2E3C96',
               d:'M12 2.8 20 6v6c0 4.6-3.3 7.7-8 9.2C7.3 19.7 4 16.6 4 12V6l8-3.2ZM12 8.6v4M12 15.2v.1' }
    };
    const s = EXTRA[l.id] || svcById(l.id === 'power' ? 'elec' : l.id === 'water' ? 'plumb' : l.id);
    const icon = l.hot
      ? svg('M15.5 14.9a2 2 0 0 1 2.1-.45l2.3.9A2 2 0 0 1 21 17.3v1.9a2 2 0 0 1-2.2 2A17.6 17.6 0 0 1 3 5.2 2 2 0 0 1 5 3h1.9a2 2 0 0 1 2 1.6l.5 2.4a2 2 0 0 1-.6 1.9l-1 1a14 14 0 0 0 5.4 5.4l1-1Z')
      : svg(s.d);
    const body = `
      <span class="ic" style="${l.hot ? '' : `background:${s.tint};color:${s.ink}`}">${icon}</span>
      <span class="tx"><b>${esc(l.name)}</b><span>${esc(l.desc)}</span></span>
      <span class="no">${tel ? AR(esc(tel)) : 'لم يُضف بعد'}</span>`;
    return tel
      ? `<a class="emg ${l.hot ? 'hot' : ''}" href="tel:${esc(tel)}">${body}</a>`
      : `<div class="emg unset ${l.hot ? 'hot' : ''}">${body}</div>`;
  }).join('');
}

/* ══════════ settings ══════════ */
function renderSettings() {
  $('#sName').value  = profile.name  || '';
  $('#sPhone').value = profile.phone || '';
  $('#sBlock').value = profile.block || '';
  $('#sFlat').value  = profile.flat  || '';

  $('#adminLines').innerHTML = CONFIG.lines.map((l) => `
    <div class="adm">
      <label for="ln-${l.id}">${esc(l.name)}</label>
      <input id="ln-${l.id}" data-line="${l.id}" inputmode="tel"
             placeholder="${esc(l.tel || 'أدخل الرقم')}" value="${esc(lines[l.id] || '')}">
    </div>`).join('');

  $$('#adminLines input').forEach((inp) => {
    inp.addEventListener('change', () => {
      const v = inp.value.trim();
      if (v) lines[inp.dataset.line] = v; else delete lines[inp.dataset.line];
      store.set('lines', lines);
      toast('تم حفظ الرقم');
    });
  });

  $('#installState').textContent = isStandalone() ? 'مثبّت بالفعل' : 'متاح';
}

['sName', 'sPhone', 'sBlock', 'sFlat'].forEach((id) => {
  $('#' + id).addEventListener('change', (e) => {
    profile[id.slice(1).toLowerCase()] = e.target.value.trim();
    store.set('profile', profile);
    toast('تم الحفظ');
  });
});

$('#btnClear').addEventListener('click', () => {
  if (!requests.length) { toast('لا توجد طلبات'); return; }
  if (!confirm('سيتم مسح كل الطلبات المحفوظة على هذا الجهاز. متابعة؟')) return;
  requests = [];
  store.set('requests', requests);
  renderCounters(); renderList();
  toast('تم مسح الطلبات');
});

$('#btnSettings').addEventListener('click', () => go('settings'));

/* prefill the form from the saved profile */
function prefill() {
  if (profile.phone && !$('#fPhone').value) $('#fPhone').value = profile.phone;
  if (profile.block && !$('#fBlock').value) $('#fBlock').value = profile.block;
  if (profile.flat  && !$('#fFlat').value)  $('#fFlat').value  = profile.flat;
  if (profile.area  && !$('#fArea').value)  $('#fArea').value  = profile.area;
}

/* ══════════ install (PWA) ══════════
   Android/Chrome  → beforeinstallprompt
   iOS Safari      → no API; show the Share → Add to Home Screen sheet
   already added   → hide the banner                                */

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
           || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installHint').textContent = 'اضغط «تثبيت» ويظهر على شاشتك خلال ثانية.';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  $('#installCard').hidden = true;
  toast('تم التثبيت — ستجده على شاشتك الرئيسية');
});

async function doInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome !== 'accepted') toast('تقدر تثبّته في أي وقت من الإعدادات');
    return;
  }
  // iOS, or a browser that has not fired the event yet
  $('#iosSheet').hidden = false;
}

$('#btnInstall').addEventListener('click', doInstall);
$('#btnInstall2').addEventListener('click', doInstall);

function initInstallUI() {
  if (isStandalone()) { $('#installCard').hidden = true; return; }
  if (isIOS) {
    $('#installHint').textContent = 'من زر المشاركة في سفاري ← «إضافة إلى الشاشة الرئيسية».';
    $('#btnInstall').textContent = 'كيف؟';
  }
}

/* ══════════ boot ══════════ */
renderServices();
renderCounters();
prefill();
initInstallUI();

/* deep links from the manifest shortcuts: ?go=new / ?go=emergency */
const wanted = new URLSearchParams(location.search).get('go');
go(VIEWS.indexOf(wanted) > -1 ? wanted : 'home');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
