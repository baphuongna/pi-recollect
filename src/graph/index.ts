/**
 * Graph Memory Module
 * Beads-style graph-based memory with hash IDs, semantic decay, FTS5 search
 */

export { generateHashId, generateHierarchicalId, parseHierarchicalId, isValidHashId, generateShortId } from './hash-id.js';
export { GraphMemoryStore, type MemoryEntry, type MemoryQuery } from './memory-store.js';
export { SemanticDecay, type DecayConfig } from './decay.js';
export { computeConfidence, type ConfidenceMetadata, type ConfidenceInput, type MemoryRelation, ConfidenceThresholds, isHighConfidence, isLowConfidence } from './confidence.js';
export { createEvolution, updateEvolution, supersedeEvolution, archiveEvolution, mergeEvolutions, reconstructChain, chainLength, detectSupersessionConflict, type MemoryEvolution, type EvolutionEntry, type EvolutionChain, type ConflictInfo } from './evolution.js';
