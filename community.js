/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — تتبّع الطلب · آراء السكان · تحكّم الإدارة
   ══════════════════════════════════════════════════════════════ */

/* ── 1. تتبّع طلب برقمه ───────────────────────────────────
   أي حد يكتب رقم الطلب ويشوف وصل لحد فين، حتى لو من
   موبايل تاني أو من غير ما يكون هو اللي سجّله.            */

async function trackRequest(no) {
  const box = $('#trackResult');
  const q = String(no || '').trim().toUpperCase();

  if (!q) { box.innerHTML = ''; box.hidden = true; return; }

  box.hidden = false;
  box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`;

  let r = null;

  if (DB.ready()) {
    try {
      const rows = await DB.req('requests?select=*&no=eq.' + encodeURIComponent(q));
      if (rows && rows.length) r = fromRow(rows[0]);
    } catch (e) {
      box.innerHTML = `<div class="note-box warn"><b>${esc(T('err.net'))}</b></div>`;
      return;
    }
  }
  if (!r) r = requests.find((x) => x.no.toUpperCase() === q);

  if (!r) {
    box.innerHTML = `<div class="track-miss">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4M11 8v3.5M11 14.2v.1"/></svg>
      <b>${esc(T('track.none'))}</b>
      <span>${esc(T('track.noneB'))}</span>
    </div>`;
    return;
  }

  const s = svcById(r.svc);
  const c = colorOf(s);
  const p = CFG.priorities[r.prio] || CFG.priorities.normal;
  const stage = Math.min(r.stage | 0, STAGE_COUNT - 1);

  box.innerHTML = `<article class="track-card" data-p="${esc(r.prio)}">
    <div class="track-top">
      <span class="ic" style="background:${c.tint};color:${c.ink}">${svg(iconOf(s))}</span>
      <div class="track-h">
        <b>${esc(C(s, 'name'))}</b>
        <span>${esc(r.no)} · ${esc(T('lbl.building'))} ${num(esc(r.block))} / ${esc(T('lbl.flat'))} ${num(esc(r.flat))}</span>
      </div>
      ${stageChip(r.stage)}
    </div>

    <div class="track-rail" role="img" aria-label="${esc(T('stg.' + stage + 't'))}">
      ${Array.from({ length: STAGE_COUNT }, (_, i) => `
        <div class="tr-step ${i < stage ? 'done' : i === stage ? 'now' : ''}">
          <i></i><span>${esc(T('stg.' + i + 't'))}</span>
        </div>`).join('')}
    </div>

    <dl class="kv">
      <dt>${esc(T('det.wo'))}</dt><dd class="ltr">${esc(r.wo || '—')}</dd>
      <dt>${esc(T('wa.prio'))}</dt><dd>${esc(C(p, 'label'))} · ${esc(C(p, 'sla'))}</dd>
      ${r.tech_name ? `<dt>${esc(T('exp.tech'))}</dt><dd>${esc(r.tech_name)}</dd>` : ''}
      <dt>${esc(T('exp.date'))}</dt><dd>${esc(new Date(r.at).toLocaleString(locale()))}</dd>
    </dl>
  </article>`;
}

/* ── 2. آراء السكان ─────────────────────────────────────── */

let commentsCache = [];

async function loadComments() {
  const box = $('#cmList');
  if (!box) return;

  if (!DB.ready()) {
    box.innerHTML = `<div class="note-box warn"><b>${esc(T('cm.off'))}</b></div>`;
    return;
  }

  box.innerHTML = `<p class="fine center">${esc(T('loading'))}</p>`;
  try {
    commentsCache = await DB.req('comments?select=*&order=created_at.desc&limit=200') || [];
  } catch (e) {
    box.innerHTML = `<div class="note-box warn"><b>${esc(T('cm.needSql'))}</b></div>`;
    return;
  }

  const rows = commentsCache.filter((c) => isAdmin || !c.hidden);

  if (!rows.length) {
    box.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
        <path d="M20 4.5H4a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 16.5h3v4l4.5-4H20a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 20 4.5Z"/></svg>
      <b>${esc(T('cm.empty'))}</b><p>${esc(T('cm.emptyB'))}</p></div>`;
    return;
  }

  const avg = (() => {
    const r = rows.filter((c) => c.stars);
    return r.length ? (r.reduce((a, c) => a + c.stars, 0) / r.length).toFixed(1) : null;
  })();

  box.innerHTML = `
    ${avg ? `<div class="cm-avg"><b>${esc(avg)}</b><span>${starRow(Math.round(avg))}</span><em>${esc(T('cm.from').replace('{n}', num(rows.filter((c) => c.stars).length)))}</em></div>` : ''}
    ${rows.map((c) => `
      <article class="cm${c.hidden ? ' is-hidden' : ''}">
        <div class="cm-top">
          <span class="cm-av" aria-hidden="true">${esc((c.name || '?').trim().charAt(0))}</span>
          <div class="cm-h">
            <b>${esc(c.name)}</b>
            <span>${esc(new Date(c.created_at).toLocaleDateString(locale()))}${c.block ? ' · ' + esc(T('lbl.building')) + ' ' + num(esc(c.block)) : ''}</span>
          </div>
          ${c.stars ? `<span class="cm-stars">${starRow(c.stars)}</span>` : ''}
        </div>
        <p>${esc(c.body)}</p>
        ${c.reply ? `<div class="cm-reply"><b>${esc(T('cm.replyBy'))}</b><p>${esc(c.reply)}</p></div>` : ''}
        ${isAdmin ? `<div class="cm-admin">
          <button type="button" data-cmhide="${c.id}">${esc(T(c.hidden ? 'cm.show' : 'cm.hide'))}</button>
          <button type="button" data-cmreply="${c.id}">${esc(T('cm.reply'))}</button>
        </div>` : ''}
      </article>`).join('')}`;
}

const starRow = (n) => Array.from({ length: 5 }, (_, i) =>
  `<svg viewBox="0 0 24 24" class="st-i ${i < n ? 'on' : ''}" aria-hidden="true"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9Z" fill="currentColor"/></svg>`).join('');

let cmStars = 0;

function paintCmStars() {
  $('#cmStars').innerHTML = [1, 2, 3, 4, 5].map((i) =>
    `<button type="button" class="star ${i <= cmStars ? 'on' : ''}" data-cmstar="${i}" aria-label="${i}">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9Z"/></svg>
    </button>`).join('');
}

async function sendComment() {
  const name = $('#cmName').value.trim();
  const body = $('#cmBody').value.trim();

  if (name.length < 2 || body.length < 3) { toast(T('cm.fill')); return; }
  if (!DB.ready()) { toast(T('cm.off')); return; }

  const btn = $('#cmSend');
  btn.disabled = true;

  try {
    await DB.req('comments', {
      method: 'POST',
      body: JSON.stringify([{
        name, body,
        stars: cmStars || null,
        block: ($('#cmBlock').value || '').trim() || null,
        lang: LANG
      }])
    });
    $('#cmBody').value = '';
    cmStars = 0;
    paintCmStars();
    store.set('cmName', name);
    toast(T('cm.thanks'));
    loadComments();
  } catch (e) {
    toast(T('cm.needSql'));
  }
  btn.disabled = false;
}

async function cmHide(id) {
  const c = commentsCache.find((x) => String(x.id) === String(id));
  if (!c) return;
  try {
    await DB.req('comments?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ hidden: !c.hidden }) });
    loadComments();
  } catch (e) { toast(T('err.net')); }
}

async function cmReply(id) {
  const c = commentsCache.find((x) => String(x.id) === String(id));
  if (!c) return;
  const txt = prompt(T('cm.replyAsk'), c.reply || '');
  if (txt === null) return;
  try {
    await DB.req('comments?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ reply: txt.trim() || null }) });
    loadComments();
  } catch (e) { toast(T('err.net')); }
}

/* ── 3. تحكّم الإدارة في مراحل الطلب ────────────────────── */

async function adminSetStage(no, stage) {
  if (!DB.ready()) { toast(T('foot.local')); return; }
  try {
    await DB.setStage(no, stage);
    const local = requests.find((x) => x.no === no);
    if (local) { local.stage = stage; store.set('requests', requests); }
    toast(T('tech.updated'));
    renderAdmin();
    renderCounters();
  } catch (e) { toast(T('err.net')); }
}

function stageSelect(r) {
  return `<select class="stage-sel" data-setstage="${esc(r.no)}" aria-label="${esc(T('exp.stage'))}">
    ${Array.from({ length: STAGE_COUNT }, (_, i) =>
      `<option value="${i}"${i === (r.stage | 0) ? ' selected' : ''}>${esc(T('stg.' + i + 't'))}</option>`).join('')}
  </select>`;
}

/* ── 4. wiring ──────────────────────────────────────────── */

function initCommunity() {
  const saved = store.get('cmName', '');
  if (saved && $('#cmName')) $('#cmName').value = saved;
  paintCmStars();

  $('#trackGo').addEventListener('click', () => trackRequest($('#trackNo').value));
  $('#trackNo').addEventListener('keydown', (e) => { if (e.key === 'Enter') trackRequest($('#trackNo').value); });
  $('#trackNo').addEventListener('input', (e) => { if (!e.target.value.trim()) { $('#trackResult').hidden = true; } });
  $('#cmSend').addEventListener('click', sendComment);

  document.addEventListener('click', (e) => {
    const st = e.target.closest('[data-cmstar]');
    if (st) { cmStars = Number(st.dataset.cmstar); paintCmStars(); return; }
    const h = e.target.closest('[data-cmhide]');
    if (h) { cmHide(h.dataset.cmhide); return; }
    const rp = e.target.closest('[data-cmreply]');
    if (rp) { cmReply(rp.dataset.cmreply); return; }
  });

  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-setstage]');
    if (sel) adminSetStage(sel.dataset.setstage, Number(sel.value));
  });
}
