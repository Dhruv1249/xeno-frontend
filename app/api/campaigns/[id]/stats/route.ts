/**
 * Campaign Analytics Stats API Route
 *
 * Exposes a GET endpoint to retrieve detailed campaign metrics and
 * chronological chart timelines.
 *
 * Responsibilities:
 * - Validate campaign ID.
 * - Retrieve campaign metadata and event streams.
 * - Build chronological cumulative intervals for chart timelines.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, getCampaignChartData } from "@/lib/db";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Handles GET /api/campaigns/[id]/stats requests.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validated = ParamsSchema.parse(params);

    const campaign = await getCampaignById(validated.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Load timeline event records
    const events = await getCampaignChartData(campaign.id);

    // Group events chronologically into 5 cumulative timepoints
    const intervals = 5;
    const startTime = campaign.sent_at 
      ? new Date(campaign.sent_at).getTime() 
      : new Date(campaign.created_at).getTime();
    
    const endTime = campaign.completed_at 
      ? new Date(campaign.completed_at).getTime() 
      : Date.now();

    const timeSpan = endTime - startTime;
    const step = timeSpan > 0 ? timeSpan / (intervals - 1) : 60 * 1000; // 1 minute default if instantaneous

    const chartData = [];

    for (let i = 0; i < intervals; i++) {
      const timeVal = new Date(startTime + i * step);
      const timeStr = timeVal.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      let sent = 0;
      let delivered = 0;
      let opened = 0;
      let clicked = 0;

      for (const evt of events) {
        const evtTime = new Date(evt.occurred_at).getTime();
        if (evtTime <= timeVal.getTime()) {
          if (evt.event_type === "sent") sent++;
          if (evt.event_type === "delivered") delivered++;
          if (evt.event_type === "opened") {
            delivered++;
            opened++;
          }
          if (evt.event_type === "clicked") {
            delivered++;
            opened++;
            clicked++;
          }
        }
      }

      chartData.push({
        time: timeStr,
        sent,
        delivered,
        opened,
        clicked,
      });
    }

    const payload = {
      ...campaign,
      chart_data: chartData,
    };

    return NextResponse.json({
      data: payload,
    });
  } catch (error) {
    console.error("[GET CAMPAIGN STATS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve campaign analytics" },
      { status: 400 }
    );
  }
}
