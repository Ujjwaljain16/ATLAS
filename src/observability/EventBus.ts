import { ATLASEvent } from './events';

type EventHandler = (event: ATLASEvent) => void;

export class EventBus {
  private subscribers: Map<string, EventHandler[]> = new Map();
  private asyncDispatch: boolean;

  constructor(asyncDispatch = false) {
    this.asyncDispatch = asyncDispatch;
  }
  
  // Subscribe to a specific event type
  on(eventType: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(eventType) || [];
    this.subscribers.set(eventType, [...handlers, handler]);
  }
  
  // Subscribe to all events
  onAll(handler: EventHandler): void {
    this.on('*', handler);
  }
  
  // Emit — synchronous fan-out (v1; async-compatible interface for v3+)
  emit(event: ATLASEvent): void {
    const handlers = [
      ...(this.subscribers.get(event.type) || []),
      ...(this.subscribers.get('*') || []),
    ];
    
    for (const handler of handlers) {
      if (this.asyncDispatch) {
        queueMicrotask(() => {
          try { handler(event); }
          catch (err) { console.error(`EventBus handler error [${event.type}]:`, err); }
        });
      } else {
        try {
          handler(event);
        } catch (err) {
          console.error(`EventBus handler error [${event.type}]:`, err);
        }
      }
    }
  }
}
