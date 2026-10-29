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
