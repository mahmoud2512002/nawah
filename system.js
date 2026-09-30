/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — أدوات المنظومة (لوحة الإدارة)

   ١) الإعدادات بتتحفظ في السيرفر وتوصل لكل الناس على طول
      (من غير تنزيل config.json ولا نشر).
   ٢) «السجل»: مين عمل إيه وإمتى — كل عملية بتتسجل من السيرفر نفسه.
   ٣) «فحص المنظومة»: كل جزء شغال ولا ناقص، والمساحة، والتنبيهات.
   ٤) نسخة احتياطية كاملة واسترجاعها (الاسترجاع بيضيف الناقص بس).
   ٥) تغيير كلمة مرور الإدارة من اللوحة.

   كل ده محتاج ملف التركيب الموحّد (supabase/nawah-install.sql).
   لو لسه ما اتشغّلش، التطبيق بيكمّل بالطريقة القديمة من غير ما يقف.
   ══════════════════════════════════════════════════════════════ */

const APP_VERSION = '2026.10.2';
const SCHEMA_NEED = 1;                         // أقل إصدار لقاعدة البيانات يشتغل معاه الكود ده

/* حدود الخطة المجانية (غيّرها لو الاشتراك اتغير) */
const PLAN_DB_BYTES      = 500 * 1024 * 1024;
const PLAN_STORAGE_BYTES = 1024 * 1024 * 1024;
/* الطلب الواحد بكل عملياته في السجل بياخد حوالي ١٫٥ ك.ب (اتقاس على ٢٠ ألف طلب) — ٢ ك.ب للأمان */
const BYTES_PER_REQUEST  = 2048;

const SYS = {
  cfgServer: null,         // true = الإعدادات من السيرفر · false = الدالة مش موجودة · null = لسه معرفناش
  cfgTimer: null,
  cfgBusy: false,
  cfgAgain: false,
  cfgSavedAt: 0,
  cfgErr: '',
  health: null,
  healthAt: 0,
  log: [],
  logFilter: 'all',
  logDone: false
};

const is404 = (e) => /http-404/.test(String((e && e.message) || e));

/* ══════════ ١. الإعدادات من السيرفر ══════════ */

/* بتتنادى من loadConfig قبل أي حاجة: ترجّع {version, data} أو null (مفيش حاجة اتحفظت لسه)
   أو undefined (معرفناش — من غير نت، أو قاعدة البيانات قديمة) */
async function fetchServerConfig(file) {
  const b = (file && file.backend) || {};
  if (!b.url || !b.key) return undefined;
  DB.init(file);
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const tm = setTimeout(() => { if (ctl) ctl.abort(); }, 3500);
  try {
    const out = await DB.req('rpc/public_config', { method: 'POST', body: '{}', signal: ctl ? ctl.signal : undefined });
    SYS.cfgServer = true;
    return out || null;
  } catch (e) {
    if (is404(e)) SYS.cfgServer = false;
    return undefined;
  } finally {
    clearTimeout(tm);
  }
}

/* الإعدادات المنشورة = الملف + اللي في السيرفر (السيرفر أحدث) */
function mergeServerConfig(file, srv) {
  if (!srv || !srv.data || typeof srv.data !== 'object') return file;
  if (Number(file.version || 0) > Number(srv.version || 0)) return file;   // حد نشر ملف أحدث بالطريقة القديمة
  const out = deepMerge(clone(file), srv.data);
  out.backend = file.backend;
  out.version = Number(srv.version) || Number(file.version) || 0;
  return out;
}

function cfgForServer() {
  const out = clone(CFG);
  delete out.technicians;
  delete out.backend;
  delete out.locked;
  delete out.version;
  return out;
}

function canSaveConfig() {
  return SYS.cfgServer !== false && DB.ready() && typeof DEVICE_OK !== 'undefined' && DEVICE_OK && !!DEVICE;
}

/* saveDraft بتناديها: لو ينفع نحفظ في السيرفر ترجّع true */
function cfgSaveSoon() {
  if (!canSaveConfig()) return false;
  clearTimeout(SYS.cfgTimer);
  SYS.cfgTimer = setTimeout(saveConfigNow, 1200);
  paintSaveState('saving');
  return true;
}

async function saveConfigNow() {
  if (SYS.cfgBusy) { SYS.cfgAgain = true; return; }
  SYS.cfgBusy = true;
  try {
    const v = await DB.rpc('admin_save_config', Object.assign(DB.cred(), {
      p_data: cfgForServer(),
      p_base: Number((REMOTE && REMOTE.version) || 0)
    }));
    const ver = Number(v) || Number((REMOTE && REMOTE.version) || 0) + 1;
    SYS.cfgServer = true;
    SYS.cfgErr = '';
    SYS.cfgSavedAt = Date.now();
    CFG.version = ver;
    const pub = clone(CFG);
    if (DB.secure === true) delete pub.technicians;
    REMOTE = clone(pub);
    store.set('cfgCache', pub);
    store.del('cfgDraft');
    if ($('#pubDot')) $('#pubDot').hidden = true;
    paintSaveState('saved');
  } catch (e) {
    if (is404(e)) SYS.cfgServer = false;
    SYS.cfgErr = is404(e) ? 'old-db' : 'net';
    if ($('#pubDot')) $('#pubDot').hidden = false;
    paintSaveState('error');
  } finally {
    SYS.cfgBusy = false;
    if (SYS.cfgAgain) { SYS.cfgAgain = false; saveConfigNow(); }
  }
  if (typeof adminTab !== 'undefined' && adminTab === 'publish' && !$('#v-admin').hidden) renderAdmin();
}

/* شارة صغيرة جنب عنوان اللوحة: بيحفظ… / اتحفظ للكل / متحفظش */
function paintSaveState(st) {
  let el = $('#cfgState');
  if (!el) {
    const head = $('#v-admin .vhead');
    if (!head) return;
    el = document.createElement('span');
    el.id = 'cfgState';
    el.className = 'cfg-state';
    el.setAttribute('role', 'status');
    head.appendChild(el);
  }
  el.dataset.st = st;
  el.textContent = st === 'saving' ? 'بيحفظ…'
    : st === 'saved' ? '✓ اتحفظ ووصل للكل'
    : SYS.cfgErr === 'old-db' ? 'اتحفظ على الجهاز ده بس' : 'متحفظش — مفيش اتصال';
  clearTimeout(el._t);
  if (st === 'saved') el._t = setTimeout(() => { el.textContent = ''; el.dataset.st = ''; }, 4000);
}

/* محتوى تبويب «نشر» لما الإعدادات بتتحفظ في السيرفر */
function admPublishServer() {
  const pending = hasDraft();
  const when = SYS.cfgSavedAt ? ago(new Date(SYS.cfgSavedAt).toISOString()) : '';
  return `
    <div class="note-box ${pending ? 'warn' : 'ok'}">
      <b>${pending ? 'فيه تعديلات لسه ما اتحفظتش في السيرفر' : '✓ كل التعديلات واصلة لكل الناس'}</b>
      <p>${pending
        ? (SYS.cfgErr === 'old-db'
            ? 'قاعدة البيانات محتاجة ملف التركيب الموحّد عشان التعديلات تتحفظ للكل. لحد ما يتشغّل، التعديلات على الجهاز ده بس.'
            : 'مفيش اتصال بالسيرفر دلوقتي. التعديلات محفوظة على الجهاز ده، واضغط «حفظ دلوقتي» لما النت يرجع.')
        : 'أي تعديل في الخدمات أو الأرقام أو النصوص أو الإعلانات بيتحفظ في السيرفر لوحده ويظهر عند الكل من أول فتحة — من غير ملفات ولا نشر.'}</p>
      ${when ? `<p class="fine">آخر حفظ ${esc(when)}، إصدار ${num(Number((REMOTE && REMOTE.version) || 0))}</p>` : ''}
      ${pending ? '<button class="btn btn-primary btn-block mt" type="button" data-sys="cfgsave">حفظ دلوقتي</button>' : ''}
    </div>

    <h4 class="adm-h">نسخة من الإعدادات كملف</h4>
    <p class="fine">للاحتياط، أو عشان تجهّز نسخة لعميل جديد بنفس الإعدادات.</p>
    <button class="btn btn-quiet btn-block" type="button" data-act="download">⬇️ تنزيل config.json</button>

    <button class="btn btn-quiet btn-block mt" type="button" data-act="revert">↩️ إلغاء التعديلات اللي على الجهاز ده</button>
    <button class="btn btn-quiet btn-block mt" type="button" data-act="logout">🔒 قفل لوحة الإدارة</button>`;
}


/* ══════════ ٢. السجل ══════════ */
const STG_SHORT = ['استلام', 'إسناد', 'تنفيذ', 'إصلاح', 'غلق'];
const LOG_GROUPS = {
  req:  ['new', 'assign', 'stage', 'rate'],
  adm:  ['tech_add', 'tech_edit', 'tech_del', 'config', 'lock', 'unlock', 'cm_hide', 'cm_show', 'cm_reply', 'backup', 'restore', 'storage_clear'],
  sec:  ['login_fail', 'device_add', 'device_del', 'pass']
};

function logText(a) {
  const ref = esc(a.ref || '');
  const det = esc(num(a.detail || ''));
  switch (a.action) {
    case 'new': {
      const parts = String(a.detail || '').split('|');
      const sv = svcById(parts[0]);
      return `طلب جديد <b>${ref}</b> — ${esc(C(sv, 'name'))}${parts[1] === 'urgent' ? ' <em class="st st-hot">طارئ</em>' : ''}`;
    }
    case 'assign':  return a.detail === '—' ? `إلغاء إسناد <b>${ref}</b>` : `إسناد <b>${ref}</b> إلى ${det}`;
    case 'stage': {
      const m = String(a.detail || '').split('>');
      return `<b>${ref}</b>: من «${esc(STG_SHORT[m[0]] || m[0])}» إلى «${esc(STG_SHORT[m[1]] || m[1])}»`;
    }
    case 'rate':       return `تقييم <b>${ref}</b>: ${'★'.repeat(Math.max(0, Math.min(5, Number(a.detail) || 0)))}`;
    case 'tech_add':   return `إضافة الفني <b>${ref}</b>`;
    case 'tech_edit':  return `تعديل بيانات الفني <b>${ref}</b>${a.detail === 'pin' ? ' — رقم سري جديد' : ''}`;
    case 'tech_del':   return `حذف الفني <b>${ref}</b>`;
    case 'device_add': return `جهاز دخل الإدارة: <b>${ref}</b>`;
    case 'device_del': return `إلغاء جهاز: <b>${ref}</b>`;
    case 'cm_hide':    return `إخفاء رأي <b>${ref}</b>: «${det}»`;
    case 'cm_show':    return `إظهار رأي <b>${ref}</b>`;
    case 'cm_reply':   return `رد على رأي <b>${ref}</b>: «${det}»`;
    case 'lock':       return '<b>قفل الموقع</b>';
    case 'unlock':     return '<b>فتح الموقع</b>';
    case 'config':     return det;
    case 'pass':       return `<b>${det}</b>`;
    case 'login_fail': return det;
    case 'backup':     return 'تنزيل نسخة احتياطية';
    case 'restore':    return `استرجاع نسخة احتياطية: ${det}`;
    case 'storage_clear': return 'مسح أوامر الشغل القديمة من السيرفر';
    default:           return esc(a.action) + (ref ? ' ' + ref : '') + (det ? ' — ' + det : '');
  }
}

async function admLog(box, more) {
  if (!DEVICE_OK) {
    box.innerHTML = `<div class="note-box warn"><b>السجل بيظهر على أجهزة الإدارة المعتمدة بس</b>
      <p>اعتمد الجهاز ده من تبويب «أجهزة الإدارة».</p></div>`;
    return;
  }
  if (!more) { SYS.log = []; SYS.logDone = false; }
  const before = more && SYS.log.length ? SYS.log[SYS.log.length - 1].id : null;
  let rows;
  try {
    rows = await DB.rpc('admin_audit', Object.assign(DB.cred(), { lim: 150, before_id: before })) || [];
  } catch (e) {
    box.innerHTML = is404(e) ? oldDbCard('السجل') : `<div class="note-box warn"><b>${esc(T('err.net'))}</b></div>`;
    return;
  }
  SYS.log = SYS.log.concat(rows);
  if (rows.length < 150) SYS.logDone = true;
  if (adminTab !== 'log' || $('#v-admin').hidden) return;
  paintLog(box);
}

function paintLog(box) {
  const f = SYS.logFilter;
  const rows = SYS.log.filter((a) => f === 'all' || (LOG_GROUPS[f] || []).indexOf(a.action) > -1);
  let day = '';
  const items = rows.map((a) => {
    const d = new Date(a.at);
    const dk = d.toDateString();
    const head = dk !== day ? `<h4 class="log-day">${esc(fmtDate(d, true))}</h4>` : '';
    day = dk;
    const sec = LOG_GROUPS.sec.indexOf(a.action) > -1;
    return `${head}<div class="log-row${sec ? ' sec' : ''}">
      <time>${esc(d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }))}</time>
      <div><p>${logText(a)}</p><small>${esc(a.actor || '')}</small></div>
    </div>`;
  }).join('');

  box.innerHTML = `
    <p class="fine mb">كل عملية على الطلبات والفنيين والأجهزة والإعدادات بتتسجل هنا من السيرفر نفسه، باسم الجهاز أو الفني اللي عملها.</p>
    <div class="filters log-filters" role="tablist">
      ${[['all', 'الكل'], ['req', 'الطلبات'], ['adm', 'الإدارة'], ['sec', 'الأمان']].map(([k, l]) =>
        `<button class="chip ${f === k ? 'on' : ''}" type="button" role="tab" data-sys="logf" data-f="${k}">${l}</button>`).join('')}
    </div>
    <div class="log-list">${items || '<p class="fine center">مفيش عمليات في القسم ده لسه.</p>'}</div>
    ${SYS.logDone ? '' : '<button class="btn btn-quiet btn-block mt" type="button" data-sys="logmore">عرض الأقدم</button>'}`;
}


/* ══════════ ٣. فحص المنظومة ══════════ */
function fmtBytes(n) {
  n = Number(n) || 0;
  const trim = (x) => String(Number(x)).replace('.', LANG === 'ar' ? '٫' : '.');   // 500 · 1.00 → 1 · 8.60 → 8٫6
  if (!n) return num(0);
  if (n < 1024 * 1024) return num(Math.max(1, Math.round(n / 1024))) + ' ك.ب';
  if (n < 1024 * 1024 * 1024) return num(trim((n / 1048576).toFixed(n < 10485760 ? 1 : 0))) + ' م.ب';
  return num(trim((n / 1073741824).toFixed(2))) + ' ج.ب';
}

function healthRow(state, title, text, action) {
  const ico = state === 'ok' ? '✓' : state === 'bad' ? '✕' : state === 'warn' ? '!' : 'i';
  return `<div class="hc-row" data-st="${state}">
    <span class="hc-ico" aria-hidden="true">${ico}</span>
    <div><b>${title}</b><p>${text}</p>${action || ''}</div>
  </div>`;
}

function meter(used, cap) {
  const p = Math.min(100, Math.round((used / cap) * 100));
  return `<div class="hc-meter" role="img" aria-label="${p}٪"><i style="width:${Math.max(2, p)}%"></i></div>`;
}

async function loadHealth() {
  const h = await DB.rpc('system_health', DB.cred());
  SYS.health = h || {};
  SYS.healthAt = Date.now();
  paintHealthDot();
  return SYS.health;
}

/* فيه حاجة محتاجة انتباه؟ نقطة على تبويب «فحص المنظومة» */
function healthIssues(h) {
  if (!h) return 0;
  let n = 0;
  if (Number(h.schema || 0) < SCHEMA_NEED) n++;
  if (!h.hook || h.pg_net === false) n++;
  if (!h.push_devices) n++;
  if (Number(h.db_bytes || 0) > PLAN_DB_BYTES * 0.7) n++;
  if (woCloudOn() && Number(h.storage_bytes || 0) > PLAN_STORAGE_BYTES * 0.7) n++;
  if (!woCloudOn() && h.bucket === true) n++;
  if (Number(h.stale_new || 0) > 0) n++;
  if (!h.backup_at || Date.now() - new Date(h.backup_at).getTime() > 7 * 864e5) n++;
  return n;
}

function paintHealthDot() {
  const chip = $('#admTabs .chip[data-tab="health"]');
  if (!chip) return;
  let dot = chip.querySelector('.chip-dot');
  const n = healthIssues(SYS.health);
  if (!dot && n) { dot = document.createElement('i'); dot.className = 'chip-dot'; chip.appendChild(dot); }
  if (dot) dot.hidden = !n;
}

/* فحص خفيف مرة كل ساعة وقت ما اللوحة مفتوحة — عشان النقطة تنبّه لوحدها */
function healthProbe() {
  if (!isAdmin || !DEVICE_OK || !DB.ready()) return;
  if (Date.now() - SYS.healthAt < 3600e3) return;
  loadHealth().catch(() => {});
}

async function admHealth(box) {
  if (!DB.ready()) {
    box.innerHTML = '<div class="note-box warn"><b>التطبيق مش متوصل بقاعدة البيانات</b><p>ادخل تبويب «السيرفر» واكتب بيانات الاتصال.</p></div>';
    return;
  }
  if (!DEVICE_OK) {
    box.innerHTML = '<div class="note-box warn"><b>الفحص بيظهر على أجهزة الإدارة المعتمدة بس</b><p>اعتمد الجهاز ده من تبويب «أجهزة الإدارة».</p></div>';
    return;
  }
  let h;
  try { h = await loadHealth(); }
  catch (e) {
    box.innerHTML = is404(e) ? oldDbCard('فحص المنظومة') : `<div class="note-box warn"><b>${esc(T('err.net'))}</b></div>`;
    return;
  }
  if (adminTab !== 'health' || $('#v-admin').hidden) return;

  const rows = [];
  const schemaOk = Number(h.schema || 0) >= SCHEMA_NEED;
  rows.push(healthRow(schemaOk ? 'ok' : 'bad', 'قاعدة البيانات',
    schemaOk ? 'متحدثة ومتوافقة مع نسخة التطبيق دي.' : 'محتاجة تحديث: شغّل ملف التركيب الموحّد nawah-install.sql مرة واحدة.'));

  const hookOk = h.hook && h.pg_net !== false;
  rows.push(healthRow(hookOk ? 'ok' : 'bad', 'الإشعارات والموقع مقفول',
    hookOk ? 'قاعدة البيانات بتبعت إشعار مع كل طلب جديد.'
           : 'رابط دالة الإشعارات أو مفتاحها ناقص. اكتبهم في أول ملف التركيب (p_url و p_secret) وشغّله تاني.'));

  const pd = Number(h.push_devices || 0), dv = Number(h.devices || 0);
  rows.push(healthRow(pd ? (pd < dv ? 'warn' : 'ok') : 'bad', 'أجهزة بيوصلها الإشعار',
    pd ? `${num(pd)} من ${num(dv)} جهاز إدارة.${pd < dv ? ' افتح التطبيق على الباقي واضغط «تفعيل الإشعارات».' : ''}`
       : 'ولا جهاز. افتح «الطلبات المستلمة» واضغط «تفعيل الإشعارات».'));

  const dbb = Number(h.db_bytes || 0);
  const room = Math.max(0, PLAN_DB_BYTES - dbb);
  const fits = Math.floor(room / BYTES_PER_REQUEST);
  const perDay = Number(h.req_30d || 0) / 30;
  const years = perDay > 0 ? fits / perDay / 365 : 0;
  const runway = perDay >= 1
    ? ` بالمعدل الحالي (حوالي ${num(Math.round(perDay))} طلب في اليوم) ده يكفي ${years >= 20 ? 'أكتر من ' + num(20) + ' سنة' : 'حوالي ' + num(Math.max(1, Math.round(years))) + ' سنة'}.`
    : '';
  rows.push(healthRow(dbb > PLAN_DB_BYTES * 0.85 ? 'bad' : dbb > PLAN_DB_BYTES * 0.7 ? 'warn' : 'ok', 'مساحة قاعدة البيانات',
    `${fmtBytes(dbb)} من ${fmtBytes(PLAN_DB_BYTES)} في الخطة المجانية. الباقي يشيل حوالي ${fits >= 1000 ? num(Math.round(fits / 1000)) + ' ألف' : num(fits)} طلب كمان.${runway}`
    + (dbb > PLAN_DB_BYTES * 0.7 ? ' قرّبت تخلص: نزّل نسخة احتياطية وفكّر في الخطة المدفوعة.' : '')
    + meter(dbb, PLAN_DB_BYTES)));

  if (!woCloudOn()) {
    const old = Number(h.pdfs || 0);
    const leftovers = h.bucket === true;
    rows.push(healthRow(leftovers ? 'warn' : 'ok', 'مساحة الملفات',
      'أوامر الشغل مبتترفعش على السيرفر — بتتعمل على الجهاز وقت ما تتطلب، فمساحة الملفات مش بتزيد.'
      + (leftovers ? (old ? ` لسه فيه ${num(old)} ملف قديم من قبل التحديث (${fmtBytes(Number(h.storage_bytes || 0))}).`
                          : ' لسه فيه مكان تخزين قديم لأوامر الشغل.') : ' مساحة الملفات صفر.'),
      leftovers ? '<button class="btn btn-quiet btn-sm mt" type="button" data-sys="clearpdf">امسح أوامر الشغل القديمة</button>' : ''));
  } else if (h.bucket === false) {
    rows.push(healthRow('bad', 'أرشيف أوامر الشغل', 'مكان حفظ الملفات مش موجود. شغّل ملف التركيب الموحّد.'));
  } else if (h.storage_bytes != null && !(Number(h.pdfs || 0) === 0 && Number(h.wo_links || 0) > 0)) {
    const sb = Number(h.storage_bytes || 0);
    rows.push(healthRow(sb > PLAN_STORAGE_BYTES * 0.7 ? 'warn' : 'ok', 'مساحة أوامر الشغل',
      `${num(Number(h.pdfs || 0))} ملف، مساحتهم ${fmtBytes(sb)} من ${fmtBytes(PLAN_STORAGE_BYTES)}.` + meter(sb, PLAN_STORAGE_BYTES)));
  } else {
    rows.push(healthRow('info', 'أرشيف أوامر الشغل', `${num(Number(h.wo_links || 0))} أمر شغل متحفوظ في الأرشيف.`));
  }

  const stale = Number(h.stale_new || 0);
  rows.push(healthRow(stale ? 'warn' : 'ok', 'طلبات مستنية إسناد',
    stale ? `${num(stale)} طلب عدّى عليه أكتر من يوم من غير إسناد.` : 'مفيش طلب جديد مستني أكتر من يوم.',
    stale ? '<button class="btn btn-quiet btn-sm mt" type="button" data-sys="gonew">افتح الطلبات الجديدة</button>' : ''));

  const fails = Number(h.fails_24h || 0);
  rows.push(healthRow(fails >= 10 ? 'warn' : 'ok', 'محاولات دخول غلط',
    fails ? `${num(fails)} محاولة في آخر ٢٤ ساعة.${fails >= 10 ? ' لو مش منكم: غيّر كلمة المرور من «أجهزة الإدارة».' : ''}`
          : 'مفيش محاولات غلط في آخر ٢٤ ساعة.'));

  const bAt = h.backup_at ? new Date(h.backup_at) : null;
  const bOld = !bAt || Date.now() - bAt.getTime() > 7 * 864e5;
  rows.push(healthRow(bOld ? 'warn' : 'ok', 'النسخة الاحتياطية',
    bAt ? `آخر نسخة ${esc(ago(bAt.toISOString()))}.${bOld ? ' يفضّل تنزّل نسخة كل أسبوع.' : ''}` : 'لسه ما اتنزّلتش أي نسخة.'));

  box.innerHTML = `
    <div class="hc-sum ${healthIssues(h) ? 'warn' : 'ok'}">
      <b>${healthIssues(h) ? num(healthIssues(h)) + ' حاجة محتاجة انتباه' : '✓ المنظومة كلها شغالة'}</b>
      <span>${num(Number(h.requests || 0))} طلب، منهم ${num(Number(h.open || 0))} مفتوح${Number(h.urgent_open || 0) ? ' و' + num(Number(h.urgent_open)) + ' طارئ' : ''}، و${num(Number(h.techs || 0))} فني</span>
    </div>
    <div class="hc-list">${rows.join('')}</div>

    <h4 class="adm-h">النسخة الاحتياطية</h4>
    <p class="fine">ملف واحد فيه كل الطلبات والفنيين والآراء وأرقام الكارنيهات والإعدادات. فيه بيانات السكان
      والأرقام السرية للفنيين — احفظه في مكان آمن ومتبعتهوش لحد.</p>
    <button class="btn btn-primary btn-block" type="button" data-sys="backup">⬇️ تنزيل نسخة احتياطية</button>
    <label class="btn btn-quiet btn-block mt file-btn">⬆️ استرجاع من نسخة
      <input type="file" accept=".json,application/json" data-sys-file="restore" hidden></label>
    <p class="fine">الاسترجاع بيضيف الناقص بس — عمره ما بيمسح أو يغيّر حاجة موجودة. بينفع كمان لنقل المنظومة لقاعدة بيانات جديدة.</p>

    <button class="btn btn-quiet btn-block mt" type="button" data-sys="health">↻ فحص تاني</button>
    <p class="fine center mt">نسخة التطبيق ${esc(num(APP_VERSION))}، وقاعدة البيانات إصدار ${esc(num(String(h.schema || '—')))}</p>`;
}

function oldDbCard(what) {
  return `<div class="note-box warn"><b>«${esc(what)}» محتاج تحديث قاعدة البيانات</b>
    <p>شغّل ملف التركيب الموحّد <span class="ltr">nawah-install.sql</span> مرة واحدة في
    <span class="ltr">Supabase → SQL Editor</span>، وبعدها ارجع هنا.</p></div>`;
}


/* ══════════ ٤. النسخة الاحتياطية ══════════ */
async function downloadBackup(btn) {
  const was = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'بيجهّز النسخة…'; }
  try {
    const data = await DB.rpc('admin_backup', DB.cred());
    const d = new Date();
    const name = 'nawah-backup-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    if (typeof saveBlob === 'function') saveBlob(blob, name);
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
    toast('✓ اتنزّلت النسخة: ' + num((data.requests || []).length) + ' طلب');
    SYS.healthAt = 0;
  } catch (e) {
    toast(is404(e) ? 'شغّل ملف التركيب الموحّد الأول' : T('err.net'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = was; }
  }
}

async function restoreBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (e) { toast('الملف ده مش نسخة احتياطية سليمة'); return; }
  if (!data || data.kind !== 'nawah-backup') { toast('الملف ده مش نسخة احتياطية من المنظومة'); return; }
  const at = data.at ? fmtDate(new Date(data.at), true) : '';
  if (!confirm('استرجاع نسخة ' + at + '؟\n' + num((data.requests || []).length) + ' طلب، و' +
               num((data.technicians || []).length) + ' فني، و' + num((data.comments || []).length) + ' رأي\n\n' +
               'هيتضاف الناقص بس، ومفيش حاجة موجودة هتتمسح أو تتغير.')) return;
  try {
    const r = await DB.rpc('admin_restore', Object.assign(DB.cred(), { p: data }));
    toast('✓ اتضاف ' + num(r.requests || 0) + ' طلب و' + num(r.technicians || 0) + ' فني و' + num(r.comments || 0) + ' رأي');
    if (typeof TECHS_LOADED !== 'undefined') TECHS_LOADED = false;
    INBOX.loadedAt = 0;
    renderAdmin();
  } catch (e) {
    toast(is404(e) ? 'شغّل ملف التركيب الموحّد الأول' : 'الاسترجاع ما نفعش — ' + T('err.net'));
  }
}


/* مسح أوامر الشغل القديمة من السيرفر — دالة الإشعارات بتمسحها وتبعت إشعار لما تخلص */
async function clearOldPDFs(btn) {
  if (!confirm('مسح كل أوامر الشغل القديمة من السيرفر؟\n\nمش هتحتاجها: أي أمر شغل بيتعمل تاني من بيانات الطلب في أي وقت.')) return;
  btn.disabled = true;
  let r;
  try { r = await DB.rpc('admin_clear_storage', DB.cred()); }
  catch (e) { r = is404(e) ? 'old-db' : 'net'; }
  if (r === 'sent') {
    toast('بيتمسحوا دلوقتي — هيوصلك إشعار لما يخلصوا');
    setTimeout(() => { if (adminTab === 'health' && !$('#v-admin').hidden) admHealth($('#admBody')); }, 9000);
    return;
  }
  btn.disabled = false;
  toast(r === 'no-hook' ? 'رابط دالة الإشعارات ناقص — شوف سطر «الإشعارات والموقع مقفول»'
      : r === 'old-db' ? 'شغّل ملف التركيب الموحّد الأول' : T('err.net'));
}


/* ══════════ ٥. كلمة مرور الإدارة ══════════ */
function passCard() {
  return `
    <h4 class="adm-h">كلمة مرور الإدارة</h4>
    <div class="note-box pass-card">
      <p>كلمة مرور واحدة للإدارة كلها. أي جهاز يدخل بيها بيبقى جهاز إدارة على طول، وكل الأجهزة التانية
        بيوصلها إشعار باسمه — فلو ظهر جهاز مش تبعكم، الغيه من فوق وغيّر كلمة المرور من هنا.</p>
      <label class="fld"><span>كلمة المرور الحالية</span>
        <input id="pwOld" class="ltr" type="password" inputmode="numeric" autocomplete="current-password"></label>
      <label class="fld"><span>كلمة المرور الجديدة (أرقام، ٨ أو أكتر)</span>
        <input id="pwNew" class="ltr" type="password" inputmode="numeric" autocomplete="new-password"></label>
      <label class="fld"><span>اكتبها تاني</span>
        <input id="pwNew2" class="ltr" type="password" inputmode="numeric" autocomplete="new-password"></label>
      <label class="chk"><input id="pwDrop" type="checkbox"> خروج كل الأجهزة التانية (هتدخل تاني بكلمة المرور الجديدة)</label>
      <button class="btn btn-primary btn-block mt" type="button" data-sys="pass">تغيير كلمة المرور</button>
    </div>`;
}

async function changePass(btn) {
  const o = ($('#pwOld') || {}).value || '';
  const n = ($('#pwNew') || {}).value || '';
  const n2 = ($('#pwNew2') || {}).value || '';
  const drop = !!($('#pwDrop') && $('#pwDrop').checked);
  if (!/^[0-9]{8,}$/.test(n)) { toast('كلمة المرور الجديدة لازم تبقى أرقام بس، ٨ أو أكتر'); return; }
  if (n !== n2) { toast('كلمة المرور الجديدة مش زي اللي كتبتها تاني'); return; }
  if (drop && !confirm('كل أجهزة الإدارة التانية هتخرج، ولازم تدخل تاني بكلمة المرور الجديدة. متأكد؟')) return;
  btn.disabled = true;
  let r;
  try { r = await DB.rpc('admin_change_pass', Object.assign(DB.cred(), { old_pass: o, new_pass: n, drop_others: drop })); }
  catch (e) { r = is404(e) ? 'old-db' : 'net'; }
  btn.disabled = false;
  const msg = {
    ok: drop ? '✓ اتغيرت كلمة المرور، وكل الأجهزة التانية خرجت' : '✓ اتغيرت كلمة المرور — بلّغ بيها زميلك في الإدارة',
    bad: 'كلمة المرور الحالية غلط',
    weak: 'كلمة المرور الجديدة لازم تبقى أرقام بس، ٨ أو أكتر',
    same: 'كلمة المرور الجديدة زي القديمة',
    locked: 'محاولات غلط كتير — استنى ربع ساعة وجرّب تاني',
    'old-db': 'شغّل ملف التركيب الموحّد الأول',
    net: T('err.net')
  }[String(r)] || T('err.net');
  toast(msg);
  if (r === 'ok') {
    if (typeof ADMIN_PIN !== 'undefined' && ADMIN_PIN) { ADMIN_PIN = n; sessionStorage.setItem('nawah.pin', n); }
    ['#pwOld', '#pwNew', '#pwNew2'].forEach((s) => { if ($(s)) $(s).value = ''; });
    if (drop) refreshAdminViews();
  }
}


/* ══════════ التوصيل ══════════ */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sys]');
  if (!b) return;
  const k = b.dataset.sys;
  const box = $('#admBody');
  if (k === 'cfgsave') { saveConfigNow(); return; }
  if (k === 'logf')    { SYS.logFilter = b.dataset.f; paintLog(box); return; }
  if (k === 'logmore') { b.disabled = true; admLog(box, true); return; }
  if (k === 'health')  { box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`; admHealth(box); return; }
  if (k === 'backup')  { downloadBackup(b); return; }
  if (k === 'pass')    { changePass(b); return; }
  if (k === 'gonew')   { INBOX.filter = 'new'; adminTab = 'inbox'; renderAdmin(); return; }
  if (k === 'clearpdf') { clearOldPDFs(b); return; }
});

document.addEventListener('change', (e) => {
  const f = e.target.closest && e.target.closest('[data-sys-file="restore"]');
  if (f && f.files && f.files[0]) { restoreBackup(f.files[0]); f.value = ''; }
});

setInterval(healthProbe, 60000);
