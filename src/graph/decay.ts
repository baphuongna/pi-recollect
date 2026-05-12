/**
 * Semantic Decay - Automatic memory compaction
 * Based on beads pattern: summarize old entries, keep active ones
 */

import { GraphMemoryStore, MemoryEntry } from './memory-store';

export interface DecayConfig {
  /** Age in ms before entry is eligible for decay (default: 7 days) */
  ageThreshold?: number;
  /** Maximum active entries to keep (default: 50) */
  maxActive?: number;
  /** Summary prompt for LLM summarization */
  summaryPrompt?: (entries: MemoryEntry[]) => string;
}

const DEFAULT_AGE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_MAX_ACTIVE = 50;

/**
 * SemanticDecay compacts old closed memories while keeping active ones fresh
 */
export class SemanticDecay {
  private store: GraphMemoryStore;
  private config: Required<DecayConfig>;

  constructor(store: GraphMemoryStore, config: DecayConfig = {}) {
    this.store = store;
    this.config = {
      ageThreshold: config.ageThreshold ?? DEFAULT_AGE_THRESHOLD,
      maxActive: config.maxActive ?? DEFAULT_MAX_ACTIVE,
      summaryPrompt: config.summaryPrompt ?? this.defaultSummaryPrompt,
    };
  }

  /**
   * Default summary prompt for compacting memories
   */
  private defaultSummaryPrompt(entries: MemoryEntry[]): string {
    return `Summarize the following memories into a concise overview:\n\n${
      entries.map((e) => `- ${e.key}: ${e.value}`).join('\n')
    }\n\nProvide a 2-3 sentence summary.`;
  }

  /**
   * Run semantic decay on memory store
   * Returns count of compacted entries
   */
  async compact(): Promise<{ compacted: number; active: number }> {
    const now = Date.now();
    const threshold = now - this.config.ageThreshold;

    // Get all active entries
    const active = this.store.query({ status: 'active', limit: 1000 });

    // If under limit, no decay needed
    if (active.length < this.config.maxActive) {
      return { compacted: 0, active: active.length };
    }

    // Get old closed entries eligible for decay
    const oldClosed = this.store.query({
      status: 'closed',
      limit: 100,
    }).filter((e) => e.updatedAt < threshold);

    if (oldClosed.length === 0) {
      return { compacted: 0, active: active.length };
    }

    // Generate summary using LLM
    const summary = await this.summarize(oldClosed);

    // Store summary and mark old entries as compacted
    await this.store.remember(
      `summary-${new Date().toISOString().split('T')[0]}`,
      summary,
      'summary',
      { tags: ['compacted', 'decay'] }
    );

    // Mark old entries as compacted
    for (const entry of oldClosed) {
      this.store.update(entry.id, `[COMPACTED] ${entry.value.substring(0, 100)}...`);
      // Note: In production, you might want to delete instead
    }

    return {
      compacted: oldClosed.length,
      active: active.length,
    };
  }

  /**
   * Summarize entries using LLM
   * Override this with actual LLM integration
   */
  private async summarize(entries: MemoryEntry[]): Promise<string> {
    // Default: simple concatenation
    // In production: call LLM with config.summaryPrompt
    const summary = this.config.summaryPrompt(entries);

    // If summary looks like a prompt, just concatenate
    if (summary.startsWith('Summarize')) {
      return entries
        .slice(0, 10)
        .map((e) => `${e.key}: ${e.value}`)
        .join('; ');
    }

    return summary;
  }

  /**
   * Check if decay is needed
   */
  needsDecay(): boolean {
    const active = this.store.query({ status: 'active', limit: 1000 });
    return active.length >= this.config.maxActive;
  }

  /**
   * Get decay statistics
   */
  getStats(): {
    total: number;
    active: number;
    closed: number;
    compacted: number;
  } {
    const all = this.store.query({ limit: 10000 });
    return {
      total: all.length,
      active: all.filter((e) => e.status === 'active').length,
      closed: all.filter((e) => e.status === 'closed').length,
      compacted: all.filter((e) => e.status === 'compacted').length,
    };
  }
}
