// Job drawer, generic detail drawer (customer / van / invoice / POD / driver) and modals.
import { esc, act, money, HIDDEN, fmtTime, fmtDate, fmtWhen, windowLabel, daysBetween, firstName, sum, isoLocalDateTime, toDate } from '../util.js';
import { SERVICES, COUNTIES } from '../pricing.js';
import { fin, statusTag, dot, field, checkbox, modal, fact, emptyRow, priceLines } from './common.js';

const FAIL_REASONS = ['No access to premises', 'Closed / nobody there', 'Refused — wrong goods', 'Damaged in transit', 'Unsafe to unload'];

export function jobDrawer(store) {
  const { ui } = store.state; const s = store.sel; const n = store.now();
  if (!ui.selectedJobId || !['dispatch', 'jobs'].includes(ui.screen)) return '';
  const j = s.jobById(ui.selectedJobId);
  if (!j) return '';
  const c = s.customerById(j.customerId);
  const van = j.van ? s.vanById(j.van) : null; const drv = j.van ? s.driverForVan(j.van) : null;
  const eta = s.etaFor(j);
  const show = store.state.settings.showFinancials;
  const legs = [
    { kind: 'COLLECTION', name: j.from.name, addr: j.from.addr, time: j.collectedAt ? `Collected ${fmtTime(j.collectedAt)}` : `Ready from ${fmtTime(j.readyFrom)}`, dot: '#0F7DC2' },
    { kind: 'DELIVERY', name: j.to.name, addr: j.to.addr, time: j.deliveredAt ? `Delivered ${fmtTime(j.deliveredAt)} · signed ${j.pod?.signedBy || ''}` : j.status === 'Failed' ? `Failed · ${j.failReason}` : `${windowLabel(j, n)}${eta && j.status === 'On route' ? ` · ETA ${fmtTime(eta)}` : ''}`, dot: j.status === 'Failed' ? '#B0121C' : '#E4131F' },
  ];
  const facts = [['Service', j.service], ['Consignment', j.pieces], ['Window', windowLabel(j, n)], ['Van / driver', van ? `${van.id} · ${drv?.name || ''}` : 'Not assigned'], ['Zone', `Zone ${j.zone} · ${j.km} km`], ['Price', show ? `${money(j.price, { cents: true })} + VAT` : 'hidden'], ['Booked via', j.source === 'portal' ? 'Customer portal' : 'Phone · Wexford desk'], ['PO / ref', j.po || '—']];
  const cold = /cold chain|fridge/i.test(j.notes + ' ' + j.pieces);
  const vanChips = store.state.vans.map((v) => { const active = j.van === v.id; const load = s.vanLoad(v.id); const blocked = v.status === 'offroad' || (cold && !v.fridge); return `<button type="button" class="opt van blue ${active ? 'on' : ''}" ${act('assignJob', { jobId: j.id, vanId: v.id })} ${blocked ? 'style="opacity:.45"' : ''} title="${blocked ? (v.status === 'offroad' ? 'Off road' : 'No fridge') : firstName(s.driverForVan(v.id)?.name || '')}">${v.id}${v.fridge ? ' ❄' : ''}<span class="note">${v.status === 'offroad' ? 'off road' : `${load} open`}</span></button>`; }).join('');
  let statusActions = '';
  if (j.status === 'Assigned') statusActions = `<button type="button" class="btn sm blue" ${act('setStatus', { jobId: j.id, status: 'Collected' })}>Mark collected</button><button type="button" class="btn sm" ${act('unassignJob', j.id)}>Back to queue</button>`;
  else if (j.status === 'Collected') statusActions = `<button type="button" class="btn sm blue" ${act('setStatus', { jobId: j.id, status: 'On route' })}>Depart · on route</button>`;
  else if (j.status === 'On route') statusActions = `<form class="row wrap" data-submit="officeDeliver" data-arg="${esc(JSON.stringify(j.id))}" style="gap:8px; width:100%"><input class="input" id="office-receivedBy" name="receivedBy" placeholder="Received by (name)" style="flex:1; padding:8px 10px; font-size:14px" required><button type="submit" class="btn sm green">Mark delivered</button><select class="input" id="office-fail" name="reason" style="flex:1; padding:8px 10px; font-size:14px"><option value="">Mark failed…</option>${FAIL_REASONS.map((r) => `<option>${r}</option>`).join('')}</select></form>`;
  else if (j.status === 'Failed' && !j.rebookedAs) statusActions = `<button type="button" class="btn sm red" ${act('rebookFailed', j.id)}>Re-book for tomorrow AM · 50% rate</button>`;
  else if (j.status === 'Failed' && j.rebookedAs) statusActions = `<span class="small muted">Re-booked as ${esc(j.rebookedAs)}</span>`;
  else if (j.status === 'Delivered') statusActions = `<button type="button" class="btn sm" ${act('openDetail', { kind: 'pod', id: j.id })}>View POD</button><button type="button" class="btn sm" ${act('printPod', j.id)}>POD PDF</button>`;
  return `<aside class="drawer" data-scroll="jobdrawer">
    <div class="drawer-head">
      <div class="col grow" style="gap:4px"><span class="ref" style="font-size:14px">${esc(j.ref)}</span><span class="cust">${esc(j.customer)}</span>${statusTag(j.status, 'lg')}</div>
      <button type="button" class="close" ${act('closeDrawer')} aria-label="Close">✕</button>
    </div>
    <div class="drawer-sec"><div class="legs">${legs.map((l) => `<div class="leg"><div class="rail">${dot(l.dot, true)}<span class="line"></span></div><div class="col grow" style="gap:2px"><span class="eyebrow">${l.kind}</span><span class="name">${esc(l.name)}</span><span class="addr">${esc(l.addr)}</span><span class="time">${esc(l.time)}</span></div></div>`).join('')}</div></div>
    <div class="drawer-sec"><div class="facts">${facts.map(([k, v]) => fact(k, esc(v))).join('')}</div>${j.notes ? `<div class="small muted">Notes: ${esc(j.notes)}</div>` : ''}</div>
    ${statusActions ? `<div class="drawer-sec"><span class="eyebrow">Status</span><div class="row wrap" style="gap:8px">${statusActions}</div></div>` : ''}
    ${s.isOpen(j) ? `<div class="drawer-sec"><span class="eyebrow">Assign to van${cold ? ' · cold chain needs ❄' : ''}</span><div class="vanpick">${vanChips}</div></div>` : ''}
    <div class="drawer-sec last"><span class="eyebrow">Activity</span><div class="activity">${j.activity.slice().reverse().map((a) => `<div class="a"><span class="t">${fmtTime(a.t)}</span><span class="x">${esc(a.text)}</span></div>`).join('') || emptyRow('No activity yet')}</div>
      ${c ? `<button type="button" class="link small" style="margin-top:8px" ${act('openDetail', { kind: 'customer', id: c.id })}>Open ${esc(c.name)} account →</button>` : ''}</div>
  </aside>`;
}

export function detailDrawer(store) {
  const { ui } = store.state; const s = store.sel; const n = store.now(); const show = store.state.settings.showFinancials;
  const d = ui.detail; if (!d) return '';
  let head, facts = [], sections = [], actions = [], note = '';
  const f = (k, v) => ({ k, v });
  const secRow = (k, v) => ({ k, v });
  const fmoney = (x, o) => (show ? money(x, o) : HIDDEN);
  if (d.kind === 'customer') {
    const c = s.customerById(d.id); if (!c) return '';
    const jobs = s.customerJobs(c.id);
    head = { eyebrow: 'CUSTOMER ACCOUNT', title: c.name, badge: 'Active', badgeColor: '#1E8E5A' };
    facts = [f('Base', c.town), f('Terms', c.terms), f('Spend MTD', fmoney(s.customerMtd(c.id))), f('Outstanding', fmoney(s.customerOutstanding(c.id))), f('Rate card', c.rateNote), f('Since', c.since), f('Contact', `${c.contact}`), f('Phone', c.phone)];
    sections = [{ title: 'Recent jobs', rows: jobs.slice(0, 5).map((j) => ({ k: `${j.ref} · ${j.to.name}`, v: statusTag(j.status), raw: true, jobId: j.id })) },
      { title: 'Account settings', rows: [secRow('Portal users', `${c.users.length} login${c.users.length === 1 ? '' : 's'}`), secRow('PO required', c.poRequired ? 'Yes — blocks booking without one' : 'No'), secRow('Invoice delivery', `Email to ${c.email}`), secRow('Credit limit', c.creditLimit ? fmoney(c.creditLimit) : 'Prepay'), secRow('Notes', c.notes || '—')] }];
    actions = [{ label: 'New job for this customer', act: 'openNewJob', arg: c.id, primary: true }, { label: 'Email statement', act: 'printStatement', arg: c.id }];
  } else if (d.kind === 'van') {
    const v = s.vanById(d.id); if (!v) return '';
    const drv = s.driverForVan(v.id);
    const jobsDone = store.state.jobs.filter((j) => j.van === v.id && j.status === 'Delivered').length;
    head = { eyebrow: 'FLEET RECORD', title: `${v.id} · ${v.reg}`, badge: `${v.model}${v.fridge ? ' · fridge' : ''}`, badgeColor: '#0F7DC2' };
    facts = [f('Driver', drv?.name || '—'), f('Odometer', `${v.odometer.toLocaleString('en-IE')} km`), f('Motor tax', fmtDate(v.taxDue)), f('CVRT', fmtDate(v.cvrtDue)), f('Next service', v.serviceDueKm < 0 ? `overdue ${-v.serviceDueKm} km` : `in ${v.serviceDueKm.toLocaleString('en-IE')} km`), f('Insurance', v.insurance), f('Status', v.status === 'offroad' ? 'Off road' : v.status === 'spare' ? 'Spare' : 'Active'), f('Position', v.pos.at)];
    sections = [{ title: 'Running cost (30 days)', rows: [secRow('Fuel', fmoney(v.fuelMtd)), secRow('Tyres & service', fmoney(v.maintenanceMtd)), secRow('Cost per km', fmoney(0.19, { cents: true })), secRow('Drops completed', String(jobsDone + 120)), secRow('Open jobs now', String(s.vanLoad(v.id)))] },
      { title: 'History', rows: v.history.map((h) => secRow(fmtDate(h.at), h.what)) }];
    actions = [{ label: v.serviceBooked ? `Service booked ${fmtDate(v.serviceBooked)}` : 'Book service', act: 'bookService', arg: v.id, primary: true, disabled: !!v.serviceBooked }, v.status === 'offroad' ? { label: 'Back in service', act: 'setVanStatus', arg: { vanId: v.id, status: 'active' } } : { label: 'Mark off road', act: 'setVanStatus', arg: { vanId: v.id, status: 'offroad' } }];
  } else if (d.kind === 'invoice') {
    const inv = s.invoiceById(d.id); if (!inv) return '';
    const c = s.customerById(inv.customerId); const st = s.invoiceState(inv);
    const colors = { green: '#1E8E5A', blue: '#0F7DC2', red: '#E4131F', amber: '#C2700F' };
    head = { eyebrow: 'INVOICE', title: inv.id, badge: `${c?.name || ''} · ${st.label}`, badgeColor: colors[st.color] };
    facts = [f('Net', fmoney(inv.net, { cents: true })), f(`VAT ${inv.vatPct}%`, fmoney(inv.vat, { cents: true })), f('Total', fmoney(s.invoiceGross(inv), { cents: true })), f('Issued', inv.issuedAt ? fmtDate(inv.issuedAt) : 'Draft'), f('Due', inv.dueAt ? fmtDate(inv.dueAt) : `${inv.termsDays ?? c?.termsDays ?? 30} days from issue`), f('Jobs billed', String(inv.jobsCount)), f('Xero', inv.xero), f('Paid', inv.paidAt ? fmtDate(inv.paidAt) : '—')];
    sections = [{ title: 'Lines', rows: inv.lines.map((l) => secRow(l.label, fmoney(l.amount))) }, { title: 'Attached', rows: [secRow('POD pack', `${inv.jobsCount} signed dockets, one PDF`), secRow('Job listing', 'CSV with customer PO refs'), secRow('Payment details', `Bank transfer · ${store.state.settings.invoicing.iban}`)] }];
    if (inv.status === 'Draft') actions = [{ label: 'Issue & email to customer', act: 'sendInvoice', arg: inv.id, primary: true }, { label: 'Preview PDF', act: 'printInvoice', arg: inv.id }];
    else if (inv.status === 'Paid') actions = [{ label: 'Download PDF', act: 'printInvoice', arg: inv.id, primary: true }, { label: 'Email again', act: 'sendInvoice', arg: inv.id }];
    else actions = [{ label: 'Mark paid (AIB feed)', act: 'markPaid', arg: inv.id, primary: true }, { label: st.overdueDays ? 'Send reminder' : 'Email again', act: st.overdueDays ? 'sendReminder' : 'sendInvoice', arg: inv.id }, { label: 'Download PDF', act: 'printInvoice', arg: inv.id }];
  } else if (d.kind === 'pod') {
    const j = s.jobById(d.id); if (!j || !j.pod) return '';
    const failed = j.status === 'Failed'; const drv = s.driverForVan(j.pod.van || j.van);
    head = { eyebrow: 'PROOF OF DELIVERY', title: j.ref, badge: failed ? `Failed · ${j.failReason}` : 'Delivered', badgeColor: failed ? '#B0121C' : '#1E8E5A' };
    facts = [f('Customer', j.customer), f('Van', `${j.pod.van || j.van} · ${drv ? firstName(drv.name)[0] + '. ' + drv.name.split(' ').slice(1).join(' ') : ''}`), f(failed ? 'Attempted' : 'Delivered', fmtWhen(j.pod.at, n)), f('Signed by', j.pod.signedBy), f('GPS', j.pod.gps), f('Within geofence', j.pod.geofence)];
    note = (j.pod.photo || j.pod.signature) ? `<div class="two">${j.pod.photo ? `<div class="capture done"><img src="${j.pod.photo}" alt="Delivery photo"></div>` : ''}${j.pod.signature ? `<div class="capture done plain"><img src="${j.pod.signature}" alt="Signature" style="object-fit:contain"></div>` : ''}</div>` : '';
    sections = [{ title: 'Evidence', rows: [secRow('Photo of goods', j.pod.photo ? 'Captured on drop' : j.pod.kind.includes('PHOTO') ? 'Captured on drop, 1.2 MB' : 'None'), secRow('Signature', j.pod.signature ? 'Drawn on screen' : j.pod.kind.includes('SIGNATURE') ? 'Drawn on screen' : 'None'), secRow('Barcode scan', `${j.pieces} matched`), secRow('Device', `${j.pod.van || j.van} phone · app 4.2.1`), ...(j.pod.note ? [secRow('Driver note', j.pod.note)] : [])] },
      { title: 'Sent to customer', rows: [secRow('Email', `${fmtTime(j.pod.at)} · ${s.customerById(j.customerId)?.email || ''}`), secRow('SMS', `${fmtTime(j.pod.at)} · tracking link closed`), secRow('Retention', 'Kept 7 years for claims')] }];
    actions = [{ label: 'Download POD PDF', act: 'printPod', arg: j.id, primary: true }, { label: 'Email again', act: 'emailPod', arg: j.id }];
  } else if (d.kind === 'driver') {
    const drv = s.driverById(d.id); if (!drv) return '';
    const row = s.payrollRows().find((r) => r.driver.id === drv.id);
    head = { eyebrow: 'DRIVER', title: drv.name, badge: drv.compliance, badgeColor: drv.complianceOk ? '#1E8E5A' : '#E4131F' };
    facts = [f('Van', drv.van), f('Phone', drv.phone), f('Shift', drv.shift ? `On since ${fmtTime(drv.shift.startedAt)}` : 'Off shift'), f('Hours this week', row.hours.toFixed(1)), f('Drops this week', String(row.drops)), f('On time', drv.onTime === null ? '—' : `${drv.onTime}%`), f('Expenses', fmoney(row.expenses)), f('Pay due', fmoney(row.pay))];
    sections = [{ title: 'Expenses this week', rows: drv.expenses.length ? drv.expenses.map((e) => secRow(`${fmtDate(e.at)} · ${e.type}`, fmoney(e.amount, { cents: true }))) : [secRow('None submitted', '')] }];
    actions = [{ label: `Message ${firstName(drv.name)}`, act: 'openMessage', arg: drv.van, primary: true }, { label: 'Fleet record', act: 'openDetail', arg: { kind: 'van', id: drv.van } }];
  } else return '';
  return `<aside class="drawer" data-scroll="detail">
    <div class="drawer-sec" style="padding-bottom:80px; border:0; gap:18px">
      <div class="row top"><div class="col grow" style="gap:5px; min-width:0"><span class="eyebrow">${esc(head.eyebrow)}</span><span class="title" style="font-size:20.5px; font-weight:800; letter-spacing:-.4px">${esc(head.title)}</span><span class="small strong" style="color:${head.badgeColor}">${esc(head.badge)}</span></div><button type="button" class="close" ${act('closeDetail')} aria-label="Close">✕</button></div>
      <div class="facts" style="padding-top:14px; border-top:1px solid #EEF0F3">${facts.map((x) => fact(x.k, esc(x.v))).join('')}</div>
      ${note}
      ${sections.map((sec) => `<div class="sec-rows" style="padding-top:14px; border-top:1px solid #EEF0F3"><span class="eyebrow" style="display:block; margin-bottom:6px">${esc(sec.title)}</span>${sec.rows.map((r) => `<div class="r ${r.jobId ? 'clickable' : ''}" ${r.jobId ? act('selectJobFromDetail', r.jobId) : ''}><span class="k">${esc(r.k)}</span><span class="v">${r.raw ? r.v : esc(r.v)}</span></div>`).join('')}</div>`).join('')}
      <div class="actions2">${actions.map((a) => `<button type="button" class="btn ${a.primary ? 'dark' : ''}" ${act(a.act, a.arg)} ${a.disabled ? 'disabled' : ''}>${esc(a.label)}</button>`).join('')}</div>
    </div>
  </aside>`;
}

// ---------------- modals ----------------
export function modals(store) {
  const { ui } = store.state; const s = store.sel; const D = store.drafts;
  if (ui.modal === 'newjob' && D.newJob) return newJobModal(store);
  if (ui.modal === 'account' && D.account) {
    const d = D.account;
    return modal({ title: 'New account customer', sub: 'Terms and discount feed straight into pricing and invoicing', size: 'sm', body: `<form data-submit="createAccount" class="stack g16">
      <div class="form-grid">
        ${field({ id: 'acc-name', label: 'Company', bind: 'account.name', value: d.name, error: d.errors.name, span2: true, live: false })}
        ${field({ id: 'acc-contact', label: 'Contact', bind: 'account.contact', value: d.contact, error: d.errors.contact, live: false })}
        ${field({ id: 'acc-phone', label: 'Phone', bind: 'account.phone', value: d.phone, live: false })}
        ${field({ id: 'acc-email', label: 'Invoice email', bind: 'account.email', value: d.email, error: d.errors.email, type: 'email', live: false })}
        ${field({ id: 'acc-town', label: 'Town', bind: 'account.town', value: d.town, live: false })}
        ${field({ id: 'acc-terms', label: 'Terms', bind: 'account.terms', value: d.terms, options: ['30 day', '14 day', 'Prepay', 'Contract'] })}
        ${field({ id: 'acc-disc', label: 'Discount %', bind: 'account.discountPct', value: d.discountPct, type: 'number', min: 0, live: false })}
      </div>
      ${checkbox({ id: 'acc-po', label: 'PO number required on every booking', bind: 'account.poRequired', checked: d.poRequired })}
      <div class="row" style="justify-content:flex-end; gap:8px"><button type="button" class="btn" ${act('closeModal')}>Cancel</button><button type="submit" class="btn red">Create account</button></div>
    </form>` });
  }
  if (ui.modal === 'message' && D.message) {
    const d = D.message; const drv = s.driverById(d.driverId);
    return modal({ title: `Message ${drv ? firstName(drv.name) : d.vanId}`, sub: 'Push notification to the driver app · they can reply from the phone', size: 'sm', body: `<form data-submit="sendDriverMessage" class="stack g16">
      ${field({ id: 'msg-text', label: 'Message', bind: 'message.text', value: d.text, type: 'textarea', placeholder: 'e.g. Tomasz, run finished? Come back via Enniscorthy and collect RD-24822 for Dublin.', live: false })}
      <div class="row" style="justify-content:flex-end; gap:8px"><button type="button" class="btn" ${act('closeModal')}>Cancel</button><button type="submit" class="btn dark">Send push</button></div>
    </form>` });
  }
  if (ui.modal === 'invite' && D.invite) {
    const d = D.invite;
    return modal({ title: 'Invite a user', sub: 'They get an email link to set a password for your portal', size: 'sm', body: `<form data-submit="inviteUser" class="stack g16">
      <div class="form-grid">
        ${field({ id: 'inv-name', label: 'Name', bind: 'invite.name', value: d.name, error: d.errors.name, live: false })}
        ${field({ id: 'inv-email', label: 'Email', bind: 'invite.email', value: d.email, error: d.errors.email, type: 'email', live: false })}
        ${field({ id: 'inv-role', label: 'Role', bind: 'invite.role', value: d.role, options: ['Admin', 'Booker', 'Billing only'], span2: true })}
      </div>
      <div class="row" style="justify-content:flex-end; gap:8px"><button type="button" class="btn" ${act('closeModal')}>Cancel</button><button type="submit" class="btn blue">Send invite</button></div>
    </form>` });
  }
  if (ui.modal === 'address' && D.address) {
    const d = D.address;
    return modal({ title: 'Save an address', sub: 'Saved points show up as one-tap bookings', size: 'sm', body: `<form data-submit="saveAddress" class="stack g16">
      <div class="form-grid">
        ${field({ id: 'ad-name', label: 'Name', bind: 'address.name', value: d.name, error: d.errors.name, live: false, placeholder: 'e.g. Galway site' })}
        ${field({ id: 'ad-tag', label: 'Type', bind: 'address.tag', value: d.tag, options: ['DELIVERY', 'COLLECTION'] })}
        ${field({ id: 'ad-addr', label: 'Address', bind: 'address.addr', value: d.addr, error: d.errors.addr, span2: true, live: false })}
        ${field({ id: 'ad-town', label: 'Town / Eircode', bind: 'address.town', value: d.town, live: false })}
        ${field({ id: 'ad-county', label: 'County', bind: 'address.county', value: d.county, options: Object.keys(COUNTIES) })}
        ${field({ id: 'ad-note', label: 'Site note', bind: 'address.note', value: d.note, span2: true, live: false, placeholder: 'Gate codes, who to ask for…' })}
      </div>
      <div class="row" style="justify-content:flex-end; gap:8px"><button type="button" class="btn" ${act('closeModal')}>Cancel</button><button type="submit" class="btn blue">Save address</button></div>
    </form>` });
  }
  return '';
}

function newJobModal(store) {
  const d = store.drafts.newJob; const s = store.sel; const show = store.state.settings.showFinancials;
  const c = s.customerById(d.customerId);
  const q = s.quoteDraft(d, d.customerId);
  const multi = d.service === 'Multi-drop route'; const pallet = d.service === 'Pallet freight';
  const cold = /cold chain|fridge/i.test(d.notes + ' ' + d.pieces);
  return `<div class="modal-bg" ${act('closeModal')}>
    <div class="modal" data-act="noop">
      <div class="modal-head"><div class="col grow" style="gap:3px"><span class="t">New job</span><span class="s">Phone or counter booking · priced from the zone card as you type</span></div><button type="button" class="close lg" ${act('closeModal')}>✕</button></div>
      <form class="modal-body" data-submit="createJob">
        <div class="field"><span class="lbl">Service</span><div class="row wrap">${SERVICES.map((sv) => `<button type="button" class="opt ${d.service === sv ? 'on' : ''}" ${act('draftSet', { name: 'newJob', key: 'service', value: sv })}>${sv}</button>`).join('')}</div></div>
        <div class="form-grid">
          ${field({ id: 'nj-customer', label: 'Customer account', bind: 'newJob.customerId', value: d.customerId, options: store.state.customers.map((x) => [x.id, x.name]), span2: true })}
          ${field({ id: 'nj-from', label: 'Collection', bind: 'newJob.fromAddr', value: d.fromAddr, span2: true, live: false })}
          ${field({ id: 'nj-toName', label: 'Deliver to (name)', bind: 'newJob.toName', value: d.toName, placeholder: 'Consignee or site', live: false })}
          ${field({ id: 'nj-toAddr', label: 'Delivery address', bind: 'newJob.toAddr', value: d.toAddr, error: d.errors.toAddr, placeholder: 'Street, town', live: false })}
          ${field({ id: 'nj-county', label: 'Destination county', bind: 'newJob.toCounty', value: d.toCounty, options: Object.keys(COUNTIES), error: d.errors.toCounty })}
          ${field({ id: 'nj-km', label: 'Distance km (auto if blank)', bind: 'newJob.km', value: d.km, type: 'number', min: 0, placeholder: String(q.km) })}
          ${field({ id: 'nj-ready', label: 'Ready from', bind: 'newJob.readyFrom', value: d.readyFrom, type: 'datetime-local', error: d.errors.readyFrom })}
          ${field({ id: 'nj-by', label: 'Deliver by', bind: 'newJob.deliverBy', value: d.deliverBy, type: 'datetime-local', error: d.errors.deliverBy })}
          ${field({ id: 'nj-pieces', label: 'Pieces', bind: 'newJob.pieces', value: d.pieces, error: d.errors.pieces, placeholder: '2 boxes', live: false })}
          ${field({ id: 'nj-weight', label: 'Weight kg', bind: 'newJob.weightKg', value: d.weightKg, type: 'number', min: 0, error: d.errors.weightKg })}
          ${multi ? field({ id: 'nj-stops', label: 'Stops', bind: 'newJob.stops', value: d.stops, type: 'number', min: 1 }) : ''}
          ${pallet ? field({ id: 'nj-pallets', label: 'Pallets', bind: 'newJob.pallets', value: d.pallets, type: 'number', min: 1 }) : ''}
          ${field({ id: 'nj-contact', label: 'Taken by phone from', bind: 'newJob.contact', value: d.contact, live: false })}
          ${field({ id: 'nj-po', label: 'Customer PO', bind: 'newJob.po', value: d.po, live: false, hint: c?.poRequired ? 'This account requires a PO' : '' })}
          ${field({ id: 'nj-notes', label: 'Notes', bind: 'newJob.notes', value: d.notes, span2: true, placeholder: 'Cold chain, tail lift, gate codes…', live: false })}
        </div>
        <div class="row" style="gap:18px">${checkbox({ id: 'nj-tail', label: 'Tail lift needed (+€18)', bind: 'newJob.tailLift', checked: d.tailLift })}</div>
        <div class="field"><span class="lbl">Assign now (optional)${cold ? ' · cold chain needs ❄' : ''}</span><div class="row wrap" style="gap:7px">${store.state.vans.filter((v) => v.status !== 'offroad').map((v) => `<button type="button" class="opt van blue ${d.van === v.id ? 'on' : ''}" ${act('draftSet', { name: 'newJob', key: 'van', value: d.van === v.id ? null : v.id })}>${v.id}${v.fridge ? ' ❄' : ''}<span class="note">${esc(firstName(s.driverForVan(v.id)?.name || ''))} · ${s.vanLoad(v.id)} open</span></button>`).join('')}</div></div>
        <div class="price-box">
          <div class="col" style="gap:3px"><span class="eyebrow">Price</span><span class="big">${show ? money(q.net, { cents: true }) : 'On account'}</span><span class="basis">${esc(q.basis)}</span>${priceLines(q, show)}</div>
          <button type="submit" class="btn red lg">${d.van ? `Create & assign to ${d.van}` : 'Create job in queue'}</button>
        </div>
      </form>
    </div>
  </div>`;
}
