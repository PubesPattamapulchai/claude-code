// Markdown -> sanitised HTML. marked, DOMPurify and hljs are classic-script globals from /vendor.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});

export function renderMarkdown(src) {
  const box = document.createElement('div');
  box.innerHTML = DOMPurify.sanitize(marked.parse(src, { gfm: true }));
  box.querySelectorAll('pre code').forEach((el) => hljs.highlightElement(el));
  return box.innerHTML;
}
