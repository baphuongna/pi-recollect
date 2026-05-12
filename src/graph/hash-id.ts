/**
 * Hash-based ID generation for conflict-free task tracking
 * Based on beads pattern: bd-a1b2 format
 */

import { createHash } from 'crypto';

/**
 * Generate a hash-based ID in bd-a1b2 format
 * Prevents merge conflicts in multi-agent workflows
 */
export function generateHashId(content: string, prefix = 'bd'): string {
  const hash = createHash('sha256')
    .update(content + Date.now())
    .digest('hex')
    .substring(0, 6);
  return `${prefix}-${hash}`;
}

/**
 * Generate hierarchical ID for nested tasks
 * Format: bd-a1b2.1.2
 */
export function generateHierarchicalId(
  parentId: string,
  childIndex: number
): string {
  return `${parentId}.${childIndex}`;
}

/**
 * Parse hierarchical ID into components
 */
export function parseHierarchicalId(id: string): {
  epic: string;
  task?: number;
  subtask?: number;
} {
  const parts = id.split('.');
  return {
    epic: parts[0],
    task: parts[1] ? parseInt(parts[1], 10) : undefined,
    subtask: parts[2] ? parseInt(parts[2], 10) : undefined,
  };
}

/**
 * Check if an ID is a valid hash-based ID
 */
export function isValidHashId(id: string): boolean {
  return /^([a-z]+-)?[a-f0-9]{4,6}(\.\d+)*$/.test(id);
}

/**
 * Generate short ID for display
 */
export function generateShortId(content: string): string {
  const hash = createHash('md5')
    .update(content)
    .digest('hex')
    .substring(0, 4);
  return hash;
}
