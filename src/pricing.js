// Pricing engine: zone & distance rate card + automatic surcharges.
// Pure functions only: no DOM, no store. Unit-tested in tests/pricing.test.js.
import { round2, toDate } from './util.js';

export const SERVICES = ['Same-day urgent', 'Next-day parcel', 'Multi-drop route', 'Pallet freight', 'Furniture removal', 'Contract run'];

export const ZONES = [
  { zone: 1, label: 'Zone 1 · Co. Wexford', km: '0–45', rates: { small: 22, transit: 35, pallet: 60 } },
  { zone: 2, label: 'Zone 2 · Waterford / Carlow / Kilkenny', km: '45–95', rates: { small: 38, transit: 65, pallet: 110 } },
  { zone: 3, label: 'Zone 3 · Dublin / Wicklow / Kildare', km: '95–180', rates: { small: 52, transit: 78, pallet: 140 } },
  { zone: 4, label: 'Zone 4 · Cork / Tipperary', km: '180–260', rates: { small: 85, transit: 135, pallet: 245 } },
  { zone: 5, label: 'Zone 5 · Limerick / Clare', km: '260–320', rates: { small: 105, transit: 160, pallet: 275 } },
  { zone: 6, label: 'Zone 6 · Galway / Mayo', km: '320–400', rates: { small: 125, transit: 185, pallet: 310 } },
  { zone: 7, label: 'Zone 7 · Donegal / Northern Ireland', km: '400+', rates: { small: 165, transit: 230, pallet: 395 } },
];

// Destination county → zone and typical road distance from the Wexford depot.
export const COUNTIES = {
  'Wexford': { zone: 1, km: 20 },
  'Waterford': { zone: 2, km: 60 },
  'Carlow': { zone: 2, km: 75 },
  'Kilkenny': { zone: 2, km: 80 },
  'Wicklow': { zone: 3, km: 100 },
  'Laois': { zone: 3, km: 110 },
  'Kildare': { zone: 3, km: 130 },
  'Dublin': { zone: 3, km: 158 },
  'Offaly': { zone: 3, km: 150 },
  'Westmeath': { zone: 3, km: 165 },
  'Meath': { zone: 3, km: 175 },
  'Tipperary': { zone: 4, km: 185 },
  'Longford': { zone: 4, km: 190 },
  'Louth': { zone: 4, km: 200 },
  'Cork': { zone: 4, km: 210 },
  'Cavan': { zone: 4, km: 230 },
  'Monaghan': { zone: 4, km: 240 },
  'Roscommon': { zone: 5, km: 260 },
  'Limerick': { zone: 5, km: 270 },
  'Kerry': { zone: 5, km: 290 },
  'Clare': { zone: 5, km: 300 },
  'Galway': { zone: 6, km: 330 },
  'Leitrim': { zone: 6, km: 320 },
  'Sligo': { zone: 6, km: 340 },
  'Mayo': { zone: 6, km: 380 },
  'Donegal': { zone: 7, km: 410 },
  'Northern Ireland': { zone: 7, km: 380 },
};

export const DEFAULT_PRICING_RULES = {
  outOfHoursPct: 35,      // ready-from before 06:00 or after 18:00
  weekendPct: 50,
  bankHolidayPct: 75,
  waitingFreeMins: 30,
  waitingPer30: 22,
  tailLift: 18,
  nextDayFactor: 0.72,    // next-day parcel is a consolidated run
  perExtraStop: 18,       // multi-drop, per stop after the first
  extraPalletPct: 40,     // each extra pallet adds 40% of the pallet rate
  removalHourly: 75,      // 2-man crew per hour
  removalPerKm: 0.9,
  heavyParcelKg: 150,     // same-day above this needs a Transit
  contractRunDefault: 120,
};

// Irish public holidays (fixed for the seeded demo years; extend as needed).
export const BANK_HOLIDAYS = new Set([
  '2026-01-01', '2026-02-02', '2026-03-17', '2026-04-06', '2026-05-04', '2026-06-01', '2026-08-03', '2026-10-26', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-02-01', '2027-03-17', '2027-03-29', '2027-05-03', '2027-06-07', '2027-08-02', '2027-10-25', '2027-12-25', '2027-12-26',
]);

const isoDate = (d) => {
  const x = toDate(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function zoneFor(county) {
  const c = COUNTIES[county];
  return c ? ZONES.find((z) => z.zone === c.zone) : null;
}
export function zoneByKm(km) {
  const k = Number(km) || 0;
  if (k <= 45) return ZONES[0];
  if (k <= 95) return ZONES[1];
  if (k <= 180) return ZONES[2];
  if (k <= 260) return ZONES[3];
  if (k <= 320) return ZONES[4];
  if (k <= 400) return ZONES[5];
  return ZONES[6];
}

export function vehicleFor(service, { weightKg = 0, rules = DEFAULT_PRICING_RULES } = {}) {
  switch (service) {
    case 'Same-day urgent': return weightKg > rules.heavyParcelKg ? 'transit' : 'small';
    case 'Next-day parcel': return 'small';
    case 'Multi-drop route': return 'transit';
    case 'Pallet freight': return 'pallet';
    case 'Furniture removal': return 'transit';
    case 'Contract run': return 'transit';
    default: return 'small';
  }
}

/**
 * Quote a job.
 * @param {object} input
 *  service, county | km, weightKg, stops, pallets, tailLift, readyFrom (Date|ISO),
 *  waitingMins, discountPct, contractRate
 * @param {object} settings  { vatPct, fuelSurchargePct, rules }
 */
export function quote(input, settings = {}) {
  const rules = { ...DEFAULT_PRICING_RULES, ...(settings.rules || {}) };
  const vatPct = settings.vatPct ?? 23;
  const fuelPct = settings.fuelSurchargePct ?? 4.5;
  const service = SERVICES.includes(input.service) ? input.service : 'Same-day urgent';
  const county = input.county && COUNTIES[input.county] ? input.county : null;
  const km = Number(input.km) > 0 ? Number(input.km) : (county ? COUNTIES[county].km : 158);
  const zone = county ? zoneFor(county) : zoneByKm(km);
  const vehicle = vehicleFor(service, { weightKg: Number(input.weightKg) || 0, rules });
  const lines = [];
  let base = 0;

  switch (service) {
    case 'Same-day urgent':
      base = zone.rates[vehicle];
      lines.push({ label: `${zone.label.split(' · ')[0]} · ${vehicle === 'small' ? 'small van' : 'Transit'}`, amount: base });
      break;
    case 'Next-day parcel':
      base = round2(zone.rates.small * rules.nextDayFactor);
      lines.push({ label: `${zone.label.split(' · ')[0]} · next-day consolidated`, amount: base });
      break;
    case 'Multi-drop route': {
      const stops = Math.max(1, Number(input.stops) || 1);
      base = zone.rates.transit;
      lines.push({ label: `${zone.label.split(' · ')[0]} · Transit route`, amount: base });
      if (stops > 1) {
        const extra = (stops - 1) * rules.perExtraStop;
        lines.push({ label: `${stops - 1} extra stop${stops > 2 ? 's' : ''} @ €${rules.perExtraStop}`, amount: extra });
        base += extra;
      }
      break;
    }
    case 'Pallet freight': {
      const pallets = Math.max(1, Number(input.pallets) || 1);
      base = zone.rates.pallet;
      lines.push({ label: `${zone.label.split(' · ')[0]} · first pallet`, amount: base });
      if (pallets > 1) {
        const extra = round2((pallets - 1) * zone.rates.pallet * (rules.extraPalletPct / 100));
        lines.push({ label: `${pallets - 1} extra pallet${pallets > 2 ? 's' : ''} @ ${rules.extraPalletPct}%`, amount: extra });
        base += extra;
      }
      break;
    }
    case 'Furniture removal': {
      const hours = round2(2 + km / 50);
      const crew = round2(hours * rules.removalHourly);
      const mileage = round2(km * rules.removalPerKm);
      lines.push({ label: `2-man crew · ${hours} h @ €${rules.removalHourly}`, amount: crew });
      lines.push({ label: `Mileage · ${km} km @ €${rules.removalPerKm}`, amount: mileage });
      base = round2(crew + mileage);
      break;
    }
    case 'Contract run':
      base = Number(input.contractRate) > 0 ? Number(input.contractRate) : rules.contractRunDefault;
      lines.push({ label: 'Fixed contract rate', amount: base });
      break;
  }

  // Time-based surcharges (highest one wins)
  const when = input.readyFrom ? toDate(input.readyFrom) : null;
  let timePct = 0; let timeLabel = null;
  if (when && !Number.isNaN(when.getTime())) {
    const hour = when.getHours();
    const dow = when.getDay();
    if (BANK_HOLIDAYS.has(isoDate(when))) { timePct = rules.bankHolidayPct; timeLabel = 'Bank holiday'; }
    else if (dow === 0 || dow === 6) { timePct = rules.weekendPct; timeLabel = 'Weekend'; }
    else if (hour < 6 || hour >= 18) { timePct = rules.outOfHoursPct; timeLabel = 'Out of hours'; }
  }
  if (timePct) lines.push({ label: `${timeLabel} +${timePct}%`, amount: round2(base * timePct / 100) });
  if (input.tailLift) lines.push({ label: 'Tail lift', amount: rules.tailLift });
  const waiting = Math.max(0, Number(input.waitingMins) || 0);
  if (waiting > rules.waitingFreeMins) {
    const blocks = Math.ceil((waiting - rules.waitingFreeMins) / 30);
    lines.push({ label: `Waiting time · ${blocks} × 30 min`, amount: blocks * rules.waitingPer30 });
  }

  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const discountPct = Math.max(0, Number(input.discountPct) || 0);
  const discount = round2(subtotal * discountPct / 100);
  const afterDiscount = round2(subtotal - discount);
  const fuel = round2(afterDiscount * fuelPct / 100);
  const net = round2(afterDiscount + fuel);
  const vat = round2(net * vatPct / 100);
  const gross = round2(net + vat);

  const basisBits = [zone.label.split(' · ')[0], `${km} km`, service.toLowerCase() + ' rate'];
  if (discountPct) basisBits.push(`account discount ${discountPct}% applied`);
  if (timeLabel) basisBits.push(timeLabel.toLowerCase() + ' surcharge');

  return { service, zone: zone.zone, zoneLabel: zone.label, km, vehicle, lines, subtotal, discountPct, discount, fuelPct, fuel, net, vatPct, vat, gross, basis: basisBits.join(' · ') };
}
