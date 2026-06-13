/**
 * CSV Ingestion API Route
 *
 * Exposes a POST endpoint accepting multipart/form-data containing customers.csv
 * and orders.csv. Parses and upserts data, then recalculates RFM metrics.
 *
 * Responsibilities:
 * - Retrieve and validate uploaded file payloads.
 * - Parse CSV contents into structured data.
 * - Load records into CockroachDB/PostgreSQL.
 * - Run the RFM scoring algorithm.
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertCustomer, insertOrder } from "@/lib/db";
import { computeRfmScores } from "@/lib/rfm";

/**
 * Basic CSV string parser. Splits rows and handles quoted cells.
 */
function parseCsvRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    })
    .filter((row) => row.length > 0 && row[0] !== "");
}

/**
 * Handles POST /api/ingest requests.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const customersFile = formData.get("customers") as File | null;
    const ordersFile = formData.get("orders") as File | null;

    if (!customersFile || !ordersFile) {
      return NextResponse.json(
        { error: "Both 'customers' and 'orders' CSV files are required" },
        { status: 400 }
      );
    }

    // Read and parse customers CSV
    const customersText = await customersFile.text();
    const customerRows = parseCsvRows(customersText);
    const customerHeaders = customerRows[0].map((h) => h.toLowerCase());
    
    let customersImported = 0;
    for (let i = 1; i < customerRows.length; i++) {
      const row = customerRows[i];
      if (row.length < customerHeaders.length) continue;

      const record: Record<string, string> = {};
      customerHeaders.forEach((header, idx) => {
        record[header] = row[idx];
      });

      if (!record.email || !record.name) continue;

      await upsertCustomer({
        id: record.id || undefined,
        name: record.name,
        email: record.email,
        phone: record.phone || undefined,
        city: record.city || undefined,
        gender: record.gender || undefined,
      });
      customersImported++;
    }

    // Read and parse orders CSV
    const ordersText = await ordersFile.text();
    const orderRows = parseCsvRows(ordersText);
    const orderHeaders = orderRows[0].map((h) => h.toLowerCase());

    let ordersImported = 0;
    for (let i = 1; i < orderRows.length; i++) {
      const row = orderRows[i];
      if (row.length < orderHeaders.length) continue;

      const record: Record<string, string> = {};
      orderHeaders.forEach((header, idx) => {
        record[header] = row[idx];
      });

      if (!record.customer_id || !record.amount) continue;

      // Parse items field if present
      let items = [];
      try {
        items = record.items ? JSON.parse(record.items) : [];
      } catch {
        items = [{ name: "Imported Product", price: parseFloat(record.amount), qty: 1 }];
      }

      await insertOrder({
        id: record.id || undefined,
        customer_id: record.customer_id,
        amount: parseFloat(record.amount),
        channel: (record.channel as any) || "online",
        items,
        created_at: record.created_at || undefined,
      });
      ordersImported++;
    }

    // Recalculate RFM scores now that new transactions are stored
    await computeRfmScores();

    return NextResponse.json({
      customers_imported: customersImported,
      orders_imported: ordersImported,
      rfm_computed: true,
    });
  } catch (error) {
    console.error("[POST INGEST API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process ingestion upload" },
      { status: 400 }
    );
  }
}
