/**
 * Database Seeder Script
 *
 * Populates CockroachDB/PostgreSQL with realistic demo datasets for
 * Indian shopper names, cities, seasonal order distributions, RFM scores,
 * segments, and completed campaign analytics history.
 *
 * Responsibilities:
 * - Load 001_init.sql migration and run it.
 * - Truncate existing tables to allow safe seed re-runs.
 * - Generate 500 realistic customer profiles.
 * - Generate 2000-3000 orders over the past 18 months.
 * - Run RFM score calculations on the database.
 * - Seed default segments and completed campaigns.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { faker } from "@faker-js/faker";
import {
  pool,
  runSchemaMigration,
  insertSegment,
  insertCampaign,
  insertCommunication,
  insertEvent,
  getCustomersBySegmentRules,
} from "./db";
import { computeRfmScores } from "./rfm";
import { buildSegmentSql } from "./segment-engine";
import { FilterRules } from "../types";

// Seed parameters
const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune"];
const GENDERS = ["Male", "Female"];
const CHANNELS = ["online", "store", "app"];
const INDIAN_FIRST_NAMES_MALE = [
  "Aarav", "Aditya", "Amit", "Aniket", "Arjun", "Deepak", "Gaurav", "Harish", "Kabir", "Karan",
  "Manish", "Nikhil", "Pranav", "Rahul", "Rohan", "Sanjay", "Siddharth", "Varun", "Vikram", "Yash"
];
const INDIAN_FIRST_NAMES_FEMALE = [
  "Aishwarya", "Ananya", "Anjali", "Deepika", "Diya", "Isha", "Kavya", "Meera", "Neha", "Pooja",
  "Priya", "Riya", "Sanya", "Shruti", "Sneha", "Swati", "Tanvi", "Vaidehi", "Vidya", "Zara"
];
const INDIAN_SURNAMES = [
  "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Patel", "Rao", "Joshi", "Singh", "Malhotra",
  "Mehta", "Reddy", "Kulkarni", "Deshmukh", "Choudhury", "Bose", "Menon", "Sen", "Pillai", "Bhat"
];

function generateIndianNameAndGender(): { name: string; gender: string } {
  const gender = faker.helpers.arrayElement(GENDERS);
  const firstName = gender === "Male" 
    ? faker.helpers.arrayElement(INDIAN_FIRST_NAMES_MALE)
    : faker.helpers.arrayElement(INDIAN_FIRST_NAMES_FEMALE);
  const surname = faker.helpers.arrayElement(INDIAN_SURNAMES);
  return { name: `${firstName} ${surname}`, gender };
}

/**
 * Returns a random date over the last 18 months, with seasonal weighting
 * for festive seasons in India (October to January).
 */
function generateOrderDate(): Date {
  const now = new Date();
  const start = new Date(now.getTime() - 18 * 30 * 24 * 60 * 60 * 1000);
  const orderTime = faker.date.between({ from: start, to: now });
  
  // Apply a 40% probability boost to festive months (Oct, Nov, Dec, Jan)
  const month = orderTime.getMonth(); // 0-indexed (9=Oct, 10=Nov, 11=Dec, 0=Jan)
  const isFestive = month === 9 || month === 10 || month === 11 || month === 0;
  
  if (!isFestive && Math.random() < 0.35) {
    // Re-roll to force festive season concentration
    const targetMonths = [0, 9, 10, 11];
    const targetMonth = faker.helpers.arrayElement(targetMonths);
    orderTime.setMonth(targetMonth);
  }

  return orderTime;
}

/**
 * Main seeding task runner.
 */
async function seed() {
  console.log("Starting database seeding process...");

  // 1. Run migrations
  const migrationPath = path.join(process.cwd(), "migrations", "001_init.sql");
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  
  console.log("Executing schema migrations...");
  await runSchemaMigration(migrationSql);
  console.log("Migration executed successfully.");

  // 2. Clear existing records
  console.log("Cleaning database tables...");
  await pool.query("TRUNCATE events, communications, campaigns, segments, orders, customers CASCADE");

  // 3. Seed Customers
  console.log("Generating 50,000 customer UUIDs...");
  const customerIds: string[] = [];
  for (let i = 0; i < 50000; i++) {
    customerIds.push(crypto.randomUUID());
  }

  console.log("Seeding 50,000 customer records in chunks of 5,000...");
  const chunkSize = 5000;
  for (let i = 0; i < customerIds.length; i += chunkSize) {
    const chunkIds = customerIds.slice(i, i + chunkSize);
    const valuePlaceholders: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    chunkIds.forEach((id, index) => {
      const globalIdx = i + index;
      const { name, gender } = generateIndianNameAndGender();
      const city = faker.helpers.arrayElement(CITIES);
      const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${globalIdx + 1}@example.com`;
      const phone = `+91 ${faker.helpers.arrayElement(["9", "8", "7", "6"])}${faker.string.numeric(9)}`;

      valuePlaceholders.push(`($${paramIdx}::uuid, $${paramIdx+1}::text, $${paramIdx+2}::text, $${paramIdx+3}::text, $${paramIdx+4}::text, $${paramIdx+5}::text)`);
      params.push(id, name, email, phone, city, gender);
      paramIdx += 6;
    });

    const queryText = `
      INSERT INTO customers (id, name, email, phone, city, gender)
      VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT (email) DO NOTHING
    `;

    await pool.query(queryText, params);
    if ((i + chunkSize) % 10000 === 0 || i + chunkSize >= customerIds.length) {
      console.log(`  Inserted ${Math.min(i + chunkSize, customerIds.length)} / 50,000 customers...`);
    }
  }

  // 4. Seed Orders
  console.log("Seeding 100,000 customer orders in chunks of 5,000...");
  const totalOrders = 100000;
  for (let i = 0; i < totalOrders; i += chunkSize) {
    const currentChunkSize = Math.min(chunkSize, totalOrders - i);
    const valuePlaceholders: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (let j = 0; j < currentChunkSize; j++) {
      const orderId = crypto.randomUUID();
      const customerId = faker.helpers.arrayElement(customerIds);
      const orderDate = generateOrderDate();
      const channel = faker.helpers.arrayElement(CHANNELS);
      const orderAmount = parseFloat(faker.commerce.price({ min: 200, max: 8000 }));

      const items = [{
        name: faker.commerce.productName(),
        price: orderAmount,
        qty: 1,
      }];

      valuePlaceholders.push(`($${paramIdx}::uuid, $${paramIdx+1}::uuid, $${paramIdx+2}::decimal, $${paramIdx+3}::text, $${paramIdx+4}::jsonb, $${paramIdx+5}::timestamptz)`);
      params.push(orderId, customerId, orderAmount, channel, JSON.stringify(items), orderDate.toISOString());
      paramIdx += 6;
    }

    const queryText = `
      INSERT INTO orders (id, customer_id, amount, channel, items, created_at)
      VALUES ${valuePlaceholders.join(", ")}
    `;

    await pool.query(queryText, params);
    if ((i + chunkSize) % 10000 === 0 || i + chunkSize >= totalOrders) {
      console.log(`  Inserted ${Math.min(i + chunkSize, totalOrders)} / 100,000 orders...`);
    }
  }

  // 5. Pre-compute RFM scores
  console.log("Pre-computing RFM scores for all customers...");
  await computeRfmScores();
  console.log("RFM Scores compiled.");

  // 6. Create default segments
  console.log("Creating default CRM target segments...");
  const segmentDefinitions: { name: string; description: string; rules: FilterRules }[] = [
    {
      name: "All Shoppers",
      description: "All registered shoppers in the database.",
      rules: { operator: "AND", rules: [] },
    },
    {
      name: "Champions",
      description: "Highest scoring loyal customer cohort.",
      rules: { operator: "AND", rules: [{ field: "rfm_segment", op: "eq", value: "Champion" }] },
    },
    {
      name: "At-Risk High Spenders",
      description: "Previously valuable shoppers showing fading activity.",
      rules: {
        operator: "AND",
        rules: [
          { field: "rfm_segment", op: "eq", value: "At Risk" },
          { field: "rfm_monetary", op: "gte", value: 3000 },
        ],
      },
    },
    {
      name: "Lapsed Shoppers (60+ Days)",
      description: "Shoppers whose last purchase occurred more than 60 days ago.",
      rules: { operator: "AND", rules: [{ field: "rfm_recency_days", op: "gt", value: 60 }] },
    },
    {
      name: "New Customers",
      description: "First-time buyers with recent store engagement.",
      rules: {
        operator: "AND",
        rules: [
          { field: "rfm_recency_days", op: "lte", value: 30 },
          { field: "rfm_frequency", op: "eq", value: 1 },
        ],
      },
    },
  ];

  const segmentsMap: Record<string, string> = {};

  for (const segDef of segmentDefinitions) {
    const { whereClause, params } = buildSegmentSql(segDef.rules);
    const matchingCustomers = await getCustomersBySegmentRules(whereClause, params);
    
    const segment = await insertSegment({
      name: segDef.name,
      description: segDef.description,
      filter_rules: segDef.rules,
      customer_count: matchingCustomers.length,
    });
    segmentsMap[segDef.name] = segment.id;
  }

  // 7. Seed completed campaigns
  console.log("Seeding completed campaigns and analytics stats...");

  // Campaign 1: Champions on WhatsApp
  const championsSegmentId = segmentsMap["Champions"];
  const championsWhere = buildSegmentSql(segmentDefinitions[0].rules);
  const championsCustomers = await getCustomersBySegmentRules(championsWhere.whereClause, championsWhere.params);

  const camp1 = await insertCampaign({
    name: "Loyalty Reward - Champions Offer",
    segment_id: championsSegmentId,
    channel: "whatsapp",
    message_template: "Hi {{customer_name}}! Here is your exclusive reward for being our top shopper. Grab ₹500 off now!",
    status: "completed",
    ai_recommendation: {
      recommended_channel: "whatsapp",
      recommended_time: "Tuesday 7–9 PM",
      reasoning: "High direct response rates on mobile channels during post-work hours.",
      risk: "Low risk due to high affinity of the target cluster.",
    },
  });

  // Campaign 2: Lapsed Shoppers on SMS
  const lapsedSegmentId = segmentsMap["Lapsed Shoppers (60+ Days)"];
  const lapsedWhere = buildSegmentSql(segmentDefinitions[2].rules);
  const lapsedCustomers = await getCustomersBySegmentRules(lapsedWhere.whereClause, lapsedWhere.params);

  const camp2 = await insertCampaign({
    name: "Lapsed Win-back Campaign",
    segment_id: lapsedSegmentId,
    channel: "sms",
    message_template: "Hi {{customer_name}}! We miss you. Use code BACK20 to get 20% off your next purchase.",
    status: "completed",
    ai_recommendation: {
      recommended_channel: "sms",
      recommended_time: "Friday 5–7 PM",
      reasoning: "SMS has high read-receipt speed, useful for instant win-backs before the weekend.",
      risk: "High risk of number stagnation or opt-outs.",
    },
  });

  // Seed communications and events for Campaign 1 (WhatsApp, highly engaging)
  const championsToSeed = championsCustomers.slice(0, 200);
  console.log(`Generating delivery simulator callbacks for ${championsToSeed.length} Champions...`);
  for (const customer of championsToSeed) {
    const statusRoll = Math.random();
    let status: "sent" | "delivered" | "opened" | "clicked" | "failed" = "sent";
    
    if (statusRoll < 0.05) status = "failed";
    else if (statusRoll < 0.20) status = "delivered";
    else if (statusRoll < 0.50) status = "opened";
    else status = "clicked";

    const sentAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    const comm = await insertCommunication({
      campaign_id: camp1.id,
      customer_id: customer.id,
      message: camp1.message_template.replace("{{customer_name}}", customer.name),
      channel: "whatsapp",
      status,
      sent_at: sentAt.toISOString(),
    });

    // Seed historical events
    await insertEvent(comm.id, "sent", sentAt, {});
    
    if (status !== "failed") {
      const delivAt = new Date(sentAt.getTime() + 5 * 60 * 1000);
      await insertEvent(comm.id, "delivered", delivAt, {});

      if (status === "opened" || status === "clicked") {
        const openAt = new Date(delivAt.getTime() + 45 * 60 * 1000);
        await insertEvent(comm.id, "opened", openAt, {});

        if (status === "clicked") {
          const clickAt = new Date(openAt.getTime() + 10 * 60 * 1000);
          await insertEvent(comm.id, "clicked", clickAt, {});
        }
      }
    } else {
      const failAt = new Date(sentAt.getTime() + 2 * 60 * 1000);
      await insertEvent(comm.id, "failed", failAt, { reason: "Provider connection reset" });
    }
  }

  // Seed communications and events for Campaign 2 (SMS, lower engaging)
  const lapsedToSeed = lapsedCustomers.slice(0, 200);
  console.log(`Generating delivery simulator callbacks for ${lapsedToSeed.length} Lapsed shoppers...`);
  for (const customer of lapsedToSeed) {
    const statusRoll = Math.random();
    let status: "sent" | "delivered" | "opened" | "clicked" | "failed" = "sent";
    
    if (statusRoll < 0.15) status = "failed";
    else if (statusRoll < 0.45) status = "delivered";
    else if (statusRoll < 0.80) status = "opened";
    else status = "clicked";

    const sentAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

    const comm = await insertCommunication({
      campaign_id: camp2.id,
      customer_id: customer.id,
      message: camp2.message_template.replace("{{customer_name}}", customer.name),
      channel: "sms",
      status,
      sent_at: sentAt.toISOString(),
    });

    await insertEvent(comm.id, "sent", sentAt, {});
    
    if (status !== "failed") {
      const delivAt = new Date(sentAt.getTime() + 2 * 60 * 1000);
      await insertEvent(comm.id, "delivered", delivAt, {});

      if (status === "opened" || status === "clicked") {
        const openAt = new Date(delivAt.getTime() + 90 * 60 * 1000);
        await insertEvent(comm.id, "opened", openAt, {});

        if (status === "clicked") {
          const clickAt = new Date(openAt.getTime() + 15 * 60 * 1000);
          await insertEvent(comm.id, "clicked", clickAt, {});
        }
      }
    } else {
      const failAt = new Date(sentAt.getTime() + 30 * 1000);
      await insertEvent(comm.id, "failed", failAt, { reason: "Absent subscriber" });
    }
  }

  console.log("Database seeded successfully!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed with error:", err);
    process.exit(1);
  });
