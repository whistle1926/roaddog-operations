import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, zoneFor, zoneByKm, vehicleFor, COUNTIES, ZONES } from '../src/pricing.js';

const settings = { vatPct: 23, fuelSurchargePct: 4.5 };
const weekday10 = new Date(2026, 8, 1, 10, 0); // Tue 1 Sep 2026 10:00

test('zone lookup by county and by km', () => {
  assert.equal(zoneFor('Dublin').zone, 3);
  assert.equal(zoneFor('Wexford').zone, 1);
  assert.equal(zoneFor('Nowhere'), null);
  assert.equal(zoneByKm(10).zone, 1);
  assert.equal(zoneByKm(200).zone, 4);
  assert.equal(zoneByKm(999).zone, 7);
  assert.equal(Object.keys(COUNTIES).length, 27);
  assert.equal(ZONES.length, 7);
});

test('same-day urgent to Dublin prices from zone 3 small van', () => {
  const q = quote({ service: 'Same-day urgent', county: 'Dublin', weightKg: 14, readyFrom: weekday10 }, settings);
  assert.equal(q.zone, 3);
  assert.equal(q.vehicle, 'small');
  assert.equal(q.subtotal, 52);
  assert.equal(q.fuel, 2.34);
  assert.equal(q.net, 54.34);
  assert.equal(q.vat, 12.5);
  assert.equal(q.gross, 66.84);
});

test('heavy same-day consignment upgrades to a Transit', () => {
  assert.equal(vehicleFor('Same-day urgent', { weightKg: 300 }), 'transit');
  const q = quote({ service: 'Same-day urgent', county: 'Dublin', weightKg: 300, readyFrom: weekday10 }, settings);
  assert.equal(q.subtotal, 78);
});

test('account discount reduces the subtotal before fuel surcharge', () => {
  const q = quote({ service: 'Same-day urgent', county: 'Dublin', readyFrom: weekday10, discountPct: 8 }, settings);
  assert.equal(q.discount, 4.16);
  assert.equal(q.net, 49.99);
  assert.match(q.basis, /account discount 8%/);
});

test('out-of-hours, weekend and bank holiday surcharges', () => {
  const evening = quote({ service: 'Same-day urgent', county: 'Wexford', readyFrom: new Date(2026, 8, 1, 19, 0) }, settings);
  assert.ok(evening.lines.some((l) => l.label.startsWith('Out of hours')));
  assert.equal(evening.subtotal, 22 + 7.7);
  const sat = quote({ service: 'Same-day urgent', county: 'Wexford', readyFrom: new Date(2026, 8, 5, 10, 0) }, settings);
  assert.ok(sat.lines.some((l) => l.label.startsWith('Weekend')));
  const bh = quote({ service: 'Same-day urgent', county: 'Wexford', readyFrom: new Date(2026, 9, 26, 10, 0) }, settings);
  assert.ok(bh.lines.some((l) => l.label.startsWith('Bank holiday')));
  assert.equal(bh.subtotal, 22 + 16.5);
});

test('multi-drop charges per extra stop', () => {
  const q = quote({ service: 'Multi-drop route', county: 'Wexford', stops: 9, readyFrom: weekday10 }, settings);
  assert.equal(q.subtotal, 35 + 8 * 18);
});

test('pallet freight charges extra pallets at 40%', () => {
  const q = quote({ service: 'Pallet freight', county: 'Cork', pallets: 3, readyFrom: weekday10 }, settings);
  assert.equal(q.subtotal, 245 + 2 * 98);
});

test('waiting time is free for 30 minutes then €22 per 30', () => {
  const none = quote({ service: 'Same-day urgent', county: 'Wexford', readyFrom: weekday10, waitingMins: 25 }, settings);
  assert.ok(!none.lines.some((l) => l.label.startsWith('Waiting')));
  const some = quote({ service: 'Same-day urgent', county: 'Wexford', readyFrom: weekday10, waitingMins: 75 }, settings);
  assert.equal(some.lines.find((l) => l.label.startsWith('Waiting')).amount, 44);
});

test('contract run uses the customer rate and falls back to default', () => {
  assert.equal(quote({ service: 'Contract run', county: 'Wexford', contractRate: 150, readyFrom: weekday10 }, settings).subtotal, 150);
  assert.equal(quote({ service: 'Contract run', county: 'Wexford', readyFrom: weekday10 }, settings).subtotal, 120);
});

test('unknown service and county degrade safely', () => {
  const q = quote({ service: 'Teleport', county: 'Atlantis', readyFrom: 'not a date' }, settings);
  assert.equal(q.service, 'Same-day urgent');
  assert.equal(q.zone, 3);
  assert.ok(q.net > 0);
});
