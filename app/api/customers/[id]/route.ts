/**
 * Customer Profile Details API Route
 *
 * Exposes endpoints to retrieve a detailed customer file including
 * order logs, campaign receipts, and dynamic AI summary.
 *
 * Responsibilities:
 * - Validate ID parameter.
 * - Retrieve customer record, orders, and communications.
 * - Build and merge profile payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, getCustomerOrders, getCustomerCommunications } from "@/lib/db";
import { z } from "zod";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Returns a dynamic AI shopper insight sentence based on segment and city.
 */
function getAiShopperInsight(segment: string | undefined, name: string, city: string | undefined): string {
  const customerName = name.split(" ")[0];
  switch (segment) {
    case "Champion":
      return `Premium champion shopper. ${customerName} has high purchase frequency and responds extremely well to VIP exclusivity messaging over WhatsApp, especially in ${city || "Metro cities"}.`;
    case "Loyal":
      return `Steady loyal shopper. Demonstrates consistent value, responds well to friendly email updates and seasonal discounts.`;
    case "At Risk":
      return `At-risk customer. Previously a high-value customer whose activity has faded. We recommend sending a personalized win-back message with an urgent offer.`;
    case "Lost":
      return `Lapsed inactive customer. Has not made any purchases in several months. Re-activation probability is low, but low-cost SMS blast is worth a try.`;
    case "New":
      return `First-time shopper. Just registered their first purchase. Consider sending a welcome coupon within 14 days to secure a second order.`;
    default:
      return `${customerName} is a valuable retail shopper. Standard marketing triggers and general notifications apply.`;
  }
}

/**
 * Handles GET /api/customers/[id] requests.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const validated = ParamsSchema.parse(params);

    const customer = await getCustomerById(validated.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const [orders, communications] = await Promise.all([
      getCustomerOrders(customer.id),
      getCustomerCommunications(customer.id),
    ]);

    const profile = {
      ...customer,
      ai_summary: getAiShopperInsight(customer.rfm_segment, customer.name, customer.city),
      orders,
      communications,
    };

    return NextResponse.json({
      data: profile,
    });
  } catch (error) {
    console.error("[GET CUSTOMER PROFILE API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve customer profile details" },
      { status: 400 }
    );
  }
}
