type QueueListener = () => void;

const drainListeners = new Set<QueueListener>();

export function onQueueDrained(cb: QueueListener): () => void {
  drainListeners.add(cb);
  return () => {
    drainListeners.delete(cb);
  };
}

export function emitQueueDrained(): void {
  for (const listener of drainListeners) {
    listener();
  }
}
