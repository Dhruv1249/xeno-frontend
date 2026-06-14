/**
 * Database Migration Script
 *
 * Reads 001_init.sql and executes the schema migration against the database,
 * creating the required tables and indexes without seeding any dummy data.
 *
 * Usage:
 * npx tsx lib/migrate.ts
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "fs";
import path from "path";

async function migrate() {
  console.log("Starting database schema migration...");

  // Dynamically import db to ensure env vars are loaded first
  const { pool, runSchemaMigration } = await import("./db");

  try {
    const migrationPath = path.join(process.cwd(), "migrations", "001_init.sql");
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }

    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    
    console.log("Executing 001_init.sql against CockroachDB...");
    await runSchemaMigration(migrationSql);
    console.log("Schema tables and indexes created successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    // End pool connection so the Node process can exit cleanly
    await pool.end();
  }
}

migrate();
