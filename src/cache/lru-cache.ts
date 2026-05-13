/**
 * LRU Cache Pattern
 * 
 * Least Recently Used cache with size limits.
 * 
 * Inspired by pi-subagents3 and pi-hermes-memory patterns.
 */

export interface LRUCacheOptions<K, V> {
  /** Maximum number of entries. Default: 100 */
  maxSize?: number;
  /** Maximum age in milliseconds. Default: no expiry */
  maxAgeMs?: number;
  /** Called when entry is evicted. */
  onEvict?: (key: K, value: V) => void;
}

/**
 * Least Recently Used Cache.
 */
export class LRUCache<K, V> {
  private readonly maxSize: number;
  private readonly maxAgeMs?: number;
  private readonly onEvict?: (key: K, value: V) => void;
  
  private cache = new Map<K, { value: V; timestamp: number }>();
  private order: K[] = [];

  constructor(options: LRUCacheOptions<K, V> = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.maxAgeMs = options.maxAgeMs;
    this.onEvict = options.onEvict;
  }

  /**
   * Get a value from the cache.
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check age
    if (this.maxAgeMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > this.maxAgeMs) {
        this.delete(key);
        return undefined;
      }
    }

    // Move to end (most recently used)
    this.touch(key);
    return entry.value;
  }

  /**
   * Set a value in the cache.
   */
  set(key: K, value: V): void {
    // Check if exists
    if (this.cache.has(key)) {
      this.cache.set(key, { value, timestamp: Date.now() });
      this.touch(key);
      return;
    }

    // Evict if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.order.shift();
      if (oldest) {
        const entry = this.cache.get(oldest);
        if (entry) {
          this.onEvict?.(oldest, entry.value);
        }
        this.cache.delete(oldest);
      }
    }

    // Add new entry
    this.cache.set(key, { value, timestamp: Date.now() });
    this.order.push(key);
  }

  /**
   * Check if key exists in cache.
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.maxAgeMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > this.maxAgeMs) {
        this.delete(key);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Delete a key from the cache.
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.onEvict?.(key, entry.value);
      this.cache.delete(key);
      this.order = this.order.filter((k) => k !== key);
      return true;
    }
    return false;
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    for (const [key, entry] of this.cache) {
      this.onEvict?.(key, entry.value);
    }
    this.cache.clear();
    this.order = [];
  }

  /**
   * Get cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys.
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values.
   */
  values(): V[] {
    return Array.from(this.cache.values()).map((e) => e.value);
  }

  /**
   * Update access time.
   */
  private touch(key: K): void {
    this.order = this.order.filter((k) => k !== key);
    this.order.push(key);
  }
}

/**
 * Create an LRU cache.
 */
export function createLRUCache<K, V>(options?: LRUCacheOptions<K, V>): LRUCache<K, V> {
  return new LRUCache(options);
}
