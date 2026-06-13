/**
 * Shared Type Definitions
 *
 * Defines shared interfaces for customers, segments, campaigns,
 * communications, and API contract structures for Xeno Mini CRM.
 *
 * Responsibilities:
 * - Ensure frontend-backend contract safety.
 * - Enforce TypeScript strict mode compatibility.
 */

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city: string;
  gender?: string;
  created_at?: string;
  rfm_recency_days?: number;
  rfm_frequency?: number;
  rfm_monetary?: number;
  rfm_score?: number;
  rfm_segment?: string;
}

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  customer_id?: string;
  amount: number;
  channel: "online" | "store" | "app";
  items: OrderItem[];
  created_at: string;
}

export interface FilterRule {
  field: string;
  op: string;
  value: string | number | string[] | number[];
}

export interface FilterRules {
  operator: string;
  rules: FilterRule[];
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  filter_rules: FilterRules;
  customer_count: number;
  created_at: string;
  updated_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  segment_id?: string;
  segment_name: string;
  channel: "whatsapp" | "sms" | "email" | "rcs";
  message_template: string;
  status: "draft" | "scheduled" | "running" | "completed";
  scheduled_at?: string;
  sent_at?: string;
  completed_at?: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  failed_count: number;
  ai_summary?: string | null;
  ai_recommendation?: AIRecommendation | null;
  created_at: string;
}

export interface Communication {
  id: string;
  campaign_id: string;
  campaign_name: string;
  customer_id?: string;
  message: string;
  channel: string;
  status: "queued" | "sent" | "delivered" | "failed" | "opened" | "clicked";
  sent_at: string;
}

export interface CustomerProfile extends Customer {
  ai_summary?: string;
  orders: Order[];
  communications: Communication[];
}

export interface AIRecommendation {
  recommended_channel: "whatsapp" | "sms" | "email" | "rcs";
  recommended_time: string;
  reasoning: string;
  risk: string;
}
