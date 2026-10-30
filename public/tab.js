// A tab id lives in sessionStorage: it survives a reload but is not shared between tabs, so each tab owns one chat on the server.
// ponytail: "Duplicate tab" copies sessionStorage, so the copy shares the original's id and both attach to one chat.
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

export function getTabId(storage, makeId = () => crypto.randomUUID()) {
  const stored = storage.getItem('tab');
  if (stored && VALID.test(stored)) return stored;
  const id = makeId();
  storage.setItem('tab', id);
  return id;
}

export const withTab = (path, tab) => `${path}${path.includes('?') ? '&' : '?'}tab=${tab}`;
