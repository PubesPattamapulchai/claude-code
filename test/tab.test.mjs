import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTabId, withTab } from '../public/tab.js';

const fakeStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('getTabId generates once and then returns the stored id', () => {
  const storage = fakeStorage();
  let made = 0;
  const makeId = () => `tab-made-${++made}`;
  const first = getTabId(storage, makeId);
  assert.equal(getTabId(storage, makeId), first);
  assert.equal(made, 1);
});

test('getTabId replaces a stored value that is not a valid tab id', () => {
  const storage = fakeStorage({ tab: '../x' });
  assert.equal(getTabId(storage, () => 'tab-fresh-0001'), 'tab-fresh-0001');
  assert.equal(storage.getItem('tab'), 'tab-fresh-0001');
});

test('withTab adds the parameter with ? or & as needed', () => {
  assert.equal(withTab('/api/events', 'T1234567'), '/api/events?tab=T1234567');
  assert.equal(withTab('/api/sessions?cwd=x', 'T1234567'), '/api/sessions?cwd=x&tab=T1234567');
});
