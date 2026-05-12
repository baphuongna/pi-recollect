import type { SessionEvent } from "../store/events.ts";

export type FindingType = "bug" | "knowledge" | "decision";

export interface RoutedFinding {
	type: FindingType;
	confidence: number;
	events: SessionEvent[];
}

/**
 * Route session events to the appropriate finding type.
 * Classifies as bug/knowledge/decision based on event patterns.
 */
export function routeFinding(events: SessionEvent[]): RoutedFinding | null {
	if (events.length === 0) return null;

	const types = events.map((e) => e.type);
	const hasError = types.includes("error");
	const hasSuccess = types.includes("command_success");
	const hasUserDecision = types.includes("user_decision");
	const hasFileEdit = types.includes("file_edit");

	// Error followed by success → bug pattern
	if (hasError && hasSuccess && hasFileEdit) {
		return { type: "bug", confidence: 0.8, events };
	}

	// User decision events → decision
	if (hasUserDecision) {
		return { type: "decision", confidence: 0.7, events };
	}

	// File edits without errors → knowledge pattern
	if (hasFileEdit && !hasError) {
		return { type: "knowledge", confidence: 0.5, events };
	}

	// Error without clear resolution → low-confidence bug
	if (hasError) {
		return { type: "bug", confidence: 0.3, events };
	}

	return null;
}

/**
 * Route multiple sessions' events and return all routed findings.
 */
export function routeSessionFindings(events: SessionEvent[]): RoutedFinding[] {
	const findings: RoutedFinding[] = [];

	// Group consecutive events by context
	const errorEvents: SessionEvent[] = [];
	const decisionEvents: SessionEvent[] = [];
	const editEvents: SessionEvent[] = [];

	for (const event of events) {
		if (event.type === "error" || event.type === "command_success") {
			errorEvents.push(event);
		} else if (event.type === "user_decision") {
			decisionEvents.push(event);
		} else if (event.type === "file_edit") {
			editEvents.push(event);
		}
	}

	if (errorEvents.length > 0) {
		const f = routeFinding(errorEvents);
		if (f) findings.push(f);
	}

	if (decisionEvents.length > 0) {
		findings.push({ type: "decision", confidence: 0.7, events: decisionEvents });
	}

	if (editEvents.length > 0 && errorEvents.length === 0) {
		findings.push({ type: "knowledge", confidence: 0.5, events: editEvents });
	}

	return findings;
}
