/**
 * AI Pre-Send Advisor API Route
 *
 * Exposes a POST endpoint to provide schedule timing, channel verification,
 * and delivery risk assessment prior to dispatching campaigns.
 *
 * Responsibilities:
 * - Load target segment parameters (audience size, name).
 * - Request scheduling metrics from Gemini.
 * - Return the structured advisor JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSegmentById } from "@/lib/db";
import { getPreSendRecommendation } from "@/lib/gemini";
import { z } from "zod";

const RecommendSchema = z.object({
  segment_id: z.string().uuid(),
  channel: z.string(),
});

/**
 * Handles POST /api/ai/recommend requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RecommendSchema.parse(body);

    const segment = await getSegmentById(validated.segment_id);
    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    const recommendation = await getPreSendRecommendation(
      segment.name,
      validated.channel,
      segment.customer_count
    );

    return NextResponse.json({
      data: recommendation,
    });
  } catch (error) {
    console.error("[POST AI RECOMMEND API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate send recommendation" },
      { status: 400 }
    );
  }
}
