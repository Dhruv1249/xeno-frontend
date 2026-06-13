/**
 * AI Message Draft API Route
 *
 * Exposes a POST endpoint to draft marketing campaign templates based on segment context,
 * communication channels, and desired tones.
 *
 * Responsibilities:
 * - Validate request parameters using Zod.
 * - Call the copywriting engine in gemini.ts.
 * - Return the generated message draft.
 */

import { NextRequest, NextResponse } from "next/server";
import { draftCampaignMessage } from "@/lib/gemini";
import { z } from "zod";

const DraftSchema = z.object({
  segment_name: z.string(),
  segment_description: z.string().optional().default(""),
  channel: z.string(),
  tone: z.string(),
});

/**
 * Handles POST /api/ai/draft requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = DraftSchema.parse(body);

    const message = await draftCampaignMessage(
      validated.segment_name,
      validated.segment_description,
      validated.channel,
      validated.tone
    );

    return NextResponse.json({
      data: {
        draft: message,
      },
    });
  } catch (error) {
    console.error("[POST AI DRAFT API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate campaign draft" },
      { status: 400 }
    );
  }
}
