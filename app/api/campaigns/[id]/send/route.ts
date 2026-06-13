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
import { getCampaignById, getSegmentById, getCustomersBySegmentRules, insertCommunication, updateCampaignStatus } from "@/lib/db";
import { buildSegmentSql } from "@/lib/segment-engine";
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

    // 1. Fetch Campaign
    const campaign = await getCampaignById(validated.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // 2. Validate Status
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return NextResponse.json(
        { error: `Campaign cannot be sent because it is in '${campaign.status}' status` },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Target segment contains 0 matching shoppers" }, { status: 400 });
    }

    // 4. Create communication queue entries
    const communicationsList = [];
    const now = new Date();

    for (const customer of targetCustomers) {
      // Personalize message template
      const personalizedMessage = campaign.message_template.replace(
        /\{\{\s*customer_name\s*\}\}/g,
        customer.name
      );

      const comm = await insertCommunication({
        campaign_id: campaign.id,
        customer_id: customer.id,
        message: personalizedMessage,
        channel: campaign.channel,
        status: "queued",
        sent_at: now.toISOString(),
      });

      communicationsList.push({
        communication_id: comm.id,
        recipient_phone: customer.phone || null,
        recipient_email: customer.email || null,
        channel: campaign.channel,
        message: personalizedMessage,
      });
    }

    // 5. Call external Channel Simulator (Rust backend)
    const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || "http://localhost:8080";
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const callbackUrl = `${protocol}://${host}/api/receipts`;

    const sendPayload = {
      campaign_id: campaign.id,
      communications: communicationsList,
      callback_url: callbackUrl,
    };

    console.log(`Sending dispatch request to Rust service: ${channelServiceUrl}/send`);

    try {
      const channelRes = await fetch(`${channelServiceUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": process.env.RECEIPT_WEBHOOK_SECRET || "some-shared-secret",
        },
        body: JSON.stringify(sendPayload),
      });

      if (!channelRes.ok) {
        const errorText = await channelRes.text();
        throw new Error(`Channel service returned error: ${channelRes.status} ${errorText}`);
      }
    } catch (err: any) {
      console.error("Failed communicating with Rust channel service:", err);
      return NextResponse.json(
        { error: `Simulator connection failed: ${err.message}` },
        { status: 502 }
      );
    }

    // 6. Update Campaign Status
    await updateCampaignStatus(campaign.id, "running", now);

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
