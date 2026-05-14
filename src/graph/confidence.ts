/**
 * Confidence scoring for memory entries.
 * Provides 0-1 confidence scores based on source quality, freshness, and relations.
 */

import type { MemoryEntry } from "./memory-store.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ConfidenceMetadata {
  /** Confidence score from 0 (unreliable) to 1 (highly reliable) */
  confidence: number;
  /** Source of this memory entry */
  source: "user" | "agent" | "tool" | "auto" | "compound" | "import";
  /** When this entry was created (Unix ms) */
  timestamp: number;
  /** Version number for updates */
  version: number;
  /** Relations to other entries */
  relations?: MemoryRelation[];
  /** Reasoning behind the confidence score */
  reason?: string;
  /** Override score if manually verified */
  verified?: boolean;
}

export interface MemoryRelation {
  targetId: string;
  type: "depends_on" | "related_to" | "blocks" | "supersedes" | "derived_from";
  strength: number; // 0-1
}

// ── Confidence scoring factors ────────────────────────────────────────────────

const SOURCE_WEIGHTS: Record<ConfidenceMetadata["source"], number> = {
  user: 1.0,      // User-provided knowledge is gold standard
  tool: 0.9,      // Tool-generated (e.g., file reads, grep)
  agent: 0.7,     // AI agent reasoning
  auto: 0.5,      // Auto-generated summaries
  compound: 0.85, // Compound knowledge from multiple sources
  import: 0.75,    // Imported from external sources
};

const MAX_FRESHNESS_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function freshnessScore(createdAt: number): number {
  const age = Date.now() - createdAt;
  if (age <= 0) return 1.0;
  if (age >= MAX_FRESHNESS_AGE_MS) return 0.2;
  // Linear decay from 1.0 to 0.2 over 7 days
  return 1.0 - (age / MAX_FRESHNESS_AGE_MS) * 0.8;
}

function relationScore(relations: MemoryRelation[] = []): number {
  if (relations.length === 0) return 0.5; // No relations = neutral
  const avgStrength = relations.reduce((sum, r) => sum + r.strength, 0) / relations.length;
  // More relations with higher strength = more confident
  const countBonus = Math.min(relations.length / 5, 1.0); // Cap at 5 relations
  return 0.5 + avgStrength * 0.3 + countBonus * 0.2;
}

function contentQualityScore(content: string): number {
  if (!content || content.trim().length === 0) return 0.0;
  // Minimum content length threshold
  if (content.trim().length < 20) return 0.3;
  // Penalize very long or very short entries (optimal around 100-1000 chars)
  const len = content.length;
  if (len < 100) return 0.6;
  if (len > 5000) return 0.7;
  return 0.9;
}

// ── Main scoring function ──────────────────────────────────────────────────────

export interface ConfidenceInput {
  entry: MemoryEntry;
  source?: ConfidenceMetadata["source"];
  relations?: MemoryRelation[];
  verified?: boolean;
  reason?: string;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceMetadata {
  const { entry, source = "auto", relations = [], verified = false, reason } = input;

  const sourceW = SOURCE_WEIGHTS[source] ?? 0.5;
  const freshness = freshnessScore(entry.createdAt);
  const relation = relationScore(relations);
  const quality = contentQualityScore(entry.value);

  // Weighted geometric mean to balance factors
  const weights = [sourceW * 0.35, freshness * 0.30, relation * 0.20, quality * 0.15];
  const rawScore = weights.reduce((prod, w) => prod * (w + 0.01), 1);
  const normalized = Math.min(1, Math.max(0, Math.pow(rawScore, 0.25)));

  // Manual verification overrides
  const confidence = verified ? Math.max(normalized, 0.8) : normalized;

  return {
    confidence: Math.round(confidence * 1000) / 1000,
    source,
    timestamp: entry.createdAt,
    version: 1,
    relations,
    reason: reason ?? generateReason(sourceW, freshness, relation, quality),
    verified,
  };
}

function generateReason(sourceW: number, freshness: number, relation: number, quality: number): string {
  const parts: string[] = [];
  if (sourceW >= 0.9) parts.push("high-quality source");
  else if (sourceW < 0.6) parts.push("low-confidence source");
  if (freshness >= 0.9) parts.push("recent");
  else if (freshness < 0.4) parts.push("stale");
  if (relation >= 0.8) parts.push("well-connected");
  if (quality >= 0.9) parts.push("rich content");
  return parts.join(", ") || "standard";
}

/**
 * Update confidence on entry update.
 */
export function bumpVersion(meta: ConfidenceMetadata): ConfidenceMetadata {
  return {
    ...meta,
    version: meta.version + 1,
    timestamp: Date.now(),
    confidence: Math.min(1, meta.confidence + 0.05), // Slight boost for updates
  };
}

/**
 * Reduce confidence on supersession.
 */
export function markSuperseded(meta: ConfidenceMetadata, supersessionNote?: string): ConfidenceMetadata {
  return {
    ...meta,
    confidence: Math.max(0.1, meta.confidence - 0.3),
    reason: supersessionNote ?? "superseded by newer entry",
  };
}

// ── Threshold helpers ─────────────────────────────────────────────────────────

export const ConfidenceThresholds = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3,
} as const;

export function isHighConfidence(meta: ConfidenceMetadata): boolean {
  return meta.confidence >= ConfidenceThresholds.HIGH;
}

export function isLowConfidence(meta: ConfidenceMetadata): boolean {
  return meta.confidence < ConfidenceThresholds.LOW;
}