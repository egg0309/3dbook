const STORAGE_KEY = 'zunyi.clientId';

let memoryId: string | null = null;

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 持久匿名编号：同浏览器多次测试归到同一人，清缓存或换浏览器才换号。
 * localStorage 不可用时退化为会话内存编号，不阻断业务。
 */
export function getClientId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = makeUuid();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    memoryId ??= makeUuid();
    return memoryId;
  }
}
