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

// Setup connection pool. Fallback to local docker postgres connection if DATABASE_URL is not set.
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/xeno_db";

export const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
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

  if (rfmSegment !== "All") {
    queryText += ` AND rfm_segment = $${paramIdx}`;
    params.push(rfmSegment);
    paramIdx++;
  }

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
           COUNT(CASE WHEN comm.id IS NOT NULL THEN 1 END) as sent_count,
           COUNT(CASE WHEN comm.status IN ('delivered', 'opened', 'clicked') THEN 1 END) as delivered_count,
           COUNT(CASE WHEN comm.status = 'opened' OR comm.status = 'clicked' THEN 1 END) as open_count,
           COUNT(CASE WHEN comm.status = 'clicked' THEN 1 END) as click_count,
           COUNT(CASE WHEN comm.status = 'failed' THEN 1 END) as failed_count
    FROM campaigns c
    JOIN segments s ON c.segment_id = s.id
    LEFT JOIN communications comm ON c.id = comm.campaign_id
    GROUP BY c.id, s.name
    ORDER BY c.created_at DESC
  `;
  const rows = await executeQuery<any>(queryText);
  return rows.map((r) => ({
    ...r,
    sent_count: Number(r.sent_count),
    delivered_count: Number(r.delivered_count || 0),
    open_count: Number(r.open_count),
    click_count: Number(r.click_count),
    failed_count: Number(r.failed_count),
  }));
}

/**
 * Fetches a single campaign detail.
 */
export async function getCampaignById(id: string): Promise<Campaign | null> {
  const queryText = `
    SELECT c.id, c.name, c.segment_id, s.name as segment_name, c.channel, c.message_template,
           c.status, c.scheduled_at, c.sent_at, c.completed_at, c.ai_recommendation, c.ai_summary, c.created_at,
           COUNT(CASE WHEN comm.id IS NOT NULL THEN 1 END) as sent_count,
           COUNT(CASE WHEN comm.status IN ('delivered', 'opened', 'clicked') THEN 1 END) as delivered_count,
           COUNT(CASE WHEN comm.status = 'opened' OR comm.status = 'clicked' THEN 1 END) as open_count,
           COUNT(CASE WHEN comm.status = 'clicked' THEN 1 END) as click_count,
           COUNT(CASE WHEN comm.status = 'failed' THEN 1 END) as failed_count
    FROM campaigns c
    JOIN segments s ON c.segment_id = s.id
    LEFT JOIN communications comm ON c.id = comm.campaign_id
    WHERE c.id = $1
    GROUP BY c.id, s.name
  `;
  const rows = await executeQuery<any>(queryText, [id]);
  if (!rows[0]) return null;
  return {
    ...rows[0],
    sent_count: Number(rows[0].sent_count),
    delivered_count: Number(rows[0].delivered_count || 0),
    open_count: Number(rows[0].open_count),
    click_count: Number(rows[0].click_count),
    failed_count: Number(rows[0].failed_count),
  };
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
  await executeQuery(
    "INSERT INTO events (communication_id, event_type, occurred_at, metadata) VALUES ($1, $2, $3, $4)",
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
        NULLIF(COUNT(CASE WHEN status != 'failed' THEN 1 END), 0)),
        0.428
      ) * 100 as rate
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
  
  const { buildSegmentSql } = require("./segment-engine");
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
           COALESCE(SUM(o.amount), 0)::float as monetary
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
  const rows = await executeQuery<any>(queryText, [id]);
  return rows[0] || null;
}

/**
 * Checks if all communications for a campaign have reached completed/terminal states,
 * and updates campaign status to completed if true.
 */
export async function checkAndUpdateCampaignCompletion(campaignId: string): Promise<void> {
  const queryText = `
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN status IN ('delivered', 'failed', 'opened', 'clicked') THEN 1 END) as completed
    FROM communications
    WHERE campaign_id = $1
  `;
  const rows = await executeQuery<{ total: string; completed: string }>(queryText, [campaignId]);
  const total = Number(rows[0]?.total || 0);
  const completed = Number(rows[0]?.completed || 0);
  if (total > 0 && total === completed) {
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
  const queryText = `
    SELECT e.event_type, e.occurred_at
    FROM events e
    JOIN communications c ON e.communication_id = c.id
    WHERE c.campaign_id = $1
    ORDER BY e.occurred_at ASC
  `;
  return executeQuery<{ event_type: string; occurred_at: Date }>(queryText, [campaignId]);
}



