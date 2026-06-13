/**
 * AI Campaign Summary API Route
 *
 * Exposes a GET endpoint to generate post-campaign performance reviews
 * using the Gemini client based on delivery metrics.
 *
 * Responsibilities:
 * - Retrieve campaign metrics.
 * - Call Gemini summarization model in gemini.ts.
 * - Return the paragraph review string.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, updateCampaignSummary } from "@/lib/db";
import { summarizeCampaignPerformance } from "@/lib/gemini";
import { z } from "zod";

const QuerySchema = z.object({
  campaign_id: z.string().uuid(),
});

/**
 * Handles GET /api/ai/summary requests.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const validated = QuerySchema.parse({
      campaign_id: searchParams.get("campaign_id") || undefined,
    });

    const campaign = await getCampaignById(validated.campaign_id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const stats = {
      sent: campaign.sent_count,
      opened: campaign.open_count,
      clicked: campaign.click_count,
      failed: campaign.failed_count,
    };

    const summary = await summarizeCampaignPerformance(
      campaign.name,
      campaign.channel,
      stats
    );

    // Persist to database so it shows up in history and lists instantly
    await updateCampaignSummary(validated.campaign_id, summary);

    return NextResponse.json({
      summary,
    });
  } catch (error) {
    console.error("[GET AI SUMMARY API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate campaign performance summary" },
      { status: 400 }
    );
  }
}
