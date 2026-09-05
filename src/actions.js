// Maps data-act names and data-bind inputs to store actions, plus browser-only side effects
// (printing, file capture, signature pad, live shift clock).
import { esc, money, fmtDate, fmtTime, fmtDateTime, fmtDuration, minutesBetween, sum } from './util.js';

export function createHandlers(store) {
  const A = store.actions; const S = store.sel;

  // ---------- printing (opens a print-ready window) ----------
  function printWindow(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { store.commit(() => {}); alert('Allow pop-ups to download PDFs'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Archivo,Helvetica,Arial,sans-serif;color:#131A21;margin:40px;font-size:14px}h1{font-size:24px;margin:0 0 4px}.mono{font-family:'IBM Plex Mono',Menlo,monospace}.muted{color:#6B7480}
      table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #E3E6EA;font-size:13px}th{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6B7480}.r{text-align:right}
      .logo{font-weight:800;font-size:22px}.logo .r1{color:#E4131F}.logo .b1{color:#2E9BE0}.box{border:1px solid #E3E6EA;border-radius:8px;padding:12px 14px;margin-top:14px}.tot{font-size:18px;font-weight:800}img{max-width:300px;border:1px solid #E3E6EA;border-radius:6px;margin-top:8px}
      @media print{button{display:none}}</style></head><body>${bodyHtml}<p style="margin-top:28px"><button onclick="window.print()">Print / Save as PDF</button></p></body></html>`);
    w.document.close();
  }
  const letterhead = (kicker) => { const c = store.state.settings.company; return `<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="logo"><span class="r1">ROAD</span><span class="b1">DOG</span></div><div class="muted">${esc(c.registeredName)} t/a ${esc(c.tradingName)}<br>${esc(c.address)}, ${esc(c.eircode)}<br>${esc(c.phone)} · ${esc(c.email)}<br>VAT ${esc(c.vat)} · CRO ${esc(c.cro)}</div></div><div style="text-align:right"><div class="mono muted" style="font-size:11px;letter-spacing:.12em">${kicker}</div></div></div>`; };

  function printInvoice(id) {
    const inv = S.invoiceById(id); if (!inv) return;
    const c = S.customerById(inv.customerId); const b = store.state.settings.invoicing;
    const jobs = inv.jobIds.map(S.jobById).filter(Boolean);
    const lines = jobs.length ? jobs.map((j) => `<tr><td class="mono">${esc(j.ref)}</td><td>${fmtDate(j.readyFrom)}</td><td>${esc(j.from.town)} → ${esc(j.to.name)}</td><td>${esc(j.service)}</td><td class="mono">${esc(j.po || '')}</td><td class="r mono">${money(j.price, { cents: true })}</td></tr>`).join('') : inv.lines.map((l) => `<tr><td colspan="5">${esc(l.label)}</td><td class="r mono">${money(l.amount, { cents: true })}</td></tr>`).join('');
    printWindow(inv.id, `${letterhead(inv.status === 'Draft' ? 'DRAFT INVOICE' : 'INVOICE')}
      <h1 style="margin-top:24px">${esc(inv.id)}</h1><div class="muted">Issued ${inv.issuedAt ? fmtDate(inv.issuedAt) : 'draft'} · Due ${inv.dueAt ? fmtDate(inv.dueAt) : `${inv.termsDays ?? c.termsDays} days`} · ${esc(c.terms)} terms</div>
      <div class="box"><strong>${esc(c.name)}</strong><br>${esc(c.contact)} · ${esc(c.town)}<br>${esc(c.email)}</div>
      <table><thead><tr><th>Ref</th><th>Date</th><th>Route</th><th>Service</th><th>PO</th><th class="r">Net</th></tr></thead><tbody>${lines}</tbody></table>
      <table style="width:320px;margin-left:auto"><tr><td>Net</td><td class="r mono">${money(inv.net, { cents: true })}</td></tr><tr><td>VAT ${inv.vatPct}%</td><td class="r mono">${money(inv.vat, { cents: true })}</td></tr><tr><td class="tot">Total due</td><td class="r mono tot">${money(S.invoiceGross(inv), { cents: true })}</td></tr></table>
      <div class="box">Pay by bank transfer to <strong>${esc(b.bankName)}</strong> · IBAN <span class="mono">${esc(b.iban)}</span> · BIC <span class="mono">${esc(b.bic)}</span><br>Quote <strong>${esc(inv.id)}</strong> as the reference. Transfers are matched automatically.</div>`);
  }
  function printPod(id) {
    const j = S.jobById(id); if (!j?.pod) return;
    const c = S.customerById(j.customerId); const drv = S.driverForVan(j.pod.van || j.van);
    printWindow(`POD ${j.ref}`, `${letterhead('PROOF OF DELIVERY')}
      <h1 style="margin-top:24px">${esc(j.ref)} · ${j.status === 'Failed' ? 'Delivery attempt' : 'Delivered'}</h1><div class="muted">${esc(c?.name || j.customer)}${j.po ? ` · PO ${esc(j.po)}` : ''}</div>
      <table><tr><th>Collection</th><td>${esc(j.from.name)}, ${esc(j.from.addr)}${j.collectedAt ? ` · ${fmtDateTime(j.collectedAt)}` : ''}</td></tr><tr><th>Delivery</th><td>${esc(j.to.name)}, ${esc(j.to.addr)}, ${esc(j.to.town)}</td></tr><tr><th>Consignment</th><td>${esc(j.pieces)}${j.weightKg ? ` · ${j.weightKg} kg` : ''}</td></tr><tr><th>${j.status === 'Failed' ? 'Attempted' : 'Delivered'}</th><td>${fmtDateTime(j.pod.at)} · GPS ${esc(j.pod.gps)} · within geofence ${esc(j.pod.geofence)}</td></tr><tr><th>Van / driver</th><td>${esc(j.pod.van || j.van || '')} · ${esc(drv?.name || '')}</td></tr><tr><th>${j.status === 'Failed' ? 'Reason' : 'Received by'}</th><td>${esc(j.status === 'Failed' ? j.failReason : j.pod.signedBy)}</td></tr></table>
      ${j.pod.photo ? `<div><div class="muted" style="margin-top:14px">Photo on delivery</div><img src="${j.pod.photo}"></div>` : ''}${j.pod.signature ? `<div><div class="muted" style="margin-top:14px">Signature</div><img src="${j.pod.signature}" style="background:#fff"></div>` : ''}
      <div class="box muted">Every status tap is timestamped and GPS-stamped by the driver app. Retained 7 years for claims.</div>`);
  }
  function printStatement(cid) {
    const c = S.customerById(cid); if (!c) return;
    const inv = store.state.invoices.filter((i) => i.customerId === cid && i.status !== 'Draft');
    const open = inv.filter((i) => i.status !== 'Paid');
    printWindow(`Statement ${c.name}`, `${letterhead('STATEMENT OF ACCOUNT')}
      <h1 style="margin-top:24px">${esc(c.name)}</h1><div class="muted">As at ${fmtDate(store.now())} · ${esc(c.terms)} terms</div>
      <table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>${inv.map((i) => `<tr><td class="mono">${esc(i.id)}</td><td>${fmtDate(i.issuedAt)}</td><td>${fmtDate(i.dueAt)}</td><td>${esc(S.invoiceState(i).label)}</td><td class="r mono">${money(S.invoiceGross(i), { cents: true })}</td></tr>`).join('')}</tbody></table>
      <table style="width:320px;margin-left:auto"><tr><td class="tot">Balance outstanding</td><td class="r mono tot">${money(sum(open, S.invoiceGross), { cents: true })}</td></tr></table>`);
    store.commit((s) => { s.messages.unshift({ id: `m_${Date.now()}`, at: store.now().toISOString(), channel: 'EMAIL', to: c.email, text: `Statement of account · balance €${sum(open, S.invoiceGross).toFixed(2)}` }); });
  }

  // ---------- image helpers ----------
  function fileToThumb(file, max = 480) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ---------- signature pad ----------
  const sig = { strokes: [], drawing: false };
  function initSignaturePad(root) {
    const canvas = root.querySelector('#sig-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const redraw = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#131A21'; sig.strokes.forEach((s) => { ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }); };
    const pt = (ev) => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) * (canvas.width / r.width), (ev.clientY - r.top) * (canvas.height / r.height)]; };
    canvas.onpointerdown = (ev) => { ev.preventDefault(); canvas.setPointerCapture(ev.pointerId); sig.drawing = true; sig.strokes.push([pt(ev)]); root.querySelector('#sig-hint')?.remove(); };
    canvas.onpointermove = (ev) => { if (!sig.drawing) return; sig.strokes[sig.strokes.length - 1].push(pt(ev)); redraw(); };
    const end = () => { if (!sig.drawing) return; sig.drawing = false; if (sig.strokes.some((s) => s.length > 3)) { store.drafts.delivery.signature = canvas.toDataURL('image/png'); const pad = root.querySelector('#sigpad'); pad?.classList.add('done'); if (pad && !pad.querySelector('.ok-mark')) pad.insertAdjacentHTML('afterbegin', '<span class="ok-mark">SIGNED</span>'); } };
    canvas.onpointerup = end; canvas.onpointercancel = end; canvas.onpointerleave = end;
    redraw();
  }
  const resetDelivery = () => { sig.strokes = []; store.drafts.delivery = { receivedBy: '', photo: null, signature: null, error: '' }; };

  // ---------- live shift clock (no re-render) ----------
  setInterval(() => { document.querySelectorAll('[data-clock]').forEach((el) => { const st = el.dataset.clock; if (st) el.textContent = fmtDuration(minutesBetween(st, new Date())); }); }, 30000);

  // ---------- alert routing ----------
  function alertAction(id) {
    const a = S.alerts().find((x) => x.id === id); if (!a) return;
    switch (a.kind) {
      case 'unassigned': A.go('dispatch'); A.selectJob(a.jobId); break;
      case 'failed': A.rebookFailed(a.jobId); break;
      case 'idle': A.openMessage(a.vanId); break;
      case 'late': A.notifyLate(a.jobId); break;
      case 'compliance': A.go('fleet'); A.openDetail('van', a.vanId); break;
      case 'overdue': A.sendReminder(a.invoiceId); break;
      case 'notified': A.markPaid(a.invoiceId); break;
      case 'query': A.resolveQuery(a.queryId); break;
    }
  }

  const actions = {
    noop: (_a, _el, ev) => ev.stopPropagation(),
    escape: () => { const u = store.state.ui; if (u.modal) A.closeModal(); else if (u.bankModal) A.closeBank(); else if (u.detail) A.closeDetail(); else if (u.selectedJobId) A.closeDrawer(); },
    setRole: (r) => A.setRole(r), go: (s) => A.go(s), goPortal: (s) => A.goPortal(s),
    selectJob: (id) => A.selectJob(id), closeDrawer: () => A.closeDrawer(),
    selectJobFromMap: (id) => { A.go('dispatch'); A.selectJob(id); },
    selectJobFromDetail: (id) => { if (!['dispatch', 'jobs'].includes(store.state.ui.screen)) A.go('jobs'); A.selectJob(id); },
    openDetail: ({ kind, id }) => A.openDetail(kind, id), closeDetail: () => A.closeDetail(), closeModal: () => A.closeModal(),
    toggleBoard: () => A.toggleBoard(), setJobFilter: (f) => A.setJobFilter(f), setSettingsTab: (t) => A.setSettingsTab(t), setMapVan: (id) => A.setMapVan(id),
    dismissAlert: (id) => A.dismissAlert(id), alertAction,
    openNewJob: (cid) => A.openNewJob(typeof cid === 'string' ? cid : undefined),
    draftSet: ({ name, key, value }) => A.setDraftAndRender(name, key, value),
    createJob: () => A.createJob(),
    assignJob: ({ jobId, vanId }) => A.assignJob(jobId, vanId), unassignJob: (id) => A.unassignJob(id),
    setStatus: ({ jobId, status }) => A.setStatus(jobId, status),
    officeDeliver: (jobId, form) => { const fd = new FormData(form); const reason = fd.get('reason'); if (reason) A.setStatus(jobId, 'Failed', { reason }); else A.setStatus(jobId, 'Delivered', { receivedBy: fd.get('receivedBy') }); },
    rebookFailed: (id) => A.rebookFailed(id), notifyLate: (id) => A.notifyLate(id),
    openMessage: (vanId) => A.openMessage(vanId), sendDriverMessage: () => A.sendDriverMessage(),
    toggleAutomation: (id) => A.toggleAutomation(id), toggleIntegration: (n) => A.toggleIntegration(n),
    toggleFinancials: () => A.updateSetting('showFinancials', !store.state.settings.showFinancials),
    resetDemo: () => { if (confirm('Reset all demo data? Everything you changed will be lost.')) { resetDelivery(); A.resetDemo(); } },
    runBilling: () => A.runBilling(), sendInvoice: (id) => A.sendInvoice(id), markPaid: (id) => A.markPaid(id), sendReminder: (id) => A.sendReminder(id),
    printInvoice, printPod, printStatement,
    emailPod: (id) => { const j = S.jobById(id); const c = S.customerById(j?.customerId); if (!j || !c) return; store.commit((s) => { s.messages.unshift({ id: `m_${Date.now()}`, at: store.now().toISOString(), channel: 'EMAIL', to: c.email, text: `POD for ${j.ref} re-sent` }); }); },
    approvePayroll: () => A.approvePayroll(),
    bookService: (id) => A.bookService(id), setVanStatus: ({ vanId, status }) => A.setVanStatus(vanId, status),
    openAccount: () => A.openAccount(), createAccount: () => A.createAccount(),
    // portal
    startBooking: (addrId) => { const c = S.customerById(store.state.ui.portalCustomerId); A.startBooking(c.addresses.find((a) => a.id === addrId)); },
    placeOrder: () => A.placeOrder(), resetOrder: () => A.resetOrder(),
    openInvite: () => A.openInvite(), inviteUser: () => A.inviteUser(), openAddress: () => A.openAddress(), saveAddress: () => A.saveAddress(),
    raiseQuery: () => A.raiseQuery(), openBank: (id) => { if (id) A.openBank(id); }, closeBank: () => A.closeBank(), notifyPayment: (id) => A.notifyPayment(id),
    openPortalPod: (id) => { const j = S.jobById(id); if (j?.pod) printPod(id); },
    // driver
    setDriver: (id) => { resetDelivery(); A.setDriver(id); },
    toggleShift: (id) => { if (id) A.toggleShift(id); },
    driverCollect: (jobId) => A.setStatus(jobId, 'Collected', { note: 'scanned at collection' }),
    driverDepart: (jobId) => A.setStatus(jobId, 'On route'),
    driverArrive: () => A.setStage('arrived'),
    driverComplete: (jobId) => {
      const d = store.drafts.delivery;
      if (!d.receivedBy.trim()) { d.error = 'Who signed for it?'; store.commit(() => {}); return; }
      A.setStatus(jobId, 'Delivered', { receivedBy: d.receivedBy.trim(), photo: d.photo, signature: d.signature });
      resetDelivery();
    },
    driverFail: ({ jobId, reason }) => { A.setStatus(jobId, 'Failed', { reason, photo: store.drafts.delivery.photo }); resetDelivery(); },
    toggleFail: () => A.toggleFail(), toggleFuel: () => A.toggleFuel(),
    submitExpense: (driverId) => A.submitExpense(driverId),
  };

  // data-bind handler: drafts, ui.search and settings.* live edits
  function bind(draft, key, value, el) {
    if (draft === 'ui' && key === 'search') { A.setSearch(value); return; }
    if (draft === 'settings') { A.updateSetting(el.dataset.bind.slice('settings.'.length), value); return; }
    if (el.type === 'file') {
      const file = el.files?.[0]; if (!file) return;
      fileToThumb(file).then((data) => { const target = key === 'photoFile' ? 'photo' : 'receipt'; if (store.drafts[draft]) { store.drafts[draft][target] = data; store.commit(() => {}); } }).catch(() => {});
      return;
    }
    A.setDraft(draft, key, value);
  }

  return { actions, bind, afterRender: initSignaturePad };
}
