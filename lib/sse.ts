/**
 * SSE Emitter Singleton
 *
 * Provides a persistent event bus instance for streaming delivery callbacks
 * in real-time to active dashboard clients using Server-Sent Events (SSE).
 *
 * Responsibilities:
 * - Hold a global reference to the EventEmitter.
 * - Avoid duplicating emitter listeners during HMR hot reloads.
 */

import { EventEmitter } from "events";

const globalRef = global as unknown as { sseEmitter?: EventEmitter };

if (!globalRef.sseEmitter) {
  globalRef.sseEmitter = new EventEmitter();
  // Allow unlimited concurrent client subscription listeners
  globalRef.sseEmitter.setMaxListeners(0);
}

export const sseEmitter = globalRef.sseEmitter;
