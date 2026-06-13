/**
 * AI Segment Builder API Route
 *
 * Exposes a POST endpoint to translate natural language marketer queries
 * into visual segment filters using the Gemini client.
 *
 * Responsibilities:
 * - Validate text prompt parameter.
 * - Call translation engine in gemini.ts.
 * - Return structured rules and a matching description sentence.
 */

import { NextRequest, NextResponse } from "next/server";
import { translateNlToSegmentFilters } from "@/lib/gemini";
import { z } from "zod";

const PromptSchema = z.object({
  prompt: z.string().min(3),
});

/**
 * Maps operators to user-friendly text descriptions.
 */
function getOperatorDesc(op: string): string {
  switch (op) {
    case "eq": return "equals";
    case "neq": return "is not";
    case "gt": return "is greater than";
    case "gte": return "is at least";
    case "lt": return "is less than";
    case "lte": return "is at most";
    case "in": return "is one of";
    case "nin": return "is not in";
    case "like": return "contains";
    default: return op;
  }
}

/**
 * Format field names for explanation outputs.
 */
function getFieldNameDesc(field: string): string {
  return field.replace(/_/g, " ");
}

/**
 * Handles POST /api/ai/segment requests.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = PromptSchema.parse(body);

    const rules = await translateNlToSegmentFilters(validated.prompt);

    // Build a human-readable explanation matching the resolved visual rules
    const explanation = rules.rules.length > 0
      ? `Filters resolved: Shoppers where ` + rules.rules
          .map((r) => `[${getFieldNameDesc(r.field)}] ${getOperatorDesc(r.op)} "${r.value}"`)
          .join(` ${rules.operator} `)
      : `Could not translate request into specific rules. Displaying entire customer list.`;

    return NextResponse.json({
      rules,
      explanation,
    });
  } catch (error) {
    console.error("[POST AI SEGMENT API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to translate natural language query" },
      { status: 400 }
    );
  }
}
