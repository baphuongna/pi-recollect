#!/usr/bin/env node
/**
 * Install script for <PKG-NAME>
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const home = os.homedir();
const agentDir = path.join(home, ".pi", "agent");
const pkgName = path.basename(process.cwd());
const configPath = path.join(agentDir, `${pkgName}.json`);

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

console.log(`\nInstall the published package in Pi with:`);
console.log(`  pi install npm:@baphuongna/${pkgName}`);
console.log(`\nFor local development from a cloned repo:`);
console.log(`  pi install .`);
console.log(`\nVerify installation:`);
console.log(`  pi list\n`);
