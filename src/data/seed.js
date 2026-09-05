// Demo dataset. Everything is generated relative to `now` so the app looks live on any day.
import { addDays, addMinutes, atTime, uid } from '../util.js';
import { quote, COUNTIES } from '../pricing.js';

export const SEED_VERSION = 3;

const iso = (d) => d.toISOString();

export function defaultSettings() {
  return {
    showFinancials: true,
    company: {
      tradingName: 'RoadDog Courier Service', registeredName: 'P. Byrne Transport Ltd', cro: '412778', vat: 'IE 6412778T', established: '1996 · Wexford Town',
      address: 'Unit 4, Whitemill Industrial Estate, Wexford', eircode: 'Y35 R2K8', phone: '053 912 4480', mobile: '087 244 0019', hours: '24/7 · same-day desk 06:00–20:00',
      email: 'ops@roaddogcourier.ie',
    },
    invoicing: { termsDays: 30, vatPct: 23, fuelSurchargePct: 4.5, runDay: 'Monday 08:00', bankName: 'AIB Wexford', iban: 'IE29 AIBK 9311 5212 3456 78', bic: 'AIBKIE2D' },
    capacity: { maxDropsPerVan: 9, maxPalletsPerVan: 4, driverHoursCap: 11 },
    security: { twoFactor: 'Required for owner + office', deviceBinding: 'One device per driver login', sessionTimeout: 'Office 8 h · driver 24 h', audit: 'All price and status changes kept 7 years' },
    integrations: [
      { name: 'Xero', detail: 'Invoices + payments sync nightly', on: true },
      { name: 'Google Maps Platform', detail: 'Routing, ETA, live tracking', on: true },
      { name: 'Twilio SMS', detail: 'Customer tracking texts', on: true },
      { name: 'AIB bank feed', detail: 'Transfers matched to invoices automatically', on: true },
      { name: 'Revenue ROS', detail: 'VAT return export', on: true },
      { name: 'Sage 50', detail: 'Alternative to Xero', on: false },
      { name: 'Fuelcard (Circle K)', detail: 'Auto-import fuel spend per van', on: false },
      { name: 'Webfleet telematics', detail: 'Real GPS + driver behaviour', on: false },
      { name: 'Shopify / WooCommerce', detail: 'Retail customers push orders straight in', on: false },
    ],
    notifications: {
      owner: [['Job unassigned > 20 min', 'Push + SMS'], ['Delivery going late', 'Push'], ['Failed delivery', 'Push + email'], ['Van idle > 20 min', 'Push'], ['Invoice overdue 7 days', 'Email digest'], ['Compliance due < 30 days', 'Email Monday']],
      office: [['New portal order', 'Push, on screen'], ['Driver message', 'Push'], ['Waiting time started', 'On screen banner'], ['POD missing at end of day', 'Email 18:30']],
      quiet: [['Owner', '22:00–06:00 · urgent only'], ['Office', 'Outside 06:00–20:00 muted'], ['Escalation', 'Unactioned urgent alert rings owner mobile']],
    },
    payRate: 19.5,
  };
}

const VANS = [
  { id: 'RD1', reg: '19-WX-2841', model: 'Ford Transit Custom', cls: 'transit', fridge: false, taxDays: 9, cvrtDays: 180, serviceKm: 4200, odometer: 184220, status: 'active', pos: { lat: 52.343, lng: -6.497, at: 'Whitemill depot, Wexford', speed: 0, state: 'Back at depot' } },
  { id: 'RD2', reg: '21-WX-1190', model: 'Renault Trafic', cls: 'transit', fridge: false, taxDays: 86, cvrtDays: 139, serviceKm: 1100, odometer: 96400, status: 'active', pos: { lat: 52.330, lng: -6.520, at: 'Wexford bypass', speed: 81, state: 'On route' } },
  { id: 'RD3', reg: '22-WX-864', model: 'Ford Transit LWB', cls: 'transit', fridge: false, taxDays: 148, cvrtDays: 294, serviceKm: 8400, odometer: 71300, status: 'active', pos: { lat: 52.975, lng: -6.105, at: 'N11 northbound, past Ashford', speed: 96, state: 'On route' } },
  { id: 'RD4', reg: '20-WX-3312', model: 'VW Caddy', cls: 'small', fridge: true, taxDays: 176, cvrtDays: 220, serviceKm: 6900, odometer: 122800, status: 'active', pos: { lat: 52.380, lng: -6.450, at: 'Kelly Fuels, Castlebridge', speed: 0, state: 'At drop' } },
  { id: 'RD5', reg: '23-WX-577', model: 'Ford Transit LWB', cls: 'transit', fridge: false, taxDays: 56, cvrtDays: 100, serviceKm: 2300, odometer: 44100, status: 'active', pos: { lat: 52.655, lng: -6.652, at: 'Bunclody village square', speed: 0, state: 'Idle', idleSince: -24 } },
  { id: 'RD6', reg: '18-WX-4402', model: 'Mercedes Sprinter', cls: 'pallet', fridge: false, taxDays: 117, cvrtDays: -3, serviceKm: -400, odometer: 231900, status: 'offroad', pos: { lat: 52.343, lng: -6.497, at: 'Whitemill depot · CVRT booked', speed: 0, state: 'Off road' } },
  { id: 'RD7', reg: '23-WX-901', model: 'VW Caddy', cls: 'small', fridge: true, taxDays: 298, cvrtDays: 331, serviceKm: 9600, odometer: 31500, status: 'active', pos: { lat: 52.680, lng: -6.295, at: 'Gorey, returning', speed: 62, state: 'On route' } },
  { id: 'RD8', reg: '21-WX-2205', model: 'Mercedes Sprinter 5t', cls: 'pallet', fridge: false, taxDays: 207, cvrtDays: 248, serviceKm: 5100, odometer: 143700, status: 'active', pos: { lat: 52.515, lng: -7.885, at: 'M8 southbound, Cashel', speed: 88, state: 'On route' } },
  { id: 'RD9', reg: '22-WX-1478', model: 'Ford Transit Custom', cls: 'transit', fridge: false, taxDays: -5, cvrtDays: 86, serviceKm: 3800, odometer: 88200, status: 'active', pos: { lat: 53.219, lng: -6.660, at: 'Naas depot handover', speed: 0, state: 'At drop' } },
  { id: 'RD10', reg: '24-WX-330', model: 'Renault Master', cls: 'transit', fridge: false, taxDays: 329, cvrtDays: 163, serviceKm: 11200, odometer: 12900, status: 'active', pos: { lat: 52.550, lng: -7.100, at: 'R700 toward Kilkenny', speed: 74, state: 'On route' } },
];

const DRIVERS = [
  { id: 'd1', name: 'Paul Byrne', van: 'RD1', phone: '087 244 0019', hours: 41.5, drops: 38, onTime: 97, expenses: [['Diesel', 62]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd2', name: 'Mick Doyle', van: 'RD2', phone: '086 331 8820', hours: 44.0, drops: 52, onTime: 94, expenses: [['Diesel', 88], ['Tolls', 30]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd3', name: 'Dave Kehoe', van: 'RD3', phone: '085 114 6674', hours: 46.5, drops: 61, onTime: 91, expenses: [['Diesel', 110], ['Tolls', 35]], compliance: 'CPC expires 12 Nov', ok: false },
  { id: 'd4', name: 'Sharon Walsh', van: 'RD4', phone: '087 902 1155', hours: 38.0, drops: 44, onTime: 98, expenses: [['Diesel', 54]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd5', name: 'Tomasz Nowak', van: 'RD5', phone: '089 441 7702', hours: 45.0, drops: 73, onTime: 96, expenses: [['Diesel', 132]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd6', name: "Liam O'Neill", van: 'RD6', phone: '086 720 9931', hours: 12.0, drops: 9, onTime: 88, expenses: [['Diesel', 28]], compliance: 'Licence check overdue', ok: false },
  { id: 'd7', name: 'Aoife Murphy', van: 'RD7', phone: '085 668 2140', hours: 36.5, drops: 40, onTime: 99, expenses: [['Diesel', 48]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd8', name: 'John Redmond', van: 'RD8', phone: '087 355 0188', hours: 43.0, drops: 35, onTime: 93, expenses: [['Diesel', 140], ['Tolls', 25]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd9', name: 'Stephen Fox', van: 'RD9', phone: '086 512 3390', hours: 40.0, drops: 48, onTime: 95, expenses: [['Diesel', 70], ['Tolls', 18]], compliance: 'Tacho + CPC valid', ok: true },
  { id: 'd10', name: 'Ciara Nolan', van: 'RD10', phone: '089 207 4461', hours: 0, drops: 0, onTime: null, expenses: [], compliance: 'New start · induction due', ok: false },
];

const CUSTOMERS = [
  { id: 'c_sinnott', name: 'Sinnott Electrical Ltd', short: 'Sinnott Electrical', contact: 'Aidan Sinnott', phone: '087 244 1180', email: 'accounts@sinnottelec.ie', town: 'Wexford Town', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 8, rateNote: 'Zone card −8%', since: '2011', poRequired: true, creditLimit: 5000, notes: 'Goods-in gate closes 16:30',
    addresses: [
      { id: 'a1', name: 'Our yard · Wexford', addr: 'Unit 4, Whitemill Ind. Est.', town: 'Wexford Y35 R2K8', county: 'Wexford', note: 'Default collection · forklift on site', tag: 'COLLECTION' },
      { id: 'a2', name: 'Sandyford site', addr: 'Blackthorn Rd, Sandyford Business Park', town: 'Dublin D18 T9K4', county: 'Dublin', note: 'Goods-in gate closes 16:30', tag: 'DELIVERY' },
      { id: 'a3', name: 'Naas depot', addr: 'Unit 11, Monread Ind. Est.', town: 'Naas, Co. Kildare', county: 'Kildare', note: 'Ask for parts desk', tag: 'DELIVERY' },
      { id: 'a4', name: 'Cork branch', addr: 'Kinsale Rd Roundabout', town: 'Cork T12 K4H9', county: 'Cork', note: 'Tail lift needed', tag: 'DELIVERY' },
      { id: 'a5', name: 'Athlone contractor', addr: 'Golden Island Retail Park', town: 'Athlone N37 P1D6', county: 'Westmeath', note: 'Site foreman: 086 771 2204', tag: 'DELIVERY' },
      { id: 'a6', name: 'Rosslare Europort', addr: 'Terminal dock office', town: 'Rosslare Harbour', county: 'Wexford', note: 'Photo ID required at barrier', tag: 'DELIVERY' },
    ],
    users: [
      { id: 'u1', name: 'Aidan Sinnott', role: 'Admin', detail: 'Books, sees prices and invoices', email: 'aidan@sinnottelec.ie' },
      { id: 'u2', name: 'Marie Kelly', role: 'Booker', detail: 'Books jobs, no invoice access', email: 'marie@sinnottelec.ie' },
      { id: 'u3', name: 'Accounts inbox', role: 'Billing only', detail: 'Receives invoices and PODs', email: 'accounts@sinnottelec.ie' },
    ],
    prefs: { poRequired: 'Yes — booking blocked without one', tracking: 'Consignee mobile on each job', pod: 'Email on completion + weekly pack', cycle: 'Monthly, 30 day terms', defaultService: 'Same-day urgent' },
  },
  { id: 'c_mcguiness', name: 'McGuiness Transport', short: 'McGuiness Transport', contact: 'Ger McGuiness', phone: '053 914 2211', email: 'ger@mcguinesstransport.ie', town: 'Wexford Town', county: 'Wexford', terms: 'Contract', termsDays: 30, discountPct: 0, rateNote: 'Fixed €120/run', contractRate: 120, since: '2004', poRequired: false, creditLimit: 8000, notes: 'Daily paper run 04:30' },
  { id: 'c_creamery', name: 'Wexford Creamery', short: 'Wexford Creamery', contact: 'Nora Barry', phone: '053 912 8800', email: 'dispatch@wexfordcreamery.ie', town: 'Drinagh', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 0, rateNote: 'Pallet card', since: '2015', poRequired: false, creditLimit: 10000, notes: 'Weighbridge docket required' },
  { id: 'c_harvey', name: 'Harvey Norman Wexford', short: 'Harvey Norman', contact: 'Store ops', phone: '053 918 4400', email: 'wexford.ops@harveynorman.ie', town: 'Drinagh', county: 'Wexford', terms: '14 day', termsDays: 14, discountPct: 0, rateNote: 'Removal hourly', since: '2019', poRequired: true, creditLimit: 3000, notes: 'Second man required on all drops' },
  { id: 'c_kehoe', name: 'Kehoe Pharmacy Group', short: 'Kehoe Pharmacy', contact: 'Sarah Kehoe', phone: '053 923 3010', email: 'accounts@kehoepharmacy.ie', town: 'Enniscorthy', county: 'Wexford', terms: 'Prepay', termsDays: 0, discountPct: 0, rateNote: 'Zone card', since: '2021', poRequired: false, creditLimit: 0, notes: 'Cold chain · fridge vans only' },
  { id: 'c_slaney', name: 'Slaney Foods Intl', short: 'Slaney Foods', contact: 'Dispatch office', phone: '053 937 7100', email: 'dispatch@slaneyfoods.ie', town: 'Bunclody', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 5, rateNote: 'Multi-drop €185', since: '2009', poRequired: false, creditLimit: 12000, notes: 'Chilled totes · 06:00 collections' },
  { id: 'c_rossiter', name: 'Rossiter Motors', short: 'Rossiter Motors', contact: 'Parts desk', phone: '053 912 3355', email: 'parts@rossitermotors.ie', town: 'Wexford Town', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 0, rateNote: 'Zone card', since: '2017', poRequired: false, creditLimit: 2500, notes: '' },
  { id: 'c_byrnej', name: 'Byrne Joinery', short: 'Byrne Joinery', contact: 'Tom Byrne', phone: '051 442 108', email: 'tom@byrnejoinery.ie', town: 'New Ross', county: 'Wexford', terms: '14 day', termsDays: 14, discountPct: 0, rateNote: 'Removal hourly', since: '2020', poRequired: false, creditLimit: 2000, notes: '' },
  { id: 'c_doyle', name: 'Doyle Plumbing', short: 'Doyle Plumbing', contact: 'Ken Doyle', phone: '086 209 7741', email: 'ken@doyleplumbing.ie', town: 'Wexford Town', county: 'Wexford', terms: 'Prepay', termsDays: 0, discountPct: 0, rateNote: 'Zone card', since: '2023', poRequired: false, creditLimit: 0, notes: '' },
  { id: 'c_staidan', name: "St Aidan's School", short: "St Aidan's School", contact: 'School office', phone: '053 923 3444', email: 'office@staidans.ie', town: 'Enniscorthy', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 0, rateNote: 'Zone card', since: '2018', poRequired: true, creditLimit: 1500, notes: '' },
  { id: 'c_murphyf', name: 'Murphy Floors', short: 'Murphy Floors', contact: 'Declan Murphy', phone: '053 942 1188', email: 'info@murphyfloors.ie', town: 'Gorey', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 0, rateNote: 'Pallet card', since: '2016', poRequired: false, creditLimit: 4000, notes: '' },
  { id: 'c_vet', name: 'Wexford Vet Clinic', short: 'Wexford Vet Clinic', contact: 'Reception', phone: '053 912 6600', email: 'reception@wexfordvet.ie', town: 'Wexford Town', county: 'Wexford', terms: 'Prepay', termsDays: 0, discountPct: 0, rateNote: 'Zone card', since: '2022', poRequired: false, creditLimit: 0, notes: 'Cold chain' },
  { id: 'c_cullen', name: 'Cullen Builders', short: 'Cullen Builders', contact: 'Site office', phone: '051 421 990', email: 'accounts@cullenbuilders.ie', town: 'New Ross', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 0, rateNote: 'Pallet card', since: '2014', poRequired: true, creditLimit: 6000, notes: '' },
  { id: 'c_kellyf', name: 'Kelly Fuels', short: 'Kelly Fuels', contact: 'Yard office', phone: '053 913 1200', email: 'yard@kellyfuels.ie', town: 'Castlebridge', county: 'Wexford', terms: '30 day', termsDays: 30, discountPct: 0, rateNote: 'Multi-drop', since: '2012', poRequired: false, creditLimit: 5000, notes: '' },
  { id: 'c_whitford', name: 'Whitford House Hotel', short: 'Whitford House Hotel', contact: 'Front desk', phone: '053 914 3444', email: 'reception@whitford.ie', town: 'Wexford Town', county: 'Wexford', terms: '14 day', termsDays: 14, discountPct: 0, rateNote: 'Zone card', since: '2019', poRequired: false, creditLimit: 1500, notes: '' },
];

const DEPOT = { name: 'Wexford Depot', addr: 'Unit 4, Whitemill Industrial Estate', town: 'Wexford', county: 'Wexford' };
const place = (name, addr, town, county) => ({ name, addr, town, county });

export function buildSeed(now = new Date()) {
  const t = (h, m = 0, dayOffset = 0) => atTime(addDays(now, dayOffset), h, m);
  const settings = defaultSettings();
  let refN = 24815;
  const nextRef = () => `RD-${refN++}`;
  const custById = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));

  const mkJob = (o) => {
    const c = custById[o.customerId];
    const q = quote({ service: o.service, county: o.to.county, km: o.km, weightKg: o.weightKg, stops: o.stops, pallets: o.pallets, readyFrom: o.readyFrom, discountPct: c.discountPct, contractRate: c.contractRate }, { vatPct: settings.invoicing.vatPct, fuelSurchargePct: settings.invoicing.fuelSurchargePct });
    const price = o.price ?? q.net;
    return {
      id: uid('job'), ref: o.ref || nextRef(), customerId: o.customerId, customer: c.short,
      from: o.from, to: o.to, service: o.service, pieces: o.pieces, weightKg: o.weightKg || 0, stops: o.stops || 1, pallets: o.pallets || 0,
      zone: q.zone, km: o.km || q.km, price, vatPct: settings.invoicing.vatPct,
      readyFrom: iso(o.readyFrom), deliverBy: iso(o.deliverBy), windowType: o.windowType || 'by',
      status: o.status, van: o.van || null, createdAt: iso(o.createdAt || addMinutes(o.readyFrom, -90)),
      source: o.source || 'phone', po: o.po || '', notes: o.notes || '', contact: o.contact || c.contact,
      activity: o.activity || [], pod: o.pod || null, failReason: o.failReason || null, invoiceId: o.invoiceId || null,
      collectedAt: o.collectedAt ? iso(o.collectedAt) : null, deliveredAt: o.deliveredAt ? iso(o.deliveredAt) : null,
      eta: o.eta ? iso(o.eta) : null,
    };
  };
  const A = (time, text) => ({ t: iso(time), text });
  const pod = (signedBy, at, van, kind, extra = {}) => ({ signedBy, at: iso(at), van, kind, gps: '52.5012, -6.5661', geofence: 'Yes · 18 m', ...extra });

  const jobs = [
    mkJob({ customerId: 'c_sinnott', from: place('Sinnott Electrical', 'Unit 4, Whitemill Industrial Estate', 'Wexford Town', 'Wexford'), to: place('Sandyford site', 'Blackthorn Rd, Sandyford Business Park', 'Dublin 18 · D18 T9K4', 'Dublin'), service: 'Same-day urgent', pieces: '2 boxes', weightKg: 14, readyFrom: t(12, 0), deliverBy: t(16, 0), status: 'On route', van: 'RD3', price: 78, source: 'portal', po: 'PO-88214', contact: 'Aidan Sinnott · 087 244 1180', collectedAt: t(12, 40),
      activity: [A(t(11, 58), 'Order placed via customer portal'), A(t(12, 4), 'Auto-priced from Zone 3 rate card'), A(t(12, 11), 'Assigned to RD3 by Paul'), A(t(12, 40), 'Collected · barcode scanned, photo attached'), A(t(12, 41), 'SMS sent to consignee with tracking link')] }),
    mkJob({ customerId: 'c_kehoe', from: place('Kehoe Pharmacy', 'Market Square', 'Enniscorthy', 'Wexford'), to: place('Kehoe Pharmacy Gorey', 'Main St', 'Gorey', 'Wexford'), service: 'Same-day urgent', pieces: '1 tote', weightKg: 4, readyFrom: t(12, 30), deliverBy: t(15, 0), status: 'Delivered', van: 'RD7', price: 28, collectedAt: t(13, 5), deliveredAt: t(14, 2), pod: pod('S. Kehoe', t(14, 2), 'RD7', 'PHOTO + SIGNATURE'),
      activity: [A(t(11, 20), 'Booked by phone · Sarah Kehoe'), A(t(12, 12), 'Assigned to RD7'), A(t(13, 5), 'Collected · cold chain seal checked'), A(t(14, 2), 'Delivered · signed S. Kehoe'), A(t(14, 2), 'POD emailed to accounts@kehoepharmacy.ie')] }),
    mkJob({ customerId: 'c_creamery', from: place('Wexford Creamery', 'Drinagh', 'Wexford Town', 'Wexford'), to: place('Musgrave Cork', 'Kinsale Rd', 'Cork City', 'Cork'), service: 'Pallet freight', pieces: '2 pallets', weightKg: 640, pallets: 2, readyFrom: t(11, 0), deliverBy: t(18, 0), status: 'On route', van: 'RD8', price: 245, collectedAt: t(11, 35), eta: t(18, 35),
      activity: [A(t(8, 10), 'Booked · weekly pallet run'), A(t(11, 35), 'Collected · weighbridge docket 640 kg'), A(t(13, 55), 'ETA revised to 18:35 · M8 delays')] }),
    mkJob({ customerId: 'c_byrnej', from: place('Byrne Joinery', 'Marshmeadows', 'New Ross', 'Wexford'), to: place('Private residence', 'Castlecomer Rd', 'Kilkenny', 'Kilkenny'), service: 'Furniture removal', pieces: 'Kitchen units', weightKg: 400, readyFrom: t(14, 0), deliverBy: t(17, 0), windowType: 'slot', status: 'Collected', van: 'RD10', price: 310, collectedAt: t(14, 20),
      activity: [A(t(9, 40), 'Booked · 2-man crew'), A(t(14, 20), 'Collected · 14 units loaded')] }),
    mkJob({ customerId: 'c_rossiter', from: place('Rossiter Motors', 'Distillery Rd', 'Wexford Town', 'Wexford'), to: place('Waterford Motor Factors', 'Cork Rd', 'Waterford', 'Waterford'), service: 'Same-day urgent', pieces: 'Gearbox', weightKg: 62, readyFrom: t(13, 30), deliverBy: t(17, 0), status: 'Assigned', van: 'RD2', price: 65,
      activity: [A(t(12, 50), 'Booked by phone · parts desk'), A(t(13, 2), 'Assigned to RD2')] }),
    mkJob({ customerId: 'c_slaney', from: place('Slaney Foods', 'Ryland Rd', 'Bunclody', 'Wexford'), to: place('Multi-drop · 9 stops', 'Co. Wexford retail', 'Wexford', 'Wexford'), service: 'Multi-drop route', pieces: '9 chilled totes', weightKg: 180, stops: 9, readyFrom: t(6, 0), deliverBy: t(12, 0), windowType: 'slot', status: 'Delivered', van: 'RD5', price: 185, collectedAt: t(6, 10), deliveredAt: t(11, 48), pod: pod('9 consignees', t(11, 48), 'RD5', '9 PHOTOS'),
      activity: [A(t(6, 10), 'Collected · 9 totes'), A(t(11, 48), 'Final drop delivered')] }),
    mkJob({ customerId: 'c_doyle', from: place('Doyle Plumbing', 'Whitemill', 'Wexford Town', 'Wexford'), to: place('Carlow Plumbing Supplies', 'Dublin Rd', 'Carlow', 'Carlow'), service: 'Next-day parcel', pieces: '1 parcel', weightKg: 8, readyFrom: t(16, 0), deliverBy: t(12, 0, 1), status: 'Assigned', van: 'RD4', price: 22,
      activity: [A(t(10, 15), 'Booked by phone'), A(t(10, 16), 'Assigned to RD4 for tomorrow AM')] }),
    mkJob({ customerId: 'c_staidan', from: place("St Aidan's School", 'Convent Rd', 'Enniscorthy', 'Wexford'), to: place('Dept of Education', 'Marlborough St', 'Dublin 8', 'Dublin'), service: 'Same-day urgent', pieces: '4 boxes', weightKg: 22, readyFrom: t(13, 40), deliverBy: t(16, 30), status: 'Unassigned', price: 82, po: 'SA-2026-117', createdAt: addMinutes(now, -22),
      activity: [A(addMinutes(now, -22), 'Booked by phone · school office')] }),
    mkJob({ customerId: 'c_murphyf', from: place('Murphy Floors', 'Creagh', 'Gorey', 'Wexford'), to: place('Bray Flooring', 'Boghall Rd', 'Bray', 'Wicklow'), service: 'Pallet freight', pieces: '1 pallet', weightKg: 310, pallets: 1, readyFrom: t(14, 0), deliverBy: t(18, 0), status: 'Unassigned', price: 140, createdAt: addMinutes(now, -17),
      activity: [A(addMinutes(now, -17), 'Booked via portal')] }),
    mkJob({ customerId: 'c_vet', from: place('Wexford Vet Clinic', 'Newtown Rd', 'Wexford Town', 'Wexford'), to: place('Rosslare Vet', 'Strand Rd', 'Rosslare', 'Wexford'), service: 'Same-day urgent', pieces: 'Cold chain · 1 box', weightKg: 2, readyFrom: t(14, 0), deliverBy: t(15, 30), status: 'Unassigned', price: 35, createdAt: addMinutes(now, -11), notes: 'Fridge van only',
      activity: [A(addMinutes(now, -11), 'Booked by phone · reception')] }),
    mkJob({ customerId: 'c_cullen', from: place('Cullen Builders', 'Rosbercon', 'New Ross', 'Wexford'), to: place('Limerick site', 'Dock Rd', 'Limerick', 'Limerick'), service: 'Pallet freight', pieces: '3 pallets', weightKg: 900, pallets: 3, readyFrom: t(14, 30), deliverBy: t(19, 0), status: 'Unassigned', price: 275, po: 'CB-4471', createdAt: addMinutes(now, -6),
      activity: [A(addMinutes(now, -6), 'Booked via portal · PO CB-4471')] }),
    mkJob({ customerId: 'c_mcguiness', from: DEPOT, to: place('Contract run · papers', 'Newsagents, Co. Wexford', 'Wexford', 'Wexford'), service: 'Contract run', pieces: 'Daily bundles', weightKg: 120, readyFrom: t(4, 30), deliverBy: t(8, 0), windowType: 'slot', status: 'Delivered', van: 'RD1', price: 120, collectedAt: t(4, 35), deliveredAt: t(7, 52), pod: pod('Depot stamp', t(7, 52), 'RD1', 'PHOTO'),
      activity: [A(t(4, 35), 'Collected · depot'), A(t(7, 52), 'Run complete')] }),
    mkJob({ customerId: 'c_harvey', from: place('Harvey Norman', 'Drinagh Retail Park', 'Wexford', 'Wexford'), to: place('Private residence', 'Main St', 'Ferns', 'Wexford'), service: 'Furniture removal', pieces: '3-seater + table', weightKg: 120, readyFrom: t(13, 0), deliverBy: t(16, 0), windowType: 'slot', status: 'Failed', van: 'RD6', price: 165, collectedAt: t(13, 5), failReason: 'No access to premises', pod: pod('—', t(13, 31), 'RD6', 'PHOTO + NOTE', { note: 'No access, customer not answering' }),
      activity: [A(t(13, 5), 'Collected from store'), A(t(13, 31), 'Failed · no access at Ferns address, customer not answering'), A(t(13, 31), 'Parcel back on van · dispatch notified')] }),
    mkJob({ customerId: 'c_sinnott', from: place('Sinnott Electrical', 'Unit 4, Whitemill Industrial Estate', 'Wexford Town', 'Wexford'), to: place('Naas depot', 'Unit 11, Monread Ind. Est.', 'Naas, Co. Kildare', 'Kildare'), service: 'Next-day parcel', pieces: '2 parcels', weightKg: 9, readyFrom: t(16, 30), deliverBy: t(12, 0, 1), status: 'Assigned', van: 'RD9', price: 38, source: 'portal', po: 'PO-88219',
      activity: [A(t(10, 2), 'Order placed via customer portal'), A(t(10, 30), 'Assigned to RD9 for tomorrow AM')] }),
    mkJob({ customerId: 'c_kellyf', from: place('Kelly Fuels', 'Castlebridge', 'Wexford', 'Wexford'), to: place('Multi-drop · 6 stops', 'North Wexford', 'Wexford', 'Wexford'), service: 'Multi-drop route', pieces: '6 drops', weightKg: 300, stops: 6, readyFrom: t(12, 0), deliverBy: t(18, 0), windowType: 'slot', status: 'On route', van: 'RD4', price: 150, collectedAt: t(12, 15),
      activity: [A(t(12, 15), 'Collected · 6 drops loaded'), A(t(13, 40), 'Drop 1 of 6 delivered')] }),
    mkJob({ customerId: 'c_whitford', from: place('Whitford House Hotel', 'New Line Rd', 'Wexford Town', 'Wexford'), to: place('Dublin Airport', 'Terminal 2 cargo', 'Dublin', 'Dublin'), service: 'Same-day urgent', pieces: '1 case', weightKg: 18, readyFrom: t(12, 30), deliverBy: t(17, 30), status: 'Collected', van: 'RD3', price: 95, collectedAt: t(12, 50),
      activity: [A(t(12, 50), 'Collected · loaded on RD3 with Sandyford drop')] }),
  ];

  // Historic jobs: last 30 days. Days -1..-6 are delivered, not yet invoiced (ready to bill).
  const HIST = [
    ['c_sinnott', 'Same-day urgent', 'Portlaoise', 'Laois', 'Signed · A. Sinnott', 'RD3', 1],
    ['c_sinnott', 'Next-day parcel', 'Athlone', 'Westmeath', 'Photo + signature', 'RD8', 3],
    ['c_sinnott', 'Same-day urgent', 'Sandyford D18', 'Dublin', 'Signed · goods-in', 'RD3', 5],
    ['c_sinnott', 'Pallet freight', 'Cork City', 'Cork', 'Weighbridge docket', 'RD8', 6],
    ['c_sinnott', 'Next-day parcel', 'Naas', 'Kildare', 'Photo at door', 'RD9', 10],
    ['c_sinnott', 'Multi-drop route', 'Kilkenny', 'Kilkenny', '4 signatures', 'RD2', 12],
    ['c_sinnott', 'Same-day urgent', 'Rosslare Europort', 'Wexford', 'Signed · dock office', 'RD4', 14],
    ['c_creamery', 'Pallet freight', 'Cork City', 'Cork', 'Weighbridge docket', 'RD8', 1],
    ['c_creamery', 'Pallet freight', 'Dublin 12', 'Dublin', 'Signed · gate office', 'RD8', 2],
    ['c_creamery', 'Pallet freight', 'Waterford', 'Waterford', 'Signed', 'RD6', 4],
    ['c_slaney', 'Multi-drop route', 'Co. Wexford', 'Wexford', '9 photos', 'RD5', 1],
    ['c_slaney', 'Multi-drop route', 'Co. Wexford', 'Wexford', '9 photos', 'RD5', 2],
    ['c_slaney', 'Multi-drop route', 'Co. Wexford', 'Wexford', '8 photos', 'RD5', 3],
    ['c_slaney', 'Multi-drop route', 'Co. Wexford', 'Wexford', '9 photos', 'RD5', 4],
    ['c_mcguiness', 'Contract run', 'Co. Wexford', 'Wexford', 'Depot stamp', 'RD1', 1],
    ['c_mcguiness', 'Contract run', 'Co. Wexford', 'Wexford', 'Depot stamp', 'RD1', 2],
    ['c_mcguiness', 'Contract run', 'Co. Wexford', 'Wexford', 'Depot stamp', 'RD1', 3],
    ['c_mcguiness', 'Contract run', 'Co. Wexford', 'Wexford', 'Depot stamp', 'RD1', 4],
    ['c_mcguiness', 'Contract run', 'Co. Wexford', 'Wexford', 'Depot stamp', 'RD1', 5],
    ['c_harvey', 'Furniture removal', 'Gorey', 'Wexford', 'Signed · customer', 'RD6', 2],
    ['c_harvey', 'Furniture removal', 'Enniscorthy', 'Wexford', 'Signed · customer', 'RD6', 5],
    ['c_kehoe', 'Same-day urgent', 'Gorey', 'Wexford', 'Signed', 'RD7', 2],
    ['c_kehoe', 'Same-day urgent', 'New Ross', 'Wexford', 'Signed', 'RD7', 4],
    ['c_rossiter', 'Same-day urgent', 'Waterford', 'Waterford', 'Parts desk', 'RD2', 1],
    ['c_byrnej', 'Furniture removal', 'Kilkenny', 'Kilkenny', 'Signed · T. Byrne', 'RD10', 1],
    ['c_cullen', 'Pallet freight', 'Limerick', 'Limerick', 'Site office', 'RD8', 3],
    ['c_kellyf', 'Multi-drop route', 'North Wexford', 'Wexford', '6 signatures', 'RD4', 2],
    ['c_whitford', 'Same-day urgent', 'Dublin Airport', 'Dublin', 'Cargo desk', 'RD3', 6],
  ];
  const INVOICE_LINK = { c_sinnott: 'INV-4018', c_creamery: 'INV-4020', c_slaney: 'INV-4021', c_mcguiness: 'INV-4017', c_harvey: 'INV-4019', c_kehoe: 'INV-4015', c_cullen: 'INV-4016' };
  let hRef = 24814;
  HIST.slice().reverse().forEach(([cid, service, toName, county, podKind, van, daysAgo]) => {
    const c = custById[cid];
    const day = addDays(now, -daysAgo);
    const ready = atTime(day, 9 + (hRef % 5), 15);
    const done = addMinutes(ready, 90 + (hRef % 7) * 30);
    const pallets = service === 'Pallet freight' ? 1 + (hRef % 2) : 0;
    const stops = service === 'Multi-drop route' ? 4 + (hRef % 6) : 1;
    const j = mkJob({ ref: `RD-${hRef--}`, customerId: cid, from: place(c.short, c.town, c.town, 'Wexford'), to: place(toName, toName, toName, county), service, pieces: pallets ? `${pallets} pallet${pallets > 1 ? 's' : ''}` : stops > 1 ? `${stops} drops` : '1 consignment', weightKg: pallets ? 300 * pallets : 12, pallets, stops, readyFrom: ready, deliverBy: addMinutes(ready, 240), status: 'Delivered', van, collectedAt: addMinutes(ready, 20), deliveredAt: done,
      pod: pod(podKind.replace(/^Signed · /, '').replace(/^Signed$/, 'Consignee'), done, van, podKind.toUpperCase().includes('PHOTO') ? 'PHOTO + SIGNATURE' : 'SIGNATURE'),
      invoiceId: daysAgo > 6 ? (INVOICE_LINK[cid] || 'INV-4016') : null,
      activity: [A(addMinutes(ready, 20), 'Collected'), A(done, `Delivered · ${podKind}`)] });
    j.podLabel = podKind;
    jobs.push(j);
  });

  const invoices = [
    { id: 'INV-4021', customerId: 'c_slaney', issuedDays: -11, dueDays: 19, net: 3700, status: 'Sent', jobsCount: 18 },
    { id: 'INV-4020', customerId: 'c_creamery', issuedDays: -11, dueDays: 19, net: 2455, status: 'Sent', jobsCount: 9 },
    { id: 'INV-4019', customerId: 'c_harvey', issuedDays: -25, dueDays: -7, net: 1980, status: 'Sent', jobsCount: 6 },
    { id: 'INV-4018', customerId: 'c_sinnott', issuedDays: -18, dueDays: 12, net: 1120, status: 'Sent', jobsCount: 14 },
    { id: 'INV-4017', customerId: 'c_mcguiness', issuedDays: -35, dueDays: -5, net: 3600, status: 'Paid', paidDays: -3, jobsCount: 30 },
    { id: 'INV-4016', customerId: 'c_cullen', issuedDays: -35, dueDays: -5, net: 2140, status: 'Paid', paidDays: -2, jobsCount: 7 },
    { id: 'INV-4015', customerId: 'c_kehoe', issuedDays: -35, dueDays: -21, net: 640, status: 'Paid', paidDays: -30, jobsCount: 11 },
    { id: 'INV-3994', customerId: 'c_sinnott', issuedDays: -46, dueDays: -16, net: 2265, status: 'Paid', paidDays: -20, jobsCount: 22 },
    { id: 'INV-3971', customerId: 'c_sinnott', issuedDays: -74, dueDays: -44, net: 1840, status: 'Paid', paidDays: -50, jobsCount: 19 },
    { id: 'INV-3948', customerId: 'c_sinnott', issuedDays: -109, dueDays: -79, net: 2010, status: 'Paid', paidDays: -84, jobsCount: 21 },
  ].map((i) => ({
    id: i.id, customerId: i.customerId, issuedAt: iso(atTime(addDays(now, i.issuedDays), 8)), dueAt: iso(atTime(addDays(now, i.dueDays), 23, 59)), net: i.net, vatPct: 23, vat: Math.round(i.net * 0.23 * 100) / 100,
    status: i.status, paidAt: i.paidDays !== undefined ? iso(atTime(addDays(now, i.paidDays), 10)) : null, jobIds: [], jobsCount: i.jobsCount,
    lines: [['Same-day urgent', Math.round(i.net * 0.4)], ['Multi-drop routes', Math.round(i.net * 0.25)], ['Pallet freight', Math.round(i.net * 0.2)], ['Waiting time', Math.round(i.net * 0.05)], ['Fuel surcharge 4.5%', Math.round(i.net * 0.1)]].map(([label, amount]) => ({ label, amount })),
    xero: 'Synced 02:10',
  }));

  const dailyHistory = [38, 44, 41, 52, 29, 18, 40, 46, 43, 39, 55, 47, 22].map((n, i) => ({ day: iso(addDays(now, i - 13)), jobs: n, late: [3, 5, 2, 7, 1, 0, 4, 2, 6, 3, 9, 4, 1][i] }));

  const vans = VANS.map((v) => ({
    id: v.id, reg: v.reg, model: v.model, cls: v.cls, fridge: v.fridge, status: v.status, odometer: v.odometer,
    taxDue: iso(addDays(now, v.taxDays)), cvrtDue: iso(addDays(now, v.cvrtDays)), serviceDueKm: v.serviceKm, insurance: 'AXA · 31 Dec 26',
    pos: { ...v.pos, since: iso(addMinutes(now, v.pos.idleSince || -3)) },
    history: [['Service · 10,000 km interval', -14], ['Tyres ×2, front', -63], ['Windscreen replaced', -109], ['CVRT passed, no advisories', -186]].map(([what, d]) => ({ at: iso(addDays(now, d)), what })),
    fuelMtd: Math.round(400 + (v.odometer % 300)), maintenanceMtd: Math.round(120 + (v.odometer % 200)),
  }));

  const drivers = DRIVERS.map((d) => ({
    id: d.id, name: d.name, van: d.van, phone: d.phone, weekHours: d.hours, weekDrops: d.drops, onTime: d.onTime, compliance: d.compliance, complianceOk: d.ok,
    expenses: d.expenses.map(([type, amount], i) => ({ id: uid('exp'), type, amount, at: iso(addDays(now, -1 - i)), receipt: null })),
    shift: d.van === 'RD3' ? { startedAt: iso(atTime(now, 6, 12)) } : (d.van !== 'RD6' && d.van !== 'RD1' ? { startedAt: iso(atTime(now, 6, 30 + (d.id.length * 7) % 30)) } : null),
  }));

  return {
    version: SEED_VERSION, seededAt: iso(now),
    settings, vans, drivers, customers: CUSTOMERS.map((c) => ({ ...c, addresses: c.addresses || [], users: c.users || [], prefs: c.prefs || null })), jobs, invoices, dailyHistory,
    automations: [
      { id: 'booking', name: 'Booking confirmed', detail: 'Sent the moment an order is accepted, with ref and price', channel: 'EMAIL', on: true },
      { id: 'onway', name: 'Driver on the way', detail: 'Tracking link + live ETA when the van leaves collection', channel: 'SMS', on: true },
      { id: '30out', name: '30 minutes out', detail: 'Consignee gets a heads-up so someone is on site', channel: 'SMS', on: true },
      { id: 'pod', name: 'Delivered + POD', detail: 'Photo and signature attached automatically', channel: 'EMAIL', on: true },
      { id: 'failed', name: 'Failed delivery', detail: 'Reason, photo and re-delivery options', channel: 'SMS + EMAIL', on: true },
      { id: 'reminder', name: 'Invoice reminder', detail: 'Day 25 and day 35 after issue', channel: 'EMAIL', on: false },
    ],
    messages: [
      { id: uid('m'), at: iso(atTime(now, 14, 2)), channel: 'EMAIL', to: 'accounts@kehoepharmacy.ie', text: 'POD for RD-24816 · photo + signature attached' },
      { id: uid('m'), at: iso(atTime(now, 12, 41)), channel: 'SMS', to: 'Consignee · Sandyford', text: 'RD-24815 on its way · track: rd.ie/t/24815' },
      { id: uid('m'), at: iso(atTime(now, 11, 58)), channel: 'EMAIL', to: 'aidan@sinnottelec.ie', text: 'Booking confirmed RD-24815 · €78.00 + VAT' },
    ],
    queries: [],
    dismissedAlerts: [],
    payroll: { approvedWeeks: {} },
    counters: { ref: refN, invoice: 4022, draft: 42 },
    ui: { role: 'owner', screen: 'dispatch', portalScreen: 'book', portalCustomerId: 'c_sinnott', driverId: 'd3', selectedJobId: null, detail: null, modal: null, boardByVan: true, jobFilter: 'All', search: '', settingsTab: 'Company', mapVan: null, dStage: 'none', showFail: false, showFuel: false, ordered: null, bankModal: null },
  };
}

export const DEPOT_POS = { lat: 52.343, lng: -6.497 };
export { COUNTIES };
