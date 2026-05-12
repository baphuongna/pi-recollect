import * as fs from "node:fs";
import * as path from "node:path";
import { ensurePiMemoryDir } from "../memory/hierarchical.ts";
import type { Solution } from "./extractor.ts";

export interface StoredSolution {
	id: string;
	type: string;
	title: string;
	content: string;
	filePath: string;
}

/**
 * Convert a solution to YAML frontmatter format.
 */
function solutionToYaml(solution: Solution, title: string): string {
	const now = new Date().toISOString().split("T")[0];
	const lines: string[] = [
		`type: ${solution.type}`,
		`title: "${title.replace(/"/g, '\\"')}"`,
		`created: ${now}`,
		`updated: ${now}`,
		`access_count: 0`,
		"",
		"---",
	];

	switch (solution.type) {
		case "bug":
			lines.push(`problem: |`, `  ${solution.problem}`, "");
			lines.push(`root_cause: |`, `  ${solution.rootCause}`, "");
			lines.push(`fix: |`, `  ${solution.fix}`, "");
			if (solution.files.length > 0) {
				lines.push("files:", ...solution.files.map((f) => `  - ${f}`), "");
			}
			break;
		case "knowledge":
			lines.push(`when_to_use: |`, `  ${solution.whenToUse}`, "");
			lines.push(`how: |`, `  ${solution.how}`, "");
			if (solution.tradeoffs.pro.length > 0 || solution.tradeoffs.con.length > 0) {
				lines.push("tradeoffs:");
				if (solution.tradeoffs.pro.length > 0) lines.push(`  pro: [${solution.tradeoffs.pro.join(", ")}]`);
				if (solution.tradeoffs.con.length > 0) lines.push(`  con: [${solution.tradeoffs.con.join(", ")}]`);
				lines.push("");
			}
			break;
		case "decision":
			lines.push(`context: |`, `  ${solution.context}`, "");
			if (solution.options.length > 0) {
				lines.push("options:");
				for (const opt of solution.options) {
					lines.push(`  - name: ${opt.name}`);
					if (opt.pros.length > 0) lines.push(`    pros: [${opt.pros.join(", ")}]`);
					if (opt.cons.length > 0) lines.push(`    cons: [${opt.cons.join(", ")}]`);
				}
				lines.push("");
			}
			lines.push(`choice: ${solution.choice}`, "");
			lines.push(`reasoning: |`, `  ${solution.reasoning}`, "");
			break;
	}

	if (solution.tags.length > 0) {
		lines.push(`tags: [${solution.tags.join(", ")}]`);
	}

	return lines.join("\n");
}

/**
 * Write a solution as a YAML file to .pi-recall/solutions/.
 */
export function writeSolution(cwd: string, solution: Solution, title: string): string {
	ensurePiMemoryDir(cwd);
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
	const filePath = path.join(cwd, ".pi-recall", "solutions", `${slug}.yaml`);
	const yaml = solutionToYaml(solution, title);
	fs.writeFileSync(filePath, yaml, "utf-8");
	return filePath;
}

/**
 * Read a solution YAML file.
 */
export function readSolution(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

/**
 * List all solution files in .pi-recall/solutions/.
 */
export function listSolutionFiles(cwd: string): string[] {
	const dir = path.join(cwd, ".pi-recall", "solutions");
	try {
		return fs.readdirSync(dir)
			.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
			.map((f) => path.join(dir, f));
	} catch {
		return [];
	}
}
