/**
 * pi-recollect extension entry point.
 * Delegates all registration to src/extension/register.ts.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPiRecollect } from "./src/extension/register.ts";

export default function (pi: ExtensionAPI): void {
	registerPiRecollect(pi);
}
