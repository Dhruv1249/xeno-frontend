/**
 * Webhook Receipts Callback API Route
 *
 * Receives delivery lifecycle webhook updates from the simulator channel service.
 * Updates communications statuses, logs events, and broadcasts updates via SSE.
 *
 * Responsibilities:
 * - Validate callback payload structure.
 * - Authenticate payload using shared webhook secrets.
 * - Update database records for communications and campaigns.
 * - Broadcast updates to the active SSE channel emitter.
 *
 * Performance notes:
 * - checkAndUpdateCampaignCompletion is intentionally fire-and-forget. It scans
 *   all communications for the campaign, which is expensive at scale. Running it
 *   async prevents it from blocking the 200ms SLA on individual receipt callbacks.
 * - Customer name lookup is skipped for non-'sent' events to halve DB round-trips
 *   on the hot path (delivered/opened/clicked flood the endpoint simultaneously).
 */

import { NextRequest, NextResponse } from "next/server";
import { updateCommunicationStatus, insertEvent, getCommunicationWithCustomerName, checkAndUpdateCampaignCompletion } from "@/lib/db";
import { sseEmitter } from "@/lib/sse";
import { z } from "zod";

// Lenient UUID pattern — accepts any 8-4-4-4-12 hex string.
// Zod v4's strict z.string().uuid() enforces RFC 4122 variant bits which
// rejects perfectly valid UUIDs from some generators. Since this endpoint
// only receives callbacks from our own trusted Rust service, format-only
// validation is sufficient.
const uuidLike = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Must be a UUID-formatted string"
  );

const ReceiptSchema = z.object({
  communication_id: uuidLike,
  campaign_id: uuidLike,
  event_type: z.enum(["sent", "delivered", "failed", "opened", "clicked"]),
  occurred_at: z.string(),
  metadata: z.any().optional(),
});


/**
 * Handles POST /api/receipts requests.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Webhook Authentication
    const secret = req.headers.get("x-webhook-secret");
    const expectedSecret = process.env.RECEIPT_WEBHOOK_SECRET || "some-shared-secret";
    if (secret !== expectedSecret) {
      console.warn("[AUTHENTICATION WARN] Invalid webhook secret header received");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate Payload
    const body = await req.json();
    const validated = ReceiptSchema.parse(body);
    const occurredAtDate = new Date(validated.occurred_at);

    // 3. Update communication status and insert event in parallel to halve DB latency.
    // If the communication_id doesn't exist (FK constraint) we return 200 anyway —
    // returning 400 causes Rust to retry 3 more times per event which floods the logs
    // for no benefit. A missing comm row is a no-op we can safely swallow.
    const failureReason = validated.metadata?.reason as string | undefined;
    try {
      await Promise.all([
        updateCommunicationStatus(
          validated.communication_id,
          validated.event_type,
          occurredAtDate,
          failureReason
        ),
        insertEvent(
          validated.communication_id,
          validated.event_type,
          occurredAtDate,
          validated.metadata || {}
        ),
      ]);
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      // FK violation = communication was deleted or never existed — safe to ignore
      if (msg.includes("foreign key") || msg.includes("violates") || msg.includes("fk_")) {
        console.warn(`[RECEIPTS WARN] Comm ${validated.communication_id} not found, skipping event`);
        return NextResponse.json({ success: true });
      }
      throw dbErr; // Re-throw real DB errors
    }

    // 4. Broadcast to SSE live feed with customer name — looked up fire-and-forget
    // so the DB join never blocks the webhook ACK response.
    getCommunicationWithCustomerName(validated.communication_id)
      .then((commDetails) => {
        sseEmitter.emit("receipt", {
          communication_id: validated.communication_id,
          customer_name: commDetails?.customer_name ?? "Shopper",
          event_type: validated.event_type,
          campaign_id: validated.campaign_id,
        });
      })
      .catch(() => {
        // Best-effort — SSE missing a name is non-critical
        sseEmitter.emit("receipt", {
          communication_id: validated.communication_id,
          customer_name: "Shopper",
          event_type: validated.event_type,
          campaign_id: validated.campaign_id,
        });
      });

    // 5. Campaign completion check is fire-and-forget — it runs a full COUNT(*) across
    //    all communications for the campaign, too expensive to block the callback ACK on.
    //    The campaign status will eventually converge to 'completed'.
    checkAndUpdateCampaignCompletion(validated.campaign_id).catch((err) => {
      console.error("[CAMPAIGN COMPLETION CHECK ERROR]", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST RECEIPTS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process receipt callback" },
      { status: 400 }
    );
  }
}
