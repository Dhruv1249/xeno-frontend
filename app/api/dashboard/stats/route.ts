/**
 * Dashboard Stats API Route
 *
 * Exposes a GET endpoint that returns live aggregate metrics
 * for the dashboard KPI strip. Calls getDashboardStats which
 * runs 4 parallel DB queries and returns totals in one shot.
 *
 * Responsibilities:
 * - Return real-time customer, campaign, and engagement totals.
 * - Provide the data the morning brief and KPI cards consume.
 */

import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";

/**
 * Handles GET /api/dashboard/stats requests.
 */
export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error("[GET DASHBOARD STATS ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load dashboard stats" },
      { status: 500 }
    );
  }
}
