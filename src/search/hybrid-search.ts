/**
 * Hybrid Search: RRF fusion of BM25 + vector + graph traversal
 * Pipeline: BM25 keyword → vector semantic → graph traversal → RRF fusion
 */

import type { SearchResult } from "../store/search.js";
import { rrf as fuseRrf } from "../store/search.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HybridSearchOptions {
  /** Natural language query */
  query: string;
  /** Weight for BM25 results (default: 1.0) */
  bm25Weight?: number;
  /** Weight for vector results (default: 1.0) */
  vectorWeight?: number;
  /** Weight for graph results (default: 1.0) */
  graphWeight?: number;
  /** RRF constant (default: 60) */
  rrfK?: number;
  /** Maximum results to return (default: 10) */
  limit?: number;
  /** Project scope filter */
  project?: string;
}

export interface HybridSearchResult {
  id: string;
  score: number;
  title: string;
  content: string;
  category: string;
  /** Breakdown of scores per source */
  scoreBreakdown: {
    bm25Score: number;
    vectorScore: number;
    graphScore: number;
    rrfScore: number;
  };
  /** Rank in each source channel */
  sourceRanks: {
    bm25Rank: number;
    vectorRank: number;
    graphRank: number;
  };
}

// ── Vector Scoring (placeholder) ────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Simple hash-based pseudo-embedding for placeholder vector search.
 * In production, replace with actual embedding calls (OpenAI, Cohere, etc.).
 */
function pseudoEmbeddings(text: string, dims: number = 384): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const seed = text.length + words.length * 31;
  const result: number[] = [];
  for (let i = 0; i < dims; i++) {
    // Deterministically seed pseudo-random values from text
    const h = Math.imul(seed + i * 2654435761, 1597334677);
    const u = Math.imul(h ^ (h >>> 16), 1597334677);
    result.push(((u >>> 0) / 4294967296) * 2 - 1);
  }
  // Weight by term frequency
  for (const word of words) {
    const wordHash = word.split("").reduce((acc, ch) => Math.imul(acc + ch.charCodeAt(0), 31), 0);
    const idx = Math.abs(wordHash) % dims;
    result[idx] = Math.max(-1, Math.min(1, result[idx] + 0.3));
  }
  return result;
}

/**
 * Vector search with pseudo-embeddings.
 * Placeholder — replace with actual ANN index (Faiss, Qdrant, etc.).
 */
function vectorSearch(
  entries: Array<{ id: string; key: string; value: string; title?: string; category?: string }>,
  query: string,
  topK: number
): SearchResult[] {
  const queryVec = pseudoEmbeddings(query);
  const scored = entries
    .map((e) => {
      const text = `${e.key} ${e.value}`;
      const entryVec = pseudoEmbeddings(text);
      return {
        id: e.id,
        score: cosineSimilarity(queryVec, entryVec),
        title: e.title ?? "",
        content: e.value,
        category: e.category ?? "",
      };
    })
    .filter((r) => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return scored;
}

// ── Graph traversal ────────────────────────────────────────────────────────────

export interface GraphSearchEntry {
  id: string;
  key: string;
  value: string;
  category?: string;
  depth: number;
  relationType?: string;
}

/**
 * Traverse graph relationships from seed entries.
 * Returns related entries with traversal depth.
 */
export function graphTraversal(
  seedIds: string[],
  getRelated: (id: string, type?: string) => Array<{ id: string; key: string; value: string; type?: string }>,
  maxDepth: number = 2,
  maxResults: number = 50
): GraphSearchEntry[] {
  const visited = new Set<string>(seedIds);
  const results: GraphSearchEntry[] = [];
  const queue: Array<{ id: string; depth: number; relationType?: string }> = seedIds.map((id) => ({ id, depth: 0 }));

  while (queue.length > 0 && results.length < maxResults) {
    const { id, depth, relationType } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const related = getRelated(id);
    for (const rel of related) {
      if (visited.has(rel.id)) continue;
      visited.add(rel.id);
      results.push({
        id: rel.id,
        key: rel.key,
        value: rel.value,
        category: rel.type,
        depth: depth + 1,
        relationType: rel.type,
      });
      queue.push({ id: rel.id, depth: depth + 1, relationType: rel.type });
    }
  }

  return results;
}

// ── RRF Fusion ─────────────────────────────────────────────────────────────────

/**
 * RRF (Reciprocal Rank Fusion) combining up to 3 ranked result lists.
 * Higher weight = more influence from that channel.
 */
export function rrfFusion(
  bm25Results: SearchResult[],
  vectorResults: SearchResult[],
  graphResults: GraphSearchEntry[],
  bm25Weight: number = 1.0,
  vectorWeight: number = 1.0,
  graphWeight: number = 1.0,
  k: number = 60
): HybridSearchResult[] {
  type Scored = {
    id: string;
    title: string;
    content: string;
    category: string;
    totalScore: number;
    bm25Score: number;
    vectorScore: number;
    graphScore: number;
    bm25Rank: number;
    vectorRank: number;
    graphRank: number;
  };

  const map = new Map<string, Scored>();

  // BM25 channel
  bm25Results.forEach((r, i) => {
    const existing = map.get(r.id);
    const score = (bm25Weight > 0) ? bm25Weight / (k + i + 1) : 0;
    if (existing) {
      existing.totalScore += score;
      existing.bm25Score += score;
    } else {
      map.set(r.id, {
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        totalScore: score,
        bm25Score: score,
        vectorScore: 0,
        graphScore: 0,
        bm25Rank: i + 1,
        vectorRank: 0,
        graphRank: 0,
      });
    }
  });

  // Vector channel
  vectorResults.forEach((r, i) => {
    const existing = map.get(r.id);
    const score = (vectorWeight > 0) ? vectorWeight / (k + i + 1) : 0;
    if (existing) {
      existing.totalScore += score;
      existing.vectorScore += score;
      existing.vectorRank = i + 1;
    } else {
      map.set(r.id, {
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        totalScore: score,
        bm25Score: 0,
        vectorScore: score,
        graphScore: 0,
        bm25Rank: 0,
        vectorRank: i + 1,
        graphRank: 0,
      });
    }
  });

  // Graph channel
  graphResults.forEach((r, i) => {
    const existing = map.get(r.id);
    // Depth penalty: further nodes score lower
    const depthFactor = Math.pow(0.7, r.depth);
    const score = (graphWeight > 0) ? graphWeight * depthFactor / (k + i + 1) : 0;
    if (existing) {
      existing.totalScore += score;
      existing.graphScore += score;
      existing.graphRank = i + 1;
    } else {
      map.set(r.id, {
        id: r.id,
        title: r.key,
        content: r.value,
        category: r.category ?? "",
        totalScore: score,
        bm25Score: 0,
        vectorScore: 0,
        graphScore: score,
        bm25Rank: 0,
        vectorRank: 0,
        graphRank: i + 1,
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s) => ({
      id: s.id,
      score: s.totalScore,
      title: s.title,
      content: s.content,
      category: s.category,
      scoreBreakdown: {
        bm25Score: s.bm25Score,
        vectorScore: s.vectorScore,
        graphScore: s.graphScore,
        rrfScore: s.totalScore,
      },
      sourceRanks: {
        bm25Rank: s.bm25Rank,
        vectorRank: s.vectorRank,
        graphRank: s.graphRank,
      },
    }));
}

// ── Main hybrid search function ────────────────────────────────────────────────

export interface HybridSearchEngine {
  bm25Search: (query: string, limit: number) => SearchResult[];
  getAllEntries: () => Array<{ id: string; key: string; value: string; title?: string; category?: string }>;
  getRelated: (id: string, type?: string) => Array<{ id: string; key: string; value: string; type?: string }>;
}

/**
 * Execute hybrid search over BM25, vector, and graph channels with RRF fusion.
 */
export function hybridSearch(
  engine: HybridSearchEngine,
  options: HybridSearchOptions
): HybridSearchResult[] {
  const {
    query,
    bm25Weight = 1.0,
    vectorWeight = 1.0,
    graphWeight = 1.0,
    rrfK = 60,
    limit = 10,
  } = options;

  const fetchLimit = limit * 4;

  // Step 1: BM25 keyword search
  const bm25Results = engine.bm25Search(query, fetchLimit);

  // Step 2: Vector semantic search (pseudo-embeddings placeholder)
  const allEntries = engine.getAllEntries();
  const vectorResults = vectorSearch(allEntries, query, fetchLimit);

  // Step 3: Graph traversal — seed from BM25 results
  const seedIds = bm25Results.slice(0, 3).map((r) => r.id);
  const graphResults = graphTraversal(seedIds, engine.getRelated, 2, fetchLimit);

  // Step 4: RRF fusion
  const graphEntries = graphResults.map((r) => ({
    id: r.id,
    key: r.key,
    value: r.value,
    category: r.category ?? "",
    depth: r.depth,
    relationType: r.relationType,
  }));

  return rrfFusion(bm25Results, vectorResults, graphEntries, bm25Weight, vectorWeight, graphWeight, rrfK).slice(0, limit);
}