/** Generate a UUID — works in Node 19+, modern browsers, and falls back to manual */
export function generateId(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for Node 18 where crypto.randomUUID isn't on globalThis
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // eslint-disable-next-line no-restricted-syntax -- Node 18 crypto.randomUUID polyfill
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
