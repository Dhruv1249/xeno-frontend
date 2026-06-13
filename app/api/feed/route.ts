/**
 * Live Delivery SSE Stream API Route
 *
 * Establishes a persistent Server-Sent Events (SSE) connection with client browsers.
 * Streams real-time callback notification events from the webhook receiver.
 *
 * Responsibilities:
 * - Return proper text/event-stream headers.
 * - Manage ReadableStream controller lifecycle.
 * - Safely subscribe and unsubscribe from the sseEmitter to prevent memory leaks.
 */

import { NextRequest } from "next/server";
import { sseEmitter } from "@/lib/sse";

/**
 * Handles GET /api/feed requests (SSE stream connection).
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    start(controller) {
      // Listener function to enqueue events into the stream
      const onReceipt = (data: unknown) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.error("Error writing to SSE stream controller:", err);
        }
      };

      // Register listener on global singleton
      sseEmitter.on("receipt", onReceipt);

      // Listen for connection terminations to clean up listeners
      req.signal.addEventListener("abort", () => {
        sseEmitter.off("receipt", onReceipt);
        try {
          controller.close();
        } catch {
          // Controller might already be closed, ignore
        }
      });
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Bypass Nginx proxy buffering
    },
  });
}
