/**
 * Cascade-Update Pattern
 * 
 * Marks graph nodes as stale when a memory entry is superseded.
 * Based on agentmemory/src/functions/cascade.ts
 */

import type { GraphStore, GraphNode } from './graph-store.ts';

/**
 * Result of a cascade update operation.
 */
export interface CascadeResult {
  flagged: number;
  staleIds: string[];
}

/**
 * Cascade-update: marks graph nodes/edges referencing a superseded entry as stale.
 * 
 * Finds all nodes that have a `supersedes` relation pointing to the supersededId,
 * then marks them with `stale: true` and an updated timestamp.
 * 
 * @param graphStore - The in-memory GraphStore instance to operate on
 * @param supersededId - ID of the memory entry that was superseded
 * @returns Result with count of flagged nodes and their IDs
 */
export function cascadeUpdate(
  graphStore: GraphStore,
  supersededId: string,
): CascadeResult {
  let flagged = 0;
  const staleIds: string[] = [];
  const now = new Date().toISOString();

  // Find all nodes that supersede the given ID
  const supersedingNodes = graphStore.query({
    relationType: 'supersedes',
    relationTarget: supersededId,
  });

  for (const node of supersedingNodes) {
    // Skip already-stale nodes
    if (node.stale) continue;

    // Mark as stale with current timestamp
    const updated = graphStore.updateNode(node.id, {
      stale: true,
      updatedAt: now,
    });

    if (updated) {
      flagged++;
      staleIds.push(updated.id);
    }
  }

  // Also check direct node references (nodes created from the superseded memory)
  // by looking for nodes whose content/relations reference the supersededId
  const allNodes = graphStore.query({});
  for (const node of allNodes) {
    if (node.stale) continue;
    if (staleIds.includes(node.id)) continue;

    // Check if any relation target matches the supersededId
    const hasDirectReference = node.relations.some(
      (rel) => rel.targetId === supersededId
    );

    if (hasDirectReference) {
      const updated = graphStore.updateNode(node.id, {
        stale: true,
        updatedAt: now,
      });

      if (updated) {
        flagged++;
        staleIds.push(updated.id);
      }
    }
  }

  return { flagged, staleIds };
}

/**
 * Find all stale nodes in the graph store.
 */
export function findStaleNodes(graphStore: GraphStore): GraphNode[] {
  return graphStore.query({}).filter((node) => node.stale === true);
}

/**
 * Remove stale marking from nodes (re-activate).
 */
export function activateNodes(
  graphStore: GraphStore,
  nodeIds: string[],
): number {
  let activated = 0;
  const now = new Date().toISOString();

  for (const id of nodeIds) {
    const node = graphStore.getNode(id);
    if (node?.stale) {
      graphStore.updateNode(id, { stale: false, updatedAt: now });
      activated++;
    }
  }

  return activated;
}