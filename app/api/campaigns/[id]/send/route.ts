/**
 * Campaign Dispatch API Route
 *
 * Exposes a POST endpoint to execute campaign sends. It resolves target audience cohorts,
 * writes delivery queues, and calls the Rust channel simulator.
 *
 * Responsibilities:
 * - Validate campaign status is 'draft'.
 * - Retrieve segment shopper lists.
 * - Write database communication records (queued status).
 * - Call external Channel Stub service HTTP /send endpoint.
 * - Advance campaign status to 'running'.
 */

import { NextRequest, NextResponse } from "next/server";
import { pool, getCampaignById, getSegmentById, getCustomersBySegmentRules } from "@/lib/db";
import { buildSegmentSql } from "@/lib/segment-engine";
import crypto from "crypto";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Handles POST /api/campaigns/[id]/send requests.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validated = ParamsSchema.parse(params);

    // 1 + 2. Atomically claim the campaign by transitioning it to 'running' in a
    // single UPDATE ... WHERE status IN ('draft','scheduled') RETURNING *.
    // If two requests race, only one UPDATE wins rows — the other gets 0 rows
    // and returns 409 immediately, preventing double-dispatch.
    const now = new Date();
    const claimResult = await pool.query<{ id: string }>(
      `UPDATE campaigns
         SET status = 'running', sent_at = $2
       WHERE id = $1
         AND status IN ('draft', 'scheduled')
       RETURNING id`,
      [validated.id, now]
    );

    if (claimResult.rowCount === 0) {
      // Either already running/completed, or a concurrent request claimed it first
      return NextResponse.json(
        { error: "Campaign is already running or has been completed. Refresh to see current status." },
        { status: 409 }
      );
    }

    // Fetch full campaign row now that we own it
    const campaign = await getCampaignById(validated.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // 3. Resolve Target Segment rules
    if (!campaign.segment_id) {
      return NextResponse.json({ error: "Campaign lacks target segment reference" }, { status: 400 });
    }
    const segment = await getSegmentById(campaign.segment_id);
    if (!segment) {
      return NextResponse.json({ error: "Target segment definition not found" }, { status: 400 });
    }

    const { whereClause, params: sqlParams } = buildSegmentSql(segment.filter_rules);
    const targetCustomers = await getCustomersBySegmentRules(whereClause, sqlParams);

    if (targetCustomers.length === 0) {
      // Roll back the running status since there's nobody to send to
      await pool.query("UPDATE campaigns SET status = 'draft', sent_at = NULL WHERE id = $1", [validated.id]);
      return NextResponse.json({ error: "Target segment contains 0 matching shoppers" }, { status: 400 });
    }

    // 4. Create communication queue entries
    const communicationsList = [];
    const dbPayloads = [];
    const nowStr = now.toISOString();

    for (const customer of targetCustomers) {
      // Personalize message template
      const personalizedMessage = campaign.message_template.replace(
        /\{\{\s*customer_name\s*\}\}/g,
        customer.name
      );
      const commId = crypto.randomUUID();

      dbPayloads.push({
        id: commId,
        campaign_id: campaign.id,
        customer_id: customer.id,
        message: personalizedMessage,
        channel: campaign.channel,
        status: "queued",
        sent_at: nowStr,
      });

      communicationsList.push({
        communication_id: commId,
        recipient_phone: customer.phone || null,
        recipient_email: customer.email || null,
        channel: campaign.channel,
        message: personalizedMessage,
      });
    }

    // Batch insert into database in chunks of 5,000
    const chunkSize = 5000;
    for (let i = 0; i < dbPayloads.length; i += chunkSize) {
      const chunk = dbPayloads.slice(i, i + chunkSize);
      const valuePlaceholders: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      chunk.forEach((comm) => {
        valuePlaceholders.push(`($${paramIdx}::uuid, $${paramIdx+1}::uuid, $${paramIdx+2}::uuid, $${paramIdx+3}::text, $${paramIdx+4}::text, $${paramIdx+5}::text, $${paramIdx+6}::timestamptz)`);
        params.push(comm.id, comm.campaign_id, comm.customer_id, comm.message, comm.channel, comm.status, comm.sent_at);
        paramIdx += 7;
      });

      const queryText = `
        INSERT INTO communications (id, campaign_id, customer_id, message, channel, status, sent_at)
        VALUES ${valuePlaceholders.join(", ")}
      `;
      await pool.query(queryText, params);
    }

    // 5. Call external Channel Simulator (Rust backend)
    // Fan-out in chunks of 5,000 so each request stays well under HTTP body limits
    // even for campaigns targeting 200k+ recipients.
    const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || "http://localhost:8080";
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    let callbackUrl = `${protocol}://${host}/api/receipts`;

    // If the channel simulator is running inside a Docker container (standard local dev),
    // it cannot resolve "localhost" back to the host machine. We dynamically rewrite
    // localhost/127.0.0.1 to "host.docker.internal" in the callback URL.
    if (callbackUrl.includes("localhost") || callbackUrl.includes("127.0.0.1")) {
      callbackUrl = callbackUrl
        .replace("localhost", "host.docker.internal")
        .replace("127.0.0.1", "host.docker.internal");
    }

    const CHUNK_SIZE = 5000;
    const chunks: (typeof communicationsList)[] = [];
    for (let i = 0; i < communicationsList.length; i += CHUNK_SIZE) {
      chunks.push(communicationsList.slice(i, i + CHUNK_SIZE));
    }

    console.log("[SEND DEBUG] About to dispatch to Rust:");
    console.log("  campaign_id :", campaign.id);
    console.log("  callback_url:", callbackUrl);
    console.log("  total comms :", communicationsList.length);
    console.log("  chunks      :", chunks.length, "× up to", CHUNK_SIZE);
    console.log("  sample comm :", JSON.stringify(communicationsList[0], null, 2));

    try {
      // Fire all chunks concurrently — Rust handles each as an independent async batch
      await Promise.all(
        chunks.map(async (chunk, idx) => {
          const batchPayload = {
            campaign_id: campaign.id,
            communications: chunk,
            callback_url: callbackUrl,
          };

          const channelRes = await fetch(`${channelServiceUrl}/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Secret": process.env.RECEIPT_WEBHOOK_SECRET || "some-shared-secret",
            },
            body: JSON.stringify(batchPayload),
          });

          if (!channelRes.ok) {
            const errorText = await channelRes.text();
            throw new Error(`Chunk ${idx + 1}/${chunks.length} failed: ${channelRes.status} ${errorText}`);
          }
        })
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed communicating with Rust channel service:", message);
      return NextResponse.json(
        { error: `Simulator connection failed: ${message}` },
        { status: 502 }
      );
    }

    // Campaign is already marked 'running' above — no second update needed.

    return NextResponse.json({
      data: {
        success: true,
        sent_count: communicationsList.length,
      },
    });
  } catch (error) {
    console.error("[POST CAMPAIGN SEND API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to dispatch campaign" },
      { status: 400 }
    );
  }
}
