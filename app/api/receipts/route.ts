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
 */

import { NextRequest, NextResponse } from "next/server";
import { updateCommunicationStatus, insertEvent, getCommunicationWithCustomerName, checkAndUpdateCampaignCompletion } from "@/lib/db";
import { sseEmitter } from "@/lib/sse";
import { z } from "zod";

const ReceiptSchema = z.object({
  communication_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
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

    // 3. Update Database records
    const failureReason = validated.metadata?.reason || undefined;
    await updateCommunicationStatus(
      validated.communication_id,
      validated.event_type,
      occurredAtDate,
      failureReason
    );

    // 4. Log raw event audit trail
    await insertEvent(
      validated.communication_id,
      validated.event_type,
      occurredAtDate,
      validated.metadata || {}
    );

    // 5. Query Customer Name for SSE live feed
    const commDetails = await getCommunicationWithCustomerName(validated.communication_id);
    if (commDetails) {
      sseEmitter.emit("receipt", {
        communication_id: commDetails.communication_id,
        customer_name: commDetails.customer_name,
        event_type: validated.event_type,
        campaign_id: commDetails.campaign_id,
      });
    }

    // 6. Check if Campaign has reached terminal status for all records
    await checkAndUpdateCampaignCompletion(validated.campaign_id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[POST RECEIPTS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process receipt callback" },
      { status: 400 }
    );
  }
}
