// Customer portal (business role).
import { esc, act, money, HIDDEN, fmtTime, fmtDate, fmtWhen, windowLabel, firstName, sum, initials, toDate } from '../util.js';
import { SERVICES, COUNTIES } from '../pricing.js';
import { fin, statusTag, brand, roleSwitch, navItem, field, checkbox, emptyRow, priceLines, kv } from './common.js';
import { modals } from './drawers.js';

const SUBS = { book: 'Priced instantly from your agreed zone rate card', track: 'Live van position and ETA on every open job', history: 'Every job you have booked with us, with proof of delivery attached', invoices: 'Statements, outstanding balance and payment details', pod: 'Signed dockets and delivery photos, kept 7 years', addresses: 'Saved collection and delivery points for one-tap booking', users: 'Who in your team can book, and what they can see', support: 'The Wexford desk, and how to reach a human fast' };
const TITLES = { book: 'Book a delivery', track: 'Track live jobs', history: 'Delivery history', invoices: 'Invoices', pod: 'POD documents', addresses: 'Address book', users: 'Users & settings', support: 'Support' };
const SERVICE_NOTES = { 'Same-day urgent': 'Collect within 60 min', 'Next-day parcel': 'Nationwide by 17:00', 'Multi-drop route': 'Up to 12 stops', 'Pallet freight': 'Up to 1,000 kg', 'Furniture removal': '2-man crew', 'Contract run': 'Recurring daily' };

export function portalView(store) {
  const { ui } = store.state; const s = store.sel; const n = store.now();
  const c = s.customerById(ui.portalCustomerId);
  const jobs = s.customerJobs(c.id);
  const live = jobs.filter(s.isOpen);
  const open = store.state.invoices.filter((i) => i.customerId === c.id && (i.status === 'Sent' || i.status === 'Notified'));
  const balance = sum(open, s.invoiceGross);
  const nav = [['book', 'Book a delivery', 0], ['track', 'Track live jobs', live.length], ['history', 'Delivery history', 0], ['invoices', 'Invoices', open.length], ['pod', 'POD documents', 0], ['addresses', 'Address book', 0], ['users', 'Users & settings', 0], ['support', 'Support', 0]];
  const screens = { book, track, history, invoices, pod, addresses, users, support };
  const admin = c.users[0];
  return `<div class="layout portal">
    <aside class="sidebar portal">
      ${brand('Customer portal')}
      <nav class="nav">${nav.map(([k, l, b]) => navItem(l, ui.portalScreen === k, b, 'goPortal', k, 'blue')).join('')}</nav>
      <div class="side-foot">
        <div class="who"><div class="avatar" style="background:#0F7DC2">${initials(admin?.name || c.contact)}</div><div class="col" style="gap:0"><span class="name">${esc(admin?.name || c.contact)}</span><span class="role">${esc(c.id.replace('c_', '').toUpperCase().slice(0, 3))}-014 · ${esc((admin?.role || 'admin').toUpperCase())}</span></div></div>
        <div class="col" style="gap:5px"><span class="viewas">VIEW AS</span>${roleSwitch(store)}</div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar" style="padding:0 24px">
        <div class="col" style="gap:0; flex:none"><h1>${esc(TITLES[ui.portalScreen])}</h1><span class="subtitle">${esc(SUBS[ui.portalScreen])}</span></div>
        <div class="grow"></div>
        <div class="col" style="align-items:flex-end; gap:0; flex:none"><span style="font-size:15px; font-weight:600; color:#3C444D">${esc(c.name)}</span><span class="mono xs muted">${esc(c.terms)} terms · balance ${fin(store, balance)}</span></div>
      </header>
      <div class="content portal" data-scroll="portal-${ui.portalScreen}">${(screens[ui.portalScreen] || book)(store, c, jobs)}</div>
    </div>
  </div>
  ${bankModal(store, c)}
  ${modals(store)}`;
}

function stepsFor(j) {
  const order = ['Assigned', 'Collected', 'On route', 'Delivered'];
  const idx = j.status === 'Unassigned' ? 0 : j.status === 'Failed' ? 3 : order.indexOf(j.status) + 1; // number of completed steps
  return [0, 1, 2, 3].map((i) => {
    if (j.status === 'Failed' && i === 3) return 'fail';
    if (i < idx) return 'done';
    if (i === idx && j.status !== 'Delivered') return 'now';
    return '';
  });
}
const myJob = (store, j, lg = false) => {
  const s = store.sel; const eta = s.etaFor(j); const n = store.now();
  return `<div class="myjob ${lg ? 'lg' : ''}">
    <div class="row between"><span class="ref">${esc(j.ref)}</span>${statusTag(j.status)}</div>
    <span class="route">${esc(j.from.town)} → ${esc(j.to.name)}</span>
    <div class="row" style="gap:14px"><span class="mono xs muted">${j.van ? `Van ${j.van}` : 'Awaiting van'}</span><span class="mono xs muted">${j.status === 'Delivered' ? `Delivered ${fmtTime(j.deliveredAt)}` : `ETA ${eta ? (toDate(eta).getDate() !== n.getDate() ? windowLabel(j, n) : fmtTime(eta)) : windowLabel(j, n)}`}</span>${j.po ? `<span class="mono xs muted">${esc(j.po)}</span>` : ''}</div>
    <div class="steps">${stepsFor(j).map((cls) => `<div class="s ${cls}"></div>`).join('')}</div>
    ${lg ? '<div class="step-lbls"><span>BOOKED</span><span>COLLECTED</span><span>ON ROUTE</span><span>DELIVERED</span></div>' : ''}
  </div>`;
};

function book(store, c, jobs) {
  const s = store.sel; const { ui } = store.state; const show = store.state.settings.showFinancials;
  if (!store.drafts.booking) store.drafts.booking = s.bookingDraft(c.id);
  const d = store.drafts.booking;
  const q = s.quoteDraft(d, c.id);
  const multi = d.service === 'Multi-drop route'; const pallet = d.service === 'Pallet freight';
  const live = jobs.filter((j) => s.isOpen(j) || (j.status === 'Delivered' && j.deliveredAt && toDate(j.deliveredAt) > new Date(store.now() - 86400000 * 3))).slice(0, 4);
  const mtd = s.customerMtd(c.id); const monthJobs = jobs.filter((j) => toDate(j.readyFrom).getMonth() === store.now().getMonth()).length;
  const nextInv = store.state.invoices.filter((i) => i.customerId === c.id && i.status === 'Sent').sort((a, b) => toDate(a.dueAt) - toDate(b.dueAt))[0];
  return `<div class="portal-grid">
    <div class="card"><form class="stack g16" style="padding:18px" data-submit="placeOrder">
      <div class="field"><span class="lbl">Service</span><div class="row wrap">${SERVICES.map((sv) => `<button type="button" class="opt ${d.service === sv ? 'on' : ''}" ${act('draftSet', { name: 'booking', key: 'service', value: sv })}>${sv}<span class="note">${SERVICE_NOTES[sv]}</span></button>`).join('')}</div></div>
      <div class="form-grid">
        ${field({ id: 'bk-from', label: 'Collection address', bind: 'booking.fromAddr', value: d.fromAddr, span2: true, live: false })}
        ${field({ id: 'bk-toName', label: 'Deliver to (name)', bind: 'booking.toName', value: d.toName, placeholder: 'Site or consignee', live: false })}
        ${field({ id: 'bk-county', label: 'Destination county', bind: 'booking.toCounty', value: d.toCounty, options: Object.keys(COUNTIES), error: d.errors.toCounty })}
        ${field({ id: 'bk-toAddr', label: 'Delivery address', bind: 'booking.toAddr', value: d.toAddr, error: d.errors.toAddr, span2: true, live: false, placeholder: 'Street, town, Eircode' })}
        ${field({ id: 'bk-contact', label: 'Contact on site', bind: 'booking.contact', value: d.contact, live: false })}
        ${field({ id: 'bk-ready', label: 'Ready from', bind: 'booking.readyFrom', value: d.readyFrom, type: 'datetime-local', error: d.errors.readyFrom })}
        ${field({ id: 'bk-pieces', label: 'Pieces', bind: 'booking.pieces', value: d.pieces, error: d.errors.pieces, placeholder: '2 boxes', live: false })}
        ${field({ id: 'bk-weight', label: 'Weight kg', bind: 'booking.weightKg', value: d.weightKg, type: 'number', min: 0, error: d.errors.weightKg })}
        ${multi ? field({ id: 'bk-stops', label: 'Stops', bind: 'booking.stops', value: d.stops, type: 'number', min: 1 }) : ''}
        ${pallet ? field({ id: 'bk-pallets', label: 'Pallets', bind: 'booking.pallets', value: d.pallets, type: 'number', min: 1 }) : ''}
        ${field({ id: 'bk-po', label: 'Your reference (PO)', bind: 'booking.po', value: d.po, error: d.errors.po, live: false, hint: c.poRequired ? 'Required on your account' : '' })}
        ${field({ id: 'bk-notes', label: 'Special instructions', bind: 'booking.notes', value: d.notes, live: false, placeholder: 'Ring bell at goods-in gate' })}
      </div>
      ${checkbox({ id: 'bk-tail', label: 'Tail lift needed (+€18)', bind: 'booking.tailLift', checked: d.tailLift })}
      <div class="price-box">
        <div class="col" style="gap:3px"><span class="eyebrow">Quoted price</span><span class="big">${show ? money(q.net, { cents: true }) : 'On account'}</span><span class="basis">${esc(q.basis)}</span>${priceLines(q, show)}</div>
        <button type="submit" class="btn red lg">Place order</button>
      </div>
      ${ui.ordered ? `<div class="ok-box"><div class="col grow" style="gap:4px"><span class="t">Order placed · ${esc(ui.ordered)}</span><span class="d">Wexford desk has it. You'll get a tracking link by SMS the moment a van collects, and the POD by email on delivery.</span></div><button type="button" class="btn outline-green" ${act('resetOrder')}>Book another</button></div>` : ''}
    </form></div>
    <div class="col" style="gap:20px">
      <div class="card"><div class="card-head lg"><span class="title">Your live jobs</span></div>${live.map((j) => myJob(store, j)).join('') || emptyRow('No live jobs right now.')}</div>
      <div class="card"><div class="card-head lg"><span class="title">Account</span></div>
        ${[['Jobs this month', String(monthJobs), '#131A21'], ['Spend this month', fin(store, mtd), '#131A21'], ['Outstanding balance', fin(store, s.customerOutstanding(c.id)), '#131A21'], ['Next invoice due', nextInv ? fmtDate(nextInv.dueAt) : '—', '#6B7480']].map(([k, v, col]) => `<div class="list-row" style="padding:12px 18px"><span class="k">${k}</span><span class="v" style="color:${col}">${v}</span></div>`).join('')}
      </div>
    </div>
  </div>`;
}

function track(store, c, jobs) {
  const s = store.sel; const n = store.now();
  const open = jobs.filter(s.isOpen);
  const onRoad = open.find((j) => j.status === 'On route' && j.van) || open.find((j) => j.van);
  const van = onRoad ? s.vanById(onRoad.van) : null; const drv = van ? s.driverForVan(van.id) : null;
  const eta = onRoad ? s.etaFor(onRoad) : null;
  return `<div class="track-grid">
    <div class="card"><div class="card-head lg"><span class="title">Open jobs</span><span class="count muted">${open.length}</span></div>${open.map((j) => myJob(store, j, true)).join('') || emptyRow('Nothing open — book a delivery to see it here.')}</div>
    <div class="card" style="height:420px; display:flex; flex-direction:column">
      <div class="card-head lg"><span class="title">Where is my van</span></div>
      <div class="mini-map"><span class="eyebrow" style="text-align:center; font-size:11.5px; letter-spacing:.14em; color:#7C848E">${van ? `LIVE TRACKING MAP<br>${van.id} · ${esc(van.pos.at.toUpperCase())}` : 'NO VAN ASSIGNED YET'}</span></div>
      <div class="col" style="padding:14px 18px; gap:3px">${onRoad ? `<span style="font-size:15px; font-weight:700">${esc(onRoad.ref)} · ${eta ? `ETA ${fmtTime(eta)}` : windowLabel(onRoad, n)}</span><span class="small muted" style="font-size:14px">${drv ? `${firstName(drv.name)} is ${Math.max(0, s.vanLoad(van.id) - 1)} drop${s.vanLoad(van.id) - 1 === 1 ? '' : 's'} away.` : ''} Your consignee gets a text 30 minutes out.</span>` : '<span class="small muted">Once dispatch assigns a van you will see its position here.</span>'}</div>
    </div>
  </div>`;
}

function history(store, c, jobs) {
  const done = jobs.filter((j) => !store.sel.isOpen(j));
  return `<div class="card"><div class="tbl" style="--cols:110px 100px 1.6fr 1.1fr 1.2fr 90px">
    <div class="tr th wide"><span>Ref</span><span>Date</span><span>Route</span><span>Service</span><span>Proof</span><span class="right">Charged</span></div>
    ${done.map((j) => `<div class="tr wide click" ${act('openPortalPod', j.id)}><span class="ref">${esc(j.ref)}</span><span class="mono xs muted">${fmtDate(j.readyFrom)}</span><span class="strong">${esc(j.from.town)} → ${esc(j.to.name)}</span><span class="muted">${esc(j.service)}</span><span style="color:${j.status === 'Failed' ? '#B0121C' : '#12633D'}; font-weight:600">${j.status === 'Failed' ? esc(j.failReason || 'Failed') : esc(j.podLabel || (j.pod ? `Signed · ${j.pod.signedBy}` : '—'))}</span><span class="mono right" style="font-size:13px">${fin(store, j.status === 'Failed' ? 0 : j.price)}</span></div>`).join('') || emptyRow('No completed jobs yet.')}
  </div></div>`;
}

function invoices(store, c) {
  const s = store.sel; const show = store.state.settings.showFinancials; const n = store.now();
  const mine = store.state.invoices.filter((i) => i.customerId === c.id && i.status !== 'Draft');
  const open = mine.filter((i) => i.status === 'Sent' || i.status === 'Notified');
  const balance = sum(open, s.invoiceGross);
  const next = open.filter((i) => i.status === 'Sent').sort((a, b) => toDate(a.dueAt) - toDate(b.dueAt))[0];
  const overdue = open.filter((i) => s.invoiceState(i).overdueDays > 0);
  const colors = { green: '#1E8E5A', blue: '#0F7DC2', red: '#E4131F', amber: '#C2700F' };
  const iban = store.state.settings.invoicing.iban;
  return `<div class="stack g16">
    <div class="hero" style="gap:28px">
      <div class="col grow" style="gap:4px"><span class="eyebrow">Current balance</span><span class="big">${show ? money(balance, { cents: true }) : 'On account'}</span><span class="hint">${next ? `${next.id} due ${fmtDate(next.dueAt)} · ` : ''}${overdue.length ? `${overdue.length} overdue` : 'nothing overdue'} · pay to ${esc(iban)}, quote your invoice number</span></div>
      <button type="button" class="btn blue" ${act('openBank', next?.id || open[0]?.id || null)} ${open.length ? '' : 'disabled'}>Pay by bank transfer</button>
      <button type="button" class="btn navy2" ${act('printStatement', c.id)}>Download statement</button>
    </div>
    <div class="card"><div class="tbl" style="--cols:120px 120px 120px 110px 1fr 120px">
      <div class="tr th wide"><span>Invoice</span><span>Issued</span><span>Due</span><span>Amount</span><span>Status</span><span></span></div>
      ${mine.map((i) => { const st = s.invoiceState(i); return `<div class="tr wide"><span class="ref">${esc(i.id)}</span><span class="mono xs muted">${fmtDate(i.issuedAt)}</span><span class="mono xs muted">${fmtDate(i.dueAt)}</span><span class="mono strong" style="font-size:13px">${show ? money(s.invoiceGross(i)) : HIDDEN}</span><span class="small strong" style="color:${colors[st.color]}">${i.status === 'Sent' && !st.overdueDays ? 'Open' : esc(st.label)}</span><span class="row" style="gap:10px; justify-content:flex-end"><button type="button" class="link small" ${act('printInvoice', i.id)}>PDF</button>${i.status === 'Sent' ? `<button type="button" class="link small" ${act('openBank', i.id)}>Pay</button>` : ''}</span></div>`; }).join('') || emptyRow('No invoices yet.')}
    </div></div>
  </div>`;
}

function bankModal(store, c) {
  const id = store.state.ui.bankModal; if (!id) return '';
  const s = store.sel; const inv = s.invoiceById(id); if (!inv) return '';
  const b = store.state.settings.invoicing; const show = store.state.settings.showFinancials;
  return `<div class="modal-bg" ${act('closeBank')}><div class="modal sm" data-act="noop">
    <div class="modal-head"><div class="col grow" style="gap:3px"><span class="t">Pay ${esc(inv.id)} by bank transfer</span><span class="s">Transfers are matched to your invoice automatically by the AIB feed, usually the same day</span></div><button type="button" class="close lg" ${act('closeBank')}>✕</button></div>
    <div class="modal-body">
      <div class="card">${kv('Amount', `<span class="mono strong">${show ? money(s.invoiceGross(inv), { cents: true }) : HIDDEN}</span>`)}${kv('Payee', esc(store.state.settings.company.registeredName))}${kv('Bank', esc(b.bankName))}${kv('IBAN', `<span class="mono">${esc(b.iban)}</span>`)}${kv('BIC', `<span class="mono">${esc(b.bic)}</span>`)}${kv('Reference', `<span class="mono strong">${esc(inv.id)}</span>`)}${kv('Due', fmtDate(inv.dueAt))}</div>
      <div class="info-box">Quote <span class="strong">${esc(inv.id)}</span> as the payment reference so it matches automatically. Tell us once you have sent it and we will hold any reminders.</div>
      <div class="row" style="justify-content:flex-end; gap:8px"><button type="button" class="btn" ${act('closeBank')}>Close</button><button type="button" class="btn blue" ${act('notifyPayment', inv.id)}>I've sent the transfer</button></div>
    </div>
  </div></div>`;
}

function pod(store, c, jobs) {
  const n = store.now();
  const list = jobs.filter((j) => j.pod);
  return `<div class="pod-grid">${list.map((j) => `<div class="pod" style="cursor:default">
    <div class="thumb">${j.pod.photo ? `<img src="${j.pod.photo}" alt="Delivery photo">` : `<span class="kind">${esc(j.pod.kind)}</span>`}</div>
    <div class="body"><span class="ref">${esc(j.ref)}</span><span class="cust">${esc(j.to.name)}</span><span class="small muted">${j.status === 'Failed' ? esc(j.failReason) : `Signed ${esc(j.pod.signedBy)}`} · ${fmtWhen(j.pod.at, n)}</span><button type="button" class="link small" style="text-align:left" ${act('printPod', j.id)}>Download PDF</button></div>
  </div>`).join('') || emptyRow('No POD documents yet.')}</div>`;
}

function addresses(store, c) {
  return `<div class="stack g16">
    <div class="row between"><span class="small muted">${c.addresses.length} saved address${c.addresses.length === 1 ? '' : 'es'}</span><button type="button" class="btn ghost" ${act('openAddress')}>+ Save an address</button></div>
    <div class="addr-grid">${c.addresses.map((a) => `<div class="addr">
      <div class="row between"><span class="name">${esc(a.name)}</span><span class="tagm">${esc(a.tag)}</span></div>
      <span class="ink2">${esc(a.addr)}</span><span class="muted">${esc(a.town)}</span>
      <span class="note">${esc(a.note || '—')}</span>
      ${a.tag === 'DELIVERY' ? `<button type="button" class="link" style="text-align:left" ${act('startBooking', a.id)}>Book from here →</button>` : '<span class="small muted">Default collection point</span>'}
    </div>`).join('') || emptyRow('No addresses saved.')}</div>
  </div>`;
}

function users(store, c) {
  const prefs = c.prefs || { poRequired: c.poRequired ? 'Yes' : 'No', tracking: 'Consignee mobile on each job', pod: 'Email on completion', cycle: `${c.terms} terms`, defaultService: 'Same-day urgent' };
  return `<div class="two-col" style="grid-template-columns:1.2fr 1fr">
    <div class="card"><div class="card-head lg"><span class="title">Your team</span><button type="button" class="link" ${act('openInvite')}>+ Invite user</button></div>
      ${c.users.map((u) => `<div class="user-row"><div class="col grow" style="gap:3px"><span class="n">${esc(u.name)}${u.invited ? ' <span class="tag amber">Invited</span>' : ''}</span><span class="d">${esc(u.detail || '')}</span><span class="e">${esc(u.email)}</span></div><span class="r">${esc(u.role)}</span></div>`).join('') || emptyRow('No users yet.')}
    </div>
    <div class="card"><div class="card-head lg"><span class="title">Account preferences</span></div>
      ${[['PO number required', prefs.poRequired], ['Tracking texts to', prefs.tracking], ['POD delivery', prefs.pod], ['Invoice cycle', prefs.cycle], ['Default service', prefs.defaultService]].map(([k, v]) => kv(k, esc(v), 'w140')).join('')}
    </div>
  </div>`;
}

function support(store, c, jobs) {
  const D = store.drafts; if (!D.query) D.query = { ref: jobs.find(store.sel.isOpen)?.ref || '', text: '' };
  const d = D.query; const co = store.state.settings.company;
  const mine = store.state.queries.filter((q) => q.customerId === c.id);
  return `<div class="two-col" style="grid-template-columns:1.1fr 1fr">
    <div class="stack g16">
      <div class="card"><div class="card-head lg"><span class="title">Talk to the Wexford desk</span></div>
        ${[['Same-day desk', `${co.phone} · 06:00–20:00, 7 days`], ['Out of hours', `${co.mobile} · Paul or duty driver`], ['Email', `${co.email} · answered within 30 min`], ['Your account manager', 'Marie Byrne · marie@roaddogcourier.ie'], ['Claims', 'Report within 48 h with the POD reference']].map(([k, v]) => kv(k, esc(v), 'w150')).join('')}
      </div>
      ${mine.length ? `<div class="card"><div class="card-head lg"><span class="title">Your queries</span></div>${mine.map((q) => `<div class="exc ${q.resolved ? 'blue' : 'amber'}"><div class="row between"><span class="t">${esc(q.ref || 'General')}</span><span class="tm">${fmtWhen(q.at, store.now())}</span></div><span class="d">${esc(q.text)}</span><span class="small strong" style="color:${q.resolved ? '#1E8E5A' : '#C2700F'}">${q.resolved ? 'Handled by dispatch' : 'With the desk · we will ring you'}</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card"><form class="stack" style="padding:18px; gap:12px" data-submit="raiseQuery">
      <span style="font-size:16px; font-weight:700">Raise a query on a job</span>
      ${field({ id: 'q-ref', label: 'Job reference', bind: 'query.ref', value: d.ref, live: false, placeholder: 'RD-24815' })}
      ${field({ id: 'q-text', label: "What's wrong", bind: 'query.text', value: d.text, type: 'textarea', live: false, placeholder: "Tell us what happened — we'll pull the POD and driver notes before we ring you back…", error: d.error })}
      ${d.sent ? '<div class="ok-box"><span class="d">Sent. Dispatch sees it on their exceptions board now.</span></div>' : ''}
      <button type="submit" class="btn red block lg">Send to dispatch</button>
    </form></div>
  </div>`;
}
