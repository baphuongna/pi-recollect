/**
 * pi-recall extension entry point.
 * Delegates all registration to src/extension/register.ts.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerPiMemory } from "./src/extension/register.ts";

export default function (pi: ExtensionAPI): void {
	registerPiMemory(pi);
}
