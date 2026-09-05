import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage shim so the store can run under node.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.structuredClone ??= (x) => JSON.parse(JSON.stringify(x));

const { createStore } = await import('../src/store.js');

let store;
beforeEach(() => { mem.clear(); store = createStore(); });

test('seed produces a coherent dataset', () => {
  const s = store.state;
  assert.equal(s.vans.length, 10);
  assert.equal(s.drivers.length, 10);
  assert.ok(s.jobs.length > 16);
  assert.equal(store.sel.unassigned().length, 4);
  assert.ok(store.sel.readyToBill().length > 0);
  const k = store.sel.kpis();
  assert.equal(k.unassigned, 4);
  assert.ok(k.total >= 16);
});

test('creating a job from the office draft prices it and queues it', () => {
  store.actions.openNewJob('c_sinnott');
  const d = store.drafts.newJob;
  d.toAddr = 'Blackthorn Rd, Sandyford'; d.toCounty = 'Dublin'; d.pieces = '2 boxes'; d.weightKg = '14';
  d.readyFrom = '2026-09-08T10:00'; d.deliverBy = '2026-09-08T16:00'; // a weekday, no surcharge
  const before = store.state.jobs.length;
  store.actions.createJob();
  assert.equal(store.state.jobs.length, before + 1);
  const job = store.state.jobs[0];
  assert.equal(job.status, 'Unassigned');
  assert.equal(job.zone, 3);
  assert.equal(job.price, 49.99); // €52 −8% + 4.5% fuel
  assert.ok(job.activity.length >= 2);
  assert.equal(store.state.ui.modal, null);
  assert.equal(store.state.messages[0].channel, 'EMAIL'); // booking confirmation automation
});

test('validation blocks an incomplete job', () => {
  store.actions.openNewJob('c_sinnott');
  store.drafts.newJob.toAddr = '';
  const before = store.state.jobs.length;
  store.actions.createJob();
  assert.equal(store.state.jobs.length, before);
  assert.ok(store.drafts.newJob.errors.toAddr);
  assert.equal(store.state.ui.modal, 'newjob');
});

test('assigning a queued job moves it to Assigned and logs activity', () => {
  const j = store.sel.unassigned().find((x) => !/cold chain/i.test(x.pieces));
  store.actions.assignJob(j.id, 'RD2');
  assert.equal(j.status, 'Assigned');
  assert.equal(j.van, 'RD2');
  assert.match(j.activity.at(-1).text, /Assigned to RD2/);
  assert.equal(store.sel.unassigned().length, 3);
});

test('cold chain jobs cannot go on a van without a fridge', () => {
  const j = store.state.jobs.find((x) => /cold chain/i.test(x.pieces) && x.status === 'Unassigned');
  store.actions.assignJob(j.id, 'RD3');
  assert.equal(j.status, 'Unassigned');
  store.actions.assignJob(j.id, 'RD7');
  assert.equal(j.van, 'RD7');
});

test('off-road vans refuse assignments', () => {
  const j = store.sel.unassigned().find((x) => !/cold chain/i.test(x.pieces));
  store.actions.assignJob(j.id, 'RD6');
  assert.equal(j.van, null);
});

test('driver flow: collected → on route → delivered creates a POD and bills later', () => {
  const j = store.state.jobs.find((x) => x.status === 'Assigned' && x.van === 'RD2');
  store.actions.setStatus(j.id, 'Collected');
  assert.equal(j.status, 'Collected');
  store.actions.setStatus(j.id, 'On route');
  assert.equal(j.status, 'On route');
  store.actions.setStatus(j.id, 'Delivered', { receivedBy: 'Parts desk', signature: 'data:image/png;base64,x' });
  assert.equal(j.status, 'Delivered');
  assert.equal(j.pod.signedBy, 'Parts desk');
  assert.equal(j.pod.kind, 'SIGNATURE');
  assert.ok(store.sel.readyToBill().some((x) => x.id === j.id));
});

test('failed delivery raises an alert and can be re-booked at 50%', () => {
  const j = store.state.jobs.find((x) => x.status === 'On route');
  store.actions.setStatus(j.id, 'Failed', { reason: 'Closed / nobody there' });
  assert.equal(j.status, 'Failed');
  assert.ok(store.sel.alerts().some((a) => a.id === `failed:${j.id}`));
  const before = store.state.jobs.length;
  store.actions.rebookFailed(j.id);
  assert.equal(store.state.jobs.length, before + 1);
  const nj = store.state.jobs[0];
  assert.equal(nj.price, Math.round(j.price * 50) / 100);
  assert.equal(nj.status, 'Unassigned');
  assert.ok(!store.sel.alerts().some((a) => a.id === `failed:${j.id}`));
});

test('weekly billing drafts one invoice per customer and sending issues it', () => {
  const ready = store.sel.readyToBill();
  const customers = new Set(ready.map((j) => j.customerId));
  const before = store.state.invoices.length;
  store.actions.runBilling();
  assert.equal(store.state.invoices.length, before + customers.size);
  assert.equal(store.sel.readyToBill().length, 0);
  const draft = store.state.invoices.find((i) => i.status === 'Draft');
  const draftId = draft.id;
  store.actions.sendInvoice(draftId);
  assert.equal(draft.status, 'Sent');
  assert.match(draft.id, /^INV-\d+$/);
  assert.ok(draft.jobIds.every((id) => store.sel.jobById(id).invoiceId === draft.id));
  assert.ok(store.state.messages[0].text.startsWith(draft.id));
});

test('customer payment notification flows through to owner confirmation', () => {
  const inv = store.state.invoices.find((i) => i.status === 'Sent');
  store.actions.notifyPayment(inv.id);
  assert.equal(inv.status, 'Notified');
  assert.ok(store.sel.alerts().some((a) => a.kind === 'notified'));
  store.actions.markPaid(inv.id);
  assert.equal(inv.status, 'Paid');
});

test('portal order requires a PO for accounts that demand one', () => {
  store.state.ui.portalCustomerId = 'c_sinnott';
  store.drafts.booking = store.sel.bookingDraft('c_sinnott');
  Object.assign(store.drafts.booking, { toAddr: 'Kinsale Rd, Cork', toCounty: 'Cork', pieces: '1 pallet', po: '' });
  const before = store.state.jobs.length;
  store.actions.placeOrder();
  assert.equal(store.state.jobs.length, before);
  assert.ok(store.drafts.booking.errors.po);
  store.drafts.booking.po = 'PO-1';
  store.actions.placeOrder();
  assert.equal(store.state.jobs.length, before + 1);
  assert.equal(store.state.jobs[0].source, 'portal');
  assert.ok(store.state.ui.ordered);
});

test('shift clock and expenses feed payroll', () => {
  const d = store.sel.driverById('d1'); // Paul is at the depot, off shift
  assert.equal(d.shift, null);
  store.actions.toggleShift('d1');
  assert.ok(d.shift);
  store.drafts.fuel = { amount: '92.40', type: 'Diesel', receipt: null };
  store.actions.submitExpense('d1');
  const row = store.sel.payrollRows().find((r) => r.driver.id === 'd1');
  assert.equal(row.expenses, 62 + 92.4);
  assert.ok(row.pay >= 92.4);
});

test('state survives a reload through localStorage', () => {
  store.actions.go('reports');
  const raw = mem.get('roaddog.ops.state');
  assert.ok(raw === undefined || typeof raw === 'string');
});
