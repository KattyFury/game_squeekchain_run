// One short, visible message line (also announced to screen readers). Sits in the top layer so it shows above dialogs.
let timer;
export function toast(message, {error = false, ms = 7000} = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = (error ? '⚠ ' : '') + message;
  el.dataset.kind = error ? 'error' : 'info';
  el.hidden = false;
  try { if (el.showPopover && !el.matches(':popover-open')) el.showPopover(); } catch {}
  clearTimeout(timer);
  if (ms) timer = setTimeout(() => { try { el.hidePopover?.(); } catch {} el.hidden = true; }, ms);
}
