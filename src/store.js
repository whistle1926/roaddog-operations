// State container: persistence, actions and derived selectors.
// The UI never mutates state directly; it calls store.actions.* which go through commit().
import { buildSeed, SEED_VERSION } from './data/seed.js';
import { quote, COUNTIES } from './pricing.js';
import { addDays, addMinutes, atTime, daysBetween, isToday, minutesBetween, sameDay, startOfDay, sum, uid, weekRange, isoWeek, fmtTime, fmtDate, toDate, isoLocalDateTime, parseLocalDateTime, round2 } from './util.js';

const KEY = 'roaddog.ops.state';
export const STATUSES = ['Unassigned', 'Assigned', 'Collected', 'On route', 'Delivered', 'Failed'];
export const STATUS_COLOR = { Unassigned: '#E4131F', Assigned: '#0F7DC2', Collected: '#C2700F', 'On route': '#0F7DC2', Delivered: '#1E8E5A', Failed: '#B0121C' };

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === SEED_VERSION) return parsed;
    }
  } catch (e) { console.warn('[store] could not read saved state, reseeding', e); }
  return buildSeed(new Date());
}

export function createStore() {
  let state = loadState();
  const listeners = new Set();
  let saveTimer = null;
  const drafts = { newJob: null, booking: null, fuel: null, invite: null, address: null, query: null, account: null, message: null, delivery: null };

  const now = () => new Date();

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('[store] save failed', e); }
    }, 120);
  }
  function notify() { listeners.forEach((fn) => fn(state)); }
  function commit(fn) { const r = fn(state); save(); notify(); return r; }

  // ---------- lookups ----------
  const jobById = (id) => state.jobs.find((j) => j.id === id);
  const vanById = (id) => state.vans.find((v) => v.id === id);
  const driverById = (id) => state.drivers.find((d) => d.id === id);
  const driverForVan = (vanId) => state.drivers.find((d) => d.van === vanId);
  const customerById = (id) => state.customers.find((c) => c.id === id);
  const invoiceById = (id) => state.invoices.find((i) => i.id === id);
  const automationOn = (id) => !!state.automations.find((a) => a.id === id)?.on;

  const activity = (job, text, at = now()) => { job.activity.push({ t: at.toISOString(), text }); };
  const sendMessage = (channel, to, text) => { state.messages.unshift({ id: uid('m'), at: now().toISOString(), channel, to, text }); };
  const toastQueue = [];
  const toast = (text, kind = '') => toastQueue.push({ text, kind });

  // ---------- derived ----------
  const openStatuses = new Set(['Unassigned', 'Assigned', 'Collected', 'On route']);
  const isOpen = (j) => openStatuses.has(j.status);
  const jobsToday = () => { const n = now(); return state.jobs.filter((j) => isToday(j.readyFrom, n) || isToday(j.createdAt, n) || isOpen(j)); };
  const unassigned = () => state.jobs.filter((j) => j.status === 'Unassigned').sort((a, b) => toDate(a.deliverBy) - toDate(b.deliverBy));
  const vanLoad = (vanId) => state.jobs.filter((j) => j.van === vanId && isOpen(j)).length;
  const etaFor = (j) => {
    if (j.eta) return toDate(j.eta);
    if (j.status === 'On route') return addMinutes(j.deliverBy, -8);
    if (j.status === 'Collected' || j.status === 'Assigned') return toDate(j.deliverBy);
    return null;
  };
  const isLate = (j) => { const n = now(); if (!isOpen(j) || j.status === 'Unassigned') return false; const e = etaFor(j); return (e && e > toDate(j.deliverBy)) || n > toDate(j.deliverBy); };
  const priceGross = (j) => round2(j.price * (1 + (j.vatPct ?? 23) / 100));

  function kpis() {
    const n = now();
    const today = jobsToday();
    const open = today.filter(isOpen).length;
    const closed = today.filter((j) => !isOpen(j)).length;
    const un = unassigned();
    const oldest = un.length ? minutesBetween(un.reduce((a, j) => (toDate(j.createdAt) < toDate(a.createdAt) ? j : a)).createdAt, n) : 0;
    const onRoad = state.vans.filter((v) => v.status === 'active' && driverForVan(v.id)?.shift).length;
    const off = state.vans.filter((v) => v.status !== 'active').map((v) => v.id);
    const delivered = today.filter((j) => j.status === 'Delivered');
    const finished = today.filter((j) => j.status === 'Delivered' || j.status === 'Failed');
    const onTimeCount = delivered.filter((j) => !j.deliveredAt || toDate(j.deliveredAt) <= toDate(j.deliverBy)).length;
    const onTime = finished.length ? Math.round((onTimeCount / finished.length) * 100) : 100;
    const revenue = sum(today.filter((j) => j.status !== 'Failed'), (j) => j.price);
    return { total: today.length, open, closed, unassigned: un.length, oldestMin: oldest, onRoad, vans: state.vans.length, off, onTime, revenue, drops: delivered.length };
  }

  function lanes(byVan) {
    const jobs = jobsToday().filter((j) => j.status !== 'Unassigned');
    if (byVan) {
      return state.vans.map((v) => {
        const d = driverForVan(v.id);
        const list = jobs.filter((j) => j.van === v.id).sort((a, b) => toDate(a.deliverBy) - toDate(b.deliverBy));
        return { key: v.id, title: `${v.id} · ${d ? d.name.split(' ')[0] : 'no driver'}`, kind: 'van', jobs: list, vanId: v.id };
      }).filter((l) => l.jobs.length);
    }
    return ['Assigned', 'Collected', 'On route', 'Delivered', 'Failed'].map((st) => ({ key: st, title: st, kind: st === 'Failed' ? 'failed' : 'grey', jobs: jobs.filter((j) => j.status === st) }));
  }
  const idleVans = () => state.vans.filter((v) => v.status === 'active' && !state.jobs.some((j) => j.van === v.id && isOpen(j)));

  function invoiceState(inv) {
    const n = now();
    if (inv.status === 'Paid') return { label: 'Paid', color: 'green' };
    if (inv.status === 'Draft') return { label: 'Draft — ready', color: 'amber' };
    if (inv.status === 'Notified') return { label: 'Payment notified', color: 'blue' };
    const late = daysBetween(inv.dueAt, n);
    if (late > 0) return { label: `Overdue ${late}d`, color: 'red', overdueDays: late };
    return { label: inv.status === 'Sent' ? 'Sent' : inv.status, color: 'blue' };
  }
  const invoiceGross = (inv) => round2(inv.net + inv.vat);
  const readyToBill = () => state.jobs.filter((j) => j.status === 'Delivered' && j.pod && !j.invoiceId);
  const customerOutstanding = (cid) => sum(state.invoices.filter((i) => i.customerId === cid && (i.status === 'Sent' || i.status === 'Notified')), invoiceGross);
  const customerMtd = (cid) => { const n = now(); return sum(state.jobs.filter((j) => j.customerId === cid && j.status !== 'Failed' && toDate(j.readyFrom).getMonth() === n.getMonth() && toDate(j.readyFrom).getFullYear() === n.getFullYear()), (j) => j.price); };
  const customerJobs = (cid) => state.jobs.filter((j) => j.customerId === cid).sort((a, b) => toDate(b.readyFrom) - toDate(a.readyFrom));

  function complianceItems() {
    const n = now();
    const out = [];
    state.vans.forEach((v) => {
      const tax = daysBetween(n, v.taxDue); const cvrt = daysBetween(n, v.cvrtDue);
      if (tax < 30) out.push({ van: v.id, what: 'motor tax', days: tax });
      if (cvrt < 30) out.push({ van: v.id, what: 'CVRT', days: cvrt });
      if (v.serviceDueKm < 0) out.push({ van: v.id, what: 'service', days: -1, overdueKm: -v.serviceDueKm });
    });
    return out;
  }

  function alerts() {
    const n = now();
    const list = [];
    unassigned().forEach((j) => { const m = minutesBetween(j.createdAt, n); if (m >= 20) list.push({ id: `unassigned:${j.id}`, kind: 'unassigned', color: 'amber', title: `${j.ref} unassigned ${m} min · ${j.customer}`, detail: `Due ${fmtTime(j.deliverBy)} · ${j.to.name}. Nobody has picked it up.`, at: j.createdAt, action: 'Assign a van →', screen: 'dispatch', jobId: j.id }); });
    state.jobs.filter((j) => j.status === 'Failed' && isToday(j.pod?.at || j.readyFrom, n) && !j.rebookedAs).forEach((j) => list.push({ id: `failed:${j.id}`, kind: 'failed', color: 'red', title: `${j.ref} failed · ${j.customer}`, detail: `${j.failReason || 'Delivery failed'} at ${j.to.town}. Goods back on ${j.van || 'van'}.`, at: j.pod?.at || j.readyFrom, action: 'Re-book for tomorrow AM →', jobId: j.id }));
    state.vans.filter((v) => v.pos?.state === 'Idle' && minutesBetween(v.pos.since, n) >= 20).forEach((v) => { const d = driverForVan(v.id); const m = minutesBetween(v.pos.since, n); list.push({ id: `idle:${v.id}`, kind: 'idle', color: 'amber', title: `${v.id} idle ${m} minutes`, detail: `${d ? d.name.split(' ')[0] : 'Driver'} stopped at ${v.pos.at} with ${vanLoad(v.id)} drops left — run finished early?`, at: v.pos.since, action: 'Message driver →', vanId: v.id }); });
    state.jobs.filter((j) => isLate(j)).forEach((j) => { const e = etaFor(j); list.push({ id: `late:${j.id}`, kind: 'late', color: 'amber', title: `${j.ref} running late`, detail: `${j.to.name} delivery now ETA ${e ? fmtTime(e) : '—'}, promised by ${fmtTime(j.deliverBy)}.`, at: j.readyFrom, action: `Notify ${j.customer} →`, jobId: j.id }); });
    complianceItems().forEach((c) => { const overdue = c.days < 0; list.push({ id: `comp:${c.van}:${c.what}`, kind: 'compliance', color: overdue ? 'red' : 'amber', title: `${c.van} ${c.what} ${overdue ? 'overdue' : `due in ${c.days} days`}`, detail: overdue ? (c.what === 'service' ? `Service interval passed by ${c.overdueKm} km.` : `Certificate expired ${fmtDate(addDays(n, c.days))}. Van must stay off road.`) : `Book ${c.what} before ${fmtDate(addDays(n, c.days))}.`, at: atTime(n, 9), action: 'Open fleet record →', vanId: c.van }); });
    state.invoices.forEach((i) => { const st = invoiceState(i); if (st.overdueDays >= 7 && !i.reminderAt) { const c = customerById(i.customerId); list.push({ id: `overdue:${i.id}`, kind: 'overdue', color: 'red', title: `${c?.short || i.customerId} ${moneyPlain(invoiceGross(i))} overdue ${st.overdueDays}d`, detail: `${i.id} · second reminder not yet sent${automationOn('reminder') ? '' : ' — automation is off'}.`, at: atTime(n, 8, 10), action: 'Send reminder →', invoiceId: i.id }); } });
    state.invoices.filter((i) => i.status === 'Notified').forEach((i) => { const c = customerById(i.customerId); list.push({ id: `notified:${i.id}`, kind: 'notified', color: 'blue', title: `${c?.short} says ${i.id} is paid`, detail: `Customer sent a bank transfer for ${moneyPlain(invoiceGross(i))}. Waiting for the AIB feed to match it.`, at: i.notifiedAt, action: 'Confirm payment →', invoiceId: i.id }); });
    state.queries.filter((q) => !q.resolved).forEach((q) => { const c = customerById(q.customerId); list.push({ id: `query:${q.id}`, kind: 'query', color: 'blue', title: `Query from ${c?.short} · ${q.ref || 'general'}`, detail: q.text, at: q.at, action: 'Mark handled →', queryId: q.id }); });
    return list.filter((a) => !state.dismissedAlerts.includes(a.id)).sort((a, b) => toDate(b.at) - toDate(a.at));
  }
  const moneyPlain = (n) => '€' + Math.round(n).toLocaleString('en-IE');

  function payrollRows() {
    const n = now();
    const seeded = toDate(state.seededAt);
    return state.drivers.map((d) => {
      const live = d.shift && toDate(d.shift.startedAt) > seeded ? minutesBetween(d.shift.startedAt, n) / 60 : (d.shift ? Math.max(0, minutesBetween(seeded, n)) / 60 : 0);
      const hours = round2(d.weekHours + live);
      const liveDrops = state.jobs.filter((j) => j.van === d.van && j.status === 'Delivered' && j.deliveredAt && toDate(j.deliveredAt) > seeded).length;
      const drops = d.weekDrops + liveDrops;
      const expenses = round2(sum(d.expenses, (e) => e.amount));
      const pay = round2(hours * state.settings.payRate + expenses);
      return { driver: d, hours, drops, expenses, pay, onTime: d.onTime };
    });
  }
  const weekKey = () => { const n = now(); return `${n.getFullYear()}-W${isoWeek(n)}`; };

  function chart() {
    const n = now();
    const today = jobsToday();
    const late = today.filter((j) => j.status === 'Failed' || (j.status === 'Delivered' && j.deliveredAt && toDate(j.deliveredAt) > toDate(j.deliverBy))).length;
    return [...state.dailyHistory.map((d) => ({ ...d, day: toDate(d.day) })), { day: n, jobs: today.length, late, today: true }];
  }
  const pods = () => state.jobs.filter((j) => j.pod).sort((a, b) => toDate(b.pod.at) - toDate(a.pod.at));

  function driverRun(driverId) {
    const d = driverById(driverId);
    if (!d) return { driver: null, current: null, queue: [] };
    const mine = state.jobs.filter((j) => j.van === d.van && isOpen(j)).sort((a, b) => {
      const rank = { 'On route': 0, Collected: 1, Assigned: 2 };
      return (rank[a.status] - rank[b.status]) || (toDate(a.deliverBy) - toDate(b.deliverBy));
    });
    return { driver: d, van: vanById(d.van), current: mine[0] || null, queue: mine.slice(1), doneToday: state.jobs.filter((j) => j.van === d.van && (j.status === 'Delivered' || j.status === 'Failed') && isToday(j.deliveredAt || j.pod?.at || j.readyFrom, now())).length };
  }

  // ---------- drafts ----------
  function newJobDraft(customerId) {
    const c = customerById(customerId) || state.customers[0];
    const n = now();
    return { customerId: c.id, service: 'Same-day urgent', fromAddr: `${c.short}, ${c.town}`, toName: '', toAddr: '', toCounty: 'Dublin', km: '', readyFrom: isoLocalDateTime(addMinutes(n, 30)), deliverBy: isoLocalDateTime(atTime(n, 18)), pieces: '', weightKg: '', stops: 1, pallets: 1, tailLift: false, contact: `${c.contact} · ${c.phone}`, po: '', notes: '', van: null, errors: {} };
  }
  function bookingDraft(customerId, addr) {
    const c = customerById(customerId);
    const n = now();
    const coll = c.addresses.find((a) => a.tag === 'COLLECTION');
    return { service: c.prefs?.defaultService || 'Same-day urgent', fromAddr: coll ? `${coll.addr}, ${coll.town}` : `${c.town}`, toName: addr?.name || '', toAddr: addr ? `${addr.addr}, ${addr.town}` : '', toCounty: addr?.county || 'Dublin', contact: `${c.contact} · ${c.phone}`, readyFrom: isoLocalDateTime(addMinutes(n, 45)), pieces: '', weightKg: '', stops: 1, pallets: 1, tailLift: false, po: '', notes: addr?.note || '', errors: {} };
  }
  function quoteDraft(d, customerId) {
    const c = customerById(customerId);
    return quote({ service: d.service, county: d.toCounty, km: d.km, weightKg: d.weightKg, stops: d.stops, pallets: d.pallets, tailLift: d.tailLift, readyFrom: parseLocalDateTime(d.readyFrom), discountPct: c?.discountPct || 0, contractRate: c?.contractRate }, { vatPct: state.settings.invoicing.vatPct, fuelSurchargePct: state.settings.invoicing.fuelSurchargePct });
  }
  function validateJobDraft(d, { requirePo = false } = {}) {
    const errors = {};
    if (!d.toAddr?.trim()) errors.toAddr = 'Delivery address is required';
    if (!COUNTIES[d.toCounty]) errors.toCounty = 'Pick a destination county';
    if (!d.pieces?.trim()) errors.pieces = 'What are we carrying?';
    const rf = parseLocalDateTime(d.readyFrom); const db = d.deliverBy ? parseLocalDateTime(d.deliverBy) : null;
    if (!rf) errors.readyFrom = 'Ready-from time is required';
    if (d.deliverBy !== undefined && (!db || (rf && db <= rf))) errors.deliverBy = 'Deliver-by must be after ready-from';
    if (requirePo && !d.po?.trim()) errors.po = 'Your account requires a PO number';
    if (d.weightKg !== '' && (Number.isNaN(Number(d.weightKg)) || Number(d.weightKg) < 0)) errors.weightKg = 'Weight must be a number';
    return errors;
  }
  function createJobFromDraft(d, { customerId, source, van }) {
    const c = customerById(customerId);
    const q = quoteDraft(d, customerId);
    const n = now();
    const rf = parseLocalDateTime(d.readyFrom);
    const db = d.deliverBy ? parseLocalDateTime(d.deliverBy) : defaultDeliverBy(d.service, rf);
    const ref = `RD-${state.counters.ref++}`;
    const job = {
      id: uid('job'), ref, customerId: c.id, customer: c.short,
      from: { name: c.short, addr: d.fromAddr, town: c.town, county: c.county }, to: { name: d.toName || d.toAddr.split(',')[0], addr: d.toAddr, town: d.toAddr.split(',').slice(-1)[0].trim(), county: d.toCounty },
      service: d.service, pieces: d.pieces + (d.weightKg ? ` · ${d.weightKg} kg` : ''), weightKg: Number(d.weightKg) || 0, stops: Number(d.stops) || 1, pallets: Number(d.pallets) || 0, tailLift: !!d.tailLift,
      zone: q.zone, km: q.km, price: q.net, vatPct: q.vatPct, quote: q,
      readyFrom: rf.toISOString(), deliverBy: db.toISOString(), windowType: 'by', status: van ? 'Assigned' : 'Unassigned', van: van || null, createdAt: n.toISOString(),
      source, po: d.po || '', notes: d.notes || '', contact: d.contact || c.contact, activity: [], pod: null, failReason: null, invoiceId: null, collectedAt: null, deliveredAt: null, eta: null,
    };
    activity(job, source === 'portal' ? `Order placed via customer portal${d.po ? ' · PO ' + d.po : ''}` : 'Booked by phone at the Wexford desk', n);
    activity(job, `Auto-priced from ${q.zoneLabel.split(' · ')[0]} rate card · €${q.net.toFixed(2)}`, n);
    if (van) activity(job, `Assigned to ${van} by Paul`, n);
    if (automationOn('booking')) sendMessage('EMAIL', c.email, `Booking confirmed ${ref} · €${q.net.toFixed(2)} + VAT · ${d.service}`);
    state.jobs.unshift(job);
    return job;
  }
  function defaultDeliverBy(service, rf) {
    if (service === 'Next-day parcel') return atTime(addDays(rf, 1), 17);
    if (service === 'Contract run') return addMinutes(rf, 210);
    return addMinutes(rf, 240);
  }

  // ---------- actions ----------
  const actions = {
    setUI: (patch) => commit((s) => Object.assign(s.ui, patch)),
    setRole: (role) => commit((s) => Object.assign(s.ui, { role, modal: null, detail: null, selectedJobId: null })),
    go: (screen) => commit((s) => Object.assign(s.ui, { screen, detail: null, modal: null })),
    goPortal: (portalScreen) => commit((s) => Object.assign(s.ui, { portalScreen, ordered: null, bankModal: null })),
    selectJob: (id) => commit((s) => { s.ui.selectedJobId = id; s.ui.detail = null; }),
    closeDrawer: () => commit((s) => { s.ui.selectedJobId = null; }),
    openDetail: (kind, id) => commit((s) => { s.ui.detail = { kind, id }; s.ui.selectedJobId = null; }),
    closeDetail: () => commit((s) => { s.ui.detail = null; }),
    closeModal: () => commit((s) => { s.ui.modal = null; }),
    setSearch: (q) => commit((s) => { s.ui.search = q; if (q && s.ui.screen !== 'jobs') s.ui.screen = 'jobs'; }),
    toggleBoard: () => commit((s) => { s.ui.boardByVan = !s.ui.boardByVan; }),
    setJobFilter: (f) => commit((s) => { s.ui.jobFilter = f; }),
    setSettingsTab: (t) => commit((s) => { s.ui.settingsTab = t; }),
    setMapVan: (id) => commit((s) => { s.ui.mapVan = s.ui.mapVan === id ? null : id; }),
    dismissAlert: (id) => commit((s) => { if (!s.dismissedAlerts.includes(id)) s.dismissedAlerts.push(id); }),

    // --- jobs ---
    openNewJob: (customerId) => { drafts.newJob = newJobDraft(customerId || state.ui.portalCustomerId); commit((s) => { s.ui.modal = 'newjob'; s.ui.detail = null; }); },
    setDraft: (name, key, value) => { if (!drafts[name]) return; drafts[name][key] = value; if (drafts[name].errors) delete drafts[name].errors[key]; },
    setDraftAndRender: (name, key, value) => { actions.setDraft(name, key, value); notify(); },
    createJob: () => {
      const d = drafts.newJob; if (!d) return;
      const errors = validateJobDraft(d);
      if (Object.keys(errors).length) { d.errors = errors; notify(); return; }
      commit((s) => { const job = createJobFromDraft(d, { customerId: d.customerId, source: 'phone', van: d.van }); s.ui.modal = null; s.ui.screen = 'dispatch'; s.ui.selectedJobId = job.id; toast(`${job.ref} created${job.van ? ' · assigned to ' + job.van : ' · in unassigned queue'}`, 'ok'); });
      drafts.newJob = null;
    },
    assignJob: (jobId, vanId) => commit((s) => {
      const j = jobById(jobId); const v = vanById(vanId); if (!j || !v) return;
      if (v.status === 'offroad') { toast(`${v.id} is off road · cannot assign`, 'err'); return; }
      if (/cold chain|fridge/i.test(j.notes + ' ' + j.pieces) && !v.fridge) { toast(`${v.id} has no fridge · cold chain needs RD4 or RD7`, 'err'); return; }
      if (vanLoad(v.id) >= s.settings.capacity.maxDropsPerVan) { toast(`${v.id} is at the ${s.settings.capacity.maxDropsPerVan}-drop cap`, 'err'); return; }
      const prev = j.van; j.van = v.id;
      if (j.status === 'Unassigned') j.status = 'Assigned';
      activity(j, prev ? `Reassigned ${prev} → ${v.id} by Paul` : `Assigned to ${v.id} by Paul`);
      toast(`${j.ref} → ${v.id}`, 'ok');
    }),
    unassignJob: (jobId) => commit((s) => { const j = jobById(jobId); if (!j || j.status !== 'Assigned') return; activity(j, `Unassigned from ${j.van} by Paul`); j.van = null; j.status = 'Unassigned'; }),
    setStatus: (jobId, status, extra = {}) => commit((s) => {
      const j = jobById(jobId); if (!j) return;
      const n = now();
      const c = customerById(j.customerId);
      if (status === 'Collected') { j.status = 'Collected'; j.collectedAt = n.toISOString(); activity(j, `Collected · ${extra.note || 'barcode scanned'}`, n); }
      if (status === 'On route') { j.status = 'On route'; activity(j, 'Departed collection · on route', n); if (automationOn('onway')) sendMessage('SMS', `Consignee · ${j.to.town}`, `${j.ref} on its way · track: rd.ie/t/${j.ref.slice(3)}`); }
      if (status === 'Delivered') {
        j.status = 'Delivered'; j.deliveredAt = n.toISOString(); j.eta = null;
        const kind = [extra.photo && 'PHOTO', extra.signature && 'SIGNATURE'].filter(Boolean).join(' + ') || 'NOTE';
        j.pod = { signedBy: extra.receivedBy || 'Consignee', at: n.toISOString(), van: j.van, kind, gps: extra.gps || '52.5012, -6.5661', geofence: 'Yes · 18 m', photo: extra.photo || null, signature: extra.signature || null };
        activity(j, `Delivered · signed ${j.pod.signedBy}`, n);
        if (automationOn('pod') && c) { sendMessage('EMAIL', c.email, `POD for ${j.ref} · ${kind.toLowerCase()} attached`); activity(j, `POD emailed to ${c.email}`, n); }
        toast(`${j.ref} delivered · POD sent`, 'ok');
      }
      if (status === 'Failed') {
        j.status = 'Failed'; j.failReason = extra.reason || 'Could not deliver'; j.eta = null;
        j.pod = { signedBy: '—', at: n.toISOString(), van: j.van, kind: 'PHOTO + NOTE', note: j.failReason, gps: '52.5012, -6.5661', geofence: 'Yes · 18 m', photo: extra.photo || null };
        activity(j, `Failed · ${j.failReason}`, n); activity(j, `Goods back on ${j.van} · dispatch notified`, n);
        if (automationOn('failed') && c) sendMessage('SMS + EMAIL', c.email, `${j.ref} could not be delivered: ${j.failReason}. Reply to re-book.`);
        toast(`${j.ref} marked failed · dispatch alerted`, 'err');
      }
      s.ui.dStage = 'none'; s.ui.showFail = false;
    }),
    setStage: (stage) => commit((s) => { s.ui.dStage = stage; s.ui.showFail = false; }),
    toggleFail: () => commit((s) => { s.ui.showFail = !s.ui.showFail; }),
    toggleFuel: () => { drafts.fuel = { amount: '', type: 'Diesel', receipt: null }; commit((s) => { s.ui.showFuel = !s.ui.showFuel; }); },
    rebookFailed: (jobId) => commit((s) => {
      const j = jobById(jobId); if (!j) return;
      const n = now(); const rf = atTime(addDays(n, 1), 8); const db = atTime(addDays(n, 1), 12);
      const nj = { ...structuredClone(j), id: uid('job'), ref: `RD-${s.counters.ref++}`, status: 'Unassigned', van: null, createdAt: n.toISOString(), readyFrom: rf.toISOString(), deliverBy: db.toISOString(), windowType: 'by', activity: [], pod: null, failReason: null, collectedAt: null, deliveredAt: null, eta: null, price: round2(j.price * 0.5), rebookOf: j.ref };
      activity(nj, `Re-delivery of ${j.ref} · charged at 50%`, n);
      j.rebookedAs = nj.ref; activity(j, `Re-booked as ${nj.ref} for tomorrow AM`, n);
      s.jobs.unshift(nj); s.ui.screen = 'dispatch'; s.ui.selectedJobId = nj.id; toast(`${nj.ref} booked for tomorrow AM`, 'ok');
    }),
    notifyLate: (jobId) => commit((s) => { const j = jobById(jobId); const c = customerById(j?.customerId); if (!j || !c) return; const e = etaFor(j); sendMessage('SMS', c.phone, `${j.ref} running late · new ETA ${e ? fmtTime(e) : 'tbc'}. Sorry — Wexford desk`); activity(j, `Customer notified of late ETA`); s.dismissedAlerts.push(`late:${j.id}`); toast(`${c.short} notified by SMS`, 'ok'); }),

    // --- messaging / alerts ---
    openMessage: (vanId) => { const d = driverForVan(vanId); drafts.message = { driverId: d?.id, vanId, text: '' }; commit((s) => { s.ui.modal = 'message'; }); },
    sendDriverMessage: () => commit((s) => { const m = drafts.message; if (!m || !m.text.trim()) return; const d = driverById(m.driverId); sendMessage('PUSH', d ? d.name : m.vanId, m.text.trim()); s.ui.modal = null; s.dismissedAlerts.push(`idle:${m.vanId}`); toast(`Message pushed to ${d ? d.name.split(' ')[0] : m.vanId}`, 'ok'); drafts.message = null; }),
    resolveQuery: (id) => commit((s) => { const q = s.queries.find((x) => x.id === id); if (q) { q.resolved = true; q.resolvedAt = now().toISOString(); } }),
    toggleAutomation: (id) => commit((s) => { const a = s.automations.find((x) => x.id === id); if (a) a.on = !a.on; }),

    // --- invoicing ---
    runBilling: () => commit((s) => {
      const ready = readyToBill();
      if (!ready.length) { toast('Nothing to bill · every delivered job is already invoiced'); return; }
      const byCust = {}; ready.forEach((j) => (byCust[j.customerId] ||= []).push(j));
      const n = now();
      let count = 0;
      Object.entries(byCust).forEach(([cid, jobs]) => {
        const c = customerById(cid);
        const net = round2(sum(jobs, (j) => j.price));
        const linesMap = {}; jobs.forEach((j) => { linesMap[j.service] = (linesMap[j.service] || 0) + j.price; });
        const inv = { id: `DRAFT-${s.counters.draft++}`, customerId: cid, issuedAt: null, dueAt: null, net, vatPct: s.settings.invoicing.vatPct, vat: round2(net * s.settings.invoicing.vatPct / 100), status: 'Draft', paidAt: null, jobIds: jobs.map((j) => j.id), jobsCount: jobs.length, createdAt: n.toISOString(), lines: Object.entries(linesMap).map(([label, amount]) => ({ label: `${label} ×${jobs.filter((j) => j.service === label).length}`, amount: round2(amount) })), xero: 'Not yet synced', termsDays: c?.termsDays ?? s.settings.invoicing.termsDays };
        jobs.forEach((j) => { j.invoiceId = inv.id; });
        s.invoices.unshift(inv); count++;
      });
      toast(`${count} draft invoice${count > 1 ? 's' : ''} created from ${ready.length} jobs`, 'ok');
    }),
    sendInvoice: (id) => commit((s) => {
      const inv = invoiceById(id); if (!inv) return;
      const c = customerById(inv.customerId); const n = now();
      if (inv.status === 'Draft') { const newId = `INV-${s.counters.invoice++}`; s.jobs.forEach((j) => { if (j.invoiceId === inv.id) j.invoiceId = newId; }); inv.id = newId; inv.issuedAt = n.toISOString(); inv.dueAt = atTime(addDays(n, inv.termsDays ?? s.settings.invoicing.termsDays), 23, 59).toISOString(); inv.status = 'Sent'; inv.xero = 'Queued for nightly sync'; if (s.ui.detail?.kind === 'invoice') s.ui.detail.id = newId; }
      sendMessage('EMAIL', c?.email || '', `${inv.id} · €${invoiceGross(inv).toFixed(2)} due ${fmtDate(inv.dueAt)} · POD pack attached`);
      inv.sentAt = n.toISOString(); toast(`${inv.id} emailed to ${c?.short}`, 'ok');
    }),
    markPaid: (id) => commit((s) => { const inv = invoiceById(id); if (!inv) return; inv.status = 'Paid'; inv.paidAt = now().toISOString(); toast(`${inv.id} marked paid`, 'ok'); }),
    sendReminder: (id) => commit((s) => { const inv = invoiceById(id); const c = customerById(inv?.customerId); if (!inv) return; inv.reminderAt = now().toISOString(); sendMessage('EMAIL', c?.email || '', `Reminder · ${inv.id} €${invoiceGross(inv).toFixed(2)} was due ${fmtDate(inv.dueAt)}`); toast(`Reminder sent to ${c?.short}`, 'ok'); }),
    notifyPayment: (id) => commit((s) => { const inv = invoiceById(id); if (!inv || inv.status !== 'Sent') return; inv.status = 'Notified'; inv.notifiedAt = now().toISOString(); s.ui.bankModal = null; toast('Thanks — we will match your transfer when it lands', 'ok'); }),
    openBank: (id) => commit((s) => { s.ui.bankModal = id; }),
    closeBank: () => commit((s) => { s.ui.bankModal = null; }),

    // --- payroll / drivers ---
    approvePayroll: () => commit((s) => { const k = weekKey(); const rows = payrollRows(); s.payroll.approvedWeeks[k] = { at: now().toISOString(), total: round2(sum(rows, (r) => r.pay)) }; toast(`Payroll week ${k.split('-W')[1]} approved · sent to Xero`, 'ok'); }),
    toggleShift: (driverId) => commit((s) => {
      const d = driverById(driverId); if (!d) return;
      if (d.shift) { const mins = minutesBetween(d.shift.startedAt, now()); d.weekHours = round2(d.weekHours + (toDate(d.shift.startedAt) > toDate(s.seededAt) ? mins / 60 : Math.max(0, minutesBetween(s.seededAt, now())) / 60)); d.shift = null; toast(`Shift ended · ${Math.floor(mins / 60)}h ${mins % 60}m logged to payroll`); }
      else { d.shift = { startedAt: now().toISOString() }; toast('Clocked in · GPS tracking on', 'ok'); }
    }),
    submitExpense: (driverId) => {
      const f = drafts.fuel; const amount = Number(f?.amount);
      if (!f || !(amount > 0)) { if (f) f.error = 'Enter the receipt amount'; notify(); return; }
      commit((s) => { const d = driverById(driverId); if (!d) return; d.expenses.push({ id: uid('exp'), type: f.type, amount: round2(amount), at: now().toISOString(), receipt: f.receipt || null }); s.ui.showFuel = false; toast(`€${amount.toFixed(2)} ${f.type.toLowerCase()} expense → payroll`, 'ok'); });
      drafts.fuel = null;
    },
    setDriver: (driverId) => commit((s) => { s.ui.driverId = driverId; s.ui.dStage = 'none'; s.ui.showFail = false; s.ui.showFuel = false; }),

    // --- fleet ---
    setVanStatus: (vanId, status) => commit((s) => { const v = vanById(vanId); if (!v) return; v.status = status; if (status === 'offroad') { v.pos.state = 'Off road'; v.pos.speed = 0; } else if (v.pos.state === 'Off road') v.pos.state = 'Back at depot'; toast(`${v.id} ${status === 'offroad' ? 'marked off road' : 'back in service'}`); }),
    bookService: (vanId) => commit((s) => { const v = vanById(vanId); if (!v) return; v.serviceBooked = addDays(now(), 3).toISOString(); v.history.unshift({ at: now().toISOString(), what: `Service booked for ${fmtDate(v.serviceBooked)}` }); toast(`${v.id} service booked · ${fmtDate(v.serviceBooked)}`, 'ok'); }),

    // --- customers ---
    openAccount: () => { drafts.account = { name: '', contact: '', phone: '', email: '', town: '', terms: '30 day', discountPct: 0, poRequired: false, errors: {} }; commit((s) => { s.ui.modal = 'account'; }); },
    createAccount: () => {
      const d = drafts.account; if (!d) return;
      const errors = {}; if (!d.name.trim()) errors.name = 'Company name is required'; if (!d.contact.trim()) errors.contact = 'Contact name is required'; if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) errors.email = 'Enter a valid email';
      if (Object.keys(errors).length) { d.errors = errors; notify(); return; }
      commit((s) => { const id = uid('c'); s.customers.push({ id, name: d.name.trim(), short: d.name.trim().replace(/\s+(Ltd|Limited|Group|Intl)\.?$/i, ''), contact: d.contact.trim(), phone: d.phone, email: d.email, town: d.town || 'Wexford', county: 'Wexford', terms: d.terms, termsDays: d.terms === 'Prepay' ? 0 : d.terms === '14 day' ? 14 : 30, discountPct: Number(d.discountPct) || 0, rateNote: Number(d.discountPct) ? `Zone card −${d.discountPct}%` : 'Zone card', since: String(now().getFullYear()), poRequired: !!d.poRequired, creditLimit: d.terms === 'Prepay' ? 0 : 2500, notes: '', addresses: [], users: [], prefs: null }); s.ui.modal = null; s.ui.detail = { kind: 'customer', id }; toast(`${d.name} added`, 'ok'); });
      drafts.account = null;
    },

    // --- portal ---
    startBooking: (addr) => { drafts.booking = bookingDraft(state.ui.portalCustomerId, addr); commit((s) => { s.ui.portalScreen = 'book'; s.ui.ordered = null; }); },
    placeOrder: () => {
      const cid = state.ui.portalCustomerId; const c = customerById(cid);
      if (!drafts.booking) drafts.booking = bookingDraft(cid);
      const d = drafts.booking;
      const errors = validateJobDraft(d, { requirePo: c.poRequired });
      if (Object.keys(errors).length) { d.errors = errors; notify(); return; }
      commit((s) => { const job = createJobFromDraft(d, { customerId: cid, source: 'portal', van: null }); s.ui.ordered = job.ref; toast(`Order placed · ${job.ref}`, 'ok'); });
      drafts.booking = null;
    },
    resetOrder: () => { drafts.booking = null; commit((s) => { s.ui.ordered = null; }); },
    openInvite: () => { drafts.invite = { name: '', email: '', role: 'Booker', errors: {} }; commit((s) => { s.ui.modal = 'invite'; }); },
    inviteUser: () => {
      const d = drafts.invite; if (!d) return;
      const errors = {}; if (!d.name.trim()) errors.name = 'Name is required'; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) errors.email = 'Enter a valid email';
      if (Object.keys(errors).length) { d.errors = errors; notify(); return; }
      commit((s) => { const c = customerById(s.ui.portalCustomerId); c.users.push({ id: uid('u'), name: d.name.trim(), email: d.email.trim(), role: d.role, detail: { Admin: 'Books, sees prices and invoices', Booker: 'Books jobs, no invoice access', 'Billing only': 'Receives invoices and PODs' }[d.role], invited: true }); sendMessage('EMAIL', d.email, `You have been invited to the RoadDog portal for ${c.name}`); s.ui.modal = null; toast(`Invite sent to ${d.email}`, 'ok'); });
      drafts.invite = null;
    },
    openAddress: () => { drafts.address = { name: '', addr: '', town: '', county: 'Dublin', note: '', tag: 'DELIVERY', errors: {} }; commit((s) => { s.ui.modal = 'address'; }); },
    saveAddress: () => {
      const d = drafts.address; if (!d) return;
      const errors = {}; if (!d.name.trim()) errors.name = 'Give this address a name'; if (!d.addr.trim()) errors.addr = 'Address is required';
      if (Object.keys(errors).length) { d.errors = errors; notify(); return; }
      commit((s) => { const c = customerById(s.ui.portalCustomerId); c.addresses.push({ id: uid('a'), name: d.name.trim(), addr: d.addr.trim(), town: d.town.trim(), county: d.county, note: d.note.trim(), tag: d.tag }); s.ui.modal = null; toast('Address saved', 'ok'); });
      drafts.address = null;
    },
    raiseQuery: () => {
      const d = drafts.query; if (!d || !d.text?.trim()) { if (d) d.error = 'Tell us what happened'; notify(); return; }
      commit((s) => { s.queries.unshift({ id: uid('q'), customerId: s.ui.portalCustomerId, ref: d.ref?.trim() || '', text: d.text.trim(), at: now().toISOString(), resolved: false }); toast('Sent to the Wexford desk · we will ring you back', 'ok'); });
      drafts.query = { ref: '', text: '', sent: true };
    },

    // --- settings ---
    updateSetting: (path, value) => commit((s) => { const parts = path.split('.'); let o = s.settings; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; const k = parts[parts.length - 1]; o[k] = typeof o[k] === 'number' ? Number(value) : value; }),
    toggleIntegration: (name) => commit((s) => { const i = s.settings.integrations.find((x) => x.name === name); if (i) i.on = !i.on; }),
    resetDemo: () => { try { localStorage.removeItem(KEY); } catch {} state = buildSeed(new Date()); Object.keys(drafts).forEach((k) => { drafts[k] = null; }); save(); notify(); toast('Demo data reset', 'ok'); },
  };

  return {
    get state() { return state; },
    drafts, now, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    takeToasts: () => toastQueue.splice(0),
    actions, commit,
    sel: { jobById, vanById, driverById, driverForVan, customerById, invoiceById, jobsToday, unassigned, vanLoad, etaFor, isLate, isOpen, priceGross, kpis, lanes, idleVans, invoiceState, invoiceGross, readyToBill, customerOutstanding, customerMtd, customerJobs, complianceItems, alerts, payrollRows, weekKey, chart, pods, driverRun, quoteDraft, newJobDraft, bookingDraft, automationOn },
  };
}
