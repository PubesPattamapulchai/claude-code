// Slash-command autocomplete. The helpers at the top are pure (no DOM at import time) so Node tests can load them.

// Built-ins the CLI refuses in this mode ("isn't available here"): never offered.
export const UNAVAILABLE = ['help', 'resume', 'focus'];

const MAX_RESULTS = 60;

function rank(command, query) {
  const name = command.name.toLowerCase();
  if (!query) return 4;
  if (name === query) return 0;
  const names = [name, ...(command.aliases ?? []).map((a) => a.toLowerCase())];
  if (names.some((n) => n.startsWith(query))) return 1;
  if (name.slice(name.lastIndexOf(':') + 1).startsWith(query)) return 2; // "grilling" finds "plugin:grilling"
  if (name.includes(query)) return 3;
  return -1;
}

// `text` is the whole input. The menu only exists while it is "/word" with no whitespace: after that the user is
// typing arguments, and anything not starting with "/" is an ordinary message.
export function filterCommands(commands, text) {
  if (!text.startsWith('/') || /\s/.test(text)) return [];
  const query = text.slice(1).toLowerCase();
  return commands
    .filter((c) => !UNAVAILABLE.includes(c.name))
    .map((c) => ({ c, r: rank(c, query) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || (a.c.name < b.c.name ? -1 : 1))
    .slice(0, MAX_RESULTS)
    .map((x) => x.c);
}

export const completionFor = (command) => `/${command.name} `;

// First line only, without the "(user)" / "(project)" source marker, cut to `max` characters.
export function shortDescription(text, max = 90) {
  const line = String(text ?? '').split('\n')[0].replace(/\s*\((user|project)\)\s*$/, '').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

// The menu: renders the filtered list above the input and drives it from the keyboard and mouse.
// Register it BEFORE any other keydown handler on the input: it stops Enter/Tab/Escape when it uses them.
export function attachSlashMenu({ input, menu, getCommands }) {
  let items = [];
  let active = -1;

  function close() {
    items = [];
    active = -1;
    menu.hidden = true;
    menu.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function render() {
    menu.replaceChildren(...items.map((c, i) => {
      const li = document.createElement('li');
      li.id = `slash-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      const name = document.createElement('span');
      name.className = 'cmd';
      name.textContent = `/${c.name}`;
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = c.argumentHint ?? '';
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = shortDescription(c.description);
      li.append(name, hint, desc);
      li.onmousedown = (e) => { e.preventDefault(); pick(i); }; // mousedown, so the input keeps focus
      return li;
    }));
    menu.hidden = !items.length;
    input.setAttribute('aria-expanded', String(!menu.hidden));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', `slash-opt-${active}`);
      menu.children[active]?.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function refresh() {
    items = filterCommands(getCommands(), input.value);
    active = items.length ? 0 : -1;
    render();
  }

  function pick(i) {
    const c = items[i];
    if (!c) return;
    input.value = completionFor(c);
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input')); // lets the page resize the box; the trailing space closes the menu
    close();
    input.focus();
  }

  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (menu.hidden || !items.length || e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      render();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    } else if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      // Enter on a command that is already typed in full means "run it": let the page send it.
      if (e.key === 'Enter' && input.value === `/${items[active].name}`) { close(); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      pick(active);
    }
  });

  return { refresh, close };
}
