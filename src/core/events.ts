/**
 * EventBus — the ONLY cross-system communication channel in v2.
 *
 * Architecture rules (see docs/ANALYSIS-v1.md):
 *  - Systems never import each other directly; they publish/subscribe here.
 *  - Handler exceptions are isolated: one failing handler never breaks others
 *    or the dispatch loop (games keep running even if a UI handler throws).
 *  - Snapshot dispatch semantics: handlers added/removed DURING an emit are
 *    not invoked in that same dispatch — this prevents infinite loops and
 *    mid-iteration mutation bugs.
 */

type Handler<T = unknown> = (payload: T) => void;
type AnyHandler = (event: string, payload: unknown) => void;

export class EventBus {
  private handlers = new Map<string, Handler[]>();
  private anyHandlers: AnyHandler[] = [];

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T>(event: string, handler: Handler<T>): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler);
    this.handlers.set(event, list);
    return () => this.off(event, handler as Handler);
  }

  /** Subscribe for exactly one delivery. */
  once<T>(event: string, handler: Handler<T>): () => void {
    const unsub = this.on<T>(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  /** Subscribe to every event (useful for logging/observability). */
  onAny(handler: AnyHandler): () => void {
    this.anyHandlers.push(handler);
    return () => {
      this.anyHandlers = this.anyHandlers.filter((h) => h !== handler);
    };
  }

  /** Remove a specific handler. */
  off<T>(event: string, handler: Handler<T>): void {
    const list = this.handlers.get(event);
    if (!list) return;
    this.handlers.set(
      event,
      list.filter((h) => h !== (handler as Handler)),
    );
  }

  /** Remove all handlers for one event. */
  offAll(event: string): void {
    this.handlers.delete(event);
  }

  /**
   * Publish an event. Safe with zero subscribers.
   * Dispatch iterates over a SNAPSHOT taken at emit time.
   */
  emit<T>(event: string, payload: T): void {
    for (const h of this.anyHandlers) {
      this.invokeAny(h, event, payload);
    }
    const list = this.handlers.get(event);
    if (!list || list.length === 0) return;
    for (const h of [...list]) {
      this.invoke(h, payload);
    }
  }

  private invoke(handler: Handler, payload: unknown): void {
    try {
      handler(payload);
    } catch (err) {
      // Isolation contract: a broken handler is logged, never fatal.
      console.error('[EventBus] handler error:', err);
    }
  }

  private invokeAny(handler: AnyHandler, event: string, payload: unknown): void {
    try {
      handler(event, payload);
    } catch (err) {
      console.error('[EventBus] wildcard handler error:', err);
    }
  }

  /** Test/teardown helper: drop everything. */
  clear(): void {
    this.handlers.clear();
    this.anyHandlers = [];
  }
}

/** The shared application bus. Systems receive this via init(), never via import chains. */
export const gameEvents = new EventBus();
