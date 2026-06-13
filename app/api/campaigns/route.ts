/**
 * Campaigns API Route
 *
 * Exposes endpoints to retrieve campaign histories and create new ones.
 *
 * Responsibilities:
 * - Retrieve list of campaigns with aggregated analytics counts.
 * - Validate request body for new campaigns.
 * - Save new campaign definitions to the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCampaigns, insertCampaign } from "@/lib/db";
import { z } from "zod";

const CampaignCreateSchema = z.object({
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
 * Handles GET /api/campaigns requests.
 */
export async function GET() {
  try {
    const campaigns = await getCampaigns();
    return NextResponse.json({
      data: campaigns,
    });
  } catch (error) {
    console.error("[GET CAMPAIGNS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve campaigns" },
      { status: 500 }
    );
  }
}

/**
 * Handles POST /api/campaigns requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CampaignCreateSchema.parse(body);

    const campaign = await insertCampaign({
      name: validated.name,
      segment_id: validated.segment_id,
      channel: validated.channel,
      message_template: validated.message_template,
      status: validated.status,
      scheduled_at: validated.scheduled_at || undefined,
      ai_recommendation: validated.ai_recommendation || undefined,
    });

    return NextResponse.json({
      data: campaign,
    });
  } catch (error) {
    console.error("[POST CAMPAIGN API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 400 }
    );
  }
}
