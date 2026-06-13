/**
 * RFM Scoring Engine
 *
 * Implements the recency, frequency, and monetary scoring logic
 * using quintiles across the entire shopper database.
 *
 * Responsibilities:
 * - Load all customer transaction history metrics.
 * - Partition metrics into quintiles (1-5 scale).
 * - Assign composite scores and target segment names.
 */

import { getCustomerRfmBaseMetrics, updateCustomerRfmScores } from "./db";

/**
 * Calculates and returns the quintile score (1 to 5) for a given value
 * relative to the sorted distribution of all values.
 *
 * @param value The value to score
 * @param sortedValues Distribution of all values sorted in ascending order
 * @param lowerIsBetter Set true if lower value represents better shopper engagement (e.g., recency days)
 */
function calculateQuintile(value: number, sortedValues: number[], lowerIsBetter: boolean): number {
  if (sortedValues.length === 0) return 1;
  
  // Find first index to handle ties consistently
  const index = sortedValues.indexOf(value);
  const positionRatio = index / sortedValues.length;
  
  let score = 1;
  if (positionRatio < 0.2) {
    score = 1;
  } else if (positionRatio < 0.4) {
    score = 2;
  } else if (positionRatio < 0.6) {
    score = 3;
  } else if (positionRatio < 0.8) {
    score = 4;
  } else {
    score = 5;
  }

  // If lower value is better (e.g., fewer days since last order), invert the score
  if (lowerIsBetter) {
    return 6 - score;
  }
  return score;
}

/**
 * Classifies a customer into a segment based on their individual RFM quintile scores.
 *
 * @param recencyScore Recency score (1-5)
 * @param frequencyScore Frequency score (1-5)
 * @param monetaryScore Monetary score (1-5)
 * @param rawFrequency Raw order count
 */
function classifyRfmSegment(
  recencyScore: number,
  frequencyScore: number,
  monetaryScore: number,
  rawFrequency: number
): string {
  // Champion: all three scores are 4 or 5
  if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) {
    return "Champion";
  }

  // Loyal: frequency score >= 4
  if (frequencyScore >= 4) {
    return "Loyal";
  }

  // At Risk: recency score <= 2, was previously high value (frequency or monetary score >= 3)
  if (recencyScore <= 2 && (frequencyScore >= 3 || monetaryScore >= 3)) {
    return "At Risk";
  }

  // Lost: recency score = 1
  if (recencyScore === 1) {
    return "Lost";
  }

  // New: frequency = 1 (just 1 order), recency score >= 4 (recent order)
  if (rawFrequency === 1 && recencyScore >= 4) {
    return "New";
  }

  return "Others";
}

/**
 * Computes RFM scores across all customers in the database and updates their profiles.
 */
export async function computeRfmScores(): Promise<void> {
  const metrics = await getCustomerRfmBaseMetrics();
  if (metrics.length === 0) {
    return;
  }

  // Extract distributions for quintile calculations
  const recencyValues = metrics.map((m) => m.recency_days).sort((a, b) => a - b);
  const frequencyValues = metrics.map((m) => m.frequency).sort((a, b) => a - b);
  const monetaryValues = metrics.map((m) => m.monetary).sort((a, b) => a - b);

  for (const customer of metrics) {
    const rScore = calculateQuintile(customer.recency_days, recencyValues, true);
    const fScore = calculateQuintile(customer.frequency, frequencyValues, false);
    const mScore = calculateQuintile(customer.monetary, monetaryValues, false);

    // Composite RFM score: average of three scores rounded to nearest integer
    const compositeScore = Math.round((rScore + fScore + mScore) / 3);
    const segment = classifyRfmSegment(rScore, fScore, mScore, customer.frequency);

    await updateCustomerRfmScores(
      customer.id,
      customer.recency_days,
      customer.frequency,
      customer.monetary,
      compositeScore,
      segment
    );
  }
}
