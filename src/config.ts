import * as fs from "node:fs";
import * as path from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MentalModelsConfig {
	enabled: boolean;
	budgetChars: number;
	refreshInterval: number;
	seeds: string[];
}

export interface SearchConfig {
	maxResults: number;
	rrfK: number;
	proximityBoost: number;
	defaultDetail: "compact" | "medium" | "full";
}

export interface CompoundingConfig {
	enabled: boolean;
	dedupThreshold: number;
	categories: ("bug" | "knowledge" | "decision")[];
}

export interface ContinuityConfig {
	enabled: boolean;
	autoResume: boolean;
	maxResumeContext: number;
}

export interface PiMemoryConfig {
	enabled: boolean;
	autoCompound: boolean;
	autoGenerateSummary: boolean;
	maxSolutionsAge: number;
	maxEventsPerSession: number;
	recallBudget: number;
	mentalModels: MentalModelsConfig;
	search: SearchConfig;
	compounding: CompoundingConfig;
	continuity: ContinuityConfig;
}

// ── Defaults (per SPEC §11) ────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PiMemoryConfig = {
	enabled: true,
	autoCompound: true,
	autoGenerateSummary: true,
	maxSolutionsAge: 90,
	maxEventsPerSession: 1000,
	recallBudget: 2048,
	mentalModels: {
		enabled: true,
		budgetChars: 16384,
		refreshInterval: 3,
		seeds: ["architecture", "testing-strategy", "data-flow", "conventions"],
	},
	search: {
		maxResults: 5,
		rrfK: 60,
		proximityBoost: 1.5,
		defaultDetail: "compact",
	},
	compounding: {
		enabled: true,
		dedupThreshold: 0.7,
		categories: ["bug", "knowledge", "decision"],
	},
	continuity: {
		enabled: true,
		autoResume: true,
		maxResumeContext: 1024,
	},
};

// ── Loader ─────────────────────────────────────────────────────────────────────

export function loadConfig(cwd: string): PiMemoryConfig {
	const configPath = path.join(cwd, ".pi", "pi-recollect.json");
	try {
		if (fs.existsSync(configPath)) {
			const raw = fs.readFileSync(configPath, "utf-8");
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed === "object" && parsed !== null) {
				return deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, parsed as Record<string, unknown>) as unknown as PiMemoryConfig;
			}
		}
	} catch {
		// Fall through to defaults on parse error
	}
	return { ...DEFAULT_CONFIG };
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
	const result = { ...base };
	for (const key of Object.keys(override)) {
		const bv = base[key];
		const ov = override[key];
		if (
			typeof bv === "object" && bv !== null && !Array.isArray(bv) &&
			typeof ov === "object" && ov !== null && !Array.isArray(ov)
		) {
			result[key] = deepMerge(
				bv as Record<string, unknown>,
				ov as Record<string, unknown>,
			);
		} else if (ov !== undefined) {
			result[key] = ov;
		}
	}
	return result;
}
