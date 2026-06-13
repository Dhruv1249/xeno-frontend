/**
 * AI Morning Brief API Route
 *
 * Exposes a GET endpoint to compile database statistics and retrieve
 * a daily insights bulletin for the marketer dashboard.
 *
 * Cache Rationale:
 * - Implements a global cache indexed by date (YYYY-MM-DD) to prevent duplicate
 *   AI calls on page navigations, running exactly once per day and serving instantly
 *   on subsequent queries.
 */

import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";
import { generateMorningBrief } from "@/lib/gemini";

// Global cache singleton reference to survive HMR/Dev restarts
const globalRef = global as unknown as {
  cachedBrief?: { date: string; text: string };
};

/**
 * Handles GET /api/ai/brief requests.
 */
export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0]; // E.g., "2026-06-13"

    // Serve from cache if generated today
    if (globalRef.cachedBrief && globalRef.cachedBrief.date === today) {
      console.log(`[AI BRIEF CACHE HIT] Serving cached brief for date: ${today}`);
      return NextResponse.json({
        brief: globalRef.cachedBrief.text,
      });
    }

    console.log(`[AI BRIEF CACHE MISS] Generating new morning brief for date: ${today}`);
    const stats = await getDashboardStats();

    const briefText = await generateMorningBrief({
      totalCustomers: stats.totalCustomers,
      activeCampaigns: stats.activeCampaigns,
      avgOpenRate: stats.avgOpenRate,
      atRiskCount: stats.atRiskCount,
      notMessaged30Days: stats.notMessaged30Days,
    });

    // Save to global cache
    globalRef.cachedBrief = {
      date: today,
      text: briefText,
    };

    return NextResponse.json({
      brief: briefText,
    });
  } catch (error) {
    console.error("[GET AI BRIEF API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate morning brief" },
      { status: 500 }
    );
  }
}
