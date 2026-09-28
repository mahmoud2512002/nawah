/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — الإعلانات والإشعارات
   البند ٧ في الخطاب: تعميم الإعلانات على السكان
   ══════════════════════════════════════════════════════════════ */

/* ── 1. إعلانات الشركة ───────────────────────────────────── */

const liveAnn = () => (CFG.announcements || []).filter((a) => C(a, 'title').trim());

function renderAnn() {
  const box = $('#annBox');
  if (!box) return;
  const list = liveAnn();

  if (!list.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;

  const seen = store.get('annSeen', []);
  box.innerHTML = `
    <h2 class="sec"><span>${esc(T('ann.title'))}</span></h2>
    ${list.map((a) => {
      const isNew = seen.indexOf(a.id) < 0;
      return `<article class="ann${isNew ? ' new' : ''}">
        <div class="ann-top">
          <span class="ann-ic" aria-hidden="true">${svg('M3.5 9.5v5h3l6 4V5.5l-6 4ZM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11', 1.8)}</span>
          <div class="ann-h">
            <b>${esc(C(a, 'title'))}</b>
            ${a.date ? `<span>${esc(a.date)}</span>` : ''}
          </div>
          ${isNew ? `<i class="ann-new">${esc(T('ann.new'))}</i>` : ''}
        </div>
        ${C(a, 'body') ? `<p>${esc(C(a, 'body'))}</p>` : ''}
      </article>`;
    }).join('')}`;

  store.set('annSeen', list.map((a) => a.id));
}

/* ── 2. الإشعارات ────────────────────────────────────────
   إشعار على الشاشة لحظة ما تتغير حالة الطلب أو توصل مهمة
   جديدة للفني. بيشتغل والتطبيق مفتوح أو مثبّت على الشاشة. */

const NOTIF = {
  get on() { return store.get('notify', false) && this.granted; },
  get granted() { return 'Notification' in window && Notification.permission === 'granted'; },
  get possible() { return 'Notification' in window; },

  async ask() {
    if (!this.possible) { toast(T('notif.unsupported')); return false; }
    if (Notification.permission === 'denied') { toast(T('notif.blocked')); return false; }
    const p = await Notification.requestPermission();
    const ok = p === 'granted';
    store.set('notify', ok);
    if (ok) { toast(T('notif.on')); this.show(T('notif.testT'), T('notif.testB')); }
    else toast(T('notif.off'));
    renderSettings();
    return ok;
  },

  off() { store.set('notify', false); toast(T('notif.off')); renderSettings(); },

  show(title, body) {
    if (!this.on) return;
    try {
      const n = new Notification(title, {
        body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
        lang: LANG, dir: LANGS[LANG].dir, tag: 'nawah'
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* some browsers only allow this from a service worker */ }
  }
};

/* watch the rows the server pushes and speak up when they matter to me */
function onLiveChange(payload) {
  const rec = payload && (payload.record || payload.new);
  if (!rec) return;

  /* a technician: a job landed on me */
  if (TECH && rec.tech_id === TECH.id && (rec.stage | 0) <= 1) {
    NOTIF.show(T('notif.jobT'), (rec.svc ? C(svcById(rec.svc), 'name') + ' · ' : '')
      + T('lbl.building') + ' ' + rec.block + ' / ' + T('lbl.flat') + ' ' + rec.flat);
    renderTech();
    return;
  }

  /* a resident: my own request moved */
  const mine = requests.find((x) => x.no === rec.no);
  if (mine && (rec.stage | 0) !== (mine.stage | 0)) {
    mine.stage = rec.stage | 0;
    if (rec.tech_name) mine.tech_name = rec.tech_name;
    store.set('requests', requests);
    NOTIF.show(T('notif.stageT') + ' ' + rec.no, T('stg.' + Math.min(rec.stage | 0, 4) + 't'));
    renderCounters();
    if (!$('#v-list').hidden) renderList();
    if (!$('#v-detail').hidden) renderDetail(rec.no);
  }
}

/* a light poll so status still updates where realtime is blocked */
let pollTimer = null;
function startPolling() {
  if (pollTimer || !DB.ready()) return;
  pollTimer = setInterval(async () => {
    if (document.hidden) return;
    const open = requests.filter((r) => r.stage < 4).slice(0, 12);
    if (!open.length && !TECH) return;
    try {
      if (TECH) { if (!$('#v-tech').hidden) renderTech(); return; }
      const list = open.map((r) => '"' + r.no + '"').join(',');
      const rows = await DB.req('requests?select=no,stage,tech_name&no=in.(' + encodeURIComponent(list) + ')');
      (rows || []).forEach((row) => onLiveChange({ record: row }));
    } catch (e) { /* offline — try again next tick */ }
  }, 45000);
}

/* ── 3. admin: announcements editor ─────────────────────── */

function admAnn() {
  const list = CFG.announcements || [];
  return `<p class="fine mb">${esc(T('ann.hint'))}</p>
  <div class="adm-list">
    ${list.map((a, i) => `<div class="adm-item ann-edit">
      <input class="adm-name" value="${esc(a.title || '')}" data-ak="title" data-i="${i}" placeholder="${esc(T('ann.titlePh'))}">
      <input class="adm-date" value="${esc(a.date || '')}" data-ak="date" data-i="${i}" placeholder="${esc(T('ann.datePh'))}">
      <textarea class="adm-body" rows="2" data-ak="body" data-i="${i}" placeholder="${esc(T('ann.bodyPh'))}">${esc(a.body || '')}</textarea>
      <div class="adm-ops">
        <button type="button" data-act="aup"   data-i="${i}" aria-label="${esc(T('a11y.up'))}">↑</button>
        <button type="button" data-act="adown" data-i="${i}" aria-label="${esc(T('a11y.down'))}">↓</button>
        <button type="button" data-act="adel"  data-i="${i}" class="dl" aria-label="${esc(T('a11y.del'))}">✕</button>
      </div>
    </div>`).join('')}
  </div>
  <button class="btn btn-quiet btn-block mt" type="button" data-act="addann">${esc(T('ann.add'))}</button>
  <div class="note-box"><b>${esc(T('ann.langsT'))}</b><p>${esc(T('ann.langsB'))}</p></div>`;
}
