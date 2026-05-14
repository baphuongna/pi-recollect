/**
 * Keyed Mutex — port of agentmemory pattern
 * Ensures only one async operation runs per key at a time.
 */

const locks = new Map<string, Promise<void>>();

/**
 * Run `fn` while holding an exclusive lock on `key`.
 * Concurrent calls with the same `key` are queued, not dropped.
 * The lock is released after `fn` resolves (success or rejection).
 */
export function withKeyedLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const cleanup = next.then(
    () => {},
    () => {},
  );
  locks.set(key, cleanup);
  cleanup.then(() => {
    if (locks.get(key) === cleanup) locks.delete(key);
  });
  return next;
}