/**
 * Memory Categories - Pattern from pi-hermes-memory
 * 
 * Standardized memory types for organizing persistent knowledge.
 */

export type MemoryCategory = 
  | 'observation'     // General observations
  | 'summary'         // Summarized information
  | 'decision'        // Decisions made
  | 'pattern'         // Recurring patterns
  | 'task'            // Task-related memories
  | 'failure'         // What didn't work
  | 'correction'      // User corrections
  | 'insight'         // Learning from experience
  | 'preference'      // User preferences
  | 'convention'      // Project conventions
  | 'tool-quirk';     // Tool-specific knowledge

export interface CategorizedMemory {
  category: MemoryCategory;
  content: string;
  failureReason?: string;
  toolState?: string;
  correctedTo?: string;
  created: string;
  lastReferenced: string;
}

export const MEMORY_CATEGORY_DESCRIPTIONS: Record<MemoryCategory, string> = {
  observation: 'General observations and facts',
  summary: 'Summarized information',
  decision: 'Decisions made during work',
  pattern: 'Recurring patterns identified',
  task: 'Task-related memories',
  failure: 'What was tried but did not work',
  correction: 'User corrections to agent behavior',
  insight: 'Learning from experience',
  preference: 'User preferences and style',
  convention: 'Project conventions and standards',
  'tool-quirk': 'Tool-specific behavior and quirks',
};

export const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  observation: '🔵',
  summary: '📝',
  decision: '✅',
  pattern: '🔄',
  task: '📋',
  failure: '❌',
  correction: '🔧',
  insight: '💡',
  preference: '❤️',
  convention: '📐',
  'tool-quirk': '🔧',
};

/**
 * Format memory content with category tag
 */
export function formatMemoryContent(
  content: string,
  category: MemoryCategory,
  options?: {
    failureReason?: string;
    toolState?: string;
    correctedTo?: string;
  }
): string {
  const parts: string[] = [`[${category}] ${content.trim()}`];
  
  if (options?.failureReason) {
    parts.push(`Failed: ${options.failureReason}`);
  }
  if (options?.toolState) {
    parts.push(`Tool state: ${options.toolState}`);
  }
  if (options?.correctedTo) {
    parts.push(`Corrected to: ${options.correctedTo}`);
  }
  
  return parts.join(' — ');
}

/**
 * Parse category from memory text
 */
export function parseCategory(text: string): { category: MemoryCategory | null; content: string } {
  const match = text.match(/^\[([^\]]+)\]\s+(.*)$/);
  if (match) {
    const category = match[1] as MemoryCategory;
    if (MEMORY_CATEGORY_DESCRIPTIONS[category]) {
      return { category, content: match[2] };
    }
  }
  return { category: null, content: text };
}
