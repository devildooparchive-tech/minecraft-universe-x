type Callback<T> = (data: T) => void;

export class EventEmitter {
  private listeners: { [key: string]: Callback<any>[] } = {};

  on<T>(event: string, cb: Callback<T>): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return () => this.off(event, cb);
  }

  off<T>(event: string, cb: Callback<T>): void {
    const arr = this.listeners[event];
    if (arr) {
      this.listeners[event] = arr.filter(c => c !== cb);
    }
  }

  emit<T>(event: string, data: T): void {
    const arr = this.listeners[event];
    if (arr) {
      for (const cb of arr) cb(data);
    }
  }
}

export const gameEvents = new EventEmitter();