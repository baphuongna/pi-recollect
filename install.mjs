#!/usr/bin/env node
/**
 * Install script - copies skills to project skills/ directory
 */

import { createRequire } from "module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const home = os.homedir();
const agentDir = path.join(home, ".pi", "agent");
const pkgName = path.basename(process.cwd());
const configPath = path.join(agentDir, `${pkgName}.json`);

// Get the directory where this script is located (package root)
const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

// Find project root (go up from node_modules)
function findProjectRoot(pkgDir) {
  // If we're in node_modules/<pkg>, go up to project root
  const nodeModulesIndex = pkgDir.indexOf("/node_modules/");
  if (nodeModulesIndex !== -1) {
    return pkgDir.substring(0, nodeModulesIndex);
  }
  return pkgDir;
}

const projectRoot = findProjectRoot(pkgRoot);

// Copy skills to project skills/ directory
function copySkills() {
  const skillsSrc = path.join(pkgRoot, "skills");
  const skillsDest = path.join(projectRoot, "skills", pkgName);

  // Ensure destination is contained within projectRoot to prevent path traversal
  const relativeDest = path.relative(projectRoot, skillsDest);
  if (relativeDest.startsWith('..') || path.isAbsolute(relativeDest)) {
    console.error(`ERROR: Refusing to copy skills outside project root: ${skillsDest}`);
    return;
  }
  
  console.log(`Copying skills from: ${skillsSrc}`);
  console.log(`Copying skills to: ${skillsDest}`);
  
  // Create skills destination directory
  fs.mkdirSync(skillsDest, { recursive: true });
  
  // Check if source skills directory exists
  if (!fs.existsSync(skillsSrc)) {
    console.log(`No skills directory in ${pkgName}`);
    return;
  }
  
  // Copy all skill directories
  const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true });
  for (const entry of skillDirs) {
    if (entry.isDirectory()) {
      const srcDir = path.join(skillsSrc, entry.name);
      const destDir = path.join(skillsDest, entry.name);
      
      // Create destination directory
      fs.mkdirSync(destDir, { recursive: true });
      
      // Copy SKILL.md
      const srcFile = path.join(srcDir, "SKILL.md");
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(destDir, "SKILL.md"));
        console.log(`Copied skill: ${pkgName}/${entry.name}`);
      }
    }
  }
}

// Create config directory
fs.mkdirSync(agentDir, { recursive: true });

// Check if config already exists
if (!fs.existsSync(configPath)) {
  const defaultConfig = {
    enabled: true
  };
  fs.writeFileSync(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, "utf-8");
  console.log(`Created default ${pkgName} config: ${configPath}`);
} else {
  console.log(`${pkgName} config already exists: ${configPath}`);
}

// Copy skills
copySkills();

console.log(`\nInstall complete for ${pkgName}`);
console.log(`Skills installed to: ${path.join(projectRoot, "skills", pkgName)}`);
