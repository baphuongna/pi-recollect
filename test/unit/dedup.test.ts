import test from "node:test";
import assert from "node:assert/strict";
import {
	assessOverlap,
	shouldDedup,
	type OverlapAssessment,
	type SolutionForDedup,
} from "../../src/compound/dedup.ts";

test("assessOverlap returns zero overlap for completely different solutions", () => {
	const a: SolutionForDedup = {
		title: "Auth token refresh bug",
		content: "Token cache not cleared on refresh",
		files: ["src/auth.ts"],
		tags: ["auth", "bug"],
	};
	const b: SolutionForDedup = {
		title: "CSS layout issue",
		content: "Flexbox alignment broken in Safari",
		files: ["src/styles.css"],
		tags: ["css", "layout"],
	};

	const overlap = assessOverlap(a, b);
	assert.ok(overlap.problemOverlap < 0.3);
	assert.ok(overlap.filesOverlap === 0);
});

test("assessOverlap returns high overlap for similar solutions", () => {
	const a: SolutionForDedup = {
		title: "Token refresh fails silently",
		content: "Token cache not cleared on refresh causing stale tokens",
		files: ["src/auth/token-manager.ts"],
		tags: ["auth", "token", "cache"],
	};
	const b: SolutionForDedup = {
		title: "Token refresh cache bug",
		content: "Cached token expiry not updated after refresh call",
		files: ["src/auth/token-manager.ts"],
		tags: ["auth", "token", "bug"],
	};

	const overlap = assessOverlap(a, b);
	assert.ok(overlap.filesOverlap === 1); // Same files
	assert.ok(overlap.problemOverlap > 0.3);
});

test("shouldDedup returns true for highly overlapping solutions", () => {
	const overlap: OverlapAssessment = {
		problemOverlap: 0.9,
		rootCauseOverlap: 0.8,
		solutionOverlap: 0.7,
		filesOverlap: 1.0,
		preventionOverlap: 0.6,
	};
	assert.ok(shouldDedup(overlap, 0.7));
});

test("shouldDedup returns false for low overlap", () => {
	const overlap: OverlapAssessment = {
		problemOverlap: 0.1,
		rootCauseOverlap: 0.1,
		solutionOverlap: 0.1,
		filesOverlap: 0.0,
		preventionOverlap: 0.1,
	};
	assert.ok(!shouldDedup(overlap, 0.7));
});

test("shouldDedup respects custom threshold", () => {
	const overlap: OverlapAssessment = {
		problemOverlap: 0.5,
		rootCauseOverlap: 0.5,
		solutionOverlap: 0.5,
		filesOverlap: 0.5,
		preventionOverlap: 0.5,
	};
	// Weighted: 0.5*0.3 + 0.5*0.3 + 0.5*0.2 + 0.5*0.1 + 0.5*0.1 = 0.5
	assert.ok(!shouldDedup(overlap, 0.7));
	assert.ok(shouldDedup(overlap, 0.3));
});

test("assessOverlap with empty files returns 0 filesOverlap", () => {
	const a: SolutionForDedup = {
		title: "Test", content: "content", files: [], tags: [],
	};
	const b: SolutionForDedup = {
		title: "Test", content: "content", files: ["a.ts"], tags: [],
	};
	const overlap = assessOverlap(a, b);
	assert.equal(overlap.filesOverlap, 0);
});
