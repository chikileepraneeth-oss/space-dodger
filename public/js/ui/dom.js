/** Adds an overlay to the UI root and returns it with a `[data-x]` lookup helper. */
export function overlay(root, className, html) {
  const el = document.createElement('section');
  el.className = className;
  el.hidden = true;
  el.innerHTML = html;
  root.append(el);
  const $ = (name) => el.querySelector(`[data-${name}]`);
  return { el, $ };
}

/** Wires `<button data-act="name">` clicks to handlers[name]. */
export function bindActions(el, handlers) {
  el.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (button && handlers[button.dataset.act]) handlers[button.dataset.act]();
  });
}

export function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
