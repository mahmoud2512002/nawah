/* ══════════════════════════════════════════════════════════════
   نواة المستقبل للخدمات المتكاملة — تطبيق الصيانة
   مدينة الضبعة السكنية

   كل المحتوى (الخدمات · الأرقام · النصوص · القفل) يأتي من
   config.json ويُحرَّر من لوحة الأدمن داخل التطبيق.
   ══════════════════════════════════════════════════════════════ */

/* كلمة مرور الإدارة بتتراجع في السيرفر بس (admin_check).
   البصمة كانت هنا في الكود العام وكانت بتتفك في أقل من ثانية،
   فاتشالت — متحطش كلمة المرور ولا بصمتها في أي ملف جوه site. */
const ADMIN_HASH = '';

async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── tiny helpers ───────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid = () => 's' + Math.random().toString(36).slice(2, 8);

const store = {
  get(k, d) { try { const v = localStorage.getItem('nawah.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nawah.' + k, JSON.stringify(v)); return true; } catch (e) { toast(T('err.storage')); return false; } },
  del(k)    { try { localStorage.removeItem('nawah.' + k); } catch (e) {} }
};

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ══════════ icon + colour libraries (admin picks from these) ══════════ */
const ICONS = {
  plumb:'M8 3v5M8 5.5h8a3 3 0 0 1 3 3V12M19 16.5a2.5 2.5 0 1 1-5 0c0-1.6 2.5-4.5 2.5-4.5S19 14.9 19 16.5ZM5.5 3h5M4 12h8M6 12v5a3 3 0 0 0 3 3h1',
  bolt:'M13.5 2 5 13h6l-1.5 9L19 11h-6l.5-9Z',
  ac:'M3.5 5.5h17a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 11V7a1.5 1.5 0 0 1 1.5-1.5ZM6 9h.01M9.5 9h5M6.5 16c0 1.6 1.2 2 1.2 3.4M12 16c0 1.6 1.2 2 1.2 3.4M17.5 16c0 1.6 1.2 2 1.2 3.4',
  carp:'M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5M9.5 11h5',
  sewer:'M4 8h16M6 8v9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8M9 4h6v4H9zM10.5 12v4M13.5 12v4',
  clean:'M8 3h3v7H8zM6.5 10h6l1.2 10H5.3ZM15 6h5M15 10h4M15 14h5',
  lift:'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM12 3v18M8.5 9.5 7 7.5 5.5 9.5M8.5 14.5 7 16.5 5.5 14.5M15 8.5h3.5M15 12h3.5M15 15.5h3.5',
  gear:'M11 2.5h2l.4 2.3a7.4 7.4 0 0 1 1.9.8l1.9-1.4 1.4 1.4-1.4 1.9c.36.6.63 1.24.8 1.9l2.3.4v2l-2.3.4a7.4 7.4 0 0 1-.8 1.9l1.4 1.9-1.4 1.4-1.9-1.4c-.6.36-1.24.63-1.9.8L13 21.5h-2l-.4-2.3a7.4 7.4 0 0 1-1.9-.8l-1.9 1.4-1.4-1.4 1.4-1.9a7.4 7.4 0 0 1-.8-1.9l-2.3-.4v-2l2.3-.4c.17-.66.44-1.3.8-1.9L5.4 5.6 6.8 4.2l1.9 1.4c.6-.36 1.24-.63 1.9-.8ZM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z',
  fire:'M12 2.5s5.5 4.6 5.5 9.3a5.5 5.5 0 0 1-11 0c0-1.6.7-3 1.6-4.2.3 1.3 1.1 2.2 2.1 2.2 1.6 0 2.2-1.6 1.8-7.3ZM12 21a2.6 2.6 0 0 0 2.6-2.6c0-1.6-2.6-3.7-2.6-3.7s-2.6 2.1-2.6 3.7A2.6 2.6 0 0 0 12 21Z',
  shield:'M12 2.8 20 6v6c0 4.6-3.3 7.7-8 9.2C7.3 19.7 4 16.6 4 12V6l8-3.2ZM12 8.6v4M12 15.2v.1',
  paint:'M5 3h11a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5ZM12 10v3.5a1.5 1.5 0 0 1-1.5 1.5H10a1.5 1.5 0 0 0-1.5 1.5V21h4v-4.5',
  net:'M12 20.5v-4M8.4 16.5h7.2M4 4.5h16v8H4ZM8 8.5h8M12 12.5v4',
  door:'M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M4 21h16M13 12.3v.1',
  glass:'M4 4h16v16H4ZM4 4l16 16M20 4 4 20',
  garden:'M12 21v-7M12 14c0-3.3 2.4-6 5.5-6 0 3.3-2.4 6-5.5 6ZM12 14c0-3.3-2.4-6-5.5-6 0 3.3 2.4 6 5.5 6ZM12 9c0-2.6 1-5 1-5s1 2.4 1 5a1.9 1.9 0 0 1-2 0Z',
  pest:'M12 7.5a4.5 4.5 0 0 1 4.5 4.5v3a4.5 4.5 0 0 1-9 0v-3A4.5 4.5 0 0 1 12 7.5ZM12 7.5V5M9.5 4 12 5l2.5-1M7.5 11H4M7.5 15H4.5M16.5 11H20M16.5 15h3M7 18.5l-2 2M17 18.5l2 2',
  car:'M5.5 16.5h13M4 16.5v2.2M20 16.5v2.2M6.5 16.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0ZM20.7 16.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0ZM3.5 12.5h17l-1.4-4.1A2 2 0 0 0 17.2 7H6.8a2 2 0 0 0-1.9 1.4Z'
};
const ICON_ORDER = Object.keys(ICONS);

const COLORS = {
  navy:  { tint:'#E8EDFB', ink:'#2E3C96', name:'كحلي' },
  amber: { tint:'#FCF0DC', ink:'#B86F14', name:'كهرماني' },
  green: { tint:'#E4F5EF', ink:'#12805F', name:'أخضر' },
  red:   { tint:'#FBE7EA', ink:'#C0304A', name:'أحمر' },
  wood:  { tint:'#F3EEE6', ink:'#8A6A38', name:'بني' },
  grey:  { tint:'#EFF1F8', ink:'#6B7492', name:'رمادي' },
  teal:  { tint:'#E2F3F6', ink:'#15707F', name:'تركواز' },
  plum:  { tint:'#F0EAF8', ink:'#6A46A8', name:'بنفسجي' }
};
const COLOR_ORDER = Object.keys(COLORS);

const svg = (d, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const iconOf  = (s) => ICONS[s && s.icon] || ICONS.gear;
const colorOf = (s) => COLORS[s && s.color] || COLORS.grey;


/* ══════════ language ══════════ */
let LANG = 'ar';

function T(key) {
  const row = I18N[key];
  if (!row) return key;
  return row[LANG] || row.ar || key;
}

/* a translatable value out of config.json: name / name_en / name_ru */
function C(obj, field) {
  if (!obj) return '';
  if (LANG === 'ar') return obj[field] || '';
  return obj[field + '_' + LANG] || obj[field] || '';
}

/* a translatable array out of config.json: areas / areas_en / areas_ru */
function CL(key) {
  if (LANG !== 'ar') {
    const alt = CFG[key + '_' + LANG];
    if (Array.isArray(alt) && alt.length === (CFG[key] || []).length) return alt;
  }
  return CFG[key] || [];
}

const locale = () => LANGS[LANG].locale;

/* Arabic-Indic digits for Arabic, Western digits otherwise */
function num(n) {
  const str = String(n);
  return LANG === 'ar' ? str.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : str;
}

function fmtDate(d, withYear) {
  const o = { day: 'numeric', month: 'long' };
  if (withYear) o.year = 'numeric';
  try { return d.toLocaleDateString(locale(), o); } catch (e) { return d.toLocaleDateString(); }
}

function applyI18n() {
  const L = LANGS[LANG];
  document.documentElement.lang = LANG;
  document.documentElement.dir = L.dir;
  const co = C(CFG && CFG.brand, 'company');
  document.title = co ? co + ' \u2014 ' + C(CFG.brand, 'tagline') : T('app.title');

  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = T(el.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach((el) => { el.placeholder = T(el.dataset.tp); });
  document.querySelectorAll('[data-ta]').forEach((el) => { el.setAttribute('aria-label', T(el.dataset.ta)); });

  const flag = $('#langFlag');
  if (flag) flag.textContent = L.flag;
}

function setLang(code, silent) {
  if (!LANGS[code]) code = 'ar';
  LANG = code;
  store.set('lang', code);

  applyI18n();
  paintLangMenu();
  renderAll();

  /* أعد رسم الشاشة المفتوحة بنفس محتواها */
  const open = VIEWS.find((v) => { const el = $('#v-' + v); return el && !el.hidden; });
  if (open) go(open, open === 'detail' ? lastDetail : undefined);

  if (!silent) toast(LANGS[code].name);
}

/* ── قائمة اللغات ───────────────────────────────────────
   الرسم منفصل عن الربط: الأزرار بتتربط مرة واحدة بس عند
   الإقلاع، والقائمة بترسم من جديد بعد كل تبديل.          */

function paintLangMenu() {
  const enabled = (CFG.langs && CFG.langs.enabled) || ['ar', 'en', 'ru'];
  $('#langMenu').innerHTML = enabled.map((code) => `
    <button class="lang-op ${code === LANG ? 'on' : ''}" type="button" role="menuitem" data-lang="${code}">
      <em>${LANGS[code].flag}</em><span>${LANGS[code].name}</span>
    </button>`).join('');
}

function closeLangMenu() {
  const m = $('#langMenu');
  if (!m || m.hidden) return;
  m.hidden = true;
  $('#btnLang').setAttribute('aria-expanded', 'false');
}

let langWired = false;

function initLangMenu() {
  paintLangMenu();
  if (langWired) return;           // الربط مرة واحدة فقط
  langWired = true;

  $('#btnLang').addEventListener('click', (e) => {
    e.stopPropagation();
    const m = $('#langMenu');
    const open = m.hidden;
    m.hidden = !open;
    $('#btnLang').setAttribute('aria-expanded', String(open));
  });

  $('#langMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    closeLangMenu();
    setLang(b.dataset.lang);
  });

  document.addEventListener('click', closeLangMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenu(); });
}

function detectLang() {
  const saved = store.get('lang', null);
  if (saved && LANGS[saved]) return saved;
  const nav = (navigator.language || 'ar').slice(0, 2).toLowerCase();
  if (LANGS[nav]) return nav;
  return (CFG.langs && CFG.langs.default) || 'ar';
}

/* the fixed path every request walks, from the letter:
   استلام ← إسناد بأمر شغل ← تنفيذ ← إصلاح ← غلق */
const STAGE_COUNT = 5;
const stageT = (i) => ({ t: T('stg.' + i + 't'), s: T('stg.' + i + 's') });

/* ══════════ state ══════════ */
let CFG        = null;                       // live config (remote ⊕ admin draft)
let REMOTE     = null;                       // exactly what config.json said
let requests   = store.get('requests', []);
let profile    = store.get('profile', {});
let draft      = { svc:'', prio:'', shots:[] };
let listFilter = 'all';
let lastDetail = null;
let isAdmin    = sessionStorage.getItem('nawah.admin') === '1';
let ADMIN_PIN  = sessionStorage.getItem('nawah.pin') || '';

const svcById = (id) => (CFG.services.find((s) => s.id === id)) || CFG.services[CFG.services.length - 1] || { name:'خدمة', icon:'gear', color:'grey' };
const telOf   = (l) => String(l.tel || '').trim();

/* ══════════ رقم الطلب ══════════
   حرف واحد لكل قسم + رقم متسلسل يبدأ من ١ ويكمل لما لا نهاية:
   السباكة S1 ثم S2 ثم S3 … الكهرباء E1 ثم E2 … وهكذا لكل قسم عدّاده.

   العدّاد الأساسي في قاعدة البيانات (دالة next_req_no) عشان يبقى
   واحد لكل السكان. لو مفيش اتصال، الجهاز يكمّل بعدّاد محلي
   ولا يرجع لورا أبداً. */

const CODE_SPARE = 'QRTUVYZBFGHJKLMOPW';   // حروف احتياطية لأي قسم جديد

// حرف القسم — من config.json، ولو مش موجود نختار له حرفاً فاضياً
function svcCode(id) {
  const s = CFG.services.find((x) => x.id === id);
  const c = String((s && s.code) || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(c)) return c;

  const used = {};
  CFG.services.forEach((x) => {
    const k = String(x.code || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(k) && x.id !== id) used[k] = 1;
  });
  const guess = String((s && (s.name_en || s.id)) || 'X').toUpperCase().replace(/[^A-Z]/g, '');
  for (let i = 0; i < guess.length; i++)      if (!used[guess[i]])      return guess[i];
  for (let i = 0; i < CODE_SPARE.length; i++) if (!used[CODE_SPARE[i]]) return CODE_SPARE[i];
  return 'X';
}

// آخر رقم وصل له القسم على هذا الجهاز
function lastSeq(code) {
  const seqs = store.get('seq', {});
  let n = Number(seqs[code] || 0);
  if (!(n > 0)) n = 0;
  requests.forEach((r) => {
    const v = String((r && r.no) || '').toUpperCase();
    if (v.charAt(0) !== code) return;
    const tail = v.slice(1);
    if (!/^[0-9]+$/.test(tail)) return;
    if (Number(tail) > n) n = Number(tail);
  });
  return n;
}

function keepSeq(no) {
  const m = /^([A-Z])(\d+)$/.exec(String(no || '').toUpperCase());
  if (!m) return no;
  const seqs = store.get('seq', {});
  if (Number(m[2]) > Number(seqs[m[1]] || 0)) { seqs[m[1]] = Number(m[2]); store.set('seq', seqs); }
  return no;
}

async function newReqNo(svcId) {
  const code = svcCode(svcId);
  if (DB.ready()) {
    try {
      const out = await DB.nextNo(code);
      if (/^[A-Z]\d+$/.test(String(out || ''))) return keepSeq(out);
    } catch (e) { /* مفيش اتصال — نكمّل محلياً */ }
  }
  return keepSeq(code + (lastSeq(code) + 1));
}

/* ══════════ config loading ══════════
   config.json is the source of truth for everyone.
   The admin's unpublished edits live in localStorage until exported. */
async function loadConfig() {
  let remote = null;
  try {
    const res = await fetch('config.json?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) remote = await res.json();
  } catch (e) { /* offline — fall back to whatever we cached */ }

  if (!remote) remote = store.get('cfgCache', null);
  if (!remote) { fatal(T('err.config')); return false; }

  store.set('cfgCache', remote);
  REMOTE = remote;

  let localDraft = store.get('cfgDraft', null);

  /* التعديلات اتنشرت خلاص؟ امسح المسودة وسيب المنشور هو الأصل */
  if (localDraft && Number(remote.version || 0) >= Number(localDraft.version || 0)) {
    store.del('cfgDraft');
    localDraft = null;
  }

  CFG = localDraft ? deepMerge(clone(remote), localDraft) : clone(remote);
  return true;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
function deepMerge(base, over) {
  Object.keys(over).forEach((k) => {
    if (Array.isArray(over[k]) || typeof over[k] !== 'object' || over[k] === null) base[k] = over[k];
    else base[k] = deepMerge(base[k] || {}, over[k]);
  });
  return base;
}
function saveDraft() {
  CFG.version = Number((REMOTE && REMOTE.version) || 0) + 1;
  store.set('cfgDraft', CFG);
  $('#pubDot') && ($('#pubDot').hidden = false);
}
const hasDraft = () => !!store.get('cfgDraft', null);

function fatal(msg) {
  document.body.innerHTML = `<div class="lockwrap"><div class="lockbox">
    <h1>${esc(T('err.fatal'))}</h1><p>${esc(msg)}</p></div></div>`;
}

/* ══════════ lock screen ══════════ */
function renderLock() {
  $('#lockScreen').hidden = false;
  $('.shell').hidden = true;
  $('#lockTitle').textContent = C(CFG,'lockTitle');
  $('#lockMsg').textContent   = C(CFG,'lockMessage');
}

/* ══════════ navigation ══════════ */
const VIEWS = ['home', 'new', 'list', 'detail', 'emergency', 'settings', 'admin', 'areq', 'tech', 'cm', 'wo', 'cards'];

function go(name, arg) {
  if ((name === 'admin' || name === 'areq' || name === 'cards') && !isAdmin) { askPassword(); return; }
  if (name === 'wo' && !isAdmin && !TECH) name = 'detail';          // أمر الشغل مش للساكن
  if (name === 'tech' && !TECH) { askTech(); return; }
  VIEWS.forEach((v) => { const el = $('#v-' + v); if (el) el.hidden = (v !== name); });
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.go === (name === 'areq' ? 'admin' : name)));
  window.scrollTo(0, 0);

  if (name === 'list')      renderList();
  if (name === 'detail')    renderDetail(arg);
  if (name === 'emergency') renderEmergency();
  if (name === 'settings')  renderSettings();
  if (name === 'admin')     renderAdmin();
  if (name === 'areq')      renderAReq(arg);
  if (name === 'tech')      renderTech();
  if (name === 'cm')        loadComments();
  if (name === 'home')      renderCounters();
  if (name === 'wo')        renderWO(arg);
  if (name === 'cards')     renderCards();

  const v = $('#v-' + name);
  if (v) { v.style.animation = 'none'; void v.offsetWidth; v.style.animation = ''; }
}

/* ══════════ home ══════════ */
function renderBrand() {
  $('#bCompany').textContent = C(CFG.brand,'company');
  $('#bTagline').textContent = C(CFG.brand,'tagline');
  $('#heroTitle').textContent = C(CFG.brand,'heroTitle');
  $('#heroLede').textContent  = C(CFG.brand,'heroLede');
  $('#hRoutine').textContent      = C(CFG.hours,'routine');
  $('#hRoutineNote').textContent  = C(CFG.hours,'routineNote');
  $('#hEmergency').firstChild.nodeValue = C(CFG.hours,'emergency');
  $('#hEmergencyNote').textContent = C(CFG.hours,'emergencyNote');
}

function renderServices() {
  const tile = (s, cls, extra) => {
    const c = colorOf(s);
    return `<button class="${cls}" type="button" ${extra || ''} data-svc="${esc(s.id)}">
      <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(s))}</span>
      <b>${esc(C(s,'name'))}</b></button>`;
  };
  $('#svcGrid').innerHTML = CFG.services.map((s) => tile(s, 'svc')).join('');
  $('#pickSvc').innerHTML = CFG.services.map((s) => tile(s, 'pick', 'role="radio" aria-checked="false"')).join('');
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
  $('#cOpen').textContent = num(open);
  $('#cWork').textContent = num(work);
  $('#cDone').textContent = num(done);
  $('#tabDot').hidden = requests.length === 0;
}

function renderSelects() {
  const ph = `<option value="">${esc(T('new.choose'))}</option>`;
  $('#fArea').innerHTML = ph + CL('areas').map((a) => `<option>${esc(a)}</option>`).join('');
  $('#fSpot').innerHTML = ph + CL('spots').map((a) => `<option>${esc(a)}</option>`).join('');
  $('#pickPrio').innerHTML = ['normal', 'high', 'urgent'].map((k) => {
    const p = CFG.priorities[k];
    return `<button type="button" class="prio-op" data-v="${k}" aria-checked="false">
      <b>${esc(C(p,'label'))}</b><span>${esc(C(p,'desc'))}</span><i>${esc(C(p,'short'))}</i></button>`;
  }).join('');
}

/* ══════════ new request ══════════ */
function initForm() {
  $('#fShots').addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - draft.shots.length);
    files.forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, 900 / Math.max(img.width, img.height));
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

  $('#reqForm').addEventListener('submit', onSubmit);
}

function renderShots() {
  $('#shotList').innerHTML = draft.shots.map((s, i) => `
    <div class="shot"><img src="${s}" alt="${esc(T('new.addShots'))} ${num(i + 1)}">
      <button type="button" data-rm="${i}" aria-label="${esc(T('a11y.delShot'))}">&times;</button></div>`).join('');
}

let submitting = false;

async function onSubmit(e) {
  e.preventDefault();
  if (submitting) return;
  const area  = $('#fArea').value.trim();
  const block = $('#fBlock').value.trim();
  const flat  = $('#fFlat').value.trim();
  const phone = $('#fPhone').value.replace(/\D/g, '');
  const name  = $('#fResName').value.replace(/\s+/g, ' ').trim();

  $('#errSvc').hidden   = !!draft.svc;
  $('#errLoc').hidden   = !!(area && block && flat);
  $('#errPrio').hidden  = !!draft.prio;
  $('#errName').hidden  = name.length >= 3;
  $('#errPhone').hidden = phone.length === 11;

  let bad = null;
  if (!draft.svc) bad = '#errSvc';
  else if (!(area && block && flat)) bad = '#errLoc';
  else if (!draft.prio) bad = '#errPrio';
  else if (name.length < 3) bad = '#errName';
  else if (phone.length !== 11) bad = '#errPhone';

  if (bad) {
    $(bad).closest('.step').scrollIntoView({ behavior:'smooth', block:'center' });
    toast(T('err.fill'));
    return;
  }

  const now = new Date();
  const btn = e.target.querySelector('[type="submit"]');
  submitting = true;
  if (btn) btn.disabled = true;

  let no;
  try { no = await newReqNo(draft.svc); }
  finally { submitting = false; if (btn) btn.disabled = false; }

  requests.unshift({
    no, svc:draft.svc, prio:draft.prio, area, block, flat,
    floor:$('#fFloor').value.trim(), spot:$('#fSpot').value.trim(),
    desc:$('#fDesc').value.trim(), phone, name, shots:draft.shots.slice(),
    stage:0, wo:'WO-' + now.getFullYear() + '-' + no,
    at:now.toISOString(), woAt:now.toISOString()
  });
  if (!store.set('requests', requests)) { requests.shift(); return; }

  profile = Object.assign({}, profile, { phone, name, block, flat, area });
  store.set('profile', profile);

  const p = CFG.priorities[draft.prio];
  const saved = requests[0];
  $('#doneNo').textContent = no;
  $('#doneSla').textContent = T('done.prio') + ': ' + C(p,'label') + ' — ' + T('done.target') + ' ' + C(p,'sla');
  $('#doneSheet').hidden = false;
  $('#btnDoneTrack').onclick = () => { $('#doneSheet').hidden = true; go('detail', no); };
  wireSend(saved);
  finishDelivery(saved);          // أمر الشغل بتصدره الإدارة عند الإسناد — مش عند الساكن

  e.target.reset();
  draft = { svc:'', prio:'', shots:[] };
  $$('#pickSvc .pick').forEach((p2) => p2.setAttribute('aria-checked','false'));
  $$('#pickPrio .prio-op').forEach((p2) => p2.setAttribute('aria-checked','false'));
  renderShots();
  renderCounters();
  renderSelects();
  prefill();
}

/* ══════════ sending the request to the company ══════════
   No server yet, so the resident hands the request over on WhatsApp
   in one tap. Swap this for an API call when the backend is ready. */
function requestText(r) {
  const s = svcById(r.svc), p = CFG.priorities[r.prio] || CFG.priorities.normal;
  const d = new Date(r.at);
  return [
    '*طلب صيانة — ' + CFG.brand.company + '*',
    '',
    'رقم الطلب: ' + r.no,
    'الخدمة: ' + s.name,
    'الأولوية: ' + p.label + ' (' + p.sla + ')',
    '',
    'الموقع: ' + r.area + ' — عمارة ' + r.block + (r.floor ? ' / دور ' + r.floor : '') + ' / شقة ' + r.flat,
    (r.spot ? 'مكان العطل: ' + r.spot : ''),
    '',
    'الوصف: ' + (r.desc || '—'),
    (r.name ? 'الاسم: ' + r.name : ''),
    'للتواصل: ' + r.phone,
    '',
    'التاريخ: ' + d.toLocaleString(locale())
  ].filter((x) => x !== '').join(String.fromCharCode(10));
}

function wireSend(r) {
  const wa = String((CFG.intake && CFG.intake.whatsapp) || '').replace(/\D/g, '');
  const btn = $('#btnWa');
  const txt = requestText(r);

  if (wa) {
    btn.hidden = false;
    btn.onclick = () => {
      window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      $('#doneSheet').hidden = true;
      toast(T('done.waOpen'));
    };
    $('.send-hint').textContent = 'خطوة أخيرة — ابعت الطلب لإدارة الصيانة:';
  } else {
    btn.hidden = true;
    $('.send-hint').textContent = 'رقم واتساب الإدارة لم يُضف بعد — انسخ نص الطلب وابعته للإدارة.';
  }

  if (r.shots && r.shots.length) {
    $('.send-hint').textContent += ' (ابعت الصور بعدها من الاستوديو)';
  }

  $('#btnCopyReq').onclick = async () => {
    try { await navigator.clipboard.writeText(txt); toast(T('done.copied')); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;top:-2000px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(T('adm.copied')); } catch (e2) { toast(T('adm.copyFail')); }
      ta.remove();
    }
  };
}

/* ══════════ my requests ══════════ */
function stageChip(stage) {
  if (stage >= 3)  return `<span class="st st-done">${esc(T('st.done'))}</span>`;
  if (stage === 2) return `<span class="st st-work">${esc(T('st.work'))}</span>`;
  return `<span class="st st-new">${esc(T('st.new'))}</span>`;
}

function renderList() {
  const rows = requests.filter((r) =>
    listFilter === 'all' ? true : listFilter === 'open' ? r.stage < 3 : r.stage >= 3);

  if (!rows.length) {
    $('#reqList').innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V7.6Z"/>
        <path d="M14 3v4.6h4.6M9 13h6M9 16.6h4"/></svg>
      <b>${esc(T(requests.length ? 'list.emptyFA' : 'list.emptyA'))}</b>
      <p>${requests.length ? 'جرّب تصنيفاً آخر.' : 'سجّل أول عطل وسيصلك رقم الطلب فوراً مع متابعة كل خطوة.'}</p>
      ${requests.length ? '' : '<button class="btn btn-primary" data-go="new" type="button">طلب صيانة جديد</button>'}
    </div>`;
    return;
  }

  $('#reqList').innerHTML = rows.map((r) => {
    const s = svcById(r.svc), c = colorOf(s), d = new Date(r.at);
    return `<button class="req" type="button" data-no="${esc(r.no)}" data-p="${esc(r.prio)}">
      <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(s))}</span>
      <span class="t">${esc(C(s,'name'))} ${esc(T('lbl.building'))} ${num(esc(r.block))} / ${esc(T('lbl.flat'))} ${num(esc(r.flat))}</span>
      <span class="s">${esc(r.no)} · ${num(fmtDate(d))}</span>
      ${stageChip(r.stage)}</button>${r.stage >= 3 && !r.rating ? `<button class="rate-cta" type="button" data-rate="${esc(r.no)}">\u2605 ${esc(T('rate.btn'))}</button>` : ''}`;
  }).join('');
}

/* ══════════ detail ══════════ */
function renderDetail(no) {
  const r = requests.find((x) => x.no === no) || requests.find((x) => x.no === lastDetail) || requests[0];
  if (!r) { go('list'); return; }
  lastDetail = r.no;
  const s = svcById(r.svc), d = new Date(r.at), p = CFG.priorities[r.prio] || CFG.priorities.normal;

  const timeline = Array.from({length: STAGE_COUNT}, (_, i) => stageT(i)).map((st, i) => {
    const cls = i < r.stage ? 'done' : i === r.stage ? 'now' : '';
    const tick = i < r.stage
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 5 5L19 7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>';
    return `<li class="tl ${cls}">
      <span class="node">${tick}</span><b>${esc(st.t)}</b>
      ${i < STAGE_COUNT - 1 ? '<span class="rail"></span>' : '<span class="rail" style="visibility:hidden"></span>'}
      <span>${i === r.stage ? esc(st.s) + ' ' + esc(T('done.target')) + ' ' + esc(C(p,'sla')) : esc(st.s)}</span></li>`;
  }).join('');

  $('#detail').innerHTML = `
    <div class="d-top">
      <div class="d-no">${esc(r.no)}</div>
      <h3>${esc(C(s,'name'))}</h3>
      <div class="d-meta">
        <span class="d-pill ${esc(r.prio)}">${esc(C(p,'label'))}</span>
        <span class="d-pill">${esc(C(p,'sla'))}</span>
        <span class="d-pill">${num(fmtDate(d, true))}</span>
      </div>
    </div>
    <section class="card"><h3>${esc(T('det.track'))}</h3><ul class="timeline">${timeline}</ul></section>
    <section class="card"><h3>${esc(T('det.data'))}</h3>
      <dl class="kv">
        <dt>${esc(T('det.location'))}</dt><dd>${esc(r.area)} ${esc(T('lbl.building'))} ${num(esc(r.block))}${r.floor ? ' / ' + esc(T('lbl.floor')) + ' ' + num(esc(r.floor)) : ''} / ${esc(T('lbl.flat'))} ${num(esc(r.flat))}</dd>
        ${r.spot ? `<dt>${esc(T('det.spot'))}</dt><dd>${esc(r.spot)}</dd>` : ''}
        <dt>${esc(T('det.contact'))}</dt><dd><a href="tel:${esc(r.phone)}">${num(esc(r.phone))}</a></dd>
      </dl>
      ${r.desc ? `<p class="desc">${esc(r.desc)}</p>` : ''}
      ${r.shots && r.shots.length ? `<div class="d-shots">${r.shots.map((x,i)=>`<img src="${x}" alt="صورة العطل ${num(i+1)}">`).join('')}</div>` : ''}
    </section>
    <section class="card"><h3>إرسال / متابعة مع الإدارة</h3>
      <p>لو لسه مبعتّش الطلب للإدارة، أو عايز تسأل عن حالته:</p>
      <button class="btn btn-wa btn-block" type="button" data-resend="${esc(r.no)}">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.12.07-1.8-.11a16.4 16.4 0 0 1-1.63-.6c-2.87-1.24-4.74-4.13-4.88-4.32-.14-.2-1.17-1.55-1.17-2.96 0-1.4.74-2.09 1-2.38.26-.29.57-.36.76-.36l.54.01c.18.01.41-.07.64.49l.88 2.13c.07.15.12.32.02.51l-.3.45-.44.48c-.14.14-.29.3-.12.58.16.29.73 1.2 1.56 1.94 1.07.96 1.98 1.25 2.26 1.4.28.14.44.12.6-.07l.86-1c.2-.24.37-.19.62-.1l2.03.96c.25.12.42.18.48.28.06.1.06.58-.18 1.26Z"/></svg>
        إرسال على واتساب
      </button>
    </section>
    <section class="card"><h3>تنبيه</h3>
      <p>لا تسمح لأي فني بمباشرة العمل قبل التأكد من بطاقة التعريف الشخصية والزي الموحد وأمر الشغل المعتمد من الإدارة، وأن رقم البحث المطبوع عليه هو رقم طلبك: <b class="ltr">${esc(r.no)}</b>.</p>
    </section>`;
}

/* ══════════ emergency ══════════ */
function renderEmergency() {
  const pick = { hot:'gear', power:'bolt', water:'plumb', sewer:'sewer', fire:'fire', guard:'shield' };
  $('#emgList').innerHTML = CFG.lines.map((l) => {
    const tel = telOf(l);
    const c = COLORS[l.hot ? 'navy' : (l.id === 'fire' ? 'red' : l.id === 'power' ? 'amber' : 'navy')];
    const icon = l.hot
      ? svg('M15.5 14.9a2 2 0 0 1 2.1-.45l2.3.9A2 2 0 0 1 21 17.3v1.9a2 2 0 0 1-2.2 2A17.6 17.6 0 0 1 3 5.2 2 2 0 0 1 5 3h1.9a2 2 0 0 1 2 1.6l.5 2.4a2 2 0 0 1-.6 1.9l-1 1a14 14 0 0 0 5.4 5.4l1-1Z')
      : svg(ICONS[pick[l.id]] || ICONS.gear);
    const body = `<span class="ic" style="${l.hot ? '' : `background:${c.tint};color:${c.ink}`}">${icon}</span>
      <span class="tx"><b>${esc(C(l,'name'))}</b><span>${esc(C(l,'desc'))}</span></span>
      <span class="no">${tel ? num(esc(tel)) : 'لم يُضف بعد'}</span>`;
    return tel ? `<a class="emg ${l.hot ? 'hot' : ''}" href="tel:${esc(tel)}">${body}</a>`
               : `<div class="emg unset ${l.hot ? 'hot' : ''}">${body}</div>`;
  }).join('');

  const a = CFG.authority;
  $('#authCard').innerHTML = `<h3>${esc(C(a,'name'))}</h3>
    <dl class="kv">${a.rows.map((r) => `<dt>${esc(C(r,'k'))}</dt><dd class="ltr">${num(esc(r.v))}</dd>`).join('')}</dl>
    <p class="fine">${esc(C(a,'address'))}</p>`;
}

/* ══════════ settings ══════════ */
function renderSettings() {
  $('#sName').value  = profile.name  || '';
  $('#sPhone').value = profile.phone || '';
  $('#sBlock').value = profile.block || '';
  $('#sFlat').value  = profile.flat  || '';
  $('#installState').textContent = T(isStandalone() ? 'set.installed' : 'set.available');
  const ns = $('#notifState');
  if (ns) ns.textContent = NOTIF.on ? T('notif.on') : T('notif.enable');
  $('#adminRow').textContent = T(isAdmin ? 'set.adminOpen' : 'set.adminLocked');
}

function prefill() {
  if (profile.phone && !$('#fPhone').value) $('#fPhone').value = profile.phone;
  if (profile.name  && !$('#fResName').value) $('#fResName').value = profile.name;
  if (profile.block && !$('#fBlock').value) $('#fBlock').value = profile.block;
  if (profile.flat  && !$('#fFlat').value)  $('#fFlat').value  = profile.flat;
  if (profile.area  && !$('#fArea').value)  $('#fArea').value  = profile.area;
}

/* ══════════ admin ══════════ */
function askPassword() {
  $('#passSheet').hidden = false;
  const inp = $('#passInput');
  inp.value = '';
  setTimeout(() => inp.focus(), 250);
}

async function tryPassword() {
  const pass = $('#passInput').value.trim();
  let ok = false, why = '';
  if (DB.ready() && DB.secure !== false) {
    try {
      const res = await DB.sec('admin_check', { pass }, async () => (await sha256(pass)) === ADMIN_HASH ? 'ok' : 'bad');
      ok = res === 'ok'; why = res;
    } catch (e) { why = 'net'; }
  } else {
    try { ok = (await sha256(pass)) === ADMIN_HASH; } catch (e) { ok = false; }
  }
  if (!ok) {
    $('#passErr').textContent = why === 'locked' ? 'محاولات كتير غلط — الدخول بكلمة المرور متوقف ربع ساعة.'
                              : why === 'net' ? T('err.net') : T('pass.err');
    $('#passErr').hidden = false;
    $('#passInput').value = '';
    return;
  }
  isAdmin = true;
  ADMIN_PIN = $('#passInput').value.trim();
  sessionStorage.setItem('nawah.admin', '1');
  sessionStorage.setItem('nawah.pin', ADMIN_PIN);
  $('#passErr').hidden = true;
  $('#passSheet').hidden = true;
  $('#lockScreen').hidden = true;
  $('.shell').hidden = false;
  $('#adminTab').hidden = false;
  document.body.classList.add('is-admin');
  startAdminWatch();
  if (PENDING_REQ) { const n = PENDING_REQ; PENDING_REQ = ''; openAReq(n); }
  else go('admin');
  toast(T('pass.welcome'));
}

let adminTab = 'inbox';
let TECHS_LOADED = false;

function renderAdmin() {
  $('#pubDot').hidden = !hasDraft();
  $$('#admTabs .chip').forEach((c) => c.classList.toggle('on', c.dataset.tab === adminTab));
  const box = $('#admBody');
  if (adminTab === 'services')  box.innerHTML = admServices();
  if (adminTab === 'lines')     box.innerHTML = admLines();
  if (adminTab === 'content')   box.innerHTML = admContent();
  if (adminTab === 'lock')      box.innerHTML = admLock();
  if (adminTab === 'publish')   box.innerHTML = admPublish();
  if (adminTab === 'tech' && techServer() && !TECHS_LOADED) {
    TECHS_LOADED = true;
    box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`;
    loadServerTechs().then(() => { if (adminTab === 'tech') renderAdmin(); });
    return;
  }
  if (adminTab === 'tech')      box.innerHTML = admTech();
  if (adminTab === 'backend')   box.innerHTML = admBackend();
  if (adminTab === 'ann')       box.innerHTML = admAnn();
  if (adminTab === 'devices')   { box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`; admDevices(box); }
  if (adminTab === 'inbox')     { if (!box.querySelector('.inbox')) box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`; admInbox(box); }
  if (adminTab === 'archive')   { box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`; admArchive(box); }
  if (adminTab === 'orders')    { box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`; admOrders(box); }
}

function admServices() {
  return `<p class="fine mb">اسحب لإعادة الترتيب غير متاح — استخدم أسهم ↑ ↓. أي خدمة تضيفها تظهر فوراً في الصفحة الرئيسية وفي نموذج الطلب.</p>
  <div class="adm-list">
    ${CFG.services.map((s, i) => {
      const c = colorOf(s);
      return `<div class="adm-item" data-i="${i}">
        <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(s))}</span>
        <input class="adm-name" value="${esc(s.name)}" data-k="name" data-i="${i}" aria-label="اسم الخدمة">
        <div class="adm-ops">
          <button type="button" data-act="up"   data-i="${i}" aria-label="لأعلى">↑</button>
          <button type="button" data-act="down" data-i="${i}" aria-label="لأسفل">↓</button>
          <button type="button" data-act="edit" data-i="${i}" aria-label="الأيقونة واللون">🎨</button>
          <button type="button" data-act="del"  data-i="${i}" class="dl" aria-label="حذف">✕</button>
        </div>
        <div class="adm-edit" data-edit="${i}" hidden>
          <label class="adm-code">حرف القسم في رقم الطلب
            <input value="${esc(svcCode(s.id))}" data-code="${i}" maxlength="1" size="1"
                   aria-label="حرف القسم" class="ltr">
            <span class="fine">الطلبات تبقى ${esc(svcCode(s.id))}1 ثم ${esc(svcCode(s.id))}2 وهكذا</span>
          </label>
          <div class="pal">${ICON_ORDER.map((k) => `<button type="button" class="pal-i ${s.icon===k?'on':''}" data-seticon="${k}" data-i="${i}">${svg(ICONS[k])}</button>`).join('')}</div>
          <div class="pal cols">${COLOR_ORDER.map((k) => `<button type="button" class="pal-c ${s.color===k?'on':''}" data-setcolor="${k}" data-i="${i}" style="background:${COLORS[k].tint};border-color:${COLORS[k].ink}"><i style="background:${COLORS[k].ink}"></i></button>`).join('')}</div>
        </div>
      </div>`;
    }).join('')}
  </div>
  <button class="btn btn-quiet btn-block mt" type="button" data-act="addsvc">+ إضافة خدمة جديدة</button>`;
}

function admLines() {
  return `<p class="fine mb">الأرقام دي هي اللي بتظهر في شاشة الطوارئ. سيبها فاضية لو لسه مش متاحة.</p>
  <div class="adm-list">
    ${CFG.lines.map((l, i) => `<div class="adm-item line">
      <input class="adm-name" value="${esc(l.name)}" data-lk="name" data-i="${i}" aria-label="اسم الخط">
      <input class="adm-tel ltr" value="${esc(l.tel)}" data-lk="tel" data-i="${i}" inputmode="tel" placeholder="الرقم" aria-label="الرقم">
      <input class="adm-desc" value="${esc(l.desc)}" data-lk="desc" data-i="${i}" aria-label="الوصف">
      <div class="adm-ops">
        <button type="button" data-act="lup"  data-i="${i}" aria-label="لأعلى">↑</button>
        <button type="button" data-act="ldown" data-i="${i}" aria-label="لأسفل">↓</button>
        <button type="button" data-act="ldel" data-i="${i}" class="dl" aria-label="حذف">✕</button>
      </div>
    </div>`).join('')}
  </div>
  <button class="btn btn-quiet btn-block mt" type="button" data-act="addline">+ إضافة رقم جديد</button>

  <h4 class="adm-h">وصول الطلبات للإدارة</h4>
  <div class="note-box">
    <b>الطلب بيروح فين؟</b>
    <p>الطلب بيوصل فوراً لتبويب «الطلبات المستلمة» في لوحة الإدارة مع إشعار وصوت.
    وكمان تقدر تخلي واتساب يتفتح عند الساكن برسالة جاهزة لرقم الإدارة ده — نسخة احتياطية
    توصلك حتى لو لوحة الإدارة مقفولة. اكتب الرقم بالصيغة الدولية بدون <span class="ltr">+</span>.</p>
  </div>
  <label class="fld"><span>واتساب إدارة الصيانة</span>
    <input class="ltr" data-c="intake.whatsapp" value="${esc((CFG.intake&&CFG.intake.whatsapp)||'')}" inputmode="tel" placeholder="201012345678"></label>
  <button class="row-btn mt" type="button" data-act="autosend">
    <span>فتح واتساب تلقائياً عند الساكن بعد الإرسال</span>
    <em>${CFG.intake && CFG.intake.autoSend === false ? 'مقفول' : 'شغال'}</em>
  </button>`;
}

function admContent() {
  const f = (id, label, val, ta) => ta
    ? `<label class="fld"><span>${label}</span><textarea data-c="${id}" rows="2">${esc(val)}</textarea></label>`
    : `<label class="fld"><span>${label}</span><input data-c="${id}" value="${esc(val)}"></label>`;
  return `
    <h4 class="adm-h">الهوية والعناوين</h4>
    ${f('brand.company','اسم الشركة',CFG.brand.company)}
    ${f('brand.tagline','السطر التعريفي',CFG.brand.tagline)}
    ${f('brand.heroTitle','عنوان الصفحة الرئيسية',CFG.brand.heroTitle,1)}
    ${f('brand.heroLede','الوصف تحته',CFG.brand.heroLede,1)}

    <h4 class="adm-h">مواعيد العمل</h4>
    <div class="grid-2">
      ${f('hours.routine','الصيانة الدورية',CFG.hours.routine)}
      ${f('hours.routineNote','ملاحظة',CFG.hours.routineNote)}
      ${f('hours.emergency','الطوارئ',CFG.hours.emergency)}
      ${f('hours.emergencyNote','ملاحظة',CFG.hours.emergencyNote)}
    </div>

    <h4 class="adm-h">درجات الأولوية وزمن الاستجابة</h4>
    ${['normal','high','urgent'].map((k) => `<div class="grid-2">
      ${f('priorities.'+k+'.label','الاسم',CFG.priorities[k].label)}
      ${f('priorities.'+k+'.short','الزمن المختصر',CFG.priorities[k].short)}
      ${f('priorities.'+k+'.sla','الزمن الكامل',CFG.priorities[k].sla)}
      ${f('priorities.'+k+'.desc','الوصف',CFG.priorities[k].desc)}
    </div>`).join('')}

    <h4 class="adm-h">المناطق <span class="tag">سطر لكل منطقة</span></h4>
    <label class="fld"><textarea data-list="areas" rows="5">${esc(CFG.areas.join('\n'))}</textarea></label>

    <h4 class="adm-h">أماكن العطل داخل الوحدة</h4>
    <label class="fld"><textarea data-list="spots" rows="5">${esc(CFG.spots.join('\n'))}</textarea></label>`;
}

function admLock() {
  const on = !!CFG.locked;
  const remoteOn = !!(REMOTE && REMOTE.locked);
  return `
    <div class="lock-card ${on ? 'on' : ''}">
      <div class="lock-ico">${svg(on
        ? 'M6.5 10.5V7.8a5.5 5.5 0 0 1 11 0v2.7M5.5 10.5h13a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5V12a1.5 1.5 0 0 1 1.5-1.5Z'
        : 'M6.5 10.5V7.8a5.5 5.5 0 0 1 10.6-2M5.5 10.5h13a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5V12a1.5 1.5 0 0 1 1.5-1.5Z', 1.9)}</div>
      <div class="lock-tx">
        <b>${on ? 'الموقع مقفول' : 'الموقع مفتوح'}</b>
        <span>${on ? 'الزوار يشوفون رسالة الإغلاق فقط.' : 'أي حد معاه اللينك يقدر يستخدم التطبيق.'}</span>
      </div>
      <button class="btn ${on ? 'btn-primary' : 'btn-danger'}" type="button" data-act="togglelock">${on ? 'فتح' : 'قفل'}</button>
    </div>

    <label class="fld"><span>عنوان رسالة الإغلاق</span><input data-c="lockTitle" value="${esc(CFG.lockTitle||'')}"></label>
    <label class="fld"><span>نص الرسالة</span><textarea data-c="lockMessage" rows="3">${esc(CFG.lockMessage||'')}</textarea></label>

    <div class="note-box ${CFG.locked !== remoteOn ? 'warn' : ''}">
      <b>${CFG.locked !== remoteOn ? '⚠️ التغيير لسه محلي' : 'الحالة المنشورة'}</b>
      <p>الحالة على السيرفر دلوقتي: <b>${remoteOn ? 'مقفول' : 'مفتوح'}</b>.
      ${CFG.locked !== remoteOn ? 'عشان القفل/الفتح يوصل لكل الناس، روح تبويب «نشر» واتبع الخطوة.' : ''}</p>
    </div>

    <div class="note-box">
      <b>قفل كامل (يشيل الموقع من النت)</b>
      <p>القفل اللي فوق بيخفي التطبيق ويعرض رسالة. لو عايز الموقع يختفي تماماً
      ويرجع <span class="ltr">404</span> لأي حد، شغّل ملف <code>قفل-كامل.cmd</code> الموجود في فولدر المشروع،
      و<code>فتح-كامل.cmd</code> لما ترجّعه.</p>
    </div>`;
}

function admPublish() {
  const draftOn = hasDraft();
  return `
    <div class="note-box ${draftOn ? 'warn' : 'ok'}">
      <b>${draftOn ? 'عندك تعديلات لسه مش منشورة' : 'كل التعديلات منشورة'}</b>
      <p>${draftOn
        ? 'التعديلات شغالة على جهازك دلوقتي عشان تجرّبها. عشان توصل لكل الناس، نزّل الملف وارفعه مكان القديم.'
        : 'الموقع عند كل الناس زي ما هو عندك بالظبط.'}</p>
    </div>

    <button class="btn btn-primary btn-block" type="button" data-act="download">⬇️ تنزيل config.json</button>
    <button class="btn btn-quiet btn-block mt" type="button" data-act="copy">📋 نسخ المحتوى</button>

    <div class="note-box">
      <b>الرفع من الموبايل — ٣٠ ثانية</b>
      <ol class="mini">
        <li>افتح صفحة الملف على GitHub</li>
        <li>اضغط ✏️ تعديل</li>
        <li>الصق المحتوى المنسوخ مكان القديم</li>
        <li>Commit changes — والموقع بيتحدّث خلال دقيقة</li>
      </ol>
    </div>

    <div class="note-box">
      <b>الرفع من الكمبيوتر</b>
      <p>احفظ الملف في فولدر <code>site</code> مكان القديم، وشغّل <code>نشر.cmd</code>.</p>
    </div>

    <button class="btn btn-quiet btn-block mt" type="button" data-act="revert">↩️ إلغاء التعديلات المحلية</button>
    <button class="btn btn-quiet btn-block mt" type="button" data-act="logout">🔒 قفل لوحة الإدارة</button>`;
}



/* ── admin: technicians — متجمّعين حسب القسم ──
   كل قسم ليه فنيينه، وتقدر تضيف أكتر من فني للقسم الواحد.
   الفني ممكن يبقى في أكتر من قسم (زرار الأقسام تحت اسمه). */
function techRow(t, i) {
  return `<div class="adm-item tech">
      <input class="adm-name" value="${esc(t.name)}" data-tk="name" data-i="${i}" placeholder="اسم الفني" aria-label="اسم الفني">
      <input class="adm-tel ltr" value="${esc(t.phone || '')}" data-tk="phone" data-i="${i}" inputmode="tel" placeholder="واتساب: 2010XXXXXXXX" aria-label="موبايل الفني">
      <input class="adm-pin ltr" value="${esc(t.pin || '')}" data-tk="pin" data-i="${i}" inputmode="numeric" placeholder="${esc(T('adm.pin'))}" aria-label="الرقم السري">
      <div class="trades">${CFG.services.map((sv) => `
        <button type="button" class="trade ${(t.svcs||[]).indexOf(sv.id)>-1?'on':''}" data-trade="${esc(sv.id)}" data-i="${i}">${esc(C(sv,'name'))}</button>`).join('')}</div>
      <div class="adm-ops">
        <span class="ltr" data-tcard="${esc(t.id)}" title="رقم الكارنيه — بيتكتب لوحده في أمر الشغل"
          style="align-self:center;font-size:11.5px;font-weight:600;white-space:nowrap;padding:5px 9px;border-radius:8px;background:var(--sky-soft);color:var(--navy)">${esc(techCardLabel(t.id))}</span>
        <button type="button" data-act="tdel" data-i="${i}" class="dl" aria-label="${esc(T('a11y.del'))}">\u2715</button>
      </div>
    </div>`;
}

function admTech() {
  const list = CFG.technicians || [];
  const idx = (t) => list.indexOf(t);
  const loose = list.filter((t) => !(t.svcs || []).length);

  const server = techServer();
  const fromFile = (REMOTE && REMOTE.technicians || []).filter((t) => t.name);
  const importCard = server && !TECHS_ON_SERVER.length && fromFile.length ? `<div class="note-box warn">
      <b>انقل الفنيين للسيرفر المؤمَّن</b>
      <p>فيه ${num(fromFile.length)} فنيين في ملف الإعدادات العام بأرقام سرية مكشوفة. انقلهم للسيرفر
      وهياخدوا أرقام سرية جديدة (٦ أرقام) مش ظاهرة لحد — وبعدها اعمل «نشر» عشان يتشالوا من الملف العام.</p>
      <button class="btn btn-primary btn-block mt" type="button" data-act="techimport">نقل الفنيين بأرقام سرية جديدة</button>
    </div>` : '';
  return `${importCard}<p class="fine mb">ضيف لكل قسم الفنيين والصنايعية بتوعه — مفيش حد للعدد، اضغط «+ فني» جنب القسم لكل واحد.
    لما تفتح طلب من «الطلبات المستلمة» هيظهرلك فنيين القسم بتاعه بس وتختار واحد أو أكتر.
    اللي شغال في أكتر من قسم فعّل أقسامه من الأزرار تحت اسمه.</p>
  ${server ? `<div class="note-box ok">
    <b>🔒 الفنيين محفوظين في السيرفر المؤمَّن</b>
    <p>أي تعديل بيتحفظ فوراً من غير «نشر»، والأرقام السرية بتظهر هنا لأجهزة الإدارة المعتمدة بس.
    الفني بيدخل من ⚙️ الإعدادات ← «دخول الفني».</p>
  </div>` : `<div class="note-box">
    <b>الإسناد بيشتغل فوراً من جهازك</b>
    <p>لكن عشان الفني الجديد يقدر يدخل «مهامي» من موبايله برقمه السري، لازم «نشر» بعد الإضافة.</p>
  </div>`}
  ${CFG.services.map((sv) => {
    const mine = list.filter((t) => (t.svcs || []).indexOf(sv.id) > -1);
    const c = colorOf(sv);
    return `<section class="tech-dept">
      <header>
        <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(sv))}</span>
        <b>${esc(C(sv,'name'))}</b>
        <em>${mine.length ? num(mine.length) + ' ' + (mine.length === 1 ? 'فني' : 'فنيين') : 'لا يوجد فنيين'}</em>
        <button class="btn btn-quiet btn-sm" type="button" data-act="addtech" data-svc="${esc(sv.id)}">+ فني</button>
      </header>
      <div class="adm-list">${mine.map((t) => techRow(t, idx(t))).join('')}</div>
    </section>`;
  }).join('')}
  ${loose.length ? `<section class="tech-dept"><header><b>بدون قسم</b><em>${num(loose.length)}</em></header>
    <div class="adm-list">${loose.map((t) => techRow(t, idx(t))).join('')}</div></section>` : ''}`;
}

/* ── admin: server + export + QR ── */
function admBackend() {
  const on = DB.ready();
  const b = CFG.backend || {};
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  return `
    <div class="note-box ${on ? 'ok' : 'warn'}">
      <b>${esc(T(on ? 'adm.beOn' : 'adm.beOff'))}</b>
      <p>${esc(T('adm.beHint'))}</p>
    </div>
    <label class="fld"><span>Project URL</span>
      <input class="ltr" data-c="backend.url" value="${esc(b.url || '')}" placeholder="https://xxxx.supabase.co"></label>
    <label class="fld"><span>anon public key</span>
      <textarea class="ltr" data-c="backend.key" rows="3" placeholder="eyJhbGciOi...">${esc(b.key || '')}</textarea></label>
    <button class="btn btn-quiet btn-block" type="button" data-act="betest">${esc(T('adm.beTest'))}</button>

    <h4 class="adm-h">${esc(T('exp.title'))}</h4>
    <div class="grid-2">
      <label class="fld"><span>${esc(T('exp.from'))}</span><input type="date" id="expFrom" value="${monthAgo}"></label>
      <label class="fld"><span>${esc(T('exp.to'))}</span><input type="date" id="expTo" value="${today}"></label>
    </div>
    <button class="btn btn-primary btn-block mt" type="button" data-act="export">${esc(T('exp.go'))}</button>

    <h4 class="adm-h">${esc(T('adm.qr'))}</h4>
    <p class="fine mb">${esc(T('adm.qrHint'))}</p>
    <div class="qr-row">
      <input id="qrBlock" inputmode="numeric" placeholder="${esc(T('new.block'))}" value="1">
      <button class="btn btn-quiet" type="button" data-act="qr">${esc(T('adm.qr'))}</button>
    </div>
    <div id="qrBox" class="qr-box"></div>`;
}

/* ── admin: archive ── */
async function admArchive(box) {
  let rows = [];
  if (DB.ready()) {
    try { rows = (await DB.allRequests(300)).map(fromRow); }
    catch (e) { box.innerHTML = `<div class="note-box warn"><b>${esc(T('err.net'))}</b></div>`; return; }
  } else {
    rows = requests.slice();
  }

  if (adminTab !== 'archive' || $('#v-admin').hidden) return;   // الإدارة انتقلت لتبويب تاني قبل التحميل
  rows.forEach((r) => { if (!requests.find((x) => x.no === r.no)) WO_POOL[r.no] = r; });
  const counts = [0,1,2,3,4].map((i) => rows.filter((r) => (r.stage|0) === i).length);
  const rated = rows.filter((r) => r.rating);
  const avg = rated.length ? (rated.reduce((a, r) => a + r.rating, 0) / rated.length).toFixed(1) : '\u2014';

  box.innerHTML = `
    <p class="fine mb">${esc(T('adm.archHint'))} ${esc(T('adm.stageCtl'))}</p>
    <div class="arch-stats">
      <div><b>${num(rows.length)}</b><span>${esc(T('foot.requests'))}</span></div>
      <div><b>${num(counts[0] + counts[1] + counts[2])}</b><span>${esc(T('list.open'))}</span></div>
      <div><b>${num(counts[3] + counts[4])}</b><span>${esc(T('home.cDone'))}</span></div>
      <div><b>${avg}</b><span>${esc(T('exp.rating'))}</span></div>
    </div>
    <button class="btn btn-quiet btn-block mt" type="button" data-act="archref">${esc(T('adm.refresh'))}</button>
    <div class="arch-list">
      ${rows.slice(0, 80).map((r) => {
        const sv = svcById(r.svc), c = colorOf(sv);
        const t = techById(r.tech_id);
        return `<div class="arch" data-p="${esc(r.prio)}">
          <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(sv))}</span>
          <div class="arch-t">
            <b>${esc(C(sv,'name'))} \u00b7 ${esc(T('lbl.building'))} ${num(esc(r.block))}/${num(esc(r.flat))}</b>
            <span>${esc(r.no)} \u00b7 ${esc(new Date(r.at).toLocaleDateString(locale()))}${r.tech_name ? ' \u00b7 ' + esc(r.tech_name) : ''}</span>
          </div>
          ${stageSelect(r)}
          ${t && t.phone ? `<a class="arch-wa" href="${waLink(String(t.phone).replace(/\D/g,''), techText(r))}" target="_blank" rel="noopener" title="${esc(T('tech.notify'))}">\u2709</a>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

/* ── admin: one delegated handler for the whole panel ── */
function initAdmin() {
  $('#admTabs').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c || !c.dataset.tab) return;
    adminTab = c.dataset.tab;
    renderAdmin();
  });

  $('#admBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-seticon], [data-setcolor], [data-trade]');
    if (!b) return;
    const i = Number(b.dataset.i);

    if (b.dataset.seticon)  { CFG.services[i].icon  = b.dataset.seticon;  saveDraft(); renderAll(); renderAdmin(); openEdit(i); return; }
    if (b.dataset.setcolor) { CFG.services[i].color = b.dataset.setcolor; saveDraft(); renderAll(); renderAdmin(); openEdit(i); return; }

    const act = b.dataset.act || '';
    const swap = (arr, a, c2) => { if (c2 < 0 || c2 >= arr.length) return; const t = arr[a]; arr[a] = arr[c2]; arr[c2] = t; };

    if (act === 'edit')   { openEdit(i, true); return; }
    if (act === 'up')     swap(CFG.services, i, i - 1);
    if (act === 'down')   swap(CFG.services, i, i + 1);
    if (act === 'del') {
      if (CFG.services.length <= 1) { toast(T('adm.keepOne')); return; }
      if (!confirm(T('adm.delAsk') + ' «' + C(CFG.services[i],'name') + '»؟')) return;
      CFG.services.splice(i, 1);
    }
    if (act === 'addsvc') {
      const ns = { id: uid(), name: T('adm.newSvc'), icon: 'gear', color: 'navy' };
      CFG.services.push(ns);
      ns.code = svcCode(ns.id);          // حرف فاضي لرقم الطلب
    }

    if (act === 'lup')     swap(CFG.lines, i, i - 1);
    if (act === 'ldown')   swap(CFG.lines, i, i + 1);
    if (act === 'ldel')    { if (!confirm(T('adm.delAsk') + ' «' + C(CFG.lines[i],'name') + '»؟')) return; CFG.lines.splice(i, 1); }
    if (act === 'addline') CFG.lines.push({ id: uid(), name: T('adm.newLine'), desc: '', tel: '' });

    if (act === 'togglelock') {
      const want = !CFG.locked;
      if (DB.ready()) {
        (DEVICE_OK && DEVICE && !ADMIN_PIN ? DB.setLockDevice(DEVICE.id, DEVICE.token, want) : DB.setLock(want, ADMIN_PIN))
          .then(() => {
            CFG.locked = want;
            saveDraft();
            toast(T(want ? 'adm.lockedNow2' : 'adm.openedNow2'));
            renderAdmin();
          })
          .catch(() => toast(T('adm.lockFail')));
        return;
      }
      CFG.locked = want;
      toast(T(want ? 'adm.lockedLocal' : 'adm.openedLocal'));
    }

    if (act === 'autosend') { CFG.intake = CFG.intake || {}; CFG.intake.autoSend = CFG.intake.autoSend === false; }
    if (act === 'addann')  { (CFG.announcements = CFG.announcements || []).push({ id: uid(), date: '', title: '', body: '' }); }
    if (act === 'adel')    { CFG.announcements.splice(i, 1); }
    if (act === 'aup')     { const A = CFG.announcements; if (i > 0) { const x = A[i]; A[i] = A[i-1]; A[i-1] = x; } }
    if (act === 'adown')   { const A = CFG.announcements; if (i < A.length - 1) { const x = A[i]; A[i] = A[i+1]; A[i+1] = x; } }
    if (act === 'addtech') {
      const svcFor = b.dataset.svc ? [b.dataset.svc] : [];
      const nt = { id: 't' + Date.now().toString(36), name: '', phone: '', pin: newPin(), svcs: svcFor };
      (CFG.technicians = CFG.technicians || []).push(nt);
      if (techServer()) saveTechSoon(nt); else saveDraft();
      renderAdmin();
      const fresh = $$('#admBody [data-tk="name"]').filter((x) => !x.value).pop();
      if (fresh) { fresh.focus(); fresh.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }
    if (act === 'tdel')    {
      if (!confirm(T('adm.delAsk') + ' \u00ab' + (CFG.technicians[i].name || '') + '\u00bb\u061f')) return;
      const gone = CFG.technicians.splice(i, 1)[0];
      if (techServer()) { DB.deleteTech(gone.id).catch(() => toast(T('err.net'))); renderAdmin(); return; }
    }
    if (act === 'techimport') { importTechs(b); return; }
    if (b.dataset.trade) {
      const t2 = CFG.technicians[i];
      t2.svcs = t2.svcs || [];
      const k = t2.svcs.indexOf(b.dataset.trade);
      if (k > -1) t2.svcs.splice(k, 1); else t2.svcs.push(b.dataset.trade);
      if (techServer()) saveTechSoon(t2); else saveDraft();
      renderAdmin(); return;
    }
    if (act === 'betest') {
      DB.init(CFG);
      DB.req('rpc/request_count', { method: 'POST', body: '{}' })
        .then(() => { toast(T('adm.beOn')); paintFooter(); renderAdmin(); })
        .catch(() => toast(T('err.net')));
      return;
    }
    if (act === 'export')  { exportRange($('#expFrom').value, $('#expTo').value); return; }
    if (act === 'archref') { renderAdmin(); return; }
    if (act === 'qr')      { drawQR($('#qrBlock').value.trim() || '1'); return; }
    if (act === 'download') { downloadConfig(); return; }
    if (act === 'copy')     { copyConfig(); return; }
    if (act === 'revert') {
      if (!confirm(T('adm.revertAsk'))) return;
      store.del('cfgDraft');
      CFG = clone(REMOTE);
      toast(T('adm.reverted'));
    }
    if (act === 'logout' && DEVICE_OK && DEVICE) {
      if (!confirm('الجهاز ده معتمد للإدارة. الخروج هيلغي اعتماده ويبطّل يوصله إشعارات — متأكد؟')) return;
      removeDevice(DEVICE.id).then((ok) => {
        if (!ok) return;
        dropAdmin(T('adm.loggedOut'));
        if (CFG.locked) renderLock();
      });
      return;
    }
    if (act === 'logout') {
      isAdmin = false;
      ADMIN_PIN = '';
      sessionStorage.removeItem('nawah.admin');
      sessionStorage.removeItem('nawah.pin');
      $('#adminTab').hidden = true;
      document.body.classList.remove('is-admin');
      stopAdminWatch();
      if (CFG.locked) { renderLock(); return; }
      go('home');
      toast(T('adm.loggedOut'));
      return;
    }

    if (['download','copy','betest','export','archref','qr'].indexOf(act) < 0) saveDraft();
    renderAll();
    renderAdmin();
  });

  /* text inputs across the panel */
  $('#admBody').addEventListener('input', (e) => {
    const t = e.target;
    const i = Number(t.dataset.i);
    /* حرف القسم في رقم الطلب — حرف إنجليزي واحد لا يتكرّر بين الأقسام */
    if (t.dataset.code !== undefined) {
      const v = String(t.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
      t.value = v;
      if (!v) return;                                   // لسه بيكتب
      if (CFG.services.some((x, j) => j !== i && String(x.code || '').toUpperCase() === v)) {
        toast('الحرف ' + v + ' مستخدم في قسم تاني');
        t.value = String(CFG.services[i].code || '').toUpperCase();
        return;
      }
      CFG.services[i].code = v;
      const hint = t.parentNode.querySelector('.fine');
      if (hint) hint.textContent = 'الطلبات تبقى ' + v + '1 ثم ' + v + '2 وهكذا';
      saveDraft();
      return;
    }
    if (t.dataset.k)    CFG.services[i][t.dataset.k] = t.value;
    else if (t.dataset.tk) { CFG.technicians[i][t.dataset.tk] = t.value; if (techServer()) { saveTechSoon(CFG.technicians[i]); return; } }
    else if (t.dataset.ak) CFG.announcements[i][LANG === 'ar' ? t.dataset.ak : t.dataset.ak + '_' + LANG] = t.value;
    else if (t.dataset.lk) CFG.lines[i][t.dataset.lk] = t.value;
    else if (t.dataset.list) CFG[t.dataset.list] = t.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (t.dataset.c) {
      const path = t.dataset.c.split('.');
      let o = CFG;
      for (let k = 0; k < path.length - 1; k++) o = o[path[k]];
      o[path[path.length - 1]] = t.value;
    } else return;
    saveDraft();
    renderAll();
  });
}

function openEdit(i, toggle) {
  const el = $(`[data-edit="${i}"]`);
  if (el) el.hidden = toggle ? !el.hidden : false;
}

function configJSON() {
  const out = clone(CFG);
  if (DB.secure === true) delete out.technicians;          // الفنيين وأرقامهم السرية في السيرفر مش في الملف العام
  out.version = Number((REMOTE && REMOTE.version) || 0) + 1;
  return JSON.stringify(out, null, 2);
}

function downloadConfig() {
  const blob = new Blob([configJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'config.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast(T('adm.downloaded'));
}

async function copyConfig() {
  const txt = configJSON();
  try {
    await navigator.clipboard.writeText(txt);
    toast(T('adm.copied'));
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;top:-2000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(T('adm.copied')); }
    catch (e2) { toast(T('adm.copyFail')); }
    ta.remove();
  }
}

/* ══════════ install (PWA) ══════════ */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
           || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const h = $('#installHint');
  if (h) h.textContent = 'اضغط «تثبيت» ويظهر على شاشتك خلال ثانية.';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const c = $('#installCard');
  if (c) c.hidden = true;
  toast(T('install.done'));
});

async function doInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome !== 'accepted') toast(T('install.later'));
    return;
  }
  $('#iosSheet').hidden = false;
}

function initInstallUI() {
  $('#installHint').textContent = T('install.hint');
  if (isStandalone()) { $('#installCard').hidden = true; return; }
  if (isIOS) {
    $('#installHint').textContent = 'من زر المشاركة في سفاري ← «إضافة إلى الشاشة الرئيسية».';
    $('#btnInstall').textContent = T('install.how');
  }
}

/* ══════════ global wiring ══════════ */
function renderAll() {
  applyI18n();
  if (typeof renderAnn === 'function' && CFG) renderAnn();
  if (typeof paintFooter === 'function' && CFG) paintFooter();
  renderBrand();
  renderServices();
  renderSelects();
  renderCounters();
  if (!$('#v-emergency').hidden) renderEmergency();
  if (!$('#v-list').hidden) renderList();
}

function initEvents() {
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    if (e.target.closest('[data-about]')) {
      $('#aboutCo').textContent = C(CFG.brand, 'company');
      $('#aboutSheet').hidden = false;
      return;
    }
    const c = e.target.closest('[data-close]');
    if (c) { const w = c.closest('.sheet-wrap'); if (w) w.hidden = true; return; }

    const s = e.target.closest('#svcGrid [data-svc]');
    if (s) { pickSvc(s.dataset.svc); go('new'); return; }
    const p = e.target.closest('#pickSvc [data-svc]');
    if (p) { pickSvc(p.dataset.svc); return; }
    const pr = e.target.closest('#pickPrio .prio-op');
    if (pr) {
      draft.prio = pr.dataset.v;
      $$('#pickPrio .prio-op').forEach((x) => x.setAttribute('aria-checked', String(x === pr)));
      $('#errPrio').hidden = true;
      return;
    }
    const rm = e.target.closest('#shotList [data-rm]');
    if (rm) { draft.shots.splice(Number(rm.dataset.rm), 1); renderShots(); return; }
    const rs = e.target.closest('[data-resend]');
    if (rs) {
      const r = requests.find((x) => x.no === rs.dataset.resend);
      const wa = String((CFG.intake && CFG.intake.whatsapp) || '').replace(/\D/g, '');
      if (!r) return;
      if (!wa) { toast(T('det.noWa')); return; }
      window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(requestText(r)), '_blank', 'noopener');
      return;
    }
    const rq = e.target.closest('#reqList .req');
    if (rq) { go('detail', rq.dataset.no); return; }
    const fc = e.target.closest('#filters .chip');
    if (fc) {
      listFilter = fc.dataset.f;
      $$('#filters .chip').forEach((x) => x.classList.toggle('on', x === fc));
      renderList();
      return;
    }
  });

  $('#btnSettings').addEventListener('click', () => go('settings'));
  $('#btnInstall').addEventListener('click', doInstall);
  $('#btnInstall2').addEventListener('click', doInstall);
  $('#btnAdmin').addEventListener('click', () => (isAdmin ? go('admin') : askPassword()));
  $('#lockAdmin').addEventListener('click', askPassword);
  $('#passGo').addEventListener('click', tryPassword);
  $('#passInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryPassword(); });

  $('#btnNotif').addEventListener('click', () => { NOTIF.on ? NOTIF.off() : NOTIF.ask(); });

  $('#btnClear').addEventListener('click', () => {
    if (!requests.length) { toast(T('set.noReq')); return; }
    if (!confirm(T('set.clearAsk'))) return;
    requests = [];
    store.set('requests', requests);
    renderCounters();
    renderList();
    toast(T('set.cleared'));
  });

  ['sName','sPhone','sBlock','sFlat'].forEach((id) => {
    $('#' + id).addEventListener('change', (e) => {
      profile[id.slice(1).toLowerCase()] = e.target.value.trim();
      store.set('profile', profile);
      toast(T('saved'));
    });
  });

  /* hidden entrance: tap the logo 5 times */
  let taps = 0, tapT;
  $('.mark').addEventListener('click', () => {
    taps++;
    clearTimeout(tapT);
    tapT = setTimeout(() => { taps = 0; }, 1200);
    if (taps >= 5) { taps = 0; isAdmin ? go('admin') : askPassword(); }
  });
}



/* ══════════ delivery: archive first, then WhatsApp ══════════ */
async function finishDelivery(r) {
  const res = await deliver(r);

  if (res.tech) {
    r.tech_id = res.tech.id;
    r.tech_name = res.tech.name;
    if (res.archived) r.stage = 1;
    store.set('requests', requests);
  }

  const box = $('#sendBox');
  const extra = [];

  if (res.archived) {
    extra.push(`<p class="sent-ok">\u2713 ${esc(T('done.arrived'))}</p>`);
    const hint = box.querySelector('.send-hint');
    if (hint) hint.textContent = T('done.waOptional');
  } else if (!DB.ready()) {
    extra.push(`<p class="sent-warn">${esc(T('foot.local'))}</p>`);
  } else {
    extra.push(`<p class="sent-warn">${esc(T('foot.queued').replace('{n}', num(1)))}</p>`);
  }

  const note = box.querySelector('.sent-state');
  if (note) note.remove();
  const div = document.createElement('div');
  div.className = 'sent-state';
  div.innerHTML = extra.join('');
  box.insertBefore(div, box.firstChild);

  /* the admin's WhatsApp copy, sent automatically when a number is set */
  const wa = ADMIN_WA();
  if (wa && CFG.intake.autoSend !== false) {
    setTimeout(() => {
      window.open(waLink(wa, requestText(r)), '_blank', 'noopener');
    }, 700);
  }

  paintFooter();
  renderCounters();
}

/* ══════════ technician wiring ══════════ */
function initTech() {
  const saved = sessionStorage.getItem('nawah.tech');
  if (saved) {
    let t = null;
    try { const j = JSON.parse(saved); if (j && j.id) t = j.token ? j : techById(j.id); }
    catch (e) { t = techById(saved); }                              // صيغة قديمة
    if (t) { TECH = t; $('#techTab').hidden = false; document.body.classList.add('is-tech'); }
  }
  $('#techGo').addEventListener('click', techLogin);
  $('#techPin').addEventListener('keydown', (e) => { if (e.key === 'Enter') techLogin(); });
  $('#rateGo').addEventListener('click', sendRate);

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-adv]');
    if (a) { advance(a.dataset.adv, Number(a.dataset.stage)); return; }
    const st = e.target.closest('[data-star]');
    if (st) { rateStars = Number(st.dataset.star); paintStars(); return; }
    const rb = e.target.closest('[data-rate]');
    if (rb) { askRate(rb.dataset.rate); return; }
  });
}

/* ══════════ boot additions ══════════ */
async function bootExtras() {
  DB.init(CFG);

  const sent = await QUEUE.flush();
  if (sent) toast(T('foot.synced'));

  /* ?block=14 from a building QR code */
  const qBlock = new URLSearchParams(location.search).get('block');
  if (qBlock) {
    profile.block = qBlock;
    store.set('profile', profile);
    $('#fBlock').value = qBlock;
  }

  initTech();
  initCommunity();
  initCards();
  initInbox();
  flushWO();

  /* ?t=S12 من رمز QR المطبوع على أمر الشغل */
  const qTrack = new URLSearchParams(location.search).get('t');
  if (qTrack) {
    $('#trackNo').value = qTrack;
    trackRequest(qTrack);
    setTimeout(() => $('#trackNo').scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }
  paintFooter();
  renderAnn();
  startPolling();

  /* التحديث اللحظي للإدارة والفني بس — الساكن بيتابع طلباته بالـ polling
     (ده بيوفّر اتصالات السيرفر: الخطة المجانية ٢٠٠ اتصال لحظي في نفس الوقت) */
  if (DB.ready() && TECH) DB.live(onLiveChange);
  if (isAdmin) startAdminWatch();

  /* ?req=S12 — من إشعار طلب جديد */
  const qReq = new URLSearchParams(location.search).get('req');
  if (qReq) { if (isAdmin) openAReq(qReq); else { PENDING_REQ = qReq; askPassword(); } }
}

/* ══════════ boot ══════════ */
(async function boot() {
  if (!(await loadConfig())) return;

  LANG = detectLang();
  applyI18n();
  initLangMenu();

  renderBrand();
  renderServices();
  renderSelects();
  renderCounters();
  prefill();
  initForm();
  initEvents();
  initAdmin();
  initInstallUI();

  /* القفل الفوري من قاعدة البيانات له الأولوية على الملف */
  if (DB.init(CFG)) {
    const remoteLock = await DB.isLocked();
    if (remoteLock !== null) CFG.locked = remoteLock;
  }

  /* جهاز إدارة معتمد؟ يدخل على طول من غير كلمة مرور */
  const dev = await verifyDevice();
  if (dev === true) { isAdmin = true; sessionStorage.setItem('nawah.admin', '1'); }
  else if (dev === 'revoked') { isAdmin = false; sessionStorage.removeItem('nawah.admin'); setTimeout(() => toast('الجهاز ده اتلغى اعتماده من الإدارة'), 800); }

  if (isAdmin) { $('#adminTab').hidden = false; document.body.classList.add('is-admin'); }

  if (CFG.locked && !isAdmin) { renderLock(); return; }

  const hash = location.hash.replace('#', '');

  const wanted = new URLSearchParams(location.search).get('go');
  if (hash === 'admin' && isAdmin) go('admin');
  else {
    go(VIEWS.indexOf(wanted) > -1 ? wanted : 'home');
    if (hash === 'admin') askPassword();
  }

  await bootExtras();

  if ('serviceWorker' in navigator) {
    /* التسجيل بعد تحميل الصفحة — ولو الصفحة خلصت تحميل قبل ما نوصل هنا
       (وده اللي بيحصل غالباً بعد انتظار الإعدادات من السيرفر) نسجّل على طول */
    const hadController = !!navigator.serviceWorker.controller;
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            /* نسخة جديدة جاهزة وفيه نسخة قديمة شغالة → حدّث مرة واحدة */
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('skip-waiting');
            }
          });
        });
        /* ريفرش مرة واحدة لما تنزل نسخة جديدة — مش في أول زيارة خالص */
        let reloaded = !hadController;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          location.reload();
        });
        reg.update();
      } catch (e) {}
    };
    if (document.readyState === 'complete') registerSW();
    else window.addEventListener('load', registerSW);
  }
})();
