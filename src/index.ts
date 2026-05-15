/**
 * pi-recollect extension entry point.
 * Delegates all registration to src/extension/register.ts.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPiRecollect } from "./extension/register.ts";

export default function (pi: ExtensionAPI): void {
	registerPiRecollect(pi);
}

// Session isolation exports
export { createSessionIsolation, type SessionIsolationOptions, type SessionAwareMemory } from './graph/session-isolation.js';
