/**
 * Blob Store Tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { BlobStore, createBlobStore } from "../../src/storage/blob-store.ts";

test("BlobStore - storeBlob should store a blob and return a hash", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("Hello, blob world!");
  const hash = await store.storeBlob(data, "text/plain");
  
  assert.ok(hash, "hash should be defined");
  assert.strictEqual(hash.length, 64, "SHA-256 hex should be 64 chars");
  assert.ok(/^[a-f0-9]{64}$/.test(hash), "hash should be lowercase hex");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - should return the same hash for identical content", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("Same content");
  
  const hash1 = await store.storeBlob(data, "text/plain");
  const hash2 = await store.storeBlob(data, "text/plain");
  
  assert.strictEqual(hash1, hash2, "identical content should produce same hash");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - should return different hashes for different content", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const hash1 = await store.storeBlob(Buffer.from("Content A"), "text/plain");
  const hash2 = await store.storeBlob(Buffer.from("Content B"), "text/plain");
  
  assert.notStrictEqual(hash1, hash2, "different content should produce different hashes");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - should deduplicate identical blobs", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("Duplicate test");
  
  await store.storeBlob(data, "text/plain");
  await store.storeBlob(data, "text/plain");
  
  assert.strictEqual(store.getBlobCount(), 1, "duplicate content should not increase count");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - getBlob should retrieve a stored blob", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("Stored content");
  const hash = await store.storeBlob(data, "text/plain");
  
  const retrieved = await store.getBlob(hash);
  
  assert.ok(retrieved, "retrieved should not be null");
  assert.strictEqual(retrieved?.toString(), "Stored content");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - getBlob should return null for non-existent hash", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const result = await store.getBlob("nonexistent123456789012345678901234567890123456789012");
  
  assert.strictEqual(result, null, "non-existent hash should return null");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - hasBlob should return correct boolean", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("Test data");
  const hash = await store.storeBlob(data, "text/plain");
  
  assert.strictEqual(store.hasBlob(hash), true, "stored blob should exist");
  assert.strictEqual(store.hasBlob("nonexistent123456789012345678901234567890123456789012"), false, "non-existent should not exist");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - getMetadata should return blob metadata", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("Metadata test");
  const hash = await store.storeBlob(data, "application/json");
  
  const meta = store.getMetadata(hash);
  
  assert.ok(meta, "metadata should not be null");
  assert.strictEqual(meta?.hash, hash, "hash should match");
  assert.strictEqual(meta?.size, data.length, "size should match data length");
  assert.strictEqual(meta?.mimeType, "application/json", "mimeType should match");
  assert.ok(meta?.createdAt, "createdAt should be defined");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - deleteBlob should remove stored blob", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  const data = Buffer.from("To be deleted");
  const hash = await store.storeBlob(data, "text/plain");
  
  const deleted = store.deleteBlob(hash);
  
  assert.strictEqual(deleted, true, "delete should return true");
  assert.strictEqual(store.hasBlob(hash), false, "blob should no longer exist");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("BlobStore - getBlobCount should return correct count", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  const store = createBlobStore(tempDir);
  
  assert.strictEqual(store.getBlobCount(), 0, "initial count should be 0");
  
  await store.storeBlob(Buffer.from("Blob 1"), "text/plain");
  assert.strictEqual(store.getBlobCount(), 1, "count should be 1 after first store");
  
  await store.storeBlob(Buffer.from("Blob 1"), "text/plain");
  assert.strictEqual(store.getBlobCount(), 1, "count should remain 1 for duplicate");
  
  await store.storeBlob(Buffer.from("Blob 2"), "text/plain");
  assert.strictEqual(store.getBlobCount(), 2, "count should be 2 for different content");
  
  fs.rmSync(tempDir, { recursive: true, force: true });
});