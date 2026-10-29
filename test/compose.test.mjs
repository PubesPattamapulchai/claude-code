import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeContent } from '../public/compose.js';

const image = { block: { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } } };

test('a slash command with arguments, quotes, a newline and Thai text arrives byte for byte', () => {
  const typed = '/mattpocock-skills:grilling เรื่อง "x"\nบรรทัดสอง';
  assert.deepEqual(composeContent(typed, [], []), [{ type: 'text', text: typed }]);
});

test('with a file attached the text still starts with the exact input', () => {
  const typed = '/ponytail:ponytail-help --level  full';
  const [block] = composeContent(typed, [], [{ path: 'C:\\p\\a.txt' }]);
  assert.equal(block.text, `${typed}\n\nAttached files:\n- C:\\p\\a.txt`);
  assert.ok(block.text.startsWith('/ponytail:ponytail-help --level  full'));
});

test('surrounding whitespace is trimmed but inner spacing is kept', () => {
  assert.equal(composeContent('  /clear  ', [], [])[0].text, '/clear');
  assert.equal(composeContent('a   b', [], [])[0].text, 'a   b');
});

test('images come first, then one text block; empty text gets a default per attachment kind', () => {
  assert.deepEqual(composeContent('', [image], []), [image.block, { type: 'text', text: 'See the attached image.' }]);
  assert.equal(composeContent('', [], [{ path: '/x/y.txt' }])[0].text, 'See the attached file.\n\nAttached files:\n- /x/y.txt');
  assert.deepEqual(composeContent('look', [image], []), [image.block, { type: 'text', text: 'look' }]);
});

test('several files are listed one per line', () => {
  const text = composeContent('go', [], [{ path: 'a' }, { path: 'b' }])[0].text;
  assert.equal(text, 'go\n\nAttached files:\n- a\n- b');
});

test('nothing to send gives an empty list', () => {
  assert.deepEqual(composeContent('', [], []), []);
  assert.deepEqual(composeContent('   ', [], []), []);
});
