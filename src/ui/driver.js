// Driver app (phone frame).
import { esc, act, fmtTime, fmtDuration, minutesBetween, windowLabel, firstName, initials } from '../util.js';
import { roleSwitch, field } from './common.js';

const FAIL_REASONS = ['No access to premises', 'Closed / nobody there', 'Refused — wrong goods', 'Damaged in transit', 'Unsafe to unload'];
const NOTES = [
  ['One tap per event', 'Arrived, delivered, failed. Every tap timestamps and GPS-stamps itself, so dispatch never has to ring for a status.'],
  ['POD is automatic', 'Photo and signature upload against the job reference and reach the customer by email before the driver pulls away.'],
  ['Shift clock feeds payroll', 'Clock-in and clock-out become the hours on the Friday payroll run — no timesheets.'],
  ['Works offline', 'Signal drops on the N11 and the Cork run happen. Events queue locally and sync when the van gets bars.'],
];

export function driverView(store) {
  const { ui } = store.state; const s = store.sel; const n = store.now();
  const run = s.driverRun(ui.driverId);
  const d = run.driver; const j = run.current;
  const shiftMins = d?.shift ? minutesBetween(d.shift.startedAt, n) : 0;
  const stage = ui.dStage;
  const D = store.drafts; if (!D.delivery) D.delivery = { receivedBy: '', photo: null, signature: null, error: '' };
  const del = D.delivery;
  const total = run.queue.length + (j ? 1 : 0) + run.doneToday;
  let stageLabel = '', cta = '', ctaAct = '';
  if (j) {
    if (j.status === 'Assigned') { stageLabel = `DROP ${run.doneToday + 1} OF ${total} · ASSIGNED`; cta = 'Mark collected'; ctaAct = 'driverCollect'; }
    else if (j.status === 'Collected') { stageLabel = `DROP ${run.doneToday + 1} OF ${total} · COLLECTED`; cta = 'Depart · on route'; ctaAct = 'driverDepart'; }
    else if (stage === 'arrived') { stageLabel = 'ARRIVED AT DROP'; cta = 'Complete delivery'; ctaAct = 'driverComplete'; }
    else { stageLabel = `DROP ${run.doneToday + 1} OF ${total} · ON ROUTE`; cta = 'Arrived at delivery'; ctaAct = 'driverArrive'; }
  }
  const mapsUrl = j ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${j.to.addr}, ${j.to.town}`)}` : '#';
  return `<div class="driver-stage">
    <div class="phone">
      <div class="phone-top">
        <div class="status-line"><span>${fmtTime(n)} · WEXFORD</span><select id="driver-pick" data-change="setDriver" aria-label="Driver">${store.state.drivers.map((x) => `<option value="${x.id}" ${x.id === ui.driverId ? 'selected' : ''}>${x.van} · ${firstName(x.name)[0]}. ${x.name.split(' ').slice(1).join(' ').toUpperCase()}</option>`).join('')}</select></div>
        <button type="button" class="shift ${d?.shift ? 'on' : ''}" ${act('toggleShift', d?.id)}>
          <div class="col" style="gap:2px"><span class="t">${d?.shift ? 'Shift running' : 'Start shift'}</span><span class="s">${d?.shift ? `Started ${fmtTime(d.shift.startedAt)} · tap to end` : 'Tap to clock in for today'}</span></div>
          <span class="clock" data-clock="${d?.shift ? d.shift.startedAt : ''}">${d?.shift ? fmtDuration(shiftMins) : '00:00'}</span>
        </button>
      </div>
      <div class="phone-body" data-scroll="phone">
        ${j ? `<div class="pcard">
          <div class="row between"><span class="ref" style="font-size:12px">${esc(j.ref)}</span><span class="stage-tag ${stage === 'arrived' ? 'blue' : ''}">${stageLabel}</span></div>
          <span class="cust">${esc(j.customer)}</span>
          <div class="col" style="gap:2px"><span class="addr">${esc(j.status === 'Assigned' ? j.from.addr : j.to.addr)}</span><span class="town">${esc(j.status === 'Assigned' ? `${j.from.town} · collect` : j.to.town)}${j.to.eircode ? ` · ${esc(j.to.eircode)}` : ''}</span></div>
          <div class="row" style="gap:8px"><a class="btn blue grow" href="${esc(mapsUrl)}" target="_blank" rel="noopener">Navigate</a><a class="btn grow" href="tel:${esc((j.contact || '').replace(/[^\d+]/g, '') || '0539124480')}">Call site</a></div>
          <div class="pfacts">${[['Pieces', j.pieces], ['Weight', `${j.weightKg || '—'} kg`], ['Due', windowLabel(j, n).replace('By ', '')]].map(([k, v]) => `<div class="f"><span class="eyebrow">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
          ${j.notes ? `<div class="small muted">Note: ${esc(j.notes)}</div>` : ''}
        </div>
        <div class="pcard">
          <span class="eyebrow">Proof of delivery</span>
          <div class="two">
            <label class="capture ${del.photo ? 'done' : ''}">${del.photo ? `<img src="${del.photo}" alt="Parcel photo"><span class="ok-mark">PHOTO</span>` : 'TAKE PHOTO<br>OF PARCEL'}<input type="file" accept="image/*" capture="environment" id="pod-photo" data-bind="delivery.photoFile" data-live="false"></label>
            <div class="capture plain ${del.signature ? 'done' : ''}" id="sigpad">${del.signature ? '<span class="ok-mark">SIGNED</span>' : '<span id="sig-hint">SIGN HERE</span>'}<canvas id="sig-canvas" width="330" height="190" aria-label="Signature pad"></canvas></div>
          </div>
          ${field({ id: 'pod-name', label: 'Received by', bind: 'delivery.receivedBy', value: del.receivedBy, placeholder: 'Name of person signing…', error: del.error, live: false })}
          <button type="button" class="btn green xl block" ${act(ctaAct, j.id)}>${cta}</button>
          <div class="row" style="gap:8px"><button type="button" class="btn outline-red grow" ${act('toggleFail')}>Can't deliver</button><button type="button" class="btn grow" style="padding:11px; border-radius:9px; font-size:14px" ${act('toggleFuel')}>Fuel receipt</button></div>
          ${ui.showFuel && D.fuel ? `<form class="col" style="gap:9px; padding-top:6px; border-top:1px solid #EEF0F3" data-submit="submitExpense" data-arg="${esc(JSON.stringify(d.id))}">
            <span class="eyebrow">Expense · goes straight to payroll</span>
            <label class="capture" style="height:88px">${D.fuel.receipt ? `<img src="${D.fuel.receipt}" alt="Receipt"><span class="ok-mark">RECEIPT</span>` : 'PHOTO OF RECEIPT'}<input type="file" accept="image/*" capture="environment" id="fuel-photo" data-bind="fuel.receiptFile" data-live="false"></label>
            <div class="two">${field({ id: 'fuel-amount', label: 'Amount €', bind: 'fuel.amount', value: D.fuel.amount, type: 'number', step: '0.01', min: 0, placeholder: '92.40', error: D.fuel.error, live: false })}${field({ id: 'fuel-type', label: 'Type', bind: 'fuel.type', value: D.fuel.type, options: ['Diesel', 'AdBlue', 'Tolls', 'Parking', 'Other'] })}</div>
            <button type="submit" class="btn dark block" style="border-radius:9px">Submit expense</button>
          </form>` : ''}
          ${ui.showFail ? `<div class="col" style="gap:6px; padding-top:4px"><span class="eyebrow" style="color:#B0121C">Reason — dispatch is notified</span>${FAIL_REASONS.map((r) => `<button type="button" class="reason" ${act('driverFail', { jobId: j.id, reason: r })}>${r}</button>`).join('')}</div>` : ''}
        </div>` : `<div class="done-card"><span class="eyebrow">${d?.van || ''}</span><span class="t">Run complete</span><span class="muted">${run.doneToday} drop${run.doneToday === 1 ? '' : 's'} done today. Nothing else assigned to ${d?.van || 'this van'} — dispatch will push the next job here.</span>${d?.shift ? `<button type="button" class="btn dark" ${act('toggleShift', d.id)}>End shift</button>` : ''}</div>`}
        <div class="pcard flush">
          <div class="row between" style="padding:13px 16px; border-bottom:1px solid #EEF0F3"><span style="font-size:15.5px; font-weight:700">Rest of run</span><span class="mono xs muted">${run.queue.length} drops</span></div>
          ${run.queue.map((q, i) => `<div class="queue-row"><span class="n">${run.doneToday + i + 2}</span><div class="col grow" style="gap:2px"><span class="c">${esc(q.customer)}</span><span class="d">${esc(q.to.town)} · ${esc(windowLabel(q, n))}</span></div><span class="km">${q.km} km</span></div>`).join('') || '<div class="queue-row"><span class="d">Nothing else queued — return leg to depot.</span></div>'}
        </div>
      </div>
    </div>
    <div class="driver-notes">
      ${roleSwitch(store)}
      <span class="eyebrow">DRIVER APP · ANDROID / IOS</span>
      ${NOTES.map(([t, b]) => `<div class="note"><span class="t">${t}</span><span class="b">${b}</span></div>`).join('')}
    </div>
  </div>`;
}
