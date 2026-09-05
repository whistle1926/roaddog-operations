// Shared helpers: escaping, formatting, dates, ids.

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Build data-act / data-arg attributes for delegated click handling.
export const act = (name, arg) =>
  `data-act="${esc(name)}"${arg === undefined ? '' : ` data-arg="${esc(JSON.stringify(arg))}"`}`;

export const cx = (...xs) => xs.filter(Boolean).join(' ');

let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('');

export const firstName = (name) => String(name || '').split(' ')[0];

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ---------- money ----------
export function money(n, { cents = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const opts = cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return '€' + v.toLocaleString('en-IE', opts);
}
export const HIDDEN = '••';

// ---------- dates ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const toDate = (d) => (d instanceof Date ? d : new Date(d));
export const pad2 = (n) => String(n).padStart(2, '0');

export const fmtTime = (d) => { const x = toDate(d); return `${pad2(x.getHours())}:${pad2(x.getMinutes())}`; };
export const fmtDate = (d) => { const x = toDate(d); return `${pad2(x.getDate())} ${MONTHS[x.getMonth()]} ${String(x.getFullYear()).slice(2)}`; };
export const fmtDateLong = (d) => { const x = toDate(d); return `${DAYS[x.getDay()].toUpperCase()} ${pad2(x.getDate())} ${MONTHS[x.getMonth()].toUpperCase()} ${x.getFullYear()}`; };
export const fmtHeaderClock = (d) => `${fmtDateLong(d)} · ${fmtTime(d)}`;
export const fmtDateTime = (d) => `${fmtDate(d)} ${fmtTime(d)}`;
export const isoLocalDate = (d) => { const x = toDate(d); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };
export const isoLocalDateTime = (d) => `${isoLocalDate(d)}T${fmtTime(d)}`;

export const startOfDay = (d) => { const x = new Date(toDate(d)); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(toDate(d)); x.setDate(x.getDate() + n); return x; };
export const addMinutes = (d, n) => new Date(toDate(d).getTime() + n * 60000);
export const atTime = (d, h, m = 0) => { const x = startOfDay(d); x.setHours(h, m, 0, 0); return x; };
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const isToday = (d, now = new Date()) => sameDay(d, now);
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
export const minutesBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 60000);

export function fmtDuration(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${pad2(m % 60)}m` : `${m} min`;
}

export function relativeAgo(d, now = new Date()) {
  const m = minutesBetween(d, now);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} h ${pad2(m % 60)} m`;
  return `${Math.floor(m / 1440)} d`;
}

// "Today 14:02" / "Yest 16:02" / "01 Sep 26 · 14:02"
export function fmtWhen(d, now = new Date()) {
  if (isToday(d, now)) return `Today ${fmtTime(d)}`;
  if (sameDay(d, addDays(now, -1))) return `Yest ${fmtTime(d)}`;
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}

// Delivery window label from job window fields.
export function windowLabel(job, now = new Date()) {
  const by = job.deliverBy ? toDate(job.deliverBy) : null;
  const from = job.readyFrom ? toDate(job.readyFrom) : null;
  if (!by) return '—';
  const dayPrefix = isToday(by, now) ? '' : sameDay(by, addDays(now, 1)) ? 'Tomorrow ' : fmtDate(by) + ' ';
  if (from && sameDay(from, by) && job.windowType === 'slot') return `${dayPrefix}${fmtTime(from)}–${fmtTime(by)}`;
  return `${dayPrefix}By ${fmtTime(by)}`;
}

export const parseLocalDateTime = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ISO week number (used for payroll week label)
export function isoWeek(d) {
  const x = new Date(Date.UTC(toDate(d).getFullYear(), toDate(d).getMonth(), toDate(d).getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}
export function weekRange(d) {
  const x = startOfDay(d);
  const day = x.getDay() || 7;
  const mon = addDays(x, 1 - day);
  const sun = addDays(mon, 6);
  return { start: mon, end: sun };
}

export const sum = (xs, f = (x) => x) => xs.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const by = (key, dir = 1) => (a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0);
export const groupBy = (xs, f) => xs.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
export const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);
