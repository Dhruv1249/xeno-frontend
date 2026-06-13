/**
 * Segment Live Count API Route
 *
 * Exposes a POST endpoint to evaluate segment rule configurations on the fly.
 * Used by the Segment Builder UI to calculate active target audience sizes.
 *
 * Responsibilities:
 * - Validate rules payload using Zod.
 * - Translate filter rules into parameterized SQL.
 * - Retrieve matching customer count and a sample of names.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCustomersBySegmentRules } from "@/lib/db";
import { buildSegmentSql } from "@/lib/segment-engine";
import { z } from "zod";

const RuleSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]),
});

const QuerySchema = z.object({
  operator: z.enum(["AND", "OR"]).default("AND"),
  rules: z.array(RuleSchema),
});

/**
 * Handles POST /api/segments/count requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = QuerySchema.parse(body);

    const { whereClause, params } = buildSegmentSql(validated);
    const matchingCustomers = await getCustomersBySegmentRules(whereClause, params);

    // Slice sample preview to first 5 names
    const sample = matchingCustomers.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
    }));

    return NextResponse.json({
      count: matchingCustomers.length,
      sample,
    });
  } catch (error) {
    console.error("[POST SEGMENTS COUNT API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to calculate live segment count" },
      { status: 400 }
    );
  }
}
