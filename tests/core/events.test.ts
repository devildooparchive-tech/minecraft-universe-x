import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('delivers an event to a subscribed handler', () => {
    const handler = vi.fn();
    bus.on('player:jump', handler);
    bus.emit('player:jump', { height: 2 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ height: 2 });
  });

  it('delivers to multiple handlers in subscription order', () => {
    const order: string[] = [];
    bus.on('e', () => order.push('first'));
    bus.on('e', () => order.push('second'));
    bus.emit('e', undefined);
    expect(order).toEqual(['first', 'second']);
  });

  it('off() stops delivery for that handler only', () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on('e', a);
    bus.on('e', b);
    bus.off('e', a);
    bus.emit('e', undefined);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it('once() unsubscribes automatically after first delivery', () => {
    const h = vi.fn();
    bus.once('e', h);
    bus.emit('e', undefined);
    bus.emit('e', undefined);
    expect(h).toHaveBeenCalledOnce();
  });

  it('handler errors do not break other handlers (isolation)', () => {
    const good = vi.fn();
    bus.on('e', () => {
      throw new Error('boom');
    });
    bus.on('e', good);
    expect(() => bus.emit('e', undefined)).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
  });

  it('emit with no subscribers is a safe no-op', () => {
    expect(() => bus.emit('nobody:listens', 42)).not.toThrow();
  });

  it('offAll() clears every handler for an event', () => {
    const h = vi.fn();
    bus.on('e', h);
    bus.offAll('e');
    bus.emit('e', undefined);
    expect(h).not.toHaveBeenCalled();
  });

  it('unsubscribe function returned by on() works', () => {
    const h = vi.fn();
    const unsub = bus.on('e', h);
    unsub();
    bus.emit('e', undefined);
    expect(h).not.toHaveBeenCalled();
  });

  it('removing a handler DURING emit does not disturb current dispatch', () => {
    const late = vi.fn();
    const first = bus.on('e', () => {
      // remove itself and the next handler mid-dispatch
      bus.off('e', first);
      bus.off('e', late);
    });
    bus.on('e', late);
    bus.emit('e', undefined);
    // snapshot semantics: both still ran in this dispatch
    expect(late).toHaveBeenCalledOnce();
    // but the self-removal takes effect afterwards
    bus.emit('e', undefined);
    expect(late).toHaveBeenCalledOnce();
  });

  it('wildcard subscriber receives all events with their names', () => {
    const spy = vi.fn();
    bus.onAny(spy);
    bus.emit('a', 1);
    bus.emit('b', 2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'a', 1);
    expect(spy).toHaveBeenNthCalledWith(2, 'b', 2);
  });
});
