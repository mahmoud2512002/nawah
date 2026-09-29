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
    const rows = await this.req('requests', {
      method: 'POST',
      body: JSON.stringify([toRow(r)]),
      prefer: 'return=representation'
    });
    return rows && rows[0];
  },

  // everything, newest first — for the admin archive
  async allRequests(limit) {
    return this.req('requests?select=*&order=created_at.desc&limit=' + (limit || 500));
  },

  // one resident's requests, matched on their phone number
  async myRequests(phone) {
    return this.req('requests?select=*&phone=eq.' + encodeURIComponent(phone) + '&order=created_at.desc');
  },

  // what one technician has been assigned
  async techRequests(techId) {
    return this.req('requests?select=*&tech_id=eq.' + encodeURIComponent(techId)
                    + '&stage=lt.4&order=created_at.desc');
  },

  async between(fromISO, toISO) {
    return this.req('requests?select=*&created_at=gte.' + fromISO
                    + '&created_at=lte.' + toISO + '&order=created_at.asc');
  },

  async patch(no, fields) {
    fields.updated_at = new Date().toISOString();
    return this.req('requests?no=eq.' + encodeURIComponent(no), {
      method: 'PATCH',
      body: JSON.stringify(fields),
      prefer: 'return=representation'
    });
  },

  setStage(no, stage, extra) { return this.patch(no, Object.assign({ stage }, extra || {})); },
  assign(no, techId, techName) { return this.patch(no, { tech_id: techId, tech_name: techName, stage: 1 }); },
  rate(no, stars, note) { return this.patch(no, { rating: stars, rating_note: note || '' }); },

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
    const res = await fetch(this.url + '/storage/v1/object/work-orders/' + encodeURIComponent(name), {
      method: 'POST',
      headers: {
        'apikey': this.key,
        'Authorization': 'Bearer ' + this.key,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true'
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
  // Supabase realtime over websocket; falls back silently.
  live(onChange) {
    if (!this.ready() || !window.WebSocket) return null;
    try {
      const host = this.url.replace(/^https?:\/\//, '');
      const ws = new WebSocket('wss://' + host + '/realtime/v1/websocket?apikey=' + this.key + '&vsn=1.0.0');
      let ref = 0;
      const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

      ws.onopen = () => {
        send({
          topic: 'realtime:public:requests', event: 'phx_join', ref: String(++ref),
          payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'requests' }] } }
        });
        setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 28000);
      };
      ws.onmessage = (m) => {
        try {
          const d = JSON.parse(m.data);
          if (d.event === 'postgres_changes' && d.payload && d.payload.data) onChange(d.payload.data);
        } catch (e) {}
      };
      return ws;
    } catch (e) { return null; }
  }
};

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
    no: x.no, wo: x.wo, svc: x.svc, prio: x.prio,
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
