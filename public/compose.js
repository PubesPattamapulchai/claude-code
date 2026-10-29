// Builds the content blocks for one outgoing message. Pure: no DOM, so Node tests can load it.
// The user's text goes to Claude untouched (only surrounding whitespace is trimmed): a leading "/" is a skill
// or command the CLI expands itself, so it must never be rewritten, wrapped or moved.
export function composeContent(typed, images, files) {
  const text = typed.trim();
  if (!text && !images.length && !files.length) return [];
  const body = text || (images.length ? 'See the attached image.' : 'See the attached file.');
  const attached = files.length ? `Attached files:\n${files.map((f) => `- ${f.path}`).join('\n')}` : '';
  return [...images.map((a) => a.block), { type: 'text', text: [body, attached].filter(Boolean).join('\n\n') }];
}
