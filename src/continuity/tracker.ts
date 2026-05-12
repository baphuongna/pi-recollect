import type Database from "better-sqlite3";
import { logEvent } from "../store/events.ts";

export interface SessionTracker {
	trackEdit(file: string, turn: number): void;
	trackError(tool: string, errorMessage: string, turn: number): void;
	trackDecision(message: string, turn: number): void;
	trackCommandSuccess(command: string, outputSummary: string, turn: number): void;
	trackGitOp(gitOp: string, turn: number): void;
}

/**
 * Create a session tracker that logs events to the events table.
 */
export function createSessionTracker(
	db: Database.Database,
	sessionId: string,
): SessionTracker {
	return {
		trackEdit(file: string, turn: number): void {
			logEvent(db, sessionId, "file_edit", { file, turn });
		},
		trackError(tool: string, errorMessage: string, turn: number): void {
			logEvent(db, sessionId, "error", { tool, errorMessage, turn });
		},
		trackDecision(message: string, turn: number): void {
			logEvent(db, sessionId, "user_decision", { message_summary: message.slice(0, 500), turn });
		},
		trackCommandSuccess(command: string, outputSummary: string, turn: number): void {
			logEvent(db, sessionId, "command_success", { command, output_summary: outputSummary.slice(0, 500), turn });
		},
		trackGitOp(gitOp: string, turn: number): void {
			logEvent(db, sessionId, "git_operation", { gitOp, turn });
		},
	};
}
