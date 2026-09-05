// Entry point: build the store, choose the view for the active role, mount the renderer.
import { createStore } from './store.js';
import { mount } from './ui/render.js';
import { ownerView } from './ui/owner.js';
import { portalView } from './ui/portal.js';
import { driverView } from './ui/driver.js';
import { createHandlers } from './actions.js';

const store = createStore();
const handlers = createHandlers(store);

function view(st) {
  const role = st.state.ui.role;
  const inner = role === 'business' ? portalView(st) : role === 'driver' ? driverView(st) : ownerView(st);
  return `<div class="shell">${inner}</div>`;
}

mount({ root: document.getElementById('app'), store, view, handlers });

// Expose for debugging in the console.
window.roaddog = store;
