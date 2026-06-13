/**
 * Segment Engine
 *
 * Converts CRM segment filter definitions into
 * parameterized SQL queries for CockroachDB/PostgreSQL.
 *
 * Responsibilities:
 * - Validate filter rules.
 * - Generate WHERE clauses.
 * - Prevent SQL injection via parameterization.
 */

import { FilterRules } from "../types";

interface SqlQueryResult {
  /** The generated SQL WHERE clause string with $1, $2 placeholders */
  whereClause: string;
  /** Parameters matching the placeholders in order */
  params: unknown[];
}

/**
 * Converts visual/chat segment filters into a parameterized SQL where clause.
 *
 * @param filterRules Segment filter rules definition
 * @returns Parameterized SQL WHERE clause and values array
 */
export function buildSegmentSql(filterRules: FilterRules): SqlQueryResult {
  const rules = filterRules.rules || [];
  const operator = filterRules.operator || "AND";

  if (rules.length === 0) {
    return { whereClause: "1=1", params: [] };
  }

  const clauses: string[] = [];
  const params: unknown[] = [];
  let parameterIndex = 1;

  for (const rule of rules) {
    let fieldColumn = "";
    switch (rule.field) {
      case "rfm_recency_days":
        fieldColumn = "rfm_recency_days";
        break;
      case "rfm_frequency":
      case "total_orders":
        fieldColumn = "rfm_frequency";
        break;
      case "rfm_monetary":
        fieldColumn = "rfm_monetary";
        break;
      case "rfm_score":
        fieldColumn = "rfm_score";
        break;
      case "rfm_segment":
        fieldColumn = "rfm_segment";
        break;
      case "city":
        fieldColumn = "city";
        break;
      case "gender":
        fieldColumn = "gender";
        break;
      case "last_order_amount":
        // Subquery mapping for dynamic order calculation
        fieldColumn = "(SELECT amount FROM orders WHERE customer_id = customers.id ORDER BY created_at DESC LIMIT 1)";
        break;
      default:
        continue;
    }

    let comparisonOp = "";
    let val = rule.value;

    switch (rule.op) {
      case "eq":
        comparisonOp = `= $${parameterIndex}`;
        params.push(val);
        parameterIndex++;
        break;
      case "neq":
        comparisonOp = `!= $${parameterIndex}`;
        params.push(val);
        parameterIndex++;
        break;
      case "gt":
        comparisonOp = `> $${parameterIndex}`;
        params.push(val);
        parameterIndex++;
        break;
      case "gte":
        comparisonOp = `>= $${parameterIndex}`;
        params.push(val);
        parameterIndex++;
        break;
      case "lt":
        comparisonOp = `< $${parameterIndex}`;
        params.push(val);
        parameterIndex++;
        break;
      case "lte":
        comparisonOp = `<= $${parameterIndex}`;
        params.push(val);
        parameterIndex++;
        break;
      case "like":
        comparisonOp = `ILIKE $${parameterIndex}`;
        params.push(`%${val}%`);
        parameterIndex++;
        break;
      case "in":
        if (Array.isArray(val)) {
          const placeholders = val.map((_, idx) => `$${parameterIndex + idx}`).join(", ");
          comparisonOp = `IN (${placeholders})`;
          params.push(...val);
          parameterIndex += val.length;
        } else {
          comparisonOp = `= $${parameterIndex}`;
          params.push(val);
          parameterIndex++;
        }
        break;
      case "nin":
        if (Array.isArray(val)) {
          const placeholders = val.map((_, idx) => `$${parameterIndex + idx}`).join(", ");
          comparisonOp = `NOT IN (${placeholders})`;
          params.push(...val);
          parameterIndex += val.length;
        } else {
          comparisonOp = `!= $${parameterIndex}`;
          params.push(val);
          parameterIndex++;
        }
        break;
      default:
        continue;
    }

    clauses.push(`${fieldColumn} ${comparisonOp}`);
  }

  if (clauses.length === 0) {
    return { whereClause: "1=1", params: [] };
  }

  const whereClause = clauses.join(` ${operator} `);
  return { whereClause, params };
}
