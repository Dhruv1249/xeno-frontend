/**
 * Gemini AI Integration Module
 *
 * Provides wrappers for all AI assistant operations powered by Google Gemini.
 * Includes natural language query compilation, message drafting, send advisor,
 * and summary generations.
 *
 * Responsibilities:
 * - Load and configure Gemini GenerativeAI client.
 * - Structure structured prompts and request JSON schemas.
 * - Provide robust error catch blocks and static fallbacks.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { FilterRules, AIRecommendation } from "../types";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Using gemini-3.1-flash-lite as it's the standard reliable model for structured JSON tasks.
const getModel = () => genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

/**
 * Parses raw text containing potential JSON block, stripping markdown markers if present.
 */
function cleanAndParseJson<T>(text: string, fallback: T): T {
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    return JSON.parse(cleanText.trim()) as T;
  } catch (error) {
    logError("JSON clean & parse failed", error);
    return fallback;
  }
}

/**
 * Log helper following logging standards.
 */
function logError(message: string, error: unknown) {
  console.error(`[AI ERROR] ${message}:`, error);
}

/**
 * Converts a natural language query into database segment filter rules.
 *
 * @param query Marketer's natural language input
 * @returns FilterRules structure mapping fields to operators and values
 */
export async function translateNlToSegmentFilters(query: string): Promise<FilterRules> {
  const fallback: FilterRules = { operator: "AND", rules: [] };
  
  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing, using empty filters fallback.");
    return fallback;
  }

  const prompt = `
    You are a marketing analyst database assistant for a retail CRM.
    Convert the following natural language query from a marketer into a structured JSON filter rule configuration.
    
    Fields supported:
    - rfm_recency_days (number)
    - rfm_frequency (number)
    - rfm_monetary (number)
    - rfm_score (number, 1 to 5)
    - rfm_segment (string: Champion | Loyal | At Risk | Lost | New)
    - city (string)
    - gender (string)
    - total_orders (number)
    - last_order_amount (number)

    Operators supported:
    - eq (equals)
    - neq (not equals)
    - gt (greater than)
    - gte (greater than or equal to)
    - lt (less than)
    - lte (less than or equal to)
    - like (partial match string)
    - in (array match)
    - nin (not in array match)

    Provide ONLY raw JSON matching this schema:
    {
      "operator": "AND" | "OR",
      "rules": [
        { "field": "field_name", "op": "operator_name", "value": number | string | array }
      ]
    }

    Query: "${query}"
  `;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    });
    
    const text = result.response.text();
    return cleanAndParseJson<FilterRules>(text, fallback);
  } catch (error) {
    logError("NL segment translation failed", error);
    return fallback;
  }
}

/**
 * Drafts a personalized campaign message.
 */
export async function draftCampaignMessage(
  segmentName: string,
  segmentDesc: string,
  channel: string,
  tone: string
): Promise<string> {
  const fallback = `Hi {{customer_name}}, check out our latest offers tailored just for you! Order now and get exclusive benefits.`;

  if (!apiKey) return fallback;

  const prompt = `
    You are an expert copywriter. Write a short, engaging campaign message for a customer segment.
    Segment name: "${segmentName}" (${segmentDesc || "Shoppers"})
    Communication channel: "${channel}"
    Tone of voice: "${tone}"
    
    CRITICAL: You MUST insert the exact template placeholder "{{customer_name}}" where the customer's name should appear.
    Keep it concise and appropriate for the channel. Output ONLY the raw message content. No explanation.
  `;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    });
    return result.response.text().trim() || fallback;
  } catch (error) {
    logError("Message drafting failed", error);
    return fallback;
  }
}

/**
 * Evaluates target segment context and recommends the best channel and timing.
 */
export async function getPreSendRecommendation(
  segmentName: string,
  channel: string,
  customerCount: number
): Promise<AIRecommendation> {
  const fallback: AIRecommendation = {
    recommended_channel: channel as any,
    recommended_time: "Wednesday 6–8 PM",
    reasoning: `Recommended sending over ${channel} based on retail heuristics. High engagement times for similar segments average weekday evenings.`,
    risk: "Medium risk of message fatigue. Ensure messaging contains a clear value proposition.",
  };

  if (!apiKey) return fallback;

  const prompt = `
    Analyze pre-dispatch parameters for a campaign send.
    Target Segment: "${segmentName}"
    Proposed Channel: "${channel}"
    Audience Size: ${customerCount}

    Determine if this channel is suitable, the best day/time to schedule, and potential fatigue or delivery risks.
    Return ONLY a raw JSON object matching the following structure:
    {
      "recommended_channel": "whatsapp" | "sms" | "email" | "rcs",
      "recommended_time": "e.g., Tuesday 7-9 PM",
      "reasoning": "A short sentence explaining why",
      "risk": "A short description of fatigue or delivery risks"
    }
  `;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    });
    return cleanAndParseJson<AIRecommendation>(result.response.text(), fallback);
  } catch (error) {
    logError("Pre-send advice failed", error);
    return fallback;
  }
}

/**
 * Creates a brief summary paragraph of campaign performance metrics.
 */
export async function summarizeCampaignPerformance(
  name: string,
  channel: string,
  stats: { sent: number; opened: number; clicked: number; failed: number }
): Promise<string> {
  const fallback = "Campaign completed. Engagement rates reflect typical retail baseline behaviors.";
  if (!apiKey) return fallback;

  const prompt = `
    Write a 2-sentence marketing performance summary for the campaign "${name}".
    Metrics:
    - Channel: ${channel}
    - Total Sent: ${stats.sent}
    - Opened/Read: ${stats.opened} (Open rate: ${stats.sent ? Math.round((stats.opened / stats.sent) * 100) : 0}%)
    - Clicked: ${stats.clicked} (Click rate: ${stats.sent ? Math.round((stats.clicked / stats.sent) * 100) : 0}%)
    - Failed: ${stats.failed}

    Write a human-readable summary analyzing the response rate and identifying if the channel performed well.
    Output ONLY the summary text.
  `;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });
    return result.response.text().trim() || fallback;
  } catch (error) {
    logError("Campaign summary failed", error);
    return fallback;
  }
}

/**
 * Generates the dashboard daily marketer briefing.
 */
export async function generateMorningBrief(stats: {
  totalCustomers: number;
  activeCampaigns: number;
  avgOpenRate: number;
  atRiskCount: number;
  notMessaged30Days: number;
}): Promise<string> {
  const fallback = `Retail activity is running steady. We currently have ${stats.totalCustomers} registered customers. There are ${stats.activeCampaigns} active campaigns out in the wild with a ${stats.avgOpenRate.toFixed(1)}% average open rate. ${stats.atRiskCount} customers have transitioned into the 'At Risk' category over the past 30 days — consider sending a Loyalty Reward win-back campaign today.`;

  if (!apiKey) return fallback;

  const prompt = `
    Write a 3-sentence morning briefing for a retail brand marketer based on these database statistics:
    - Total Shoppers: ${stats.totalCustomers}
    - Currently Active/Running Campaigns: ${stats.activeCampaigns}
    - Average Open/Engagement Rate: ${stats.avgOpenRate.toFixed(1)}%
    - At-Risk Segment Customers: ${stats.atRiskCount}
    - Customers not contacted/messaged in last 30+ days: ${stats.notMessaged30Days}

    Briefing should be insights-driven and action-oriented (e.g., recommend reaching out to at-risk or un-messaged cohorts).
    Output ONLY the briefing paragraph.
  `;

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    });
    return result.response.text().trim() || fallback;
  } catch (error) {
    logError("Morning brief failed", error);
    return fallback;
  }
}
