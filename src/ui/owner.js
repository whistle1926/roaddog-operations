// Owner / office admin: sidebar, top bar and the eleven screens.
import { esc, act, money, HIDDEN, fmtHeaderClock, fmtTime, fmtDate, windowLabel, relativeAgo, minutesBetween, daysBetween, initials, firstName, sum, pct, fmtWhen, isoWeek, weekRange, cx, toDate } from '../util.js';
import { ZONES } from '../pricing.js';
import { STATUS_COLOR } from '../store.js';
import { fin, statusTag, dot, brand, roleSwitch, navItem, kv, emptyRow, checkbox, field } from './common.js';
import { jobDrawer, detailDrawer, modals } from './drawers.js';
import { DEPOT_POS } from '../data/seed.js';

const TITLES = { dispatch: 'Dispatch board', map: 'Live van map', jobs: 'All jobs', customers: 'Customers & pricing', fleet: 'Fleet & compliance', drivers: 'Drivers & payroll', invoicing: 'Invoicing & billing', reports: 'Reports & KPIs', pod: 'Proof-of-delivery archive', alerts: 'Alerts & automation', settings: 'Settings' };

export function ownerView(store) {
  const { ui } = store.state;
  const s = store.sel;
  const alerts = s.alerts();
  const un = s.unassigned().length;
  const comp = s.complianceItems().length;
  const nav = [['dispatch', 'Dispatch board', un], ['map', 'Live van map', 0], ['jobs', 'All jobs', 0], ['customers', 'Customers & pricing', 0], ['fleet', 'Fleet & compliance', comp], ['drivers', 'Drivers & payroll', 0], ['invoicing', 'Invoicing', store.state.invoices.filter((i) => i.status === 'Draft').length], ['reports', 'Reports', 0], ['pod', 'POD archive', 0], ['alerts', 'Alerts & automation', alerts.length], ['settings', 'Settings', 0]];
  const screens = { dispatch, map, jobs, customers, fleet, drivers, invoicing, reports, pod, alerts: alertsScreen, settings };

  return `<div class="layout">
    <aside class="sidebar">
      ${brand('Courier Ops · Wexford')}
      <nav class="nav">${nav.map(([k, l, b]) => navItem(l, ui.screen === k, b, 'go', k)).join('')}</nav>
      <div class="side-foot">
        <div class="who"><div class="avatar" style="background:#E4131F">PB</div><div class="col" style="gap:0"><span class="name">Paul Byrne</span><span class="role">OWNER</span></div></div>
        <div class="col" style="gap:5px"><span class="viewas">VIEW AS</span>${roleSwitch(store)}</div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="col" style="gap:0; flex:none"><h1>${esc(TITLES[ui.screen])}</h1><span class="clock">${fmtHeaderClock(store.now())}</span></div>
        <div class="grow"></div>
        <div class="search"><span class="ico">⌕</span><input id="search" type="search" data-bind="ui.search" value="${esc(ui.search)}" placeholder="Search ref, customer, driver…"></div>
        <button type="button" class="alert-pill ${alerts.length ? '' : 'ok'}" ${act('go', 'alerts')}><span class="pulse"></span><span>${alerts.length ? `${alerts.length} need attention` : 'All clear'}</span></button>
        <button type="button" class="btn red" ${act('openNewJob')}>+ New job</button>
      </header>
      <div class="content" data-scroll="owner-${ui.screen}">${(screens[ui.screen] || dispatch)(store)}</div>
    </div>
    ${jobDrawer(store)}
    ${detailDrawer(store)}
  </div>
  ${modals(store)}`;
}

// ---------------- dispatch ----------------
function dispatch(store) {
  const s = store.sel; const { ui } = store.state; const show = store.state.settings.showFinancials;
  const k = s.kpis();
  const un = s.unassigned();
  const lanes = s.lanes(ui.boardByVan);
  const idle = s.idleVans();
  const kpi = (label, value, sub, color = '') => `<div class="kpi"><span class="eyebrow">${esc(label)}</span><span class="val" style="color:${color || '#131A21'}">${value}</span><span class="sub">${esc(sub)}</span></div>`;
  return `<div class="stack">
    <div class="kpis">
      ${kpi('Jobs today', k.total, `${k.open} open · ${k.closed} closed`)}
      ${kpi('Unassigned', k.unassigned, k.unassigned ? `oldest ${k.oldestMin} min` : 'queue clear', k.unassigned ? '#E4131F' : '#1E8E5A')}
      ${kpi('Vans on road', `${k.onRoad}/${k.vans}`, k.off.length ? `${k.off.join(', ')} off road` : 'full fleet out')}
      ${kpi('On-time', `${k.onTime}%`, 'target 96%', k.onTime < 96 ? '#C2700F' : '#1E8E5A')}
      ${show ? kpi('Revenue today', money(k.revenue), `${k.total} jobs · net of VAT`) : kpi('Drops done', k.drops, `across ${k.onRoad} vans`)}
    </div>
    <div class="dispatch-grid">
      <div class="card">
        <div class="card-head warn"><span class="title">Unassigned queue</span><span class="count">${un.length}</span></div>
        <div class="queue" data-scroll="queue">
          ${un.length ? un.map((j) => `<button type="button" class="queue-item" draggable="true" data-drag-job="${j.id}" ${act('selectJob', j.id)}>
            <div class="row between base"><span class="cust">${esc(j.customer)}</span><span class="win">${esc(windowLabel(j, store.now()))}</span></div>
            <span class="route">${esc(j.from.town)} → ${esc(j.to.name)}</span>
            <div class="row between base"><span class="ref">${esc(j.ref)} · ${relativeAgo(j.createdAt, store.now())}</span><span class="price">${fin(store, j.price)}</span></div>
          </button>`).join('') : emptyRow('Queue is clear — every job has a van.')}
        </div>
      </div>
      <div class="col" style="gap:12px">
        <div class="board-head">
          <span class="eyebrow dk" style="font-size:11.5px">${ui.boardByVan ? 'Board grouped by van · drag a job onto a van' : 'Board grouped by status'}</span>
          <div class="rule"></div>
          <div class="legend">${[['Assigned', '#0F7DC2'], ['Collected', '#C2700F'], ['Delivered', '#1E8E5A'], ['Failed', '#B0121C']].map(([l, c]) => `<span class="item">${dot(c)}${l}</span>`).join('')}</div>
          <button type="button" class="btn ghost" ${act('toggleBoard')}>Switch view</button>
        </div>
        <div class="lanes">
          ${lanes.map((lane) => `<div class="lane" ${lane.vanId ? `data-drop-van="${lane.vanId}"` : ''}>
            <div class="lane-head ${lane.kind === 'failed' ? 'failed' : lane.kind === 'grey' ? 'grey' : ''}"><span class="t">${esc(lane.title)}</span><span class="c">${lane.jobs.length}</span></div>
            <div class="col" style="gap:0">${lane.jobs.map((j) => `<button type="button" class="lane-job" draggable="${j.status === 'Assigned' || j.status === 'Unassigned'}" data-drag-job="${j.id}" ${act('selectJob', j.id)}>${dot(STATUS_COLOR[j.status])}<div class="col" style="gap:2px; min-width:0"><span class="cust">${esc(j.customer)}</span><span class="route">${esc(j.from.town)} → ${esc(j.to.name)}</span></div></button>`).join('') || emptyRow('No jobs')}</div>
          </div>`).join('')}
        </div>
        ${idle.length ? `<div class="capacity"><span class="eyebrow">Free capacity</span><span>${idle.map((v) => `${v.id} · ${firstName(s.driverForVan(v.id)?.name || '')}`).join('   ·   ')} — drop an unassigned job onto them or use the drawer.</span></div>` : ''}
      </div>
    </div>
  </div>`;
}

// ---------------- live map ----------------
function map(store) {
  const s = store.sel; const { ui } = store.state; const n = store.now();
  const vans = store.state.vans.filter((v) => v.pos);
  const colorFor = (v) => v.pos.state === 'On route' ? '#0F7DC2' : v.pos.state === 'At drop' ? '#C2700F' : v.pos.state === 'Idle' ? '#E4131F' : '#6B7480';
  const W = 900, H = 640; const latMin = 51.75, latMax = 53.55, lngMin = -9.2, lngMax = -5.9;
  const px = (lng) => ((lng - lngMin) / (lngMax - lngMin)) * W;
  const py = (lat) => H - ((lat - latMin) / (latMax - latMin)) * H;
  const places = [['Wexford', 52.336, -6.463], ['Dublin', 53.35, -6.26], ['Cork', 51.9, -8.47], ['Waterford', 52.26, -7.11], ['Kilkenny', 52.65, -7.25], ['Limerick', 52.66, -8.63], ['Carlow', 52.84, -6.93], ['Naas', 53.22, -6.66], ['Gorey', 52.68, -6.29]];
  const stateLabel = (v) => v.pos.state === 'Idle' ? `Idle ${minutesBetween(v.pos.since, n)} min` : v.pos.state;
  const jobFor = (v) => store.state.jobs.find((j) => j.van === v.id && (j.status === 'On route' || j.status === 'Collected'));
  return `<div class="map-grid">
    <div class="card map-canvas">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Schematic map of van positions">
        ${[[52.336, -6.463, 53.35, -6.26], [52.336, -6.463, 51.9, -8.47], [52.336, -6.463, 52.26, -7.11], [52.26, -7.11, 52.66, -8.63], [52.336, -6.463, 52.65, -7.25], [52.65, -7.25, 52.84, -6.93], [52.84, -6.93, 53.22, -6.66], [53.22, -6.66, 53.35, -6.26]].map(([a, b, c, d]) => `<line x1="${px(b)}" y1="${py(a)}" x2="${px(d)}" y2="${py(c)}" stroke="#D5DAE0" stroke-width="3" stroke-linecap="round"/>`).join('')}
        ${places.map(([nm, la, lo]) => `<g><circle cx="${px(lo)}" cy="${py(la)}" r="3.5" fill="#B9C0C8"/><text class="map-place" x="${px(lo) + 8}" y="${py(la) + 4}">${nm}</text></g>`).join('')}
        <g><rect x="${px(DEPOT_POS.lng) - 7}" y="${py(DEPOT_POS.lat) - 7}" width="14" height="14" fill="#0E1620" rx="2"/><text class="map-place" x="${px(DEPOT_POS.lng) + 11}" y="${py(DEPOT_POS.lat) - 9}" fill="#0E1620">Depot</text></g>
        ${vans.map((v, i) => { const on = ui.mapVan === v.id; const jitter = (i % 3) * 9; return `<g class="van-pin" ${act('setMapVan', v.id)}>
          <circle cx="${px(v.pos.lng) + jitter}" cy="${py(v.pos.lat)}" r="${on ? 13 : 9}" fill="${colorFor(v)}" stroke="#fff" stroke-width="2.5" opacity="${v.status === 'active' ? 1 : .55}"/>
          <text x="${px(v.pos.lng) + jitter + 14}" y="${py(v.pos.lat) + 4}">${v.id}${on ? ` · ${firstName(s.driverForVan(v.id)?.name || '')}` : ''}</text>
        </g>`; }).join('')}
      </svg>
      <div class="map-legend">${[['On route', '#0F7DC2'], ['At drop', '#C2700F'], ['Idle >15 min', '#E4131F']].map(([l, c]) => `<span class="item">${dot(c)}${l}</span>`).join('')}</div>
      <div class="map-note">SCHEMATIC · GPS PINGS EVERY 30 S · SWAP IN GOOGLE MAPS / MAPBOX FOR ROAD VIEW</div>
    </div>
    <div class="card" style="display:flex; flex-direction:column">
      <div class="card-head"><span class="title">Vans on road</span><span class="count muted">${vans.filter((v) => v.status === 'active').length} active</span></div>
      <div class="grow" style="overflow-y:auto" data-scroll="vanlist">
        ${vans.map((v) => { const d = s.driverForVan(v.id); const j = jobFor(v); const drops = s.vanLoad(v.id); const eta = j ? s.etaFor(j) : null; return `<button type="button" class="van-row ${ui.mapVan === v.id ? 'on' : ''}" ${act('setMapVan', v.id)}>
          <div class="row between"><span class="t">${v.id} · ${esc(d?.name || 'no driver')}</span><span class="status" style="color:${colorFor(v)}">${esc(stateLabel(v))}</span></div>
          <span class="at">${esc(v.pos.at)}</span>
          <div class="stats"><span>${v.pos.speed} km/h</span><span>${drops} drops left</span><span>ETA ${eta ? fmtTime(eta) : '—'}</span></div>
          ${ui.mapVan === v.id ? `<div class="row wrap" style="margin-top:6px; gap:6px">${j ? `<button type="button" class="btn ghost" ${act('selectJobFromMap', j.id)}>Open ${esc(j.ref)}</button>` : ''}<button type="button" class="btn ghost" ${act('openMessage', v.id)}>Message ${esc(firstName(d?.name || 'driver'))}</button><button type="button" class="btn ghost" ${act('openDetail', { kind: 'van', id: v.id })}>Fleet record</button></div>` : ''}
        </button>`; }).join('')}
      </div>
    </div>
  </div>`;
}

// ---------------- jobs table ----------------
function jobs(store) {
  const s = store.sel; const { ui } = store.state; const n = store.now();
  const filters = ['All', 'Unassigned', 'On route', 'Delivered', 'Failed', 'Next-day'];
  const q = ui.search.trim().toLowerCase();
  let list = store.state.jobs.slice().sort((a, b) => toDate(b.readyFrom) - toDate(a.readyFrom));
  if (ui.jobFilter !== 'All') list = list.filter((j) => ui.jobFilter === 'Next-day' ? j.service === 'Next-day parcel' : j.status === ui.jobFilter);
  if (q) list = list.filter((j) => [j.ref, j.customer, j.to.name, j.to.town, j.from.town, j.service, j.van, j.po, s.driverForVan(j.van)?.name].filter(Boolean).some((x) => x.toLowerCase().includes(q)));
  return `<div class="card">
    <div class="card-head" style="justify-content:flex-start; gap:8px; padding:12px 15px">
      ${filters.map((f) => `<button type="button" class="pill ${ui.jobFilter === f ? 'on' : ''}" ${act('setJobFilter', f)}>${f}</button>`).join('')}
      <span class="grow"></span><span class="small muted">${list.length} job${list.length === 1 ? '' : 's'}${q ? ` matching “${esc(ui.search.trim())}”` : ''}</span>
    </div>
    <div class="tbl" style="--cols:96px 1.3fr 1.6fr 1fr 96px 96px 84px">
      <div class="tr th"><span>Ref</span><span>Customer</span><span>Route</span><span>Service</span><span>Van</span><span>Status</span><span class="right">Value</span></div>
      ${list.map((j) => `<div class="tr click" ${act('selectJob', j.id)}>
        <span class="ref">${esc(j.ref)}</span><span class="strong">${esc(j.customer)}</span><span class="ink2">${esc(j.from.town)} → ${esc(j.to.name)}${!store.sel.isOpen(j) || j.readyFrom > n.toISOString() ? '' : ''}</span><span class="muted">${esc(j.service)}</span>
        <span class="mono xs">${esc(j.van || '—')}${j.status === 'Unassigned' ? '' : ''}</span>${statusTag(j.status)}<span class="mono right" style="font-size:13px">${fin(store, j.price)}</span>
      </div>`).join('') || emptyRow('No jobs match.')}
    </div>
  </div>`;
}

// ---------------- customers & pricing ----------------
function customers(store) {
  const s = store.sel;
  const list = store.state.customers.map((c) => ({ c, mtd: s.customerMtd(c.id), owed: s.customerOutstanding(c.id), overdue: store.state.invoices.some((i) => i.customerId === c.id && s.invoiceState(i).overdueDays > 0) })).sort((a, b) => b.mtd - a.mtd);
  const tagCls = (t) => t === 'Contract' || t === 'Prepay' ? 'green' : t === '14 day' ? 'amber' : 'blue';
  return `<div class="two-col">
    <div class="card">
      <div class="card-head"><span class="title">Account customers</span><button type="button" class="link" ${act('openAccount')}>+ Add account</button></div>
      <div data-scroll="custlist">${list.map(({ c, mtd, owed, overdue }) => `<button type="button" class="cust-row" ${act('openDetail', { kind: 'customer', id: c.id })}>
        <div class="row between"><span class="name">${esc(c.name)}</span><span class="tag ${tagCls(c.terms)}">${esc(c.terms)}</span></div>
        <span class="meta">${esc(c.contact)} · ${esc(c.town)}</span>
        <div class="stats"><span>${esc(c.rateNote)}</span><span>${fin(store, mtd)} MTD</span><span style="color:${owed === 0 ? '#1E8E5A' : overdue ? '#E4131F' : '#131A21'}">${fin(store, owed)} outstanding</span></div>
      </button>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head" style="flex-direction:column; align-items:flex-start; gap:2px"><span class="title">Zone &amp; distance rate card</span><span class="hint">Base rate from Wexford depot · surcharges applied automatically</span></div>
      <div class="tbl" style="--cols:1.4fr 70px 1fr 1fr 1fr">
        <div class="tr th"><span>Zone</span><span>KM</span><span>Small van</span><span>Transit</span><span>Pallet</span></div>
        ${ZONES.map((z) => `<div class="tr"><span class="strong">${esc(z.label)}</span><span class="mono xs muted">${z.km}</span><span class="mono" style="font-size:13px">${money(z.rates.small)}</span><span class="mono" style="font-size:13px">${money(z.rates.transit)}</span><span class="mono" style="font-size:13px">${money(z.rates.pallet)}</span></div>`).join('')}
      </div>
      <div class="surcharges">${['Out of hours +35%', 'Sat/Sun +50%', 'Bank holiday +75%', 'Waiting time €22/30min', 'Tail lift €18', `Fuel surcharge ${store.state.settings.invoicing.fuelSurchargePct}%`].map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    </div>
  </div>`;
}

// ---------------- fleet ----------------
function fleet(store) {
  const s = store.sel; const n = store.now();
  const vans = store.state.vans;
  const comp = s.complianceItems();
  const active = vans.filter((v) => v.status === 'active').length;
  const dateCell = (d) => { const days = daysBetween(n, d); return `<span class="mono xs" style="color:${days < 0 ? '#E4131F' : days < 30 ? '#E4131F' : days < 90 ? '#C2700F' : '#131A21'}">${fmtDate(d)}</span>`; };
  const statusOf = (v) => { const d = s.driverForVan(v.id); if (v.status === 'offroad') return ['Off road · CVRT booked', '#E4131F']; if (v.status === 'spare') return ['Spare · unassigned', '#6B7480']; if (!d?.shift) return ['Finished for day', '#6B7480']; return ['Active · on road', '#1E8E5A']; };
  const fuel = sum(vans, (v) => v.fuelMtd);
  const maint = sum(vans, (v) => v.maintenanceMtd);
  const dropsMonth = store.state.jobs.filter((j) => j.status === 'Delivered').length + 900; // month-to-date drops incl. pre-history
  return `<div class="stack g16">
    <div class="four-col">
      ${[['Vans in fleet', vans.length, `${active} on road · ${vans.filter((v) => v.status === 'offroad').length} off road · ${vans.filter((v) => v.status === 'spare').length} spare`, '#131A21'], ['Compliance due <30d', comp.length, comp.map((c) => `${c.van} ${c.what}`).join(' · ') || 'all clear', comp.length ? '#E4131F' : '#1E8E5A'], ['Fuel spend MTD', fin(store, fuel), '€0.19/km avg', '#131A21'], ['Cost per drop', fin(store, (fuel + maint) / dropsMonth, { cents: true }), 'fuel + maintenance ÷ drops MTD', '#1E8E5A']].map(([l, v, sub, c]) => `<div class="kpi card-kpi"><span class="eyebrow dk">${esc(l)}</span><span class="val" style="color:${c}">${v}</span><span class="sub">${esc(sub)}</span></div>`).join('')}
    </div>
    <div class="card">
      <div class="tbl" style="--cols:70px 1.2fr 1fr 108px 108px 118px 1fr">
        <div class="tr th"><span>Van</span><span>Reg / model</span><span>Assigned driver</span><span>Motor tax</span><span>CVRT</span><span>Service due</span><span>Status</span></div>
        ${vans.map((v) => { const d = s.driverForVan(v.id); const [st, col] = statusOf(v); return `<div class="tr click" ${act('openDetail', { kind: 'van', id: v.id })}>
          <span style="font-weight:800; letter-spacing:-.2px">${v.id}</span><span class="ink2"><span class="mono xs">${esc(v.reg)}</span> · ${esc(v.model)}${v.fridge ? ' · ❄' : ''}</span><span class="strong">${esc(d?.name || '—')}</span>
          ${dateCell(v.taxDue)}${dateCell(v.cvrtDue)}<span class="mono xs" style="color:${v.serviceDueKm < 0 ? '#E4131F' : v.serviceDueKm < 1500 ? '#C2700F' : '#131A21'}">${v.serviceDueKm < 0 ? 'Overdue' : v.serviceDueKm.toLocaleString('en-IE') + ' km'}</span>
          <span class="small strong" style="color:${col}">${st}</span>
        </div>`; }).join('')}
      </div>
    </div>
  </div>`;
}

// ---------------- drivers & payroll ----------------
function drivers(store) {
  const s = store.sel; const n = store.now();
  const rows = s.payrollRows();
  const wk = weekRange(n); const key = s.weekKey(); const approved = store.state.payroll.approvedWeeks[key];
  const total = sum(rows, (r) => r.pay);
  return `<div class="card">
    <div class="card-head">
      <div class="col" style="gap:2px"><span class="title">Week ${isoWeek(n)} · ${fmtDate(wk.start).slice(0, 6)} – ${fmtDate(wk.end)}</span><span class="hint">Hours pulled from driver app shift clock · expenses from receipt uploads</span></div>
      ${store.state.settings.showFinancials ? (approved ? `<span class="tag green">Approved ${fmtWhen(approved.at, n)} · ${money(approved.total)}</span>` : `<button type="button" class="btn blue" ${act('approvePayroll')}>Approve payroll · ${money(total)}</button>`) : ''}
    </div>
    <div class="tbl" style="--cols:1.2fr 70px 84px 84px 84px 96px 100px 1fr">
      <div class="tr th"><span>Driver</span><span>Van</span><span>Hours</span><span>Drops</span><span>On time</span><span>Expenses</span><span>Pay due</span><span>Compliance</span></div>
      ${rows.map((r) => `<div class="tr click" ${act('openDetail', { kind: 'driver', id: r.driver.id })}>
        <div class="row" style="gap:9px"><span class="avatar sm">${initials(r.driver.name)}</span><span class="strong">${esc(r.driver.name)}</span>${r.driver.shift ? `<span class="dot" style="background:#1E8E5A" title="On shift"></span>` : ''}</div>
        <span class="mono xs">${r.driver.van}</span><span class="mono xs">${r.hours.toFixed(1)}</span><span class="mono xs">${r.drops}</span><span class="mono xs" style="color:${r.onTime !== null && r.onTime < 93 ? '#E4131F' : '#131A21'}">${r.onTime === null ? '—' : r.onTime + '%'}</span>
        <span class="mono xs">${fin(store, r.expenses)}</span><span class="mono strong" style="font-size:13px">${fin(store, r.pay)}</span><span class="small strong" style="color:${r.driver.complianceOk ? '#1E8E5A' : '#E4131F'}">${esc(r.driver.compliance)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

// ---------------- invoicing ----------------
function invoicing(store) {
  const s = store.sel; const n = store.now(); const show = store.state.settings.showFinancials;
  const ready = s.readyToBill();
  const readyNet = sum(ready, (j) => j.price);
  const inv = store.state.invoices;
  const outstanding = sum(inv.filter((i) => i.status === 'Sent' || i.status === 'Notified'), s.invoiceGross);
  const overdue30 = sum(inv.filter((i) => (s.invoiceState(i).overdueDays || 0) > 0), s.invoiceGross);
  const paidMonth = sum(inv.filter((i) => i.status === 'Paid' && i.paidAt && toDate(i.paidAt).getMonth() === n.getMonth()), s.invoiceGross);
  const colors = { green: '#1E8E5A', blue: '#0F7DC2', red: '#E4131F', amber: '#C2700F' };
  return `<div class="stack g16">
    <div class="hero">
      <div class="col grow" style="gap:4px"><span class="eyebrow">Ready to bill</span><span class="big">${show ? money(readyNet) : '••••'}</span><span class="hint">${ready.length} completed job${ready.length === 1 ? '' : 's'} with POD, not yet invoiced</span></div>
      ${[['Outstanding', outstanding, '#fff'], ['Overdue', overdue30, '#FF7B82'], ['Paid this month', paidMonth, '#68D19B']].map(([l, v, c]) => `<div class="stat"><span class="eyebrow">${l}</span><span class="v" style="color:${c}">${show ? money(v) : HIDDEN}</span></div>`).join('')}
      <button type="button" class="btn red" ${act('runBilling')} ${ready.length ? '' : 'disabled'}>Run weekly billing</button>
    </div>
    <div class="card">
      <div class="tbl" style="--cols:110px 1.4fr 110px 110px 100px 1fr">
        <div class="tr th"><span>Invoice</span><span>Customer</span><span>Issued</span><span>Due</span><span>Amount</span><span>Status</span></div>
        ${inv.map((i) => { const st = s.invoiceState(i); const c = s.customerById(i.customerId); return `<div class="tr click" ${act('openDetail', { kind: 'invoice', id: i.id })}>
          <span class="ref">${esc(i.id)}</span><span class="strong">${esc(c?.name || '')}${i.status === 'Draft' ? ` <span class="muted">· ${i.jobsCount} jobs</span>` : ''}</span><span class="mono xs muted">${i.issuedAt ? fmtDate(i.issuedAt) : '—'}</span><span class="mono xs muted">${i.dueAt ? fmtDate(i.dueAt) : '—'}</span><span class="mono strong" style="font-size:13px">${show ? money(s.invoiceGross(i)) : HIDDEN}</span><span class="small strong" style="color:${colors[st.color]}">${esc(st.label)}</span>
        </div>`; }).join('')}
      </div>
    </div>
  </div>`;
}

// ---------------- reports ----------------
function reports(store) {
  const s = store.sel; const show = store.state.settings.showFinancials; const n = store.now();
  const chart = s.chart();
  const max = Math.max(...chart.map((c) => c.jobs), 1);
  const avg = Math.round(sum(chart, (c) => c.jobs) / chart.length);
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const recent = store.state.jobs.filter((j) => daysBetween(j.readyFrom, n) <= 30);
  const mix = {}; recent.forEach((j) => { mix[j.service] = (mix[j.service] || 0) + 1; });
  const mixRows = Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v: pct(v, recent.length) + '%', color: '#131A21' }));
  const rate = store.state.settings.payRate;
  const marginRows = Object.keys(mix).map((svc) => { const js = recent.filter((j) => j.service === svc && j.status !== 'Failed'); const m = js.length ? sum(js, (j) => j.price - (j.km * 0.42 + (0.5 + j.km / 60) * rate)) / js.length : 0; return { k: svc, v: show ? `${money(m)} margin` : HIDDEN, color: m < 10 ? '#E4131F' : m > 40 ? '#1E8E5A' : '#131A21', m }; }).sort((a, b) => b.m - a.m);
  const failedPct = pct(recent.filter((j) => j.status === 'Failed').length, recent.length || 1);
  const k = s.kpis();
  const lossRows = [{ k: 'Waiting at collection', v: '6.4 h/wk', color: '#E4131F' }, { k: 'Unbilled waiting time', v: show ? '€480' : HIDDEN, color: '#E4131F' }, { k: 'Empty return legs', v: '22%', color: '#C2700F' }, { k: 'Failed deliveries', v: `${failedPct}%`, color: failedPct > 2 ? '#E4131F' : '#131A21' }, { k: 'Avg drops per van today', v: (k.drops / Math.max(1, k.onRoad)).toFixed(1), color: '#131A21' }];
  const card = (title, rows) => `<div class="card"><div class="card-head"><span class="title">${esc(title)}</span></div>${rows.map((r) => `<div class="list-row"><span class="k">${esc(r.k)}</span><span class="v" style="color:${r.color}">${r.v}</span></div>`).join('')}</div>`;
  return `<div class="stack g16">
    <div class="card" style="padding:18px 20px">
      <div class="row between" style="align-items:flex-end; margin-bottom:16px"><div class="col" style="gap:3px"><span style="font-size:16px; font-weight:700">Jobs per day · last 14 days</span><span class="small muted">Red = delivered late or failed · today updates live</span></div><span class="mono xs muted">avg ${avg}/day</span></div>
      <div class="chart">${chart.map((c) => `<div class="bar ${c.today ? 'today' : ''}" title="${fmtDate(c.day)} · ${c.jobs} jobs · ${c.late} late"><div class="stack" style="height:${Math.round((c.jobs / max) * 100)}%"><div class="late" style="height:${c.jobs ? Math.round((c.late / c.jobs) * 100) : 0}%"></div><div class="ok"></div></div><span class="lbl">${days[toDate(c.day).getDay()]}</span></div>`).join('')}</div>
    </div>
    <div class="three-col">${card('Service mix (30 days)', mixRows)}${card('Profit per service (est.)', marginRows)}${card('Where time is lost', lossRows)}</div>
  </div>`;
}

// ---------------- POD archive ----------------
function pod(store) {
  const s = store.sel; const n = store.now();
  const list = s.pods();
  return `<div class="pod-grid">${list.map((j) => `<button type="button" class="pod" ${act('openDetail', { kind: 'pod', id: j.id })}>
    <div class="thumb">${j.pod.photo ? `<img src="${j.pod.photo}" alt="Delivery photo">` : `<span class="kind">${esc(j.pod.kind)}</span>`}</div>
    <div class="body">
      <div class="row between"><span class="ref">${esc(j.ref)}</span>${statusTag(j.status === 'Failed' ? 'Failed' : 'Delivered')}</div>
      <span class="cust">${esc(j.customer)}</span>
      <span class="small muted">${j.status === 'Failed' ? esc(j.failReason || 'Failed') : `Signed ${esc(j.pod.signedBy)}`} · ${fmtWhen(j.pod.at, n)}</span>
      <span class="mono xs sub">${esc(j.pod.van || j.van || '')} · GPS verified</span>
    </div>
  </button>`).join('') || emptyRow('No proof-of-delivery records yet.')}</div>`;
}

// ---------------- alerts & automation ----------------
function alertsScreen(store) {
  const s = store.sel; const n = store.now();
  const alerts = s.alerts();
  const msgs = store.state.messages.slice(0, 12);
  return `<div class="two-col" style="grid-template-columns:1fr 1fr">
    <div class="stack g16">
      <div class="card">
        <div class="card-head"><span class="title">Automated customer notifications</span></div>
        ${store.state.automations.map((a) => `<div class="auto-row"><button type="button" class="toggle ${a.on ? 'on' : ''}" ${act('toggleAutomation', a.id)} aria-label="Toggle ${esc(a.name)}"></button><div class="col grow" style="gap:2px"><span class="n">${esc(a.name)}</span><span class="d">${esc(a.detail)}</span></div><span class="ch">${esc(a.channel)}</span></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-head"><span class="title">Sent today</span><span class="count muted">${msgs.length}</span></div>
        ${msgs.map((m) => `<div class="msg-row"><span class="tm">${fmtTime(m.at)}</span><span class="ch">${esc(m.channel)}</span><span class="grow"><span class="strong">${esc(m.to)}</span> · ${esc(m.text)}</span></div>`).join('') || emptyRow('Nothing sent yet today.')}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><span class="title">Exceptions today</span><span class="count muted">${alerts.length}</span></div>
      ${alerts.map((a) => `<div class="exc ${a.color}">
        <div class="row between"><span class="t">${esc(a.title)}</span><span class="tm">${fmtTime(a.at)}</span></div>
        <span class="d">${esc(a.detail)}</span>
        <div class="row" style="gap:14px"><button type="button" class="link small" ${act('alertAction', a.id)}>${esc(a.action)}</button><button type="button" class="link small" style="color:#9AA2AC" ${act('dismissAlert', a.id)}>Dismiss</button></div>
      </div>`).join('') || emptyRow('No exceptions — a quiet day.')}
    </div>
  </div>`;
}

// ---------------- settings ----------------
function settings(store) {
  const st = store.state.settings; const { ui } = store.state;
  const tabs = ['Company', 'Users & roles', 'Services', 'Integrations', 'Notifications'];
  const input = (path, value, type = 'text') => `<input class="input" type="${type}" id="set-${path.replace(/\./g, '-')}" data-bind="settings.${path}" data-live="false" value="${esc(value)}">`;
  const group = (title, body) => `<div class="card"><div class="card-head"><span class="title">${esc(title)}</span></div>${body}</div>`;
  let intro = ''; let groups = '';
  if (ui.settingsTab === 'Company') {
    intro = 'Legal and depot details used on every invoice, docket and POD email. Edits save as you type.';
    groups = group('Business', kv('Trading name', input('company.tradingName', st.company.tradingName)) + kv('Registered name', input('company.registeredName', st.company.registeredName)) + kv('CRO number', input('company.cro', st.company.cro)) + kv('VAT number', input('company.vat', st.company.vat)) + kv('Established', esc(st.company.established)))
      + group('Depot', kv('Address', input('company.address', st.company.address)) + kv('Eircode', input('company.eircode', st.company.eircode)) + kv('Phone', input('company.phone', st.company.phone)) + kv('Out-of-hours mobile', input('company.mobile', st.company.mobile)) + kv('Opening hours', esc(st.company.hours)))
      + group('Invoicing defaults', kv('Default terms', `${input('invoicing.termsDays', st.invoicing.termsDays, 'number')}`) + kv('VAT rate %', input('invoicing.vatPct', st.invoicing.vatPct, 'number')) + kv('Fuel surcharge %', input('invoicing.fuelSurchargePct', st.invoicing.fuelSurchargePct, 'number')) + kv('Invoice run', esc(st.invoicing.runDay)) + kv('Bank', `${esc(st.invoicing.bankName)} · ${esc(st.invoicing.iban)}`));
  } else if (ui.settingsTab === 'Users & roles') {
    intro = 'Who can see what. Drivers only ever see their own run; office staff cannot change rate cards.';
    groups = group('Accounts', [['Paul Byrne', 'Owner · full access'], ['Marie Byrne', 'Office · dispatch, invoicing'], ['Karen Doyle', 'Office · dispatch only'], [`${store.state.drivers.length} driver logins`, 'Driver app only'], ['Accountant (external)', 'Read-only invoicing + reports']].map(([k, v]) => kv(k, esc(v))).join(''))
      + group('Permissions by role', [['Owner', 'Everything incl. pricing and payroll'], ['Office', 'Jobs, customers, POD, invoices'], ['Driver', 'Own run, POD capture, expenses'], ['Customer portal', 'Own jobs, own invoices, tracking'], ['Read-only', 'Reports and invoice exports']].map(([k, v]) => kv(k, esc(v))).join('') + `<div class="auto-row"><button type="button" class="toggle ${st.showFinancials ? 'on' : ''}" ${act('toggleFinancials')}></button><div class="col grow" style="gap:2px"><span class="n">Show financials on this screen</span><span class="d">Off = prices, pay and balances are masked (office-only login view)</span></div></div>`)
      + group('Security', Object.entries({ 'Two-factor': st.security.twoFactor, 'Driver device binding': st.security.deviceBinding, 'Session timeout': st.security.sessionTimeout, 'Audit log': st.security.audit }).map(([k, v]) => kv(k, esc(v))).join('') + `<div class="kv"><span class="k">Demo data</span><span class="v"><button type="button" class="btn sm" ${act('resetDemo')}>Reset demo data</button></span></div>`);
  } else if (ui.settingsTab === 'Services') {
    intro = 'Every service the business sells, and the rules dispatch applies automatically.';
    groups = group('Active services', [['Same-day urgent', 'Collect within 60 min · zone card'], ['Next-day parcel', 'Nationwide by 17:00'], ['Multi-drop route', 'Up to 12 stops · per-route price'], ['Pallet freight', 'To 1,000 kg · tail lift optional'], ['Furniture removal', '2-man crew · hourly + mileage'], ['Contract run', 'Recurring, fixed monthly invoice']].map(([k, v]) => kv(k, esc(v))).join(''))
      + group('Automatic rules', [['Out of hours', 'After 18:00 adds 35%'], ['Weekend', 'Sat/Sun adds 50%'], ['Waiting time', 'Free 30 min, then €22 per 30 min'], ['Failed delivery', 'Re-delivery charged at 50%'], ['Cold chain', 'Only RD4, RD7 (fridge fitted)']].map(([k, v]) => kv(k, esc(v))).join(''))
      + group('Capacity guards', kv('Max drops per van/day', input('capacity.maxDropsPerVan', st.capacity.maxDropsPerVan, 'number')) + kv('Max pallets per van', input('capacity.maxPalletsPerVan', st.capacity.maxPalletsPerVan, 'number')) + kv('Driver hours cap', input('capacity.driverHoursCap', st.capacity.driverHoursCap, 'number')) + kv('Auto-queue', 'Jobs over capacity go to unassigned queue'));
  } else if (ui.settingsTab === 'Integrations') {
    intro = 'The system is the hub — these connections stop anything being typed twice.';
    const row = (i) => `<div class="auto-row"><button type="button" class="toggle ${i.on ? 'on' : ''}" ${act('toggleIntegration', i.name)}></button><div class="col grow" style="gap:2px"><span class="n">${esc(i.name)}</span><span class="d">${esc(i.detail)}</span></div></div>`;
    groups = group('Connected', st.integrations.filter((i) => i.on).map(row).join('') || emptyRow('Nothing connected')) + group('Available', st.integrations.filter((i) => !i.on).map(row).join('') || emptyRow('Everything is connected'))
      + group('API & data', [['Customer API key', 'Issued per account'], ['Webhooks', 'Status change, POD ready, invoice issued'], ['Data export', 'CSV / Excel on any table'], ['Backups', 'Hourly, 30-day retention, Dublin region']].map(([k, v]) => kv(k, esc(v))).join(''));
  } else {
    intro = 'Who gets told what, and how loudly. Owner alerts are deliberately few.';
    groups = group('Owner alerts', st.notifications.owner.map(([k, v]) => kv(k, esc(v))).join('')) + group('Office alerts', st.notifications.office.map(([k, v]) => kv(k, esc(v))).join('')) + group('Quiet hours', st.notifications.quiet.map(([k, v]) => kv(k, esc(v))).join(''));
  }
  return `<div class="stack g16">
    <div class="row wrap">${tabs.map((t) => `<button type="button" class="pill lg ${ui.settingsTab === t ? 'on' : ''}" ${act('setSettingsTab', t)}>${esc(t)}</button>`).join('')}</div>
    <div style="font-size:15px; color:#6B7480; max-width:640px">${esc(intro)}</div>
    <div class="settings-grid">${groups}</div>
  </div>`;
}
