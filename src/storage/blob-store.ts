/**
 * Blob Storage - Content-addressed artifact storage
 * 
 * Pattern from oh-my-pi blob storage
 * Provides content-addressed storage using SHA-256 hashing.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface BlobMetadata {
  hash: string;
  size: number;
  mimeType: string;
  createdAt: string;
  path: string;
}

export interface BlobStoreConfig {
  /** Directory to store blobs (default: <cwd>/.pi-recall/blobs) */
  blobDir?: string;
  /** Max blob size in bytes (default: 50MB) */
  maxSize?: number;
  /** Enable compression (default: true) */
  compression?: boolean;
}

/**
 * Content-addressed blob storage
 */
export class BlobStore {
  private blobDir: string;
  private maxSize: number;
  private useCompression: boolean;
  private indexPath: string;
  private index: Map<string, BlobMetadata> = new Map();

  constructor(cwd: string, config: BlobStoreConfig = {}) {
    this.blobDir = config.blobDir ?? path.join(cwd, ".pi-recall", "blobs");
    this.maxSize = config.maxSize ?? 50 * 1024 * 1024; // 50MB
    this.useCompression = config.compression ?? false;
    this.indexPath = path.join(this.blobDir, ".blob-index.json");
    
    // Ensure blob directory exists
    fs.mkdirSync(this.blobDir, { recursive: true });
    
    // Load existing index
    this.loadIndex();
  }

  /**
   * Store a blob and return its content hash
   */
  async storeBlob(data: Buffer, mimeType: string): Promise<string> {
    // Validate size
    if (data.length > this.maxSize) {
      throw new Error(`Blob size ${data.length} exceeds maximum ${this.maxSize}`);
    }

    // Calculate content hash
    const hash = crypto.createHash("sha256").update(data).digest("hex");

    // Check if already exists (deduplication)
    if (this.index.has(hash)) {
      return hash;
    }

    // Write blob to disk
    const blobPath = this.getBlobPath(hash);
    fs.writeFileSync(blobPath, data);

    // Update index
    const metadata: BlobMetadata = {
      hash,
      size: data.length,
      mimeType,
      createdAt: new Date().toISOString(),
      path: blobPath,
    };
    this.index.set(hash, metadata);
    this.saveIndex();

    return hash;
  }

  /**
   * Retrieve a blob by its content hash
   */
  async getBlob(hash: string): Promise<Buffer | null> {
    const metadata = this.index.get(hash);
    if (!metadata) {
      return null;
    }

    const blobPath = this.getBlobPath(hash);
    if (!fs.existsSync(blobPath)) {
      // Clean up stale index entry
      this.index.delete(hash);
      this.saveIndex();
      return null;
    }

    return fs.readFileSync(blobPath);
  }

  /**
   * Check if a blob exists
   */
  hasBlob(hash: string): boolean {
    return this.index.has(hash);
  }

  /**
   * Get blob metadata
   */
  getMetadata(hash: string): BlobMetadata | null {
    return this.index.get(hash) ?? null;
  }

  /**
   * Delete a blob
   */
  deleteBlob(hash: string): boolean {
    const metadata = this.index.get(hash);
    if (!metadata) {
      return false;
    }

    try {
      if (fs.existsSync(metadata.path)) {
        fs.unlinkSync(metadata.path);
      }
    } catch {
      // Best effort deletion
    }

    this.index.delete(hash);
    this.saveIndex();
    return true;
  }

  /**
   * Get total blob storage size
   */
  getTotalSize(): number {
    let total = 0;
    for (const meta of this.index.values()) {
      total += meta.size;
    }
    return total;
  }

  /**
   * Get blob count
   */
  getBlobCount(): number {
    return this.index.size;
  }

  /**
   * Prune blobs older than specified days
   */
  pruneOldBlobs(maxAgeDays: number): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let pruned = 0;

    for (const [hash, meta] of this.index.entries()) {
      const created = new Date(meta.createdAt).getTime();
      if (created < cutoff) {
        this.deleteBlob(hash);
        pruned++;
      }
    }

    return pruned;
  }

  private getBlobPath(hash: string): string {
    // Use first 2 chars as subdirectory for better FS performance
    const subdir = hash.substring(0, 2);
    const subdirPath = path.join(this.blobDir, subdir);
    fs.mkdirSync(subdirPath, { recursive: true });
    return path.join(subdirPath, `${hash}.blob`);
  }

  private loadIndex(): void {
    if (fs.existsSync(this.indexPath)) {
      try {
        const raw = fs.readFileSync(this.indexPath, "utf-8");
        const data = JSON.parse(raw);
        this.index = new Map(Object.entries(data));
      } catch {
        // Start with empty index if corrupted
        this.index = new Map();
      }
    }
  }

  private saveIndex(): void {
    const data = Object.fromEntries(this.index);
    fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2), "utf-8");
  }
}

/**
 * Create a blob store for the given working directory
 */
export function createBlobStore(cwd: string, config?: BlobStoreConfig): BlobStore {
  return new BlobStore(cwd, config);
}