/**
 * Temporary Admin Cleanup Route
 *
 * One-shot endpoint to wipe communications and events and reset
 * all running campaigns back to draft. Delete this file after use.
 */

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST() {
  try {
    const events = await pool.query("DELETE FROM events");
    const comms = await pool.query("DELETE FROM communications");
    await pool.query(
      "UPDATE campaigns SET status = 'draft', sent_at = NULL, completed_at = NULL WHERE status IN ('running', 'completed')"
    );

    return NextResponse.json({
      data: {
        events_deleted: events.rowCount,
        communications_deleted: comms.rowCount,
        campaigns_reset: "all running → draft",
      },
    });
  } catch (error) {
    console.error("[CLEANUP ERROR]", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
