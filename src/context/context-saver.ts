/**
 * Context Save/Restore - Cross-Session Working Memory
 * Based on gstack /context-save and /context-restore patterns
 * Persist and restore working context across sessions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SavedContext {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  files: SavedFile[];
  decisions: SavedDecision[];
  pendingTasks: SavedTask[];
  sessionState: Record<string, unknown>;
  metadata: Record<string, string>;
}

export interface SavedFile {
  path: string;
  content: string;
  type: 'modified' | 'created' | 'read';
}

export interface SavedDecision {
  id: string;
  description: string;
  reason: string;
  timestamp: number;
}

export interface SavedTask {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'blocked' | 'done';
  createdAt: number;
}

export interface ContextSaveOptions {
  includeFiles?: boolean;
  includeDecisions?: boolean;
  includeTasks?: boolean;
  includeState?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Context Saver
 * Save and restore working context across sessions
 */
export class ContextSaver {
  private contextDir: string;

  constructor(contextDir?: string) {
    this.contextDir = contextDir || this.getDefaultContextDir();
    this.ensureDir();
  }

  private getDefaultContextDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, '.pi', 'context');
  }

  private ensureDir(): void {
    try {
      fs.mkdirSync(this.contextDir, { recursive: true });
    } catch {
      // Directory exists
    }
  }

  /**
   * Save current context
   */
  async save(name: string, options: ContextSaveOptions = {}): Promise<SavedContext> {
    const id = this.generateId(name);

    const context: SavedContext = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cwd: process.cwd(),
      files: options.includeFiles ? await this.captureFiles() : [],
      decisions: options.includeDecisions ? [] : [],
      pendingTasks: options.includeTasks ? [] : [],
      sessionState: options.includeState ? this.captureSessionState() : {},
      metadata: options.metadata || {},
    };

    const filePath = this.getContextPath(id);
    await fs.promises.writeFile(filePath, JSON.stringify(context, null, 2));

    return context;
  }

  /**
   * Capture modified files
   */
  private async captureFiles(): Promise<SavedFile[]> {
    // This would integrate with git to find modified files
    const files: SavedFile[] = [];

    try {
      // Get modified files from git
      const { stdout } = await this.exec('git status --porcelain');
      const lines = stdout.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        const status = line.slice(0, 2).trim();
        const filePath = line.slice(3).trim();

        if (status === 'M' || status === '??' || status === 'A') {
          const type = status === 'M' ? 'modified' : status === '??' ? 'created' : 'created';

          try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            files.push({ path: filePath, content, type });
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Not a git repo or git not available
    }

    return files;
  }

  /**
   * Capture session state
   */
  private captureSessionState(): Record<string, unknown> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: Date.now(),
    };
  }

  /**
   * Restore context
   */
  async restore(id: string): Promise<SavedContext | null> {
    const filePath = this.getContextPath(id);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as SavedContext;
    } catch {
      return null;
    }
  }

  /**
   * List all saved contexts
   */
  async list(): Promise<SavedContext[]> {
    const contexts: SavedContext[] = [];

    try {
      const files = await fs.promises.readdir(this.contextDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.promises.readFile(
              path.join(this.contextDir, file),
              'utf-8'
            );
            contexts.push(JSON.parse(content));
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return contexts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Delete saved context
   */
  async delete(id: string): Promise<boolean> {
    const filePath = this.getContextPath(id);

    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update context with decisions and tasks
   */
  async update(
    id: string,
    updates: Partial<Pick<SavedContext, 'decisions' | 'pendingTasks' | 'sessionState' | 'metadata'>>
  ): Promise<SavedContext | null> {
    const context = await this.restore(id);
    if (!context) return null;

    if (updates.decisions) {
      context.decisions = updates.decisions;
    }
    if (updates.pendingTasks) {
      context.pendingTasks = updates.pendingTasks;
    }
    if (updates.sessionState) {
      context.sessionState = { ...context.sessionState, ...updates.sessionState };
    }
    if (updates.metadata) {
      context.metadata = { ...context.metadata, ...updates.metadata };
    }

    context.updatedAt = Date.now();

    const filePath = this.getContextPath(id);
    await fs.promises.writeFile(filePath, JSON.stringify(context, null, 2));

    return context;
  }

  /**
   * Get file path for context
   */
  private getContextPath(id: string): string {
    return path.join(this.contextDir, `${id}.json`);
  }

  /**
   * Generate unique ID
   */
  private generateId(name: string): string {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const timestamp = Date.now().toString(36);
    return `${sanitized}-${timestamp}`;
  }

  /**
   * Simple exec wrapper
   */
  private exec(cmd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const { exec } = require('node:child_process');
      exec(cmd, { encoding: 'utf-8' }, (err: Error | null, stdout: string, stderr: string) => {
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });
  }

  /**
   * Format context as markdown
   */
  formatContext(context: SavedContext): string {
    const lines: string[] = [];

    lines.push(`# Context: ${context.name}\n`);
    lines.push(`**ID:** ${context.id}`);
    lines.push(`**Created:** ${new Date(context.createdAt).toLocaleString()}`);
    lines.push(`**Updated:** ${new Date(context.updatedAt).toLocaleString()}`);
    lines.push(`**CWD:** ${context.cwd}\n`);

    if (context.decisions.length > 0) {
      lines.push('## Decisions\n');
      for (const decision of context.decisions) {
        lines.push(`- **${decision.description}**`);
        lines.push(`  Reason: ${decision.reason}`);
      }
      lines.push('');
    }

    if (context.pendingTasks.length > 0) {
      lines.push('## Pending Tasks\n');
      for (const task of context.pendingTasks) {
        const icon = task.status === 'done' ? '✅' :
                     task.status === 'in-progress' ? '🔄' :
                     task.status === 'blocked' ? '🚫' : '📋';
        lines.push(`${icon} ${task.description} [${task.status}]`);
      }
      lines.push('');
    }

    if (context.files.length > 0) {
      lines.push(`## Files (${context.files.length})\n`);
      for (const file of context.files) {
        lines.push(`- ${file.type}: ${file.path}`);
      }
      lines.push('');
    }

    if (Object.keys(context.metadata).length > 0) {
      lines.push('## Metadata\n');
      for (const [key, value] of Object.entries(context.metadata)) {
        lines.push(`- **${key}:** ${value}`);
      }
    }

    return lines.join('\n');
  }
}