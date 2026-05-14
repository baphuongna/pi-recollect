/**
 * Graph Memory Module
 * Beads-style graph-based memory with hash IDs, semantic decay, FTS5 search
 */

export { generateHashId, generateHierarchicalId, parseHierarchicalId, isValidHashId, generateShortId } from './hash-id';
export { GraphMemoryStore, type MemoryEntry, type MemoryQuery } from './memory-store';
export { SemanticDecay, type DecayConfig } from './decay';
export { computeConfidence, type ConfidenceMetadata, type ConfidenceInput, type MemoryRelation, ConfidenceThresholds, isHighConfidence, isLowConfidence } from './confidence';
export { createEvolution, updateEvolution, supersedeEvolution, archiveEvolution, mergeEvolutions, reconstructChain, chainLength, detectSupersessionConflict, type MemoryEvolution, type EvolutionEntry, type EvolutionChain, type ConflictInfo } from './evolution';
