// Shared view helpers.
import { esc, act, money, HIDDEN, cx } from '../util.js';
import { STATUS_COLOR } from '../store.js';

export const fin = (store, n, opts) => (store.state.settings.showFinancials ? money(n, opts) : HIDDEN);

export const statusTag = (status, extra = '') => `<span class="status ${extra}" style="color:${STATUS_COLOR[status] || '#6B7480'}">${esc(status)}</span>`;
export const dot = (color, lg = false) => `<span class="dot ${lg ? 'lg' : ''}" style="background:${color}"></span>`;

export const brand = (tag) => `
  <div class="brand">
    <div class="logo"><span class="r">ROAD</span><span class="b">DOG</span></div>
    <div class="tag">${esc(tag)}</div>
  </div>`;

export const roleSwitch = (store) => {
  const role = store.state.ui.role;
  return `<div class="role-switch">
    ${[['owner', 'Owner'], ['business', 'Customer'], ['driver', 'Driver']].map(([k, l]) => `<button type="button" class="${role === k ? 'on' : ''}" ${act('setRole', k)}>${l}</button>`).join('')}
  </div>`;
};

export const navItem = (label, on, badge, action, arg, badgeClass = '') => `
  <button type="button" class="nav-item ${on ? 'on' : ''}" ${act(action, arg)}>
    <span class="lbl">${esc(label)}</span>
    ${badge ? `<span class="badge ${badgeClass}">${badge}</span>` : ''}
  </button>`;

export function field({ id, label, bind, value = '', type = 'text', placeholder = '', error = '', span2 = false, options = null, hint = '', live = true, min, step, rows }) {
  const cls = cx('input', error && 'err');
  let control;
  const common = `id="${esc(id)}" ${bind ? `data-bind="${esc(bind)}"` : ''} ${live ? '' : 'data-live="false"'}`;
  if (options) {
    control = `<select class="${cls}" ${common}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea class="${cls}" ${common} placeholder="${esc(placeholder)}" ${rows ? `rows="${rows}"` : ''}>${esc(value)}</textarea>`;
  } else {
    control = `<input class="${cls}" type="${type}" ${common} value="${esc(value)}" placeholder="${esc(placeholder)}" ${min !== undefined ? `min="${min}"` : ''} ${step !== undefined ? `step="${step}"` : ''}>`;
  }
  return `<div class="field ${span2 ? 'span2' : ''}">
    <label for="${esc(id)}">${esc(label)}</label>
    ${control}
    ${error ? `<span class="err-msg">${esc(error)}</span>` : hint ? `<span class="small muted">${esc(hint)}</span>` : ''}
  </div>`;
}

export const checkbox = ({ id, label, bind, checked }) => `<label class="check" for="${esc(id)}"><input type="checkbox" id="${esc(id)}" data-bind="${esc(bind)}" ${checked ? 'checked' : ''}> ${esc(label)}</label>`;

export function modal({ title, sub, body, closeAct = 'closeModal', size = '' }) {
  return `<div class="modal-bg" ${act(closeAct)}>
    <div class="modal ${size}" data-act="noop">
      <div class="modal-head">
        <div class="col grow" style="gap:3px"><span class="t">${esc(title)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ''}</div>
        <button type="button" class="close lg" ${act(closeAct)} aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${body}</div>
    </div>
  </div>`;
}

export const kv = (k, v, cls = '') => `<div class="kv ${cls}"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
export const fact = (k, v) => `<div class="fact"><span class="eyebrow">${esc(k)}</span><span class="v">${v}</span></div>`;
export const emptyRow = (text) => `<div class="empty">${esc(text)}</div>`;

export const priceLines = (q, show) => show ? `<div class="price-lines">${q.lines.map((l) => `<div class="r"><span>${esc(l.label)}</span><span>${money(l.amount, { cents: true })}</span></div>`).join('')}${q.discount ? `<div class="r"><span>Account discount ${q.discountPct}%</span><span>−${money(q.discount, { cents: true })}</span></div>` : ''}<div class="r"><span>Fuel surcharge ${q.fuelPct}%</span><span>${money(q.fuel, { cents: true })}</span></div><div class="r"><span>VAT ${q.vatPct}%</span><span>${money(q.vat, { cents: true })}</span></div></div>` : '';
