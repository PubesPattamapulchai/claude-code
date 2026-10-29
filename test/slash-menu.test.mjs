// The menu's DOM behaviour, against a tiny hand-made DOM (no browser needed): keyboard rules matter most here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.hidden = false; this.className = ''; this.id = ''; this.textContent = ''; this.value = ''; this.focused = false; }
  append(...n) { this.children.push(...n); }
  replaceChildren(...n) { this.children = [...n]; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  dispatch(type, init = {}) {
    const e = { type, key: init.key, shiftKey: !!init.shiftKey, isComposing: !!init.isComposing, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    for (const f of this.listeners[type] ?? []) { f(e); if (e.stopped) break; }
    return e;
  }
  dispatchEvent(ev) { return this.dispatch(ev.type); }
  scrollIntoView() {}
  focus() { this.focused = true; }
  setSelectionRange() {}
}
globalThis.document = { createElement: (t) => new El(t) };
globalThis.Event = class { constructor(type) { this.type = type; } };

const { attachSlashMenu } = await import('../public/slash.js');

const cmd = (name, extra = {}) => ({ name, description: `${name} desc`, argumentHint: '', ...extra });
const COMMANDS = [cmd('clear'), cmd('help'), cmd('resume'), cmd('focus'), cmd('model'), cmd('mattpocock-skills:grilling', { argumentHint: '[topic]' }), cmd('zeta')];

function setup() {
  const input = new El('textarea');
  const menu = new El('ul');
  menu.hidden = true;
  const api = attachSlashMenu({ input, menu, getCommands: () => COMMANDS });
  const page = { enterCalls: 0 };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) page.enterCalls++; }); // the page's own Enter-to-send handler, registered after
  const type = (text) => { input.value = text; input.dispatch('input'); };
  const names = () => menu.children.map((li) => li.children[0].textContent);
  const activeName = () => menu.children.find((li) => li.getAttribute('aria-selected') === 'true')?.children[0].textContent;
  return { input, menu, api, page, type, names, activeName };
}

test('typing a slash opens the list without the unavailable commands, first row active', () => {
  const { menu, type, names, activeName } = setup();
  type('/');
  assert.equal(menu.hidden, false);
  assert.ok(names().includes('/model') && !names().includes('/help') && !names().includes('/resume') && !names().includes('/focus'));
  assert.equal(activeName(), names()[0]);
});

test('arrow keys move the active row and wrap around', () => {
  const { input, type, names, activeName } = setup();
  type('/');
  const all = names();
  input.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(activeName(), all[1]);
  input.dispatch('keydown', { key: 'ArrowUp' });
  input.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(activeName(), all[all.length - 1]);
});

test('Tab completes the active command with a trailing space and closes the menu', () => {
  const { input, menu, type } = setup();
  type('/gril');
  const e = input.dispatch('keydown', { key: 'Tab' });
  assert.equal(input.value, '/mattpocock-skills:grilling ');
  assert.equal(e.defaultPrevented, true);
  assert.equal(menu.hidden, true);
});

test('Enter on a partial command completes it and does not reach the send handler', () => {
  const { input, page, type } = setup();
  type('/mo');
  const e = input.dispatch('keydown', { key: 'Enter' });
  assert.equal(input.value, '/model ');
  assert.equal(e.stopped, true);
  assert.equal(page.enterCalls, 0);
});

test('Enter on a command typed in full is left to the page, which sends it', () => {
  const { input, menu, page, type } = setup();
  type('/clear');
  const e = input.dispatch('keydown', { key: 'Enter' });
  assert.equal(e.defaultPrevented, false);
  assert.equal(page.enterCalls, 1);
  assert.equal(menu.hidden, true);
  assert.equal(input.value, '/clear');
});

test('Escape closes the menu, keeps the text, and is not passed on', () => {
  const { input, menu, type } = setup();
  type('/mo');
  const e = input.dispatch('keydown', { key: 'Escape' });
  assert.equal(menu.hidden, true);
  assert.equal(input.value, '/mo');
  assert.equal(e.stopped, true);
});

test('keys during IME composition are ignored', () => {
  const { input, page, type } = setup();
  type('/mo');
  const down = input.dispatch('keydown', { key: 'ArrowDown', isComposing: true });
  const enter = input.dispatch('keydown', { key: 'Enter', isComposing: true });
  assert.equal(down.defaultPrevented, false);
  assert.equal(enter.stopped, false);
  assert.equal(input.value, '/mo');
  assert.equal(page.enterCalls, 0); // and the page's own handler ignores composing Enter too
});

test('ordinary text and path-like text show no menu and Enter reaches the page', () => {
  const { input, menu, page, type } = setup();
  for (const text of ['hello', '/usr/bin/env', '/zzz']) {
    type(text);
    assert.equal(menu.hidden, true, text);
    input.dispatch('keydown', { key: 'Enter' });
  }
  assert.equal(page.enterCalls, 3);
});

test('Shift+Enter is not taken by the menu', () => {
  const { input, type } = setup();
  type('/mo');
  const e = input.dispatch('keydown', { key: 'Enter', shiftKey: true });
  assert.equal(e.stopped, false);
  assert.equal(input.value, '/mo');
});

test('a mouse press on a row picks it', () => {
  const { input, menu, type } = setup();
  type('/z');
  menu.children[0].onmousedown({ preventDefault() {} });
  assert.equal(input.value, '/zeta ');
  assert.equal(menu.hidden, true);
});

test('refresh re-reads the command list (it arrives after the first keystroke)', () => {
  const input = new El('textarea');
  const menu = new El('ul');
  let list = [];
  const api = attachSlashMenu({ input, menu, getCommands: () => list });
  input.value = '/';
  input.dispatch('input');
  assert.equal(menu.hidden, true);
  list = [cmd('model')];
  api.refresh();
  assert.equal(menu.hidden, false);
});

test('Enter on a command typed in full sends it whatever the case, and an alias counts too', () => {
  for (const typed of ['/Clear', '/CLEAR', '/reset']) {
    const { input, page, type } = setup();
    type(typed);
    const e = input.dispatch('keydown', { key: 'Enter' });
    assert.equal(e.defaultPrevented, false, typed);
    assert.equal(page.enterCalls, 1, typed);
    assert.equal(input.value, typed);
  }
});
