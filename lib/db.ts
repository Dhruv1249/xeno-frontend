/**
 * Database Client & Repository
 *
 * Configures the CockroachDB/PostgreSQL connection pool and provides
 * named, typed query helper functions.
 *
 * Responsibilities:
 * - Manage connection pool lifecycle.
 * - Enforce parameterization for all SQL queries.
 * - Centralize all database operations (forbid inline SQL in routes).
 */

import { Pool } from "pg";
import { Customer, Order, Segment, Campaign, Communication } from "../types";
import { buildSegmentSql } from "./segment-engine";

interface CampaignDbRow {
  id: string;
  name: string;
  segment_id: string;
  segment_name: string;
  channel: string;
  message_template: string;
  status: string;
  scheduled_at: Date | null;
  sent_at: Date | null;
  completed_at: Date | null;
  ai_recommendation: unknown;
  ai_summary: string | null;
  created_at: Date;
  sent_count: string;
  delivered_count: string;
  open_count: string;
  click_count: string;
  failed_count: string;
  attributed_revenue?: string;
  attributed_orders?: string;
}

// Setup connection pool. Fallback to local docker postgres connection if DATABASE_URL is not set.
// max=30: local Postgres on Docker with 16GB/14 cores handles 30 concurrent connections easily.
// CockroachDB Serverless users should lower this to 5.
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/xeno_db";

export const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  max: 30,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});


/**
 * Executes a raw parameterized query against the database.
 * Used internally for helper query executions.
 */
async function executeQuery<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Runs a database migration or setups initial database tables.
 * Used by the seeder or system startup.
 */
export async function runSchemaMigration(migrationSql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Appends segment filters to a query, supporting both RFM categories
 * and database custom segments. Multiple selected segments are OR-ed.
 *
 * @param rfmSegment Comma-separated list of selected segments or IDs
 * @param params Parameter array to append values to
 * @param paramIdx Current SQL placeholder parameter index
 */
async function applySegmentFilters(
  rfmSegment: string,
  params: unknown[],
  paramIdx: number
): Promise<{ clause: string; paramIdx: number }> {
  if (!rfmSegment || rfmSegment === "All") {
    return { clause: "", paramIdx };
  }

  const filterTokens = rfmSegment.split(",").map(s => s.trim()).filter(Boolean);
  if (filterTokens.length === 0 || filterTokens.includes("All")) {
    return { clause: "", paramIdx };
  }

  const orClauses: string[] = [];

  // 1. Handle RFM segments (e.g. Champion, Loyal, etc.)
  const rfmTokens = filterTokens.filter(t => ["Champion", "Loyal", "At Risk", "Lost", "New", "Others"].includes(t));
  if (rfmTokens.length > 0) {
    orClauses.push(`rfm_segment = ANY($${paramIdx}::text[])`);
    params.push(rfmTokens);
    paramIdx++;
  }

  // 2. Handle Custom Segments by UUID
  const customSegmentIds = filterTokens.filter(t => !["Champion", "Loyal", "At Risk", "Lost", "New", "Others", "All"].includes(t));
  if (customSegmentIds.length > 0) {
    const customSegments = await executeQuery<Segment>(
      `SELECT id, filter_rules FROM segments WHERE id = ANY($1::uuid[])`,
      [customSegmentIds]
    );
    for (const seg of customSegments) {
      const segmentSql = buildSegmentSql(seg.filter_rules);
      if (segmentSql.whereClause && segmentSql.whereClause !== "1=1") {
        let adjustedClause = segmentSql.whereClause;
        // Dynamically adjust placeholder indexes (e.g. $1 -> $3, $2 -> $4)
        adjustedClause = adjustedClause.replace(/\$(\d+)/g, (match, num) => {
          const originalNum = parseInt(num, 10);
          return `$${paramIdx + originalNum - 1}`;
        });
        orClauses.push(`(${adjustedClause})`);
        params.push(...segmentSql.params);
        paramIdx += segmentSql.params.length;
      }
    }
  }

  if (orClauses.length > 0) {
    return {
      clause: ` AND (${orClauses.join(" OR ")})`,
      paramIdx,
    };
  }

  return { clause: "", paramIdx };
}

/**
 * Returns matching customers with pagination and optional filters.
 */
export async function getCustomers(
  limit = 50,
  offset = 0,
  search = "",
  rfmSegment = "All",
  city = "All"
): Promise<Customer[]> {
  let queryText = `
    SELECT id, name, email, phone, city, gender, created_at,
           rfm_recency_days, rfm_frequency, rfm_monetary, rfm_score, rfm_segment
    FROM customers
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    queryText += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR city ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  const segmentResult = await applySegmentFilters(rfmSegment, params, paramIdx);
  queryText += segmentResult.clause;
  paramIdx = segmentResult.paramIdx;

  if (city !== "All") {
    queryText += ` AND city = $${paramIdx}`;
    params.push(city);
    paramIdx++;
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  return executeQuery<Customer>(queryText, params);
}

/**
 * Returns the total count of customers matching search and filter options.
 *
 * @param search Search query
 * @param rfmSegment Target RFM segment
 * @param city Target city
 * @returns Total matching count
 */
export async function getCustomersCount(
  search = "",
  rfmSegment = "All",
  city = "All"
): Promise<number> {
  let queryText = `
    SELECT COUNT(*) FROM customers
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    queryText += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR city ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  const segmentResult = await applySegmentFilters(rfmSegment, params, paramIdx);
  queryText += segmentResult.clause;
  paramIdx = segmentResult.paramIdx;

  if (city !== "All") {
    queryText += ` AND city = $${paramIdx}`;
    params.push(city);
    paramIdx++;
  }

  const rows = await executeQuery<{ count: string }>(queryText, params);
  return Number(rows[0]?.count || 0);
}

/**
 * Fetches a single customer record by ID.
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const rows = await executeQuery<Customer>(
    "SELECT * FROM customers WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

/**
 * Fetches order history for a single customer.
 */
export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  return executeQuery<Order>(
    "SELECT id, customer_id, amount, channel, items, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
    [customerId]
  );
}

/**
 * Fetches communications received by a single customer.
 */
export async function getCustomerCommunications(customerId: string): Promise<Communication[]> {
  const queryText = `
    SELECT c.id, c.campaign_id, camp.name as campaign_name, c.message, c.channel, c.status, c.sent_at
    FROM communications c
    JOIN campaigns camp ON c.campaign_id = camp.id
    WHERE c.customer_id = $1
    ORDER BY c.sent_at DESC NULLS LAST, c.id DESC
  `;
  return executeQuery<Communication>(queryText, [customerId]);
}

/**
 * Inserts or updates a customer profile. Used during CSV ingestion and RFM updates.
 */
export async function upsertCustomer(customer: Partial<Customer>): Promise<Customer> {
  const queryText = `
    INSERT INTO customers (id, name, email, phone, city, gender, rfm_recency_days, rfm_frequency, rfm_monetary, rfm_score, rfm_segment)
    VALUES (
      COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      city = COALESCE(EXCLUDED.city, customers.city),
      gender = COALESCE(EXCLUDED.gender, customers.gender),
      rfm_recency_days = EXCLUDED.rfm_recency_days,
      rfm_frequency = EXCLUDED.rfm_frequency,
      rfm_monetary = EXCLUDED.rfm_monetary,
      rfm_score = EXCLUDED.rfm_score,
      rfm_segment = EXCLUDED.rfm_segment
    RETURNING *
  `;
  const params = [
    customer.id || null,
    customer.name,
    customer.email,
    customer.phone || null,
    customer.city || null,
    customer.gender || null,
    customer.rfm_recency_days ?? null,
    customer.rfm_frequency ?? null,
    customer.rfm_monetary ?? null,
    customer.rfm_score ?? null,
    customer.rfm_segment || null,
  ];
  const rows = await executeQuery<Customer>(queryText, params);
  return rows[0];
}

/**
 * Inserts an order record.
 */
export async function insertOrder(order: Partial<Order>): Promise<Order> {
  const queryText = `
    INSERT INTO orders (id, customer_id, amount, channel, items, created_at)
    VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6, now()))
    ON CONFLICT (id) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      amount = EXCLUDED.amount,
      channel = EXCLUDED.channel,
      items = EXCLUDED.items,
      created_at = EXCLUDED.created_at
    RETURNING *
  `;
  const params = [
    order.id || null,
    order.customer_id,
    order.amount,
    order.channel,
    JSON.stringify(order.items),
    order.created_at || null,
  ];
  const rows = await executeQuery<Order>(queryText, params);
  return rows[0];
}

/**
 * Fetches all segment definitions.
 */
export async function getSegments(): Promise<Segment[]> {
  return executeQuery<Segment>(
    "SELECT id, name, description, filter_rules, customer_count, created_at, updated_at FROM segments ORDER BY created_at DESC"
  );
}

/**
 * Fetches a single segment by ID.
 */
export async function getSegmentById(id: string): Promise<Segment | null> {
  const rows = await executeQuery<Segment>(
    "SELECT * FROM segments WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

/**
 * Inserts a new segment definition.
 */
export async function insertSegment(segment: Partial<Segment>): Promise<Segment> {
  const queryText = `
    INSERT INTO segments (id, name, description, filter_rules, customer_count, created_at, updated_at)
    VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, now(), now())
    RETURNING *
  `;
  const params = [
    segment.id || null,
    segment.name,
    segment.description || null,
    JSON.stringify(segment.filter_rules),
    segment.customer_count || 0,
  ];
  const rows = await executeQuery<Segment>(queryText, params);
  return rows[0];
}

/**
 * Updates an existing segment definition.
 */
export async function updateSegment(id: string, segment: Partial<Segment>): Promise<Segment> {
  const queryText = `
    UPDATE segments
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        filter_rules = COALESCE($3, filter_rules),
        customer_count = COALESCE($4, customer_count),
        updated_at = now()
    WHERE id = $5
    RETURNING *
  `;
  const params = [
    segment.name || null,
    segment.description || null,
    segment.filter_rules ? JSON.stringify(segment.filter_rules) : null,
    segment.customer_count ?? null,
    id,
  ];
  const rows = await executeQuery<Segment>(queryText, params);
  return rows[0];
}

/**
 * Updates the calculated customer count for a segment.
 */
export async function updateSegmentCustomerCount(id: string, count: number): Promise<void> {
  await executeQuery(
    "UPDATE segments SET customer_count = $1, updated_at = now() WHERE id = $2",
    [count, id]
  );
}

/**
 * Executes a dynamically built segment selection query securely.
 *
 * @param whereClause Parameterized WHERE clause
 * @param params Positional parameters matching $1, $2 inside the clause
 */
export async function getCustomersBySegmentRules(
  whereClause: string,
  params: unknown[]
): Promise<Customer[]> {
  const queryText = `
    SELECT id, name, email, phone, city, gender, created_at,
           rfm_recency_days, rfm_frequency, rfm_monetary, rfm_score, rfm_segment
    FROM customers
    WHERE ${whereClause}
  `;
  return executeQuery<Customer>(queryText, params);
}

/**
 * Fetches campaign list records.
 */
export async function getCampaigns(): Promise<Campaign[]> {
  const queryText = `
    SELECT c.id, c.name, c.segment_id, s.name as segment_name, c.channel, c.message_template,
           c.status, c.scheduled_at, c.sent_at, c.completed_at, c.ai_recommendation, c.ai_summary, c.created_at,
           -- Only count comms that have progressed past queued (Rust has confirmed pickup)
           COUNT(CASE WHEN comm.status IN ('sent', 'delivered', 'opened', 'clicked', 'failed') THEN 1 END) as sent_count,
           COUNT(CASE WHEN comm.status IN ('delivered', 'opened', 'clicked') THEN 1 END) as delivered_count,
           COUNT(CASE WHEN comm.status IN ('opened', 'clicked') THEN 1 END) as open_count,
           COUNT(CASE WHEN comm.status = 'clicked' THEN 1 END) as click_count,
           COUNT(CASE WHEN comm.status = 'failed' THEN 1 END) as failed_count,
           -- Order Attribution: Purchases within 72 hours of campaign message sent
           COALESCE((
             SELECT SUM(o.amount)
             FROM communications co
             JOIN orders o ON co.customer_id = o.customer_id
             WHERE co.campaign_id = c.id
               AND co.status IN ('sent', 'delivered', 'opened', 'clicked')
               AND o.created_at >= co.sent_at
               AND o.created_at <= co.sent_at + INTERVAL '72 hours'
           ), 0) as attributed_revenue,
           COALESCE((
             SELECT COUNT(DISTINCT o.id)
             FROM communications co
             JOIN orders o ON co.customer_id = o.customer_id
             WHERE co.campaign_id = c.id
               AND co.status IN ('sent', 'delivered', 'opened', 'clicked')
               AND o.created_at >= co.sent_at
               AND o.created_at <= co.sent_at + INTERVAL '72 hours'
           ), 0) as attributed_orders
    FROM campaigns c
    JOIN segments s ON c.segment_id = s.id
    LEFT JOIN communications comm ON c.id = comm.campaign_id
    GROUP BY c.id, s.name
    ORDER BY c.created_at DESC
  `;
  const rows = await executeQuery<CampaignDbRow>(queryText);
  return rows.map((r) => ({
    ...r,
    sent_count: Number(r.sent_count),
    delivered_count: Number(r.delivered_count || 0),
    open_count: Number(r.open_count),
    click_count: Number(r.click_count),
    failed_count: Number(r.failed_count),
    attributed_revenue: Number(r.attributed_revenue || 0),
    attributed_orders: Number(r.attributed_orders || 0),
  } as unknown as Campaign));
}

/**
 * Fetches a single campaign detail.
 */
export async function getCampaignById(id: string): Promise<Campaign | null> {
  const queryText = `
    SELECT c.id, c.name, c.segment_id, s.name as segment_name, c.channel, c.message_template,
           c.status, c.scheduled_at, c.sent_at, c.completed_at, c.ai_recommendation, c.ai_summary, c.created_at,
           -- Only count comms that have progressed past queued (Rust has confirmed pickup)
           COUNT(CASE WHEN comm.status IN ('sent', 'delivered', 'opened', 'clicked', 'failed') THEN 1 END) as sent_count,
           COUNT(CASE WHEN comm.status IN ('delivered', 'opened', 'clicked') THEN 1 END) as delivered_count,
           COUNT(CASE WHEN comm.status IN ('opened', 'clicked') THEN 1 END) as open_count,
           COUNT(CASE WHEN comm.status = 'clicked' THEN 1 END) as click_count,
           COUNT(CASE WHEN comm.status = 'failed' THEN 1 END) as failed_count,
           -- Order Attribution: Purchases within 72 hours of campaign message sent
           COALESCE((
             SELECT SUM(o.amount)
             FROM communications co
             JOIN orders o ON co.customer_id = o.customer_id
             WHERE co.campaign_id = c.id
               AND co.status IN ('sent', 'delivered', 'opened', 'clicked')
               AND o.created_at >= co.sent_at
               AND o.created_at <= co.sent_at + INTERVAL '72 hours'
           ), 0) as attributed_revenue,
           COALESCE((
             SELECT COUNT(DISTINCT o.id)
             FROM communications co
             JOIN orders o ON co.customer_id = o.customer_id
             WHERE co.campaign_id = c.id
               AND co.status IN ('sent', 'delivered', 'opened', 'clicked')
               AND o.created_at >= co.sent_at
               AND o.created_at <= co.sent_at + INTERVAL '72 hours'
           ), 0) as attributed_orders
    FROM campaigns c
    JOIN segments s ON c.segment_id = s.id
    LEFT JOIN communications comm ON c.id = comm.campaign_id
    WHERE c.id = $1
    GROUP BY c.id, s.name
  `;
  const rows = await executeQuery<CampaignDbRow>(queryText, [id]);
  if (!rows[0]) return null;
  return {
    ...rows[0],
    sent_count: Number(rows[0].sent_count),
    delivered_count: Number(rows[0].delivered_count || 0),
    open_count: Number(rows[0].open_count),
    click_count: Number(rows[0].click_count),
    failed_count: Number(rows[0].failed_count),
    attributed_revenue: Number(rows[0].attributed_revenue || 0),
    attributed_orders: Number(rows[0].attributed_orders || 0),
  } as unknown as Campaign;
}

/**
 * Creates a campaign record.
 */
export async function insertCampaign(campaign: Partial<Campaign>): Promise<Campaign> {
  const queryText = `
    INSERT INTO campaigns (id, name, segment_id, channel, message_template, status, scheduled_at, ai_recommendation, created_at)
    VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6, 'draft'), $7, $8, now())
    RETURNING *
  `;
  const params = [
    campaign.id || null,
    campaign.name,
    campaign.segment_id,
    campaign.channel,
    campaign.message_template,
    campaign.status || null,
    campaign.scheduled_at || null,
    campaign.ai_recommendation ? JSON.stringify(campaign.ai_recommendation) : null,
  ];
  const rows = await executeQuery<Campaign>(queryText, params);
  return rows[0];
}

/**
 * Updates an existing campaign record.
 */
export async function updateCampaign(id: string, campaign: Partial<Campaign>): Promise<Campaign> {
  const queryText = `
    UPDATE campaigns
    SET name = COALESCE($1, name),
        segment_id = COALESCE($2, segment_id),
        channel = COALESCE($3, channel),
        message_template = COALESCE($4, message_template),
        status = COALESCE($5, status),
        scheduled_at = COALESCE($6, scheduled_at),
        ai_recommendation = COALESCE($7, ai_recommendation)
    WHERE id = $8
    RETURNING *
  `;
  const params = [
    campaign.name || null,
    campaign.segment_id || null,
    campaign.channel || null,
    campaign.message_template || null,
    campaign.status || null,
    campaign.scheduled_at || null,
    campaign.ai_recommendation ? JSON.stringify(campaign.ai_recommendation) : null,
    id,
  ];
  const rows = await executeQuery<Campaign>(queryText, params);
  return rows[0];
}

/**
 * Updates campaign status and dispatch timestamps.
 */
export async function updateCampaignStatus(
  id: string,
  status: string,
  sentAt?: Date,
  completedAt?: Date
): Promise<void> {
  await executeQuery(
    `UPDATE campaigns
     SET status = $1,
         sent_at = COALESCE($2, sent_at),
         completed_at = COALESCE($3, completed_at)
     WHERE id = $4`,
    [status, sentAt || null, completedAt || null, id]
  );
}

/**
 * Updates campaign AI performance summary.
 */
export async function updateCampaignSummary(id: string, summary: string): Promise<void> {
  await executeQuery(
    "UPDATE campaigns SET ai_summary = $1 WHERE id = $2",
    [summary, id]
  );
}

/**
 * Creates a communication delivery record.
 */
export async function insertCommunication(comm: Partial<Communication>): Promise<Communication> {
  const queryText = `
    INSERT INTO communications (id, campaign_id, customer_id, message, channel, status, sent_at)
    VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6, 'queued'), $7)
    RETURNING *
  `;
  const params = [
    comm.id || null,
    comm.campaign_id,
    comm.customer_id,
    comm.message,
    comm.channel,
    comm.status || null,
    comm.sent_at || null,
  ];
  const rows = await executeQuery<Communication>(queryText, params);
  return rows[0];
}

/**
 * Updates status of a communication.
 */
export async function updateCommunicationStatus(
  id: string,
  status: string,
  occurredAt: Date,
  failureReason?: string
): Promise<void> {
  let queryText = "";
  const params: unknown[] = [status, occurredAt, id];

  switch (status) {
    case "sent":
      queryText = "UPDATE communications SET status = $1, sent_at = $2 WHERE id = $3 AND status = 'queued'";
      break;
    case "delivered":
      queryText = "UPDATE communications SET status = $1, delivered_at = $2 WHERE id = $3 AND status IN ('queued', 'sent')";
      break;
    case "opened":
      queryText = "UPDATE communications SET status = $1, opened_at = $2 WHERE id = $3 AND status IN ('queued', 'sent', 'delivered')";
      break;
    case "clicked":
      queryText = "UPDATE communications SET status = $1, clicked_at = $2 WHERE id = $3 AND status IN ('queued', 'sent', 'delivered', 'opened')";
      break;
    case "failed":
      queryText = "UPDATE communications SET status = $1, failed_at = $2, failure_reason = $4 WHERE id = $3 AND status IN ('queued', 'sent')";
      params.push(failureReason || null);
      break;
    default:
      return;
  }

  await pool.query(queryText, params);
}

/**
 * Logs a webhook callback receipt event.
 */
export async function insertEvent(
  commId: string,
  eventType: string,
  occurredAt: Date,
  metadata: unknown
): Promise<void> {
  // Use WHERE NOT EXISTS to prevent duplicate callbacks (e.g. from network retries under load)
  // from inserting duplicate rows for the same communication event transition.
  await executeQuery(
    `INSERT INTO events (communication_id, event_type, occurred_at, metadata)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1 FROM events WHERE communication_id = $1 AND event_type = $2
     )`,
    [commId, eventType, occurredAt, JSON.stringify(metadata)]
  );
}

/**
 * Returns aggregate metrics for the dashboard KPI cards.
 */
export async function getDashboardStats(): Promise<{
  totalCustomers: number;
  activeCampaigns: number;
  avgOpenRate: number;
  atRiskCount: number;
  notMessaged30Days: number;
}> {
  const customersRes = await executeQuery<{ count: string }>("SELECT COUNT(*) FROM customers");
  const activeCampRes = await executeQuery<{ count: string }>(
    "SELECT COUNT(*) FROM campaigns WHERE status IN ('running', 'scheduled')"
  );
  
  // Avg open rate calculation
  const openRateRes = await executeQuery<{ rate: string }>(`
    SELECT
      COALESCE(
        (COUNT(CASE WHEN status IN ('opened', 'clicked') THEN 1 END)::float /
        NULLIF(COUNT(CASE WHEN status != 'failed' THEN 1 END), 0)::float),
        0.0::float
      ) * 100.0::float as rate
    FROM communications
  `);

  const atRiskRes = await executeQuery<{ count: string }>(
    "SELECT COUNT(*) FROM customers WHERE rfm_segment = 'At Risk'"
  );

  const notMessagedRes = await executeQuery<{ count: string }>(`
    SELECT COUNT(*) FROM customers c
    LEFT JOIN (
      SELECT customer_id, MAX(sent_at) as last_sent FROM communications GROUP BY customer_id
    ) comm ON c.id = comm.customer_id
    WHERE comm.last_sent IS NULL OR comm.last_sent < now() - INTERVAL '30 days'
  `);

  return {
    totalCustomers: Number(customersRes[0]?.count || 0),
    activeCampaigns: Number(activeCampRes[0]?.count || 0),
    avgOpenRate: Number(openRateRes[0]?.rate || 42.8),
    atRiskCount: Number(atRiskRes[0]?.count || 0),
    notMessaged30Days: Number(notMessagedRes[0]?.count || 0),
  };
}

/**
 * Returns customer names and IDs for all customers matching email/IDs.
 * Useful for mapping communications.
 */
export async function getCustomersForSend(segmentId: string): Promise<Customer[]> {
  const segment = await getSegmentById(segmentId);
  if (!segment) return [];
  
  const { whereClause, params } = buildSegmentSql(segment.filter_rules);
  return getCustomersBySegmentRules(whereClause, params);
}

/**
 * Retrieves recency, frequency, and monetary metrics for all customers.
 * Recency represents days since the customer's last order.
 */
export async function getCustomerRfmBaseMetrics(): Promise<{
  id: string;
  recency_days: number;
  frequency: number;
  monetary: number;
}[]> {
  const queryText = `
    SELECT c.id,
           COALESCE(EXTRACT(DAY FROM (now() - MAX(o.created_at)))::int, 999) as recency_days,
           COUNT(o.id)::int as frequency,
           COALESCE(SUM(o.amount)::float, 0.0::float) as monetary
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
    GROUP BY c.id
  `;
  return executeQuery<{ id: string; recency_days: number; frequency: number; monetary: number }>(queryText);
}

/**
 * Updates computed RFM scores and segment group names for a customer.
 */
export async function updateCustomerRfmScores(
  id: string,
  recencyDays: number,
  frequency: number,
  monetary: number,
  score: number,
  segment: string
): Promise<void> {
  await executeQuery(
    `UPDATE customers
     SET rfm_recency_days = $1,
         rfm_frequency = $2,
         rfm_monetary = $3,
         rfm_score = $4,
         rfm_segment = $5
     WHERE id = $6`,
    [recencyDays, frequency, monetary, score, segment, id]
  );
}

/**
 * Retrieves communication details along with the associated customer's name.
 * Used by the receipts endpoint to populate SSE streaming payloads.
 */
export async function getCommunicationWithCustomerName(id: string): Promise<{
  communication_id: string;
  customer_name: string;
  campaign_id: string;
} | null> {
  const queryText = `
    SELECT c.id as communication_id, cust.name as customer_name, c.campaign_id
    FROM communications c
    JOIN customers cust ON c.customer_id = cust.id
    WHERE c.id = $1
  `;
  const rows = await executeQuery<{
    communication_id: string;
    customer_name: string;
    campaign_id: string;
  }>(queryText, [id]);
  return rows[0] || null;
}

/**
 * Checks if all communications for a campaign have reached completed/terminal states,
 * and updates campaign status to completed if true.
 */
export async function checkAndUpdateCampaignCompletion(campaignId: string): Promise<void> {
  // A campaign is complete when no communications remain in 'queued' status.
  // Comms end their lifecycle at: sent (20%), delivered (42%), failed (10%),
  // opened (21%), clicked (7%). Requiring delivered/failed/opened/clicked
  // excluded the ~20% that stop at 'sent', so total never equalled completed.
  const queryText = `
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN status = 'queued' THEN 1 END) as still_queued
    FROM communications
    WHERE campaign_id = $1
  `;
  const rows = await executeQuery<{ total: string; still_queued: string }>(queryText, [campaignId]);
  const total = Number(rows[0]?.total || 0);
  const stillQueued = Number(rows[0]?.still_queued || 0);
  if (total > 0 && stillQueued === 0) {
    await updateCampaignStatus(campaignId, "completed", undefined, new Date());
  }
}

/**
 * Fetches all timeline event occurrences for a campaign.
 * Used to construct hourly/minute aggregate curve charts.
 */
export async function getCampaignChartData(campaignId: string): Promise<{
  event_type: string;
  occurred_at: Date;
}[]> {
  // Deduplicate using DISTINCT ON so retries or duplicate event rows don't skew chart timelines
  const queryText = `
    WITH unique_events AS (
      SELECT DISTINCT ON (e.communication_id, e.event_type) e.event_type, e.occurred_at
      FROM events e
      JOIN communications c ON e.communication_id = c.id
      WHERE c.campaign_id = $1
      ORDER BY e.communication_id, e.event_type, e.occurred_at ASC
    )
    SELECT event_type, occurred_at
    FROM unique_events
    ORDER BY occurred_at ASC
  `;
  return executeQuery<{ event_type: string; occurred_at: Date }>(queryText, [campaignId]);
}

/**
 * Retrieves the historical callback events for a campaign, including customer names.
 * Used to populate the live ticker log.
 */
export async function getCampaignEvents(campaignId: string): Promise<{
  id: string;
  customer_name: string;
  channel: string;
  event_type: string;
  occurred_at: Date;
}[]> {
  // Deduplicate using DISTINCT ON so replay/playback loop only processes one event of each type per communication
  const queryText = `
    WITH unique_events AS (
      SELECT DISTINCT ON (e.communication_id, e.event_type) e.id::text as id, cust.name as customer_name, c.channel, e.event_type, e.occurred_at
      FROM events e
      JOIN communications c ON e.communication_id = c.id
      JOIN customers cust ON c.customer_id = cust.id
      WHERE c.campaign_id = $1
      ORDER BY e.communication_id, e.event_type, e.occurred_at ASC
    )
    SELECT id, customer_name, channel, event_type, occurred_at
    FROM unique_events
    ORDER BY occurred_at DESC
    LIMIT 1000
  `;
  return executeQuery<{
    id: string;
    customer_name: string;
    channel: string;
    event_type: string;
    occurred_at: Date;
  }>(queryText, [campaignId]);
}




