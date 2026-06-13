/**
 * Campaign Detail API Route
 *
 * Exposes endpoints to retrieve and update a specific campaign record.
 *
 * Responsibilities:
 * - Validate ID parameter.
 * - Retrieve campaign details.
 * - Update existing campaign attributes (draft save/update).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, updateCampaign } from "@/lib/db";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const CampaignUpdateSchema = z.object({
  name: z.string().min(3),
  segment_id: z.string().uuid(),
  channel: z.enum(["whatsapp", "sms", "email", "rcs"]),
  message_template: z.string().min(2),
  status: z.enum(["draft", "scheduled", "running", "completed"]).default("draft"),
  scheduled_at: z.string().optional().nullable(),
  ai_recommendation: z.object({
    recommended_channel: z.enum(["whatsapp", "sms", "email", "rcs"]),
    recommended_time: z.string(),
    reasoning: z.string(),
    risk: z.string().optional().default(""),
  }).optional().nullable(),
});

/**
 * Handles GET /api/campaigns/[id] requests.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validatedParams = ParamsSchema.parse(params);

    const campaign = await getCampaignById(validatedParams.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: campaign,
    });
  } catch (error) {
    console.error("[GET CAMPAIGN DETAIL API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve campaign details" },
      { status: 400 }
    );
  }
}

/**
 * Handles PUT /api/campaigns/[id] requests.
 */
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validatedParams = ParamsSchema.parse(params);

    const body = await req.json();
    const validatedBody = CampaignUpdateSchema.parse(body);

    const existingCampaign = await getCampaignById(validatedParams.id);
    if (!existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const updated = await updateCampaign(validatedParams.id, {
      name: validatedBody.name,
      segment_id: validatedBody.segment_id,
      channel: validatedBody.channel,
      message_template: validatedBody.message_template,
      status: validatedBody.status,
      scheduled_at: validatedBody.scheduled_at || undefined,
      ai_recommendation: validatedBody.ai_recommendation || undefined,
    });

    return NextResponse.json({
      data: updated,
    });
  } catch (error: any) {
    console.error("[PUT CAMPAIGN DETAIL API ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to update campaign details" },
      { status: 400 }
    );
  }
}
