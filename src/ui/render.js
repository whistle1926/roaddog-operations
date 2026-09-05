// Render engine: full re-render from state into #app, with focus and scroll preservation,
// delegated events (data-act clicks, data-bind inputs, data-submit forms) and toasts.

export function mount({ root, store, view, handlers }) {
  let scheduled = false;

  function captureFocus() {
    const el = document.activeElement;
    if (!el || el === document.body || !el.id) return null;
    const sel = ('selectionStart' in el && typeof el.selectionStart === 'number') ? [el.selectionStart, el.selectionEnd] : null;
    return { id: el.id, sel };
  }
  function restoreFocus(f) {
    if (!f) return;
    const el = document.getElementById(f.id);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (f.sel && 'setSelectionRange' in el) { try { el.setSelectionRange(f.sel[0], f.sel[1]); } catch {} }
  }
  function captureScroll() {
    const m = {};
    root.querySelectorAll('[data-scroll]').forEach((el) => { m[el.dataset.scroll] = el.scrollTop; });
    return m;
  }
  function restoreScroll(m) {
    root.querySelectorAll('[data-scroll]').forEach((el) => { if (m[el.dataset.scroll] !== undefined) el.scrollTop = m[el.dataset.scroll]; });
  }

  function render() {
    scheduled = false;
    const focus = captureFocus();
    const scroll = captureScroll();
    root.innerHTML = view(store);
    restoreScroll(scroll);
    restoreFocus(focus);
    handlers.afterRender?.(root);
    flushToasts();
  }
  // Microtask rather than requestAnimationFrame: coalesces several commits in one tick and keeps
  // rendering even when the tab is in the background (rAF is paused there).
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(render);
  }

  function flushToasts() {
    const box = document.getElementById('toasts');
    if (!box) return;
    store.takeToasts().forEach(({ text, kind }) => {
      const t = document.createElement('div');
      t.className = `toast ${kind}`;
      t.textContent = text;
      box.appendChild(t);
      setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 3200);
    });
  }

  const parseArg = (el) => { const a = el.getAttribute('data-arg'); if (a == null) return undefined; try { return JSON.parse(a); } catch { return a; } };

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A' && el.getAttribute('href') && !el.hasAttribute('data-act-only')) return; // real links pass through
    const name = el.dataset.act;
    const fn = handlers.actions[name];
    if (!fn) { console.warn('[ui] no handler for', name); return; }
    ev.preventDefault();
    fn(parseArg(el), el, ev);
  });

  // Inputs bound to drafts: data-bind="draftName.key". Re-renders (focus preserved) so prices etc. update live.
  const onInput = (ev) => {
    const el = ev.target.closest('[data-bind]');
    if (!el) return;
    const [draft, key] = el.dataset.bind.split('.');
    const value = el.type === 'checkbox' ? el.checked : el.value;
    handlers.bind?.(draft, key, value, el);
    if (el.dataset.live !== 'false') schedule();
  };
  root.addEventListener('input', onInput);
  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('select[data-bind], input[type=checkbox][data-bind], input[type=file][data-bind]')) onInput(ev);
    if (el.matches('[data-change]')) { const fn = handlers.actions[el.dataset.change]; if (fn) fn(el.value, el, ev); }
  });
  root.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form[data-submit]');
    if (!form) return;
    ev.preventDefault();
    const fn = handlers.actions[form.dataset.submit];
    if (fn) fn(parseArg(form), form, ev);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') handlers.actions.escape?.(); });

  // Drag & drop: queue/lane jobs onto van lanes.
  root.addEventListener('dragstart', (ev) => {
    const el = ev.target.closest('[data-drag-job]');
    if (!el) return;
    ev.dataTransfer.setData('text/plain', el.dataset.dragJob);
    ev.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  root.addEventListener('dragend', (ev) => { ev.target.closest?.('[data-drag-job]')?.classList.remove('dragging'); });
  root.addEventListener('dragover', (ev) => {
    const lane = ev.target.closest('[data-drop-van]');
    if (!lane) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    lane.classList.add('drop-ok');
  });
  root.addEventListener('dragleave', (ev) => { ev.target.closest?.('[data-drop-van]')?.classList.remove('drop-ok'); });
  root.addEventListener('drop', (ev) => {
    const lane = ev.target.closest('[data-drop-van]');
    if (!lane) return;
    ev.preventDefault();
    lane.classList.remove('drop-ok');
    const jobId = ev.dataTransfer.getData('text/plain');
    if (jobId) handlers.actions.assignJob?.({ jobId, vanId: lane.dataset.dropVan });
  });

  store.subscribe(schedule);
  render();
  return { render, schedule };
}
