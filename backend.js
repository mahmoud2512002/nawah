/* ══════════════════════════════════════════════════════════════
   نواة المستقبل — طبقة الاتصال بقاعدة البيانات (Supabase)
   Backend layer. Everything the app needs from the server
   lives in these few functions — nothing else talks to the網.

   لو الاتصال فشل أو مفيش إعدادات، التطبيق يشتغل محلياً
   ويحفظ الطلبات على الجهاز لحد ما الاتصال يرجع.
   ══════════════════════════════════════════════════════════════ */

const DB = {
  url: '',
  key: '',

  init(cfg) {
    const b = (cfg && cfg.backend) || {};
    this.url = String(b.url || '').replace(/\/+$/, '');
    this.key = String(b.key || '');
    return this.ready();
  },

  ready() { return !!(this.url && this.key); },

  headers(extra) {
    return Object.assign({
      'apikey': this.key,
      'Authorization': 'Bearer ' + this.key,
      'Content-Type': 'application/json'
    }, extra || {});
  },

  async req(path, opts) {
    if (!this.ready()) throw new Error('backend-off');
    const res = await fetch(this.url + '/rest/v1/' + path, Object.assign({
      headers: this.headers(opts && opts.prefer ? { Prefer: opts.prefer } : null)
    }, opts));
    if (!res.ok) throw new Error('http-' + res.status + ' ' + (await res.text()).slice(0, 180));
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  },

  /* ── requests ─────────────────────────────────────── */

  // returns the saved row (with its server id)
  async addRequest(r) {
    const row = toRow(r);
    // return=minimal: الساكن بيسجّل بس — مالوش صلاحية يقرا الجدول
    await this.req('requests', { method: 'POST', body: JSON.stringify([row]), prefer: 'return=minimal' });
    return row;
  },

  /* ══ الوضع الآمن (security.sql) ══════════════════════════
     كل قراءة أو تعديل بيعدّي على دوال في السيرفر بتتأكد من
     جهاز الإدارة المعتمد أو الفني. لو الملف لسه ما اتشغّلش،
     بنرجع للطريقة القديمة عشان مفيش حاجة تقف. */
  secure: null,
  async sec(fn, args, legacy) {
    if (this.secure !== false) {
      try { const out = await this.rpc(fn, args); this.secure = true; return out; }
      catch (e) {
        if (!(legacy && /http-404/.test(String(e.message)))) throw e;
        this.secure = false;
      }
    }
    return legacy();
  },
  cred() {
    const d = (typeof DEVICE !== 'undefined' && DEVICE) || {};
    return { dev_id: d.id || null, dev_token: d.token || null };
  },
  tcred() {
    const t = (typeof TECH !== 'undefined' && TECH) || {};
    return { p_id: t.id || null, p_token: t.token || null };
  },
  asTech() { return typeof TECH !== 'undefined' && TECH && TECH.token && !(typeof isAdmin !== 'undefined' && isAdmin); },

  track(no) {
    return this.sec('track_request', { p_no: no },
      () => this.req('requests?select=*&no=eq.' + encodeURIComponent(no)));
  },
  status(nos) {
    return this.sec('requests_status', { p_nos: nos },
      () => this.req('requests?select=no,stage,tech_name,rating&no=in.(' + encodeURIComponent(nos.join(',')) + ')'));
  },

  // everything, newest first — for the admin archive
  async allRequests(limit) {
    return this.sec('admin_requests', Object.assign(this.cred(), { after_id: null, lim: limit || 500 }),
      () => this.req('requests?select=*&order=created_at.desc&limit=' + (limit || 500)));
  },

  // one resident's requests, matched on their phone number
  async myRequests(phone) {
    return this.req('requests?select=*&phone=eq.' + encodeURIComponent(phone) + '&order=created_at.desc');
  },

  // what one technician has been assigned — alone or with others on the same job
  async techRequests(techId) {
    const id = String(techId || '');
    const or = '(tech_id.eq.' + id + ',tech_id.like.*|' + id + '|*)';
    return this.sec('tech_tasks', this.tcred(),
      () => this.req('requests?select=*&or=' + encodeURIComponent(or) + '&stage=lt.4&order=created_at.desc'));
  },

  // الطلبات اللي وصلت بعد آخر طلب شافته الإدارة — بالرقم التسلسلي للسيرفر
  // (مش بالتاريخ، عشان ساعة موبايل الساكن ممكن تكون متأخرة)
  async newAfter(id) {
    return this.sec('admin_requests', Object.assign(this.cred(), { after_id: Number(id) || 0, lim: 50 }),
      () => this.req('requests?select=*&id=gt.' + (Number(id) || 0) + '&order=id.asc&limit=50'));
  },

  async one(no) {
    const rows = await this.sec('admin_request', Object.assign(this.cred(), { p_no: no }),
      () => this.req('requests?select=*&no=eq.' + encodeURIComponent(no)));
    return rows && rows[0];
  },

  async between(fromISO, toISO) {
    return this.sec('admin_requests_between', Object.assign(this.cred(), { p_from: fromISO, p_to: toISO }),
      () => this.req('requests?select=*&created_at=gte.' + fromISO + '&created_at=lte.' + toISO + '&order=created_at.asc'));
  },

  async patch(no, fields) {
    const legacy = () => {
      const f = Object.assign({}, fields, { updated_at: new Date().toISOString() });
      return this.req('requests?no=eq.' + encodeURIComponent(no), {
        method: 'PATCH', body: JSON.stringify(f), prefer: 'return=representation'
      });
    };
    return this.sec('admin_update_request', Object.assign(this.cred(), { p_no: no, p_patch: fields }), legacy);
  },

  setStage(no, stage, extra) {
    if (this.asTech() && !extra) {
      return this.sec('tech_set_stage', Object.assign(this.tcred(), { p_no: no, p_stage: stage }),
        () => this.patch(no, { stage }));
    }
    return this.patch(no, Object.assign({ stage }, extra || {}));
  },
  assign(no, techId, techName) { return this.patch(no, { tech_id: techId, tech_name: techName, stage: 1 }); },

  /* إسناد الطلب لفني أو أكثر — الإدارة بتختار من فنيي القسم */
  assignMany(no, techs, stage) {
    return this.patch(no, {
      tech_id: packTechs(techs.map((t) => t.id)),
      tech_name: techs.map((t) => t.name).join('، ') || null,
      stage: stage
    });
  },
  rate(no, stars, note, phone) {
    return this.sec('rate_request', { p_no: no, p_phone: phone || '', p_stars: stars, p_note: note || '' },
      () => this.patch(no, { rating: stars, rating_note: note || '' }));
  },

  /* ── الإدارة: كلمة المرور + الأجهزة + الفنيين + الآراء ── */
  adminCheck(pass)            { return this.rpc('admin_check', { pass: String(pass || '') }); },
  requestDevice(pass, id, nm) { return this.rpc('request_device', { pass: String(pass || ''), dev_id: id, dev_name: nm || '' }); },
  deviceState(id, token)      { return this.rpc('device_state', { dev_id: id, dev_token: token }); },
  approvePending(target)      { return this.rpc('approve_pending', Object.assign(this.cred(), { target })); },
  techList()                  { return this.rpc('tech_list', {}); },
  techLogin(id, pin)          { return this.rpc('tech_login', { p_id: id, p_pin: String(pin || '') }); },
  adminTechs()                { return this.rpc('admin_techs', this.cred()); },
  saveTech(t) {
    return this.rpc('admin_save_tech', Object.assign(this.cred(), {
      p_id: t.id, p_name: t.name || '', p_phone: t.phone || '', p_pin: String(t.pin || ''), p_svcs: t.svcs || []
    }));
  },
  deleteTech(id)              { return this.rpc('admin_delete_tech', Object.assign(this.cred(), { p_id: id })); },
  adminComments()             { return this.rpc('admin_comments', this.cred()); },
  adminComment(id, hidden, reply) {
    return this.rpc('admin_comment', Object.assign(this.cred(), { p_id: id, p_hidden: hidden, p_reply: reply }));
  },

  /* ── رقم الطلب: عدّاد مركزي لكل قسم ──────────────────
     الدالة في قاعدة البيانات بتزوّد العدّاد وترجّع الرقم في
     خطوة واحدة، فمستحيل رقمان يتكرّران حتى لو اتسجّل طلبان
     في نفس اللحظة من جهازين. */
  async nextNo(code) {
    const out = await this.req('rpc/next_req_no', {
      method: 'POST',
      body: JSON.stringify({ p: String(code || 'X') })
    });
    return typeof out === 'string' ? out : (out && out.next_req_no) || '';
  },

  /* ── أرشيف أوامر الشغل (PDF) ─────────────────────────
     كل أمر شغل يترفع ملف PDF في الـ bucket اسمه work-orders
     باسم رقم البحث: S12.pdf — الإعداد في work-orders.sql */
  pdfURL(name) {
    return this.url + '/storage/v1/object/public/work-orders/' + encodeURIComponent(name);
  },

  async uploadPDF(name, blob) {
    if (!this.ready()) throw new Error('backend-off');
    // اسم عشوائي محدش يقدر يخمّنه (S12-7f3a…pdf) — الرابط بيتحفظ جنب الطلب بس
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    name = String(name).replace(/\.pdf$/i, '') + '-' + rnd + '.pdf';
    const res = await fetch(this.url + '/storage/v1/object/work-orders/' + encodeURIComponent(name), {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': 'Bearer ' + this.key,
        'Content-Type': 'application/pdf',
        'cache-control': 'no-cache'
      },
      body: blob
    });
    if (!res.ok) throw new Error('upload-' + res.status);
    return this.pdfURL(name);
  },

  /* ── counters ─────────────────────────────────────── */

  async bumpVisits() {
    try {
      const out = await this.req('rpc/bump_visits', { method: 'POST', body: '{}' });
      return typeof out === 'number' ? out : (out && out.count) || 0;
    } catch (e) { return null; }
  },

  /* القفل الفوري — مخزّن في قاعدة البيانات مش في الملفات،
     فالتغيير بيوصل للناس على طول من غير نشر ولا كاش. */
  async isLocked() {
    try {
      const rows = await this.req('stats?select=value&key=eq.locked');
      return !!(rows && rows.length && Number(rows[0].value) === 1);
    } catch (e) { return null; }          // null = معرفناش، استخدم الملف
  },

  /* ── أجهزة الإدارة المعتمدة (admin-devices.sql) ── */
  rpc(fn, args) {
    return this.req('rpc/' + fn, { method: 'POST', body: JSON.stringify(args || {}) });
  },
  approveDevice(pass, id, name)  { return this.rpc('approve_device', { pass: String(pass || ''), dev_id: id, dev_name: name || '' }); },
  deviceOk(id, token)            { return this.rpc('device_ok', { dev_id: id, dev_token: token }); },
  listDevices(id, token, pass)   { return this.rpc('list_devices', { dev_id: id || null, dev_token: token || null, pass: pass || null }); },
  removeDevice(id, token, pass, target) {
    return this.rpc('remove_device', { dev_id: id || null, dev_token: token || null, pass: pass || null, target });
  },
  savePush(id, token, sub)       { return this.rpc('save_push', { dev_id: id, dev_token: token, sub }); },
  setLockDevice(id, token, flag) { return this.rpc('set_lock_device', { dev_id: id, dev_token: token, flag: !!flag }); },

  async setLock(flag, pass) {
    return this.req('rpc/set_lock', {
      method: 'POST',
      body: JSON.stringify({ flag: !!flag, pass: String(pass) })
    });
  },

  async stats() {
    try {
      const rows = await this.req('stats?select=*');
      const m = {};
      (rows || []).forEach((r) => { m[r.key] = r.value; });
      return m;
    } catch (e) { return null; }
  },

  /* ── live updates ─────────────────────────────────── */
  // Supabase realtime over websocket. Opened only for the admin and the
  // technician (residents poll their own requests instead), and it
  // reconnects by itself if the connection drops.
  _ws: null,
  _hb: null,
  _subs: [],

  live(onChange) {
    if (!this.ready() || !window.WebSocket) return null;
    if (onChange && this._subs.indexOf(onChange) < 0) this._subs.push(onChange);
    if (this._ws && this._ws.readyState <= 1) return this._ws;

    try {
      const host = this.url.replace(/^https?:\/\//, '');
      const ws = new WebSocket('wss://' + host + '/realtime/v1/websocket?apikey=' + this.key + '&vsn=1.0.0');
      this._ws = ws;
      let ref = 0;
      const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

      ws.onopen = () => {
        send({
          topic: 'realtime:public:requests', event: 'phx_join', ref: String(++ref),
          payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'requests' }] } }
        });
        clearInterval(this._hb);
        this._hb = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 28000);
      };
      ws.onmessage = (m) => {
        try {
          const d = JSON.parse(m.data);
          if (d.event === 'postgres_changes' && d.payload && d.payload.data) {
            this._subs.forEach((fn) => { try { fn(d.payload.data); } catch (e) {} });
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        clearInterval(this._hb);
        if (this._ws === ws) this._ws = null;
        if (this._subs.length) setTimeout(() => this.live(), 5000);   // رجّع الاتصال
      };
      return ws;
    } catch (e) { return null; }
  },

  unlive() {
    this._subs = [];
    clearInterval(this._hb);
    if (this._ws) { try { this._ws.close(); } catch (e) {} }
    this._ws = null;
  }
};

/* ── فني واحد أو أكثر على نفس الطلب ─────────────────────
   فني واحد يتخزّن زي ما هو (t1) عشان الطلبات القديمة تفضل شغالة،
   وأكتر من فني يتخزّنوا كده: |t1|t3|                        */
function packTechs(ids) {
  const list = (ids || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!list.length) return null;
  return list.length === 1 ? list[0] : '|' + list.join('|') + '|';
}
function techIdsOf(r) {
  return String((r && r.tech_id) || '').split('|').map((x) => x.trim()).filter(Boolean);
}

/* app shape → database row */
function toRow(r) {
  return {
    no: r.no, wo: r.wo, svc: r.svc, prio: r.prio,
    area: r.area, block: r.block, floor: r.floor || '', flat: r.flat,
    spot: r.spot || '', descr: r.desc || '', phone: r.phone,
    resident_name: r.name || '',
    stage: r.stage || 0,
    tech_id: r.tech_id || null, tech_name: r.tech_name || null,
    rating: r.rating || null, rating_note: r.rating_note || '',
    lang: r.lang || 'ar',
    created_at: r.at || new Date().toISOString()
  };
}

/* database row → app shape */
function fromRow(x) {
  return {
    id: x.id, no: x.no, wo: x.wo, svc: x.svc, prio: x.prio,
    area: x.area, block: x.block, floor: x.floor, flat: x.flat,
    spot: x.spot, desc: x.descr, phone: x.phone, name: x.resident_name,
    stage: x.stage || 0, tech_id: x.tech_id, tech_name: x.tech_name,
    rating: x.rating, rating_note: x.rating_note,
    at: x.created_at, shots: [], wo_pdf: x.wo_pdf || ''
  };
}

/* ── offline queue ──────────────────────────────────────
   A request is never lost: if the server is unreachable it
   waits here and is pushed the next time the app opens. */
const QUEUE = {
  all() { return store.get('queue', []); },
  add(r) { const q = this.all(); q.push(r); store.set('queue', q); },
  clear() { store.set('queue', []); },

  async flush() {
    if (!DB.ready()) return 0;
    const q = this.all();
    if (!q.length) return 0;
    const left = [];
    let sent = 0;
    for (const r of q) {
      try { await DB.addRequest(r); sent++; }
      catch (e) { left.push(r); }
    }
    store.set('queue', left);
    return sent;
  }
};
