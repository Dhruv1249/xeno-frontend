/**
 * Customers API Route
 *
 * Exposes endpoints to search, filter, and paginate through customer profiles.
 *
 * Responsibilities:
 * - Validate query parameters for search, city, and RFM segment.
 * - Call the parameterized getCustomers query.
 * - Return standardized JSON payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCustomers } from "@/lib/db";
import { z } from "zod";

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().default(""),
  rfmSegment: z.string().default("All"),
  city: z.string().default("All"),
});

/**
 * Handles GET /api/customers requests.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const validated = QuerySchema.parse({
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
      search: searchParams.get("search") || undefined,
      rfmSegment: searchParams.get("rfmSegment") || undefined,
      city: searchParams.get("city") || undefined,
    });

    const customers = await getCustomers(
      validated.limit,
      validated.offset,
      validated.search,
      validated.rfmSegment,
      validated.city
    );

    return NextResponse.json({
      data: customers,
    });
  } catch (error) {
    console.error("[GET CUSTOMERS API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve customers" },
      { status: 400 }
    );
  }
}

const CustomerCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().min(2),
  gender: z.string().optional(),
  initial_order_amount: z.coerce.number().min(0).optional(),
});

/**
 * Handles POST /api/customers requests (manual entry).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CustomerCreateSchema.parse(body);

    const { upsertCustomer, insertOrder, getCustomerById } = require("@/lib/db");
    const { computeRfmScores } = require("@/lib/rfm");

    // 1. Create or upsert customer
    const customer = await upsertCustomer({
      name: validated.name,
      email: validated.email,
      phone: validated.phone || undefined,
      city: validated.city,
      gender: validated.gender || undefined,
    });

    // 2. Insert order if initial amount is specified
    if (validated.initial_order_amount && validated.initial_order_amount > 0) {
      await insertOrder({
        customer_id: customer.id,
        amount: validated.initial_order_amount,
        channel: "online",
        items: [{ name: "Initial Manual Purchase", price: validated.initial_order_amount, qty: 1 }],
      });
    }

    // 3. Recalculate RFM scoring distribution
    await computeRfmScores();

    // 4. Reload updated profile details
    const updatedCustomer = await getCustomerById(customer.id);

    return NextResponse.json({
      data: updatedCustomer || customer,
    });
  } catch (error: any) {
    console.error("[POST CUSTOMER API ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to create customer" },
      { status: 400 }
    );
  }
}

