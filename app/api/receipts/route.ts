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
import { updateCommunicationStatus, insertEvent, getCommunicationWithCustomerName, updateCampaignStatus, insertOrder } from "@/lib/db";
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
  communication_id: uuidLike.optional().nullable(),
  campaign_id: uuidLike,
  event_type: z.enum(["sent", "delivered", "failed", "opened", "clicked", "completed"]),
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

    // If campaign completion callback from simulator
    if (validated.event_type === "completed") {
      try {
        await updateCampaignStatus(
          validated.campaign_id,
          "completed",
          undefined,
          occurredAtDate
        );
      } catch (dbErr) {
        console.error("[COMPLETION API ERROR]", dbErr);
        throw dbErr;
      }
      return NextResponse.json({ success: true });
    }

    // 3. Update communication status and insert event in parallel to halve DB latency.
    // If the communication_id doesn't exist (FK constraint) we return 200 anyway —
    // returning 400 causes Rust to retry 3 more times per event which floods the logs
    // for no benefit. A missing comm row is a no-op we can safely swallow.
    if (!validated.communication_id) {
      return NextResponse.json({ error: "Missing communication_id for event" }, { status: 400 });
    }

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

        // Simulate a real-time purchase when customer clicks a link (50% probability)
        if (validated.event_type === "clicked" && commDetails?.customer_id && Math.random() < 0.5) {
          const amounts = [599, 999, 1299, 1999, 2499, 3499, 4999];
          const randomAmount = amounts[Math.floor(Math.random() * amounts.length)];
          const channels: ("online" | "store" | "app")[] = ["online", "app"];
          const randomChannel = channels[Math.floor(Math.random() * channels.length)];

          insertOrder({
            customer_id: commDetails.customer_id,
            amount: randomAmount,
            channel: randomChannel,
            items: [{ name: "Simulated Campaign Purchase", price: randomAmount, qty: 1 }],
            created_at: new Date().toISOString()
          }).then((order) => {
            console.log(`[SIMULATED PURCHASE SUCCESS] Order ID: ${order.id}, Amount: ${order.amount} for customer: ${commDetails.customer_name}`);
          }).catch(err => {
            console.error("[SIMULATED PURCHASE ERROR]", err);
          });
        }
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

    // 5. Campaign completion check has been disabled here because completion is now explicitly driven
    // by the Rust simulator sending a final "completed" callback.
    // checkAndUpdateCampaignCompletion(validated.campaign_id).catch((err) => {
    //   console.error("[CAMPAIGN COMPLETION CHECK ERROR]", err);
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST RECEIPTS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process receipt callback" },
      { status: 400 }
    );
  }
}
