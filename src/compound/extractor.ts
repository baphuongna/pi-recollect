import type { SessionEvent } from "../store/events.ts";

// ── Solution types ─────────────────────────────────────────────────────────────

export interface BugSolution {
	type: "bug";
	problem: string;
	rootCause: string;
	fix: string;
	files: string[];
	tags: string[];
}

export interface KnowledgeSolution {
	type: "knowledge";
	whenToUse: string;
	how: string;
	tradeoffs: { pro: string[]; con: string[] };
	files: string[];
	tags: string[];
}

export interface DecisionSolution {
	type: "decision";
	context: string;
	options: Array<{ name: string; pros: string[]; cons: string[] }>;
	choice: string;
	reasoning: string;
	files: string[];
	tags: string[];
}

export type Solution = BugSolution | KnowledgeSolution | DecisionSolution;

// ── Extractors ─────────────────────────────────────────────────────────────────

/**
 * Extract a bug solution from error + fix events.
 */
export function extractBugSolution(
	errorEvent: SessionEvent,
	fixEvent: SessionEvent | null,
): BugSolution | null {
	let errorData: Record<string, unknown>;
	try { errorData = JSON.parse(errorEvent.data) as Record<string, unknown>; } catch { return null; }

	const errorMessage = typeof errorData.errorMessage === "string" ? errorData.errorMessage :
		typeof errorData.message === "string" ? errorData.message : "Unknown error";
	const tool = typeof errorData.tool === "string" ? errorData.tool : "unknown";

	let fix = "No fix recorded.";
	if (fixEvent) {
		try {
			const fixData = JSON.parse(fixEvent.data) as Record<string, unknown>;
			const output = typeof fixData.output_summary === "string" ? fixData.output_summary :
				typeof fixData.command === "string" ? `Ran: ${fixData.command}` : "";
			if (output) fix = output;
		} catch { /* use default */ }
	}

	return {
		type: "bug",
		problem: errorMessage,
		rootCause: `Error from tool: ${tool}`,
		fix,
		files: [],
		tags: [tool, "auto-extracted"],
	};
}

/**
 * Extract a knowledge pattern from file edit events.
 */
export function extractKnowledge(events: SessionEvent[]): KnowledgeSolution | null {
	if (events.length === 0) return null;

	const files = events
		.map((e) => { try { return (JSON.parse(e.data) as Record<string, unknown>).file as string; } catch { return ""; } })
		.filter((f) => f.length > 0);

	return {
		type: "knowledge",
		whenToUse: `When working with: ${files.join(", ")}`,
		how: "Pattern detected from file edit sequence.",
		tradeoffs: { pro: [], con: [] },
		files,
		tags: ["auto-extracted"],
	};
}

/**
 * Extract a decision from user decision events.
 */
export function extractDecision(event: SessionEvent): DecisionSolution | null {
	let data: Record<string, unknown>;
	try { data = JSON.parse(event.data) as Record<string, unknown>; } catch { return null; }

	const message = typeof data.message_summary === "string" ? data.message_summary :
		typeof data.message === "string" ? data.message : "Decision made";

	return {
		type: "decision",
		context: message,
		options: [],
		choice: message,
		reasoning: "User decision captured from session.",
		files: [],
		tags: ["auto-extracted", "user-decision"],
	};
}
