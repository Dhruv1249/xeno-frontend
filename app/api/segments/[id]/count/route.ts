/**
 * Segment Existing Count API Route
 *
 * Runs filters for a saved segment definition and returns matching shopper counts.
 *
 * Responsibilities:
 * - Validate segment ID.
 * - Retrieve segment rules.
 * - Run visual filters and return count.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSegmentById, getCustomersBySegmentRules } from "@/lib/db";
import { buildSegmentSql } from "@/lib/segment-engine";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Handles GET /api/segments/[id]/count requests.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validated = ParamsSchema.parse(params);

    const segment = await getSegmentById(validated.id);
    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    const { whereClause, params: sqlParams } = buildSegmentSql(segment.filter_rules);
    const matchingCustomers = await getCustomersBySegmentRules(whereClause, sqlParams);

    const sample = matchingCustomers.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
    }));

    return NextResponse.json({
      count: matchingCustomers.length,
      sample,
    });
  } catch (error) {
    console.error("[GET SEGMENT COUNT API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to evaluate segment count" },
      { status: 400 }
    );
  }
}
