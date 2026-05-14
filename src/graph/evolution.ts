/**
 * MemoryEvolution: tracks supersession chains and version history.
 * Enables memory to be updated without losing history.
 */

import type { ConfidenceMetadata } from "./confidence.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MemoryEvolution {
  /** Unique ID of this entry */
  id: string;
  /** ID of the entry this supersedes (if any) */
  supersededBy?: string;
  /** Version number (increments on update) */
  version: number;
  /** Entry creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Current status */
  status: "active" | "superseded" | "archived" | "merged";
  /** Changelog — human-readable summary of changes per version */
  changelog: EvolutionEntry[];
  /** Merge source IDs if this was merged from multiple entries */
  mergeSources?: string[];
}

export interface EvolutionEntry {
  version: number;
  timestamp: number;
  reason: string;
  delta?: string; // What changed (diff summary)
}

export interface EvolutionChain {
  head: MemoryEvolution;
  lineage: MemoryEvolution[];
}

// ── Evolution builder ──────────────────────────────────────────────────────────

export function createEvolution(id: string, initialReason = "created"): MemoryEvolution {
  const now = Date.now();
  return {
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: "active",
    changelog: [{ version: 1, timestamp: now, reason: initialReason }],
  };
}

export function updateEvolution(
  ev: MemoryEvolution,
  reason: string,
  delta?: string
): MemoryEvolution {
  return {
    ...ev,
    version: ev.version + 1,
    updatedAt: Date.now(),
    changelog: [
      ...ev.changelog,
      { version: ev.version + 1, timestamp: Date.now(), reason, delta },
    ],
  };
}

export function supersedeEvolution(
  ev: MemoryEvolution,
  newEntryId: string,
  reason = "superseded"
): MemoryEvolution {
  return {
    ...ev,
    supersededBy: newEntryId,
    updatedAt: Date.now(),
    status: "superseded",
    changelog: [
      ...ev.changelog,
      { version: ev.version + 1, timestamp: Date.now(), reason },
    ],
  };
}

export function archiveEvolution(
  ev: MemoryEvolution,
  reason = "archived"
): MemoryEvolution {
  return {
    ...ev,
    updatedAt: Date.now(),
    status: "archived",
    changelog: [
      ...ev.changelog,
      { version: ev.version + 1, timestamp: Date.now(), reason },
    ],
  };
}

export function mergeEvolutions(
  targetId: string,
  sources: string[],
  reason = "merged"
): MemoryEvolution {
  const now = Date.now();
  return {
    id: targetId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: "active",
    changelog: [
      {
        version: 1,
        timestamp: now,
        reason,
        delta: `merged from ${sources.length} entries: ${sources.join(", ")}`,
      },
    ],
    mergeSources: sources,
  };
}

// ── Chain reconstruction ────────────────────────────────────────────────────────

/**
 * Reconstruct the full lineage chain from a head entry.
 * Walks backward through supersededBy links.
 */
export async function reconstructChain(
  head: MemoryEvolution,
  lookup: (id: string) => Promise<MemoryEvolution | undefined>
): Promise<EvolutionChain> {
  const lineage: MemoryEvolution[] = [];
  let current: MemoryEvolution | undefined = head;

  while (current?.supersededBy) {
    const prev = await lookup(current.supersededBy);
    if (!prev) break;
    lineage.unshift(prev); // prepend so oldest is first
    current = prev;
  }

  return { head, lineage };
}

/**
 * Find the oldest ancestor in a lineage chain.
 */
export function findOrigin(ev: MemoryEvolution): MemoryEvolution {
  // Note: in-memory only; for full chain walk use reconstructChain
  return ev;
}

/**
 * Count how many versions exist in a lineage chain.
 */
export function chainLength(chain: EvolutionChain): number {
  return chain.lineage.length + 1; // +1 for head
}

// ── Conflict detection ────────────────────────────────────────────────────────

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingIds: string[];
  reason: string;
}

/**
 * Detect whether updating an entry would conflict with an existing supersession.
 */
export function detectSupersessionConflict(
  ev: MemoryEvolution,
  otherEv: MemoryEvolution
): ConflictInfo {
  // If the other entry already supersedes this one, conflict
  if (otherEv.supersededBy === ev.id) {
    return {
      hasConflict: true,
      conflictingIds: [ev.id, otherEv.id],
      reason: "circular supersession: each supersedes the other",
    };
  }

  // If both are active and have different lineages, potential conflict
  if (ev.status === "active" && otherEv.status === "active" && ev.version === 1 && otherEv.version === 1) {
    // Both are v1 (never updated) — might be parallel creations
    return {
      hasConflict: true,
      conflictingIds: [ev.id, otherEv.id],
      reason: "parallel creation: two v1 entries with same key",
    };
  }

  return { hasConflict: false, conflictingIds: [], reason: "no conflict" };
}