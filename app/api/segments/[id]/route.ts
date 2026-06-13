/**
 * Segment Detail API Route
 *
 * Exposes endpoints to retrieve, update, and manage a specific customer segment.
 *
 * Responsibilities:
 * - Validate Segment ID parameter.
 * - Support retrieving segment details.
 * - Support updating segment definition, recalculating target count.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSegmentById, updateSegment, getCustomersBySegmentRules } from "@/lib/db";
import { buildSegmentSql } from "@/lib/segment-engine";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const RuleSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]),
});

const SegmentUpdateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  filter_rules: z.object({
    operator: z.enum(["AND", "OR"]).default("AND"),
    rules: z.array(RuleSchema),
  }),
});

/**
 * Handles GET /api/segments/[id] requests.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validatedParams = ParamsSchema.parse(params);

    const segment = await getSegmentById(validatedParams.id);
    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: segment,
    });
  } catch (error) {
    console.error("[GET SEGMENT DETAIL ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve segment details" },
      { status: 400 }
    );
  }
}

/**
 * Handles PUT /api/segments/[id] requests.
 */
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validatedParams = ParamsSchema.parse(params);

    const body = await req.json();
    const validatedBody = SegmentUpdateSchema.parse(body);

    const existingSegment = await getSegmentById(validatedParams.id);
    if (!existingSegment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    // Recalculate target customer count with the new rules
    const { whereClause, params: sqlParams } = buildSegmentSql(validatedBody.filter_rules);
    const matchingCustomers = await getCustomersBySegmentRules(whereClause, sqlParams);

    const updated = await updateSegment(validatedParams.id, {
      name: validatedBody.name,
      description: validatedBody.description,
      filter_rules: validatedBody.filter_rules,
      customer_count: matchingCustomers.length,
    });

    return NextResponse.json({
      data: updated,
    });
  } catch (error: any) {
    console.error("[PUT SEGMENT ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to update segment" },
      { status: 400 }
    );
  }
}
