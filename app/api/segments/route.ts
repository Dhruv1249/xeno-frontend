/**
 * Segments API Route
 *
 * Exposes endpoints to retrieve and create target customer segments.
 *
 * Responsibilities:
 * - Validate request payload for segment name, description, and filter rules.
 * - Calculate audience count using the Segment Engine.
 * - Save segment definition to the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSegments, insertSegment, getCustomersBySegmentRules } from "@/lib/db";
import { buildSegmentSql } from "@/lib/segment-engine";
import { z } from "zod";

const RuleSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]),
});

const SegmentCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  filter_rules: z.object({
    operator: z.enum(["AND", "OR"]).default("AND"),
    rules: z.array(RuleSchema),
  }),
});

/**
 * Handles GET /api/segments requests.
 */
export async function GET() {
  try {
    const segments = await getSegments();
    return NextResponse.json({
      data: segments,
    });
  } catch (error) {
    console.error("[GET SEGMENTS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve segments" },
      { status: 500 }
    );
  }
}

/**
 * Handles POST /api/segments requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = SegmentCreateSchema.parse(body);

    // Run the filter rules against the engine to count audience size
    const { whereClause, params } = buildSegmentSql(validated.filter_rules);
    const matchingCustomers = await getCustomersBySegmentRules(whereClause, params);

    // Save segment definition
    const segment = await insertSegment({
      name: validated.name,
      description: validated.description,
      filter_rules: validated.filter_rules,
      customer_count: matchingCustomers.length,
    });

    return NextResponse.json({
      data: segment,
    });
  } catch (error) {
    console.error("[POST SEGMENT API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create segment" },
      { status: 400 }
    );
  }
}
