/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — الأوراق الرسمية

   ١) أمر الشغل
      يصدر تلقائياً مع كل طلب جديد، ويتحوّل فوراً إلى ملف PDF
      يُحفظ في الأرشيف باسم رقم البحث (مثل S12.pdf):
        • على الجهاز نفسه (IndexedDB) — يفتح حتى بدون إنترنت.
        • وفي الأرشيف السحابي (Supabase Storage) لو السيرفر مفعّل.
      الورقة فيها رقم البحث ورقم أمر الشغل والتاريخ والموقع بالتفصيل
      ووصف العطل وخانات يملأها الفني والتوقيعات — يحملها الفني
      معه وهو متوجه للوحدة.

   ٢) الكارنيهات
      بطاقات تعريف رأسية بمقاس البطاقة القياسي (٥٤ × ٨٥٫٦ مم)،
      لكل قسم لون مميز — تنفيذاً للبند (٢) من خطاب الإدارة العامة
      لأمن الأفراد والمنشآت.
      بيانات الكارنيهات تُحفظ على جهاز الإدارة وحده — لا تُرفع
      للسيرفر ولا تدخل ملف الإعدادات العام، لأنها بيانات شخصية.
   ══════════════════════════════════════════════════════════════ */

const COMPANY_AR = 'شركة نواة المستقبل للخدمات المتكاملة';
const COMPANY_SHORT = 'نواة المستقبل';
const COMPANY_EN = 'NAWAH AL-MOSTAQBAL · INTEGRATED SERVICES';
const CITY_AR    = 'المدينة السكنية بالضبعة';

/* ══════════ المكتبات — محمّلة من مجلد vendor عشان تشتغل بدون إنترنت ══════════ */
const LIBS = {};
function loadScript(src) {
  if (!LIBS[src]) {
    LIBS[src] = new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => { delete LIBS[src]; fail(new Error('lib: ' + src)); };
      document.head.appendChild(s);
    });
  }
  return LIBS[src];
}
const needPDF = () => Promise.all([loadScript('vendor/html2canvas.min.js'), loadScript('vendor/jspdf.umd.min.js')]);
const needQR  = () => loadScript('vendor/qrcode.min.js').catch(() => {});

/* رمز QR يتولّد على الجهاز نفسه — لو المكتبة مش متاحة نستخدم خدمة خارجية */
const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?margin=0&size=300x300&data=';
function qrSrc(text) {
  if (window.qrcode) {
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      const q = qrcode(0, 'M');
      q.addData(String(text));
      q.make();
      return q.createDataURL(6, 0);
    } catch (e) { /* نكمّل بالبديل */ }
  }
  return QR_API + encodeURIComponent(text);
}

/* أيقونة الخدمة بلون صريح — أداة التحويل لـ PDF مش بتفهم currentColor */
/* الأوراق الرسمية دايماً بالعربي مهما كانت لغة الواجهة */
const AN = (o, f) => (o && o[f || 'name']) || '';

const inkIcon = (s, color, w) => svg(iconOf(s), w || 1.8).replace(/currentColor/g, color);

/* ══════════ محرّك PDF ══════════
   الورقة بتترسم في حاوية خارج الشاشة، وكل صفحة A4 تتحوّل صورة
   عالية الدقة وتتجمع في ملف PDF واحد. الخط العربي بيترسم
   بمحرّك المتصفح نفسه، فالحروف متصلة وسليمة. */

function imagesReady(el) {
  const imgs = Array.from(el.querySelectorAll('img'));
  return Promise.all(imgs.map((im) => (im.complete && im.naturalWidth)
    ? Promise.resolve()
    : new Promise((done) => {
        im.addEventListener('load',  done, { once: true });
        im.addEventListener('error', () => { im.remove(); done(); }, { once: true });
        setTimeout(done, 4000);            // لو النت بطيء منستناش أكتر من كده
      })));
}

async function htmlToPDF(html) {
  await needPDF();
  const host = document.createElement('div');
  host.className = 'pdf-host';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await imagesReady(host);

    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pages = host.querySelectorAll('.sheet-a4, .cards-a4');
    for (let i = 0; i < pages.length; i++) {
      const cv = await html2canvas(pages[i], {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
      });
      const ratio = cv.height / cv.width;
      let w = 210, h = 210 * ratio;
      if (h > 297) { h = 297; w = 297 / ratio; }
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, 0, w, h, undefined, 'FAST');
    }
    pdf.setProperties({ title: document.title, author: COMPANY_AR, creator: COMPANY_AR });
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}

async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return true; }
    catch (e) { return e && e.name === 'AbortError'; }
  }
  return false;
}

/* ── الطباعة المباشرة (للي عايز يطبع ورقة على طول) ── */
function paperRoot() {
  let el = document.getElementById('paper');
  if (!el) {
    el = document.createElement('div');
    el.id = 'paper';
    document.body.appendChild(el);
  }
  return el;
}

async function printPaper(html, fileName) {
  const el = paperRoot();
  el.innerHTML = html;
  await imagesReady(el);

  const prevTitle = document.title;
  if (fileName) document.title = fileName;
  document.body.classList.add('printing');

  let cleaned = false;
  const clean = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('printing');
    document.title = prevTitle;
    el.innerHTML = '';
    window.removeEventListener('afterprint', clean);
  };
  window.addEventListener('afterprint', clean);

  try { window.print(); }
  catch (e) { toast('المتصفح الحالي لا يدعم الطباعة — افتح الصفحة من متصفح آخر.'); }

  setTimeout(clean, 1500);   // afterprint مش مضمون على كل المتصفحات
}

/* ══════════ أرشيف أوامر الشغل على الجهاز (IndexedDB) ══════════ */
const PDFDB = {
  _db: null,
  open() {
    if (!this._db) {
      this._db = new Promise((ok, fail) => {
        if (!window.indexedDB) { fail(new Error('no-idb')); return; }
        const q = indexedDB.open('nawah-archive', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('wo', { keyPath: 'no' });
        q.onsuccess = () => ok(q.result);
        q.onerror = () => fail(q.error);
      });
    }
    return this._db;
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((ok, fail) => {
      const t = db.transaction('wo', mode);
      const out = fn(t.objectStore('wo'));
      t.oncomplete = () => ok(out && 'result' in out ? out.result : undefined);
      t.onerror = () => fail(t.error);
    });
  },
  put(rec)  { return this.tx('readwrite', (s) => s.put(rec)).catch(() => null); },
  get(no)   { return this.tx('readonly',  (s) => s.get(no)).catch(() => null); },
  all()     { return this.tx('readonly',  (s) => s.getAll()).catch(() => []); }
};

/* كل الطلبات اللي اتعرضت في الأرشيف أو شاشة الفني — عشان نقدر نفتح أمر شغلها */
const WO_POOL = {};
const woFind = (no) => requests.find((x) => x.no === no) || WO_POOL[no] || null;
const woFile = (r) => 'امر-شغل-' + r.no + '.pdf';

/* إصدار أمر الشغل وحفظه — بيتنادى تلقائياً مع كل طلب جديد */
async function archiveWO(r) {
  await needQR();
  const blob = await htmlToPDF(woSheet(r));
  const rec = {
    no: r.no, wo: r.wo, svc: r.svc, at: r.at,
    block: r.block, flat: r.flat, made: new Date().toISOString(),
    blob, cloud: ''
  };
  await PDFDB.put(rec);
  await pushWO(rec);
  return rec;
}

/* رفع النسخة للأرشيف السحابي — لو فشل بيتعاد تلقائياً في الفتحة الجاية */
async function pushWO(rec) {
  if (!DB.ready() || rec.cloud) return rec;
  try {
    rec.cloud = await DB.uploadPDF(rec.no + '.pdf', rec.blob);
    await PDFDB.put(rec);
    try { await DB.patch(rec.no, { wo_pdf: rec.cloud }); } catch (e) { /* العمود اختياري */ }
  } catch (e) { /* يتعاد بعدين */ }
  return rec;
}

async function flushWO() {
  if (!DB.ready()) return;
  const all = await PDFDB.all();
  for (const rec of all) if (!rec.cloud) await pushWO(rec);
}

/* هات ملف أمر الشغل: من الجهاز ← من السحابة ← أو اصدره دلوقتي */
async function woPDF(r) {
  const local = await PDFDB.get(r.no);
  if (local && local.blob) return local.blob;
  if (DB.ready()) {
    try {
      const res = await fetch(DB.pdfURL(r.no + '.pdf'), { cache: 'no-store' });
      if (res.ok) {
        const blob = await res.blob();
        await PDFDB.put({ no: r.no, wo: r.wo, svc: r.svc, at: r.at, block: r.block, flat: r.flat,
                          made: new Date().toISOString(), blob, cloud: DB.pdfURL(r.no + '.pdf') });
        return blob;
      }
    } catch (e) { /* نصدره من جديد */ }
  }
  return (await archiveWO(r)).blob;
}

/* ══════════ ١ · أمر الشغل ══════════ */

function trackURL(no) {
  return location.origin + location.pathname + '?t=' + encodeURIComponent(no);
}

function woDate(r) {
  const d = new Date(r.woAt || r.at);
  return {
    day:  d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };
}

/* لوجو إضافي اختياري — لو اتحط ملف logo2.png جنب logo.png بيظهر تلقائياً */
const LOGO2 = '<img class="logo2" src="logo2.png" alt="" onerror="this.remove()">';

/* الورقة كاملة — HTML واحد يتحوّل PDF ويتطبع زي ما هو */
function woSheet(r) {
  const s  = svcById(r.svc);
  const d  = deptColor(r.svc);
  const p  = CFG.priorities[r.prio] || CFG.priorities.normal;
  const t  = techById(r.tech_id);
  const dt = woDate(r);
  const prioInk = r.prio === 'urgent' ? '#C0304A' : r.prio === 'high' ? '#B86F14' : '#12805F';
  const line = (CFG.lines && CFG.lines[0] && CFG.lines[0].tel) || '';

  const addr = [
    r.area,
    r.block ? 'عمارة ' + r.block : '',
    r.floor ? 'الدور ' + r.floor : '',
    r.flat  ? 'شقة ' + r.flat : ''
  ].filter(Boolean).join('  ·  ');

  const loc = [
    ['المنطقة', r.area],
    ['رقم العمارة', r.block],
    ['الدور', r.floor],
    ['رقم الشقة', r.flat],
    ['مكان العطل', r.spot]
  ].filter((x) => x[1]);

  return `
<div class="sheet-a4 wo" style="--d:${d.ink};--dd:${d.deep};--dt:${d.tint}">
  <img class="wo-mark" src="logo.png" alt="">

  <header class="wo-head">
    <div class="wo-brand">
      <img src="logo.png" alt="">
      <div>
        <h1>${esc(COMPANY_AR)}</h1>
        <span class="en">${esc(COMPANY_EN)}</span>
        <span class="sub">إدارة الصيانة — ${esc(CITY_AR)}</span>
      </div>
      ${LOGO2}
    </div>
    <div class="wo-title">
      <div>
        <b>أمر شغل صيانة</b>
        <span class="en2">MAINTENANCE WORK ORDER</span>
      </div>
      <div class="wo-search">
        <span>رقم البحث</span>
        <strong>${esc(r.no)}</strong>
      </div>
    </div>
  </header>

  <div class="wo-dept">
    <span class="ic">${inkIcon(s, '#fff', 2)}</span>
    <b>${esc(AN(s, 'name'))}</b>
    <span class="wo-dept-no">أمر شغل رقم <em>${esc(r.wo || '—')}</em></span>
  </div>

  <div class="wo-body">

    <div class="wo-tiles">
      <div><span>رقم البحث</span><b class="ltr">${esc(r.no)}</b></div>
      <div><span>تاريخ ووقت الإصدار</span><b>${esc(dt.day)}</b><em>الساعة ${esc(dt.time)}</em></div>
      <div class="prio" style="--p:${prioInk}"><span>درجة الأولوية</span><b><i></i>${esc(AN(p, 'label'))}</b><em>الاستجابة ${esc(AN(p, 'sla'))}</em></div>
      <div class="qr"><img src="${qrSrc(trackURL(r.no))}" alt=""><span>امسح لمتابعة الطلب</span></div>
    </div>

    <div class="wo-card wo-where">
      <h3>مكان العمل</h3>
      <p class="wo-addr">${esc(addr || '—')}</p>
      <dl class="wo-kv cols">
        ${loc.map((x) => `<div><dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd></div>`).join('')}
      </dl>
    </div>

    <div class="wo-row">
      <div class="wo-card">
        <h3>مقدّم الطلب</h3>
        <dl class="wo-kv">
          <dt>الاسم</dt><dd>${esc(r.name || r.resident_name || (profile && profile.name) || '—')}</dd>
          <dt>الهاتف</dt><dd class="ltr">${esc(r.phone || '—')}</dd>
          <dt>الصفة</dt><dd>ساكن بالمدينة السكنية</dd>
        </dl>
      </div>
      <div class="wo-card">
        <h3>الفني المكلّف</h3>
        <dl class="wo-kv">
          <dt>الاسم</dt><dd>${esc((t && t.name) || r.tech_name || '………………………………')}</dd>
          <dt>التخصص</dt><dd>${esc(t ? (t.svcs || []).map((x) => AN(svcById(x), 'name')).join(' · ') : AN(s, 'name'))}</dd>
          <dt>رقم الكارنيه</dt><dd class="ltr">${esc(cardNoOfTech(t) || '……………………')}</dd>
        </dl>
      </div>
    </div>

    <div class="wo-card">
      <h3>وصف العطل كما ورد من الساكن</h3>
      <div class="wo-desc${r.desc ? (r.desc.length > 260 ? ' long' : '') : ' empty'}">${esc(r.desc || 'لم يُرفق وصف — يعاين الفني العطل على الطبيعة.')}</div>
    </div>

    <div class="wo-card soft">
      <h3>يستكمله الفني بعد التنفيذ</h3>
      <div class="wo-fill">
        <div class="wo-line">وقت الوصول<i></i></div>
        <div class="wo-line">وقت الانتهاء<i></i></div>
      </div>
      <div class="wo-fill full">
        <div class="wo-line">الأعمال المنفّذة<i class="tall"></i></div>
        <div class="wo-line">الخامات وقطع الغيار المستخدمة<i></i></div>
      </div>
      <div class="wo-checks">
        <label><u></u> تم الإصلاح بالكامل</label>
        <label><u></u> يحتاج زيارة أخرى</label>
        <label><u></u> يحتاج قطع غيار</label>
        <label><u></u> خارج نطاق الصيانة</label>
      </div>
    </div>

    <div class="wo-sign">
      <div><i></i>توقيع الفني</div>
      <div><i></i>توقيع الساكن بالاستلام</div>
      <div><i></i>اعتماد مشرف الصيانة</div>
    </div>

    <div class="wo-warn">
      <b>تنبيه للساكن</b>
      لا يبدأ الفني العمل إلا بعد إبراز كارنيه الشركة وارتداء الزي الموحد ومطابقة رقم البحث أعلاه.${line ? ' للإبلاغ عن أي مخالفة: <b class="ltr">' + esc(line) + '</b>' : ''}
    </div>
  </div>

  <footer class="wo-foot">
    <img src="logo.png" alt="">
    <span>${esc(COMPANY_AR)} — ${esc(CITY_AR)}</span>
    <span>صادر آلياً من منظومة الصيانة الإلكترونية · رقم البحث <b class="ltr">${esc(r.no)}</b></span>
  </footer>
</div>`;
}

/* رقم كارنيه الفني لو الإدارة أصدرته من نفس الجهاز */
function cardNoOfTech(t) {
  if (!t) return '';
  const c = idCards().find((x) => x.tech === t.id || (x.name && x.name === t.name));
  return c ? c.no : '';
}

/* ══════════ شاشة أمر الشغل ══════════ */
let lastWO = null;

async function renderWO(no) {
  const r = woFind(no) || woFind(lastWO) || requests[0];
  const box = $('#woBox');
  if (!r) {
    box.innerHTML = `<div class="note-box warn"><b>لا يوجد طلب لعرض أمر الشغل الخاص به.</b></div>`;
    return;
  }
  lastWO = r.no;
  $('#v-wo .back').dataset.go = isAdmin && !requests.find((x) => x.no === r.no) ? 'admin' : 'list';

  await needQR();
  const rec = await PDFDB.get(r.no);
  const state = rec && rec.cloud ? '☁ محفوظ في الأرشيف السحابي وعلى هذا الجهاز'
              : rec ? '✓ محفوظ في الأرشيف على هذا الجهاز'
              : '… جاري الحفظ في الأرشيف';

  box.innerHTML = `
    <div class="wo-hero">
      <div>
        <span>رقم البحث</span>
        <b class="ltr">${esc(r.no)}</b>
      </div>
      <div>
        <span>أمر الشغل</span>
        <b class="ltr">${esc(r.wo || '—')}</b>
      </div>
      <p class="wo-state" id="woState">${esc(state)}</p>
    </div>
    <div class="pp-note">
      صدر أمر الشغل تلقائياً مع تسجيل الطلب، وحُفظ في الأرشيف ملفَّ PDF باسم رقم البحث.
      يحمله الفني معه عند التوجه للوحدة — حمّله أو شاركه أو اطبعه من الأزرار التالية.
    </div>
    <div class="pp-bar">
      <button class="btn btn-primary" type="button" data-wo="pdf" data-no="${esc(r.no)}">تحميل PDF</button>
      ${navigator.canShare ? `<button class="btn btn-quiet" type="button" data-wo="share" data-no="${esc(r.no)}">مشاركة</button>` : ''}
      <button class="btn btn-quiet" type="button" data-wo="print" data-no="${esc(r.no)}">طباعة</button>
      <button class="btn btn-quiet" type="button" data-wo="wa" data-no="${esc(r.no)}">واتساب</button>
    </div>
    <div class="pp-stage"><div class="pp-fit">${woSheet(r)}</div></div>`;

  fitPaper();
  const imgs = box.querySelectorAll('.pp-fit img');
  imgs.forEach((im) => im.addEventListener('load', fitPaper, { once: true }));

  /* لو الطلب اتفتح قبل ما يتأرشف (طلب قديم مثلاً) — نأرشفه دلوقتي */
  if (!rec) {
    try {
      const done = await archiveWO(r);
      const el = $('#woState');
      if (el) el.textContent = done.cloud ? '☁ محفوظ في الأرشيف السحابي وعلى هذا الجهاز' : '✓ محفوظ في الأرشيف على هذا الجهاز';
    } catch (e) {
      const el = $('#woState');
      if (el) el.textContent = 'تعذّر الحفظ التلقائي — استخدم زر «تحميل PDF».';
    }
  }
}

/* الورقة A4 أعرض من شاشة الموبايل — بنصغّرها للعرض فقط */
function fitPaper() {
  $$('.pp-stage').forEach((stage) => {
    if (!stage.offsetParent) return;
    const fit = stage.querySelector('.pp-fit');
    const sheet = fit && fit.firstElementChild;
    if (!sheet) return;
    const avail = stage.clientWidth - 28;
    const k = Math.min(1, avail / sheet.offsetWidth);
    fit.style.transform = 'scale(' + k + ')';
    fit.style.width = sheet.offsetWidth + 'px';
    fit.style.height = (fit.scrollHeight * k) + 'px';
  });
}

window.addEventListener('resize', () => fitPaper());

/* ══════════ لوحة الإدارة: أرشيف أوامر الشغل ══════════ */
let woQuery = '';

async function admOrders(box) {
  let rows = [];
  if (DB.ready()) {
    try { rows = (await DB.allRequests(500)).map((x) => Object.assign(fromRow(x), { wo_pdf: x.wo_pdf || '' })); }
    catch (e) { rows = requests.slice(); }
  } else {
    rows = requests.slice();
  }
  rows.forEach((r) => { if (!requests.find((x) => x.no === r.no)) WO_POOL[r.no] = r; });

  const local = {};
  (await PDFDB.all()).forEach((x) => { local[x.no] = x; });
  if (adminTab !== 'orders' || $('#v-admin').hidden) return;   // الإدارة انتقلت لتبويب تاني قبل التحميل

  const q = woQuery.trim().toUpperCase();
  const shown = rows.filter((r) => !q
    || String(r.no).toUpperCase().indexOf(q) > -1
    || String(r.wo || '').toUpperCase().indexOf(q) > -1
    || String(r.block || '') === q);
  const saved = rows.filter((r) => local[r.no] || r.wo_pdf).length;

  box.innerHTML = `
    <p class="fine mb">كل طلب يصدر له أمر شغل تلقائياً ويُحفظ ملفَّ PDF باسم رقم البحث.
      ابحث برقم البحث (مثل S12) أو رقم أمر الشغل أو رقم العمارة.</p>
    <div class="arch-stats">
      <div><b>${num(rows.length)}</b><span>أمر شغل</span></div>
      <div><b>${num(saved)}</b><span>مؤرشف PDF</span></div>
      <div><b>${num(rows.filter((r) => (local[r.no] && local[r.no].cloud) || r.wo_pdf).length)}</b><span>في السحابة</span></div>
      <div><b>${num(rows.length - saved)}</b><span>لم يُؤرشف بعد</span></div>
    </div>
    <div class="track-row mt">
      <input id="woSearch" value="${esc(woQuery)}" placeholder="رقم البحث — مثال: S12" autocomplete="off" inputmode="text">
      <button class="btn btn-primary" type="button" data-wo="find">بحث</button>
    </div>
    ${rows.length - saved ? `<button class="btn btn-quiet btn-block mt" type="button" data-wo="backfill">أرشفة الأوامر الناقصة (${num(rows.length - saved)})</button>` : ''}
    <div class="arch-list">
      ${shown.slice(0, 120).map((r) => {
        const sv = svcById(r.svc), c = colorOf(sv);
        const st = (local[r.no] && local[r.no].cloud) || r.wo_pdf ? '<em class="wo-b cloud">☁ سحابي</em>'
                 : local[r.no] ? '<em class="wo-b">على الجهاز</em>'
                 : '<em class="wo-b none">غير مؤرشف</em>';
        return `<div class="arch" data-p="${esc(r.prio)}">
          <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(sv))}</span>
          <div class="arch-t">
            <b><span class="ltr">${esc(r.no)}</span> · ${esc(C(sv,'name'))} · ${esc(T('lbl.building'))} ${num(esc(r.block))}/${num(esc(r.flat))}</b>
            <span>${esc(r.wo || '')} · ${esc(new Date(r.at).toLocaleDateString(locale()))} ${st}</span>
          </div>
          <button class="wo-op" type="button" data-wo="open" data-no="${esc(r.no)}" title="عرض">👁</button>
          <button class="wo-op" type="button" data-wo="pdf" data-no="${esc(r.no)}" title="تحميل PDF">PDF</button>
        </div>`;
      }).join('') || `<p class="fine center mt">لا توجد نتائج لـ «${esc(woQuery)}».</p>`}
    </div>`;
}

/* ══════════ ٢ · الكارنيهات ══════════ */

/* ألوان الأقسام — كل قسم له لون خاص به لا يتكرر */
const DEPT_PALETTE = {
  blue:    { ink:'#1565C0', deep:'#0B3A78', tint:'#E3EEFC' },
  amber:   { ink:'#D98A00', deep:'#8A5300', tint:'#FFF2D3' },
  teal:    { ink:'#0E8A9A', deep:'#06525C', tint:'#DDF2F5' },
  brown:   { ink:'#8A5A2B', deep:'#553616', tint:'#F4EADF' },
  purple:  { ink:'#5B3FA8', deep:'#352368', tint:'#ECE6FA' },
  green:   { ink:'#16895C', deep:'#0A5436', tint:'#DDF4E9' },
  slate:   { ink:'#4A5578', deep:'#262D4A', tint:'#E9ECF4' },
  navy:    { ink:'#1E2A72', deep:'#0E1545', tint:'#E6E9F8' },
  magenta: { ink:'#B0438A', deep:'#6B1D52', tint:'#F9E3F1' },
  red:     { ink:'#C0304A', deep:'#761628', tint:'#FBE4E8' },
  olive:   { ink:'#6E7F1F', deep:'#414C0E', tint:'#F0F3DC' },
  coral:   { ink:'#D2552E', deep:'#7E2D14', tint:'#FDE9E1' }
};
const DEPT_FIXED = {
  plumb:'blue', elec:'amber', ac:'teal', carp:'brown', sewer:'purple', clean:'green', other:'slate',
  admin:'navy', super:'magenta', security:'red'
};

/* أقسام الكارنيهات = أقسام الخدمة + الإدارة والإشراف والأمن */
const STAFF_DEPTS = [
  { id:'admin',    name:'الإدارة',        icon:'gear' },
  { id:'super',    name:'الإشراف الفني',  icon:'shield' },
  { id:'security', name:'الأمن',          icon:'shield' }
];
const cardDepts = () => CFG.services.concat(STAFF_DEPTS);
const deptById  = (id) => cardDepts().find((x) => x.id === id) || svcById(id);

function deptColor(id) {
  if (DEPT_FIXED[id]) return DEPT_PALETTE[DEPT_FIXED[id]];
  /* قسم جديد أضافته الإدارة: ياخد أول لون لسه محدش واخده */
  const used = {};
  cardDepts().forEach((d) => { if (DEPT_FIXED[d.id]) used[DEPT_FIXED[d.id]] = 1; });
  const free = Object.keys(DEPT_PALETTE).filter((k) => !used[k]);
  const extra = cardDepts().filter((d) => !DEPT_FIXED[d.id]).map((d) => d.id);
  const i = Math.max(0, extra.indexOf(id));
  return DEPT_PALETTE[free[i % free.length] || 'slate'];
}

function idCards()      { return store.get('cards', []); }
function saveCards(list) { return store.set('cards', list); }

/* رقم كارنيه تلقائي: حرف القسم + السنة + مسلسل  مثل  S-26-004 */
function deptCode(id) {
  const fixed = { admin: 'M', super: 'P', security: 'G' };
  return fixed[id] || svcCode(id);
}
function nextCardNo(deptId) {
  const code = deptCode(deptId);
  const yr = String(new Date().getFullYear()).slice(-2);
  const nums = idCards().filter((c) => c.svc === deptId)
    .map((c) => Number(String(c.no || '').split('-').pop()) || 0);
  const next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
  return code + '-' + yr + '-' + String(next).padStart(3, '0');
}

function isoToday(addYears) {
  const d = new Date();
  if (addYears) d.setFullYear(d.getFullYear() + addYears);
  return d.toISOString().slice(0, 10);
}
const cardDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

function blankCard() {
  return {
    id: 'c' + Math.random().toString(36).slice(2, 8),
    name: '', nid: '', job: '', svc: (CFG.services[0] || {}).id || '',
    no: '', from: isoToday(0), to: isoToday(2), photo: '', tech: '', blood: ''
  };
}

let cardDraft = null;

/* وجه البطاقة — رأسي */
function idcFront(c) {
  const s = deptById(c.svc);
  const d = deptColor(c.svc);
  return `
<div class="bdg" style="--d:${d.ink};--dd:${d.deep};--dt:${d.tint}">
  <div class="bdg-head">
    <svg class="bdg-orb" viewBox="0 0 200 120" aria-hidden="true">
      <g fill="none" stroke="#fff" stroke-width="1.2" opacity=".22">
        <ellipse cx="170" cy="20" rx="70" ry="24" transform="rotate(25 170 20)"/>
        <ellipse cx="170" cy="20" rx="70" ry="24" transform="rotate(85 170 20)"/>
        <ellipse cx="170" cy="20" rx="70" ry="24" transform="rotate(145 170 20)"/>
      </g>
    </svg>
    <div class="bdg-brand">
      <img src="logo.png" alt="">
      <div><b>${esc(COMPANY_SHORT)}</b><span>للخدمات المتكاملة</span></div>
    </div>
    <svg class="bdg-wave" viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 14 C50 30 120 -4 200 12 V26 H0 Z" fill="#fff"/>
    </svg>
  </div>

  <div class="bdg-photo">
    ${c.photo ? `<img src="${c.photo}" alt="">` : '<em>الصورة<br>الشخصية</em>'}
  </div>

  <div class="bdg-name${(c.name || '').length > 20 ? ' long' : ''}">${esc(c.name || 'الاسم الرباعي')}</div>
  <div class="bdg-job">${esc(c.job || 'المسمى الوظيفي')}</div>
  <div class="bdg-dept"><i>${inkIcon(s, '#fff', 2)}</i>${esc(AN(s))}</div>

  <dl class="bdg-kv">
    <div><dt>الرقم القومي</dt><dd>${esc(c.nid || '—')}</dd></div>
    <div><dt>رقم الكارنيه</dt><dd>${esc(c.no || '—')}</dd></div>
  </dl>

  <div class="bdg-foot">
    <span>صالحة حتى</span><b>${esc(cardDate(c.to))}</b>
  </div>
</div>`;
}

/* ظهر البطاقة */
function idcBack(c) {
  const s = deptById(c.svc);
  const d = deptColor(c.svc);
  const line = (CFG.lines && CFG.lines[0] && CFG.lines[0].tel) || '';
  const qrText = [COMPANY_AR, c.name, AN(s), c.job, 'كارنيه ' + (c.no || ''), 'صالحة حتى ' + (c.to || '')]
    .filter(Boolean).join(' | ');
  return `
<div class="bdg back" style="--d:${d.ink};--dd:${d.deep};--dt:${d.tint}">
  <div class="bdg-top">
    <img src="logo.png" alt="">
    <div><b>بطاقة تعريف عامل</b><span>STAFF IDENTIFICATION CARD</span></div>
  </div>
  <ul class="bdg-rules">
    <li>تُبرَز للساكن قبل دخول أي وحدة سكنية.</li>
    <li>لا يبدأ العمل إلا بأمر شغل معتمد.</li>
    <li>البطاقة شخصية وملك الشركة، ولا يجوز التنازل عنها.</li>
    <li>عند فقدها يُبلَّغ مسؤول الأمن فوراً.</li>
  </ul>
  <div class="bdg-qr">
    <img src="${qrSrc(qrText)}" alt="">
    <span>امسح للتحقق من<br>بيانات حامل البطاقة</span>
  </div>
  <div class="bdg-meta">
    <div><span>تاريخ الإصدار</span><b>${esc(cardDate(c.from))}</b></div>
    <div><span>توقيع المسؤول</span><i></i></div>
  </div>
  ${line ? `<div class="bdg-line">للتحقق أو الإبلاغ: <b>${esc(line)}</b></div>` : ''}
  <div class="bdg-foot"><span>${esc(COMPANY_AR)}</span></div>
</div>`;
}

/* ورقة A4 فيها البطاقات جاهزة للقص — ٩ كارنيهات في الصفحة.
   مع الظهر: صفحة للوجوه ثم صفحة للظهور معكوسة الأعمدة، فلما
   تتطبع على الوجهين (قلب على الحافة الطويلة) كل ظهر يقع خلف وجهه. */
function cardsSheet(list, withBack) {
  const page = (cells, label) => `<div class="cards-a4">
      <div class="cards-cap"><img src="logo.png" alt=""><b>${esc(COMPANY_AR)}</b><span>${label}</span></div>
      <div class="cards-grid">${cells.join('')}</div>
    </div>`;
  const pages = [];
  for (let i = 0; i < list.length; i += 9) {
    const chunk = list.slice(i, i + 9);
    pages.push(page(chunk.map(idcFront), withBack ? 'الوجه الأمامي — اطبع الصفحة التالية على ظهر هذه الورقة' : 'كارنيهات العاملين — قُصّ على الخط المنقّط'));
    if (withBack) {
      const cells = [];
      for (let r = 0; r < chunk.length; r += 3) {
        const row = chunk.slice(r, r + 3).map(idcBack);
        while (row.length < 3) row.push('<div class="bdg-empty"></div>');
        cells.push.apply(cells, row.reverse());
      }
      pages.push(page(cells, 'الظهر — معكوس ليطابق الوجه عند الطباعة على الوجهين'));
    }
  }
  return pages.join('') || '<div class="cards-a4"></div>';
}

/* ══════════ شاشة إنشاء الكارنيهات ══════════ */
function renderCards() {
  if (!cardDraft) cardDraft = blankCard();
  const list = idCards();
  const c = cardDraft;

  $('#cardsBox').innerHTML = `
    <div class="pp-note">
      بطاقة تعريف بلون مميز لكل قسم، تنفيذاً للبند <b>(٢)</b> من خطاب الإدارة العامة لأمن الأفراد والمنشآت.
      أدخل البيانات وأرفق الصورة، وستظهر المعاينة فوراً.
      <br><b>تُحفظ هذه البيانات على هذا الجهاز فقط</b> ولا تُرفع إلى السيرفر، لأنها بيانات شخصية.
    </div>

    <div class="dept-legend">
      ${cardDepts().map((x) => {
        const k = deptColor(x.id);
        return `<button type="button" class="dl-chip${x.id === c.svc ? ' on' : ''}" data-card="dept" data-id="${esc(x.id)}" style="--d:${k.ink};--dt:${k.tint}">
          <i></i>${esc(C(x, 'name') || x.name)}</button>`;
      }).join('')}
    </div>

    <div class="idf">
      <label class="fld wide"><span>الاسم الرباعي</span>
        <input id="cName" value="${esc(c.name)}" placeholder="مثال: محمد عبدالله السيد أحمد">
      </label>
      <label class="fld"><span>الرقم القومي</span>
        <input id="cNid" class="ltr" inputmode="numeric" maxlength="14" value="${esc(c.nid)}" placeholder="١٤ رقماً">
      </label>
      <label class="fld"><span>المسمى الوظيفي</span>
        <input id="cJob" value="${esc(c.job)}" placeholder="مثال: فني سباكة أول">
      </label>
      <label class="fld"><span>القسم</span>
        <select id="cSvc">
          ${cardDepts().map((s) => `<option value="${esc(s.id)}" ${s.id === c.svc ? 'selected' : ''}>${esc(C(s, 'name') || s.name)}</option>`).join('')}
        </select>
      </label>
      <label class="fld"><span>رقم الكارنيه</span>
        <input id="cNo" class="ltr" value="${esc(c.no)}" placeholder="يُولَّد تلقائياً">
      </label>
      <label class="fld"><span>تاريخ الإصدار</span>
        <input id="cFrom" type="date" value="${esc(c.from)}">
      </label>
      <label class="fld"><span>صالحة حتى</span>
        <input id="cTo" type="date" value="${esc(c.to)}">
      </label>
      <label class="fld wide photo-in"><span>الصورة الشخصية</span>
        <input id="cPhoto" type="file" accept="image/*">
      </label>
      <label class="fld wide"><span>ربط بفني مسجّل (اختياري — يظهر رقم كارنيهه في أوامر الشغل)</span>
        <select id="cTech">
          <option value="">— بدون ربط —</option>
          ${(CFG.technicians || []).map((t) => `<option value="${esc(t.id)}" ${t.id === c.tech ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select>
      </label>
    </div>
    <p class="err" id="cErr" hidden></p>

    <div class="id-prev">${idcFront(c)}${idcBack(c)}</div>

    <div class="pp-bar">
      <button class="btn btn-primary" type="button" data-card="save">حفظ الكارنيه</button>
      <button class="btn btn-quiet" type="button" data-card="pdf1">تحميل PDF</button>
      <button class="btn btn-quiet" type="button" data-card="print1">طباعة</button>
      <button class="btn btn-quiet" type="button" data-card="clear">كارنيه جديد</button>
    </div>

    <h3 class="adm-h">الكارنيهات المحفوظة (${num(list.length)})</h3>
    ${list.length ? `
      <div class="id-list">
        ${list.map((x, i) => {
          const col = deptColor(x.svc);
          const dp = deptById(x.svc);
          return `<div class="id-row">
            <span class="sw" style="background:${col.ink}"></span>
            ${x.photo ? `<img class="av" src="${x.photo}" alt="">` : ''}
            <div class="t"><b>${esc(x.name || '—')}</b>
              <span>${esc(C(dp, 'name') || (dp && dp.name) || '')} · <span class="ltr">${esc(x.no || '—')}</span></span></div>
            <button type="button" data-card="edit" data-i="${i}" title="تعديل">✎</button>
            <button type="button" data-card="del" data-i="${i}" class="dl" title="حذف">✕</button>
          </div>`;
        }).join('')}
      </div>
      <div class="pp-bar" style="margin-top:14px">
        <button class="btn btn-primary" type="button" data-card="pdfall">PDF لكل الكارنيهات (وجه وظهر)</button>
        <button class="btn btn-quiet" type="button" data-card="printall">طباعة الكل</button>
        <button class="btn btn-quiet" type="button" data-card="printfront">الوجه الأمامي فقط</button>
      </div>` : '<p class="fine">لا توجد كارنيهات محفوظة بعد.</p>'}`;

  wireCards();
}

function readCardForm() {
  cardDraft.name = $('#cName').value.trim();
  cardDraft.nid  = $('#cNid').value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '').slice(0, 14);
  cardDraft.job  = $('#cJob').value.trim();
  cardDraft.svc  = $('#cSvc').value;
  cardDraft.no   = $('#cNo').value.trim();
  cardDraft.from = $('#cFrom').value;
  cardDraft.to   = $('#cTo').value;
  cardDraft.tech = $('#cTech').value;
}

function wireCards() {
  ['cName','cNid','cJob','cNo','cFrom','cTo'].forEach((id) => {
    $('#' + id).addEventListener('input', () => { readCardForm(); refreshCardPreview(); });
  });
  ['cSvc','cTech'].forEach((id) => {
    $('#' + id).addEventListener('change', () => {
      const before = cardDraft.svc;
      readCardForm();
      if (id === 'cSvc') onDeptChange(before);
      if (id === 'cTech' && cardDraft.tech && !cardDraft.name) {
        const t = techById(cardDraft.tech);
        if (t) { cardDraft.name = t.name; $('#cName').value = t.name; }
      }
      refreshCardPreview();
    });
  });

  $('#cPhoto').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    shrinkPhoto(f, (dataURL) => { cardDraft.photo = dataURL; refreshCardPreview(); });
  });
}

/* تغيير القسم بيولّد رقم كارنيه جديد لو الرقم القديم كان تلقائياً */
function onDeptChange(before) {
  const auto = !cardDraft.no || cardDraft.no.charAt(0) === deptCode(before);
  if (auto && !idCards().find((x) => x.id === cardDraft.id)) {
    cardDraft.no = nextCardNo(cardDraft.svc);
    $('#cNo').value = cardDraft.no;
  }
  $$('#cardsBox .dl-chip').forEach((b) => b.classList.toggle('on', b.dataset.id === cardDraft.svc));
}

function refreshCardPreview() {
  const box = document.querySelector('#cardsBox .id-prev');
  if (box) box.innerHTML = idcFront(cardDraft) + idcBack(cardDraft);
}

/* الصورة بتتصغّر قبل التخزين عشان متملاش مساحة الجهاز */
function shrinkPhoto(file, done) {
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const W = 300, H = 400;                    // نسبة ٣ × ٤
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const k = Math.max(W / im.width, H / im.height);
      const w = im.width * k, h = im.height * k;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
      done(cv.toDataURL('image/jpeg', 0.85));
    };
    im.onerror = () => toast('تعذّرت قراءة الصورة — جرّب صورة أخرى.');
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}

function cardProblem(c) {
  if (!c.name) return 'اكتب اسم صاحب الكارنيه.';
  if (c.nid && c.nid.length !== 14) return 'الرقم القومي يجب أن يكون ١٤ رقماً.';
  if (c.from && c.to && c.to < c.from) return 'تاريخ الانتهاء قبل تاريخ الإصدار.';
  return '';
}

async function cardsPDF(list, withBack, name, btn) {
  const was = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'جاري التجهيز…'; }
  try {
    await needQR();
    const blob = await htmlToPDF(cardsSheet(list, withBack));
    saveBlob(blob, name);
  } catch (e) {
    toast('تعذّر إنشاء الملف — جرّب «طباعة» ثم «حفظ كـ PDF».');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = was; }
  }
}

/* أزرار الكارنيهات وأوامر الشغل */
function initCards() {
  $('#cardsBox').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-card]');
    if (!b) return;
    const act = b.dataset.card;
    const list = idCards();
    const i = Number(b.dataset.i);
    const err = $('#cErr');

    if (act === 'dept') {
      const before = cardDraft.svc;
      readCardForm();
      cardDraft.svc = b.dataset.id;
      $('#cSvc').value = cardDraft.svc;
      onDeptChange(before);
      refreshCardPreview();
      return;
    }
    if (act === 'save') {
      readCardForm();
      const bad = cardProblem(cardDraft);
      if (bad) { err.textContent = bad; err.hidden = false; toast(bad); return; }
      err.hidden = true;
      if (!cardDraft.no) cardDraft.no = nextCardNo(cardDraft.svc);
      const at = list.findIndex((x) => x.id === cardDraft.id);
      if (at > -1) list[at] = cardDraft; else list.push(cardDraft);
      if (!saveCards(list)) return;
      cardDraft = blankCard();
      renderCards();
      toast('تم حفظ الكارنيه.');
      return;
    }
    if (act === 'clear')  { cardDraft = blankCard(); renderCards(); return; }
    if (act === 'edit')   { cardDraft = Object.assign(blankCard(), list[i]); renderCards(); window.scrollTo(0, 0); return; }
    if (act === 'del') {
      if (!confirm('حذف كارنيه «' + (list[i].name || '') + '»؟')) return;
      list.splice(i, 1); saveCards(list); renderCards(); return;
    }
    if (act === 'print1' || act === 'pdf1') {
      readCardForm();
      const bad = cardProblem(cardDraft);
      if (bad) { err.textContent = bad; err.hidden = false; toast(bad); return; }
      if (!cardDraft.no) { cardDraft.no = nextCardNo(cardDraft.svc); $('#cNo').value = cardDraft.no; }
      const nm = 'كارنيه-' + (cardDraft.name || '').replace(/\s+/g, '-');
      if (act === 'pdf1') { cardsPDF([cardDraft], true, nm + '.pdf', b); return; }
      await needQR();
      printPaper(cardsSheet([cardDraft], true), nm);
      return;
    }
    if (act === 'pdfall')     { cardsPDF(list, true, 'كارنيهات-نواة-المستقبل.pdf', b); return; }
    if (act === 'printall')   { await needQR(); printPaper(cardsSheet(list, true),  'كارنيهات-نواة-المستقبل'); return; }
    if (act === 'printfront') { await needQR(); printPaper(cardsSheet(list, false), 'كارنيهات-نواة-المستقبل'); return; }
  });

  /* أزرار أمر الشغل — في شاشته وفي أرشيف الإدارة */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-wo]');
    if (!b) return;
    const act = b.dataset.wo;

    if (act === 'find') { woQuery = ($('#woSearch') || {}).value || ''; renderAdmin(); return; }
    if (act === 'backfill') {
      const rows = Object.values(WO_POOL).concat(requests);
      const have = {};
      (await PDFDB.all()).forEach((x) => { have[x.no] = 1; });
      const todo = rows.filter((r, k) => !have[r.no] && rows.findIndex((y) => y.no === r.no) === k);
      b.disabled = true;
      for (let k = 0; k < todo.length; k++) {
        b.textContent = 'جاري الأرشفة… ' + num(k + 1) + ' / ' + num(todo.length);
        try { await archiveWO(todo[k]); } catch (err) { /* نكمّل الباقي */ }
      }
      toast('تمت أرشفة ' + num(todo.length) + ' أمر شغل.');
      renderAdmin();
      return;
    }

    const r = woFind(b.dataset.no);
    if (!r) return;

    if (act === 'open') { go('wo', r.no); return; }
    if (act === 'wa')   { window.open(waLink(ADMIN_WA() || '', requestText(r)), '_blank', 'noopener'); return; }
    if (act === 'print') { await needQR(); printPaper(woSheet(r), 'امر-شغل-' + r.no); return; }

    const was = b.textContent;
    b.disabled = true;
    b.textContent = '…';
    try {
      const blob = await woPDF(r);
      if (act === 'share') {
        const ok = await shareBlob(blob, woFile(r), 'أمر شغل ' + r.no);
        if (!ok) saveBlob(blob, woFile(r));
      } else {
        saveBlob(blob, woFile(r));
      }
    } catch (err) {
      toast('تعذّر إنشاء الملف — استخدم «طباعة» ثم «حفظ كـ PDF».');
    } finally {
      b.disabled = false;
      b.textContent = was;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.id === 'woSearch') {
      woQuery = e.target.value;
      renderAdmin();
    }
  });
}
