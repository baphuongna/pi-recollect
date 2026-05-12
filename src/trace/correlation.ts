/**
 * Correlation/Tracing System
 * Pattern from: pi-crew/src/observability/correlation.ts
 * 
 * Uses AsyncLocalStorage for trace context propagation.
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  traceId: string;
  parentSpanId?: string;
  spanId: string;
  metadata?: Record<string, unknown>;
}

export interface TraceEvent<T = unknown> {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
  name: string;
  data?: T;
  duration?: number;
}

const storage = new AsyncLocalStorage<CorrelationContext>();
let spanCounter = 0;

/**
 * Generate a new span ID
 */
export function newSpanId(runId: string, taskId = 'main'): string {
  spanCounter += 1;
  return `${runId}:${taskId}:${spanCounter}`;
}

/**
 * Generate a new trace ID
 */
export function newTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Run a function within a correlation context
 */
export function withCorrelation<T>(ctx: CorrelationContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Run an async function within a correlation context
 */
export async function withCorrelationAsync<T>(ctx: CorrelationContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * Get the current correlation context
 */
export function getCurrentContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/**
 * Get or create a span ID
 */
export function getOrCreateSpanId(): string {
  const ctx = getCurrentContext();
  if (ctx?.spanId) {
    return ctx.spanId;
  }
  return newSpanId('default');
}

/**
 * Create a child correlation from parent
 */
export function childCorrelation(runId: string, taskId: string): CorrelationContext {
  const parent = getCurrentContext();
  const spanId = newSpanId(runId, taskId);
  return {
    traceId: parent?.traceId ?? spanId,
    parentSpanId: parent?.spanId,
    spanId,
    metadata: parent?.metadata
  };
}

/**
 * Add correlation data to an event
 */
export function correlateEvent<T extends { runId?: string; data?: Record<string, unknown> }>(
  event: T
): T & { data: Record<string, unknown> } {
  const ctx = getCurrentContext();
  if (!ctx) {
    return event as T & { data: Record<string, unknown> };
  }
  return {
    ...event,
    data: {
      ...(event.data ?? {}),
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      parentSpanId: ctx.parentSpanId,
    }
  };
}

/**
 * Trace context manager for scoped operations
 */
export class TraceContext {
  private events: TraceEvent[] = [];
  private startTime?: number;
  private endTime?: number;

  constructor(
    private name: string,
    private runId: string,
    private taskId = 'main'
  ) {}

  /**
   * Start the trace
   */
  start(metadata?: Record<string, unknown>): this {
    this.startTime = Date.now();
    const spanId = newSpanId(this.runId, this.taskId);
    const ctx: CorrelationContext = {
      traceId: this.runId,
      spanId,
      metadata
    };
    
    withCorrelation(ctx, () => {
      this.log('span.start', { metadata });
    });
    
    return this;
  }

  /**
   * End the trace
   */
  end(data?: Record<string, unknown>): number {
    this.endTime = Date.now();
    const duration = this.endTime - (this.startTime ?? this.endTime);
    
    const ctx = getCurrentContext();
    this.events.push({
      traceId: ctx?.traceId ?? this.runId,
      spanId: ctx?.spanId ?? 'unknown',
      parentSpanId: ctx?.parentSpanId,
      timestamp: this.endTime,
      name: this.name,
      data,
      duration
    });
    
    return duration;
  }

  /**
   * Log an event within the trace
   */
  log(name: string, data?: Record<string, unknown>): void {
    const ctx = getCurrentContext();
    this.events.push({
      traceId: ctx?.traceId ?? this.runId,
      spanId: ctx?.spanId ?? 'unknown',
      parentSpanId: ctx?.parentSpanId,
      timestamp: Date.now(),
      name,
      data
    });
  }

  /**
   * Get all trace events
   */
  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  /**
   * Get the trace duration in ms
   */
  getDuration(): number | undefined {
    if (this.startTime && this.endTime) {
      return this.endTime - this.startTime;
    }
    return undefined;
  }

  /**
   * Export trace as a simple object
   */
  export(): { name: string; duration?: number; events: TraceEvent[] } {
    return {
      name: this.name,
      duration: this.getDuration(),
      events: this.events
    };
  }
}

/**
 * Create a traced function
 */
export function trace<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T,
  runId?: string
): T {
  return ((...args: unknown[]) => {
    const trace = new TraceContext(name, runId ?? newTraceId());
    trace.start();
    
    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            trace.end({ success: true });
            return value;
          })
          .catch((error) => {
            trace.end({ success: false, error: String(error) });
            throw error;
          });
      }
      
      trace.end({ success: true });
      return result;
    } catch (error) {
      trace.end({ success: false, error: String(error) });
      throw error;
    }
  }) as T;
}

/**
 * Create an async traced function
 */
export function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  runId?: string
): Promise<T> {
  return (async () => {
    const trace = new TraceContext(name, runId ?? newTraceId());
    trace.start();
    
    try {
      const result = await fn();
      trace.end({ success: true });
      return result;
    } catch (error) {
      trace.end({ success: false, error: String(error) });
      throw error;
    }
  })();
}

/**
 * Simple span for quick tracing
 */
export async function withSpan<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): Promise<T> {
  const trace = new TraceContext(name, newTraceId());
  trace.start(metadata);
  
  try {
    const result = await fn();
    trace.end({ success: true });
    return result;
  } catch (error) {
    trace.end({ success: false, error: String(error) });
    throw error;
  }
}
