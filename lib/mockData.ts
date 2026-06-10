/**
 * Mock Data Repository
 *
 * Provides static fallback datasets for local development,
 * testing, and simulation of the Xeno Mini CRM frontend.
 *
 * Responsibilities:
 * - Hold fallback customer records and RFM metrics.
 * - Supply templates, segment presets, and campaign analytics structures.
 */

import { Customer, CustomerProfile, Campaign } from "../types";

export const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Aarav Sharma", email: "aarav.sharma@gmail.com", phone: "+91 98765 43210", city: "Mumbai", rfm_segment: "Champion", rfm_recency_days: 5, rfm_frequency: 15, rfm_monetary: 4500, rfm_score: 5 },
  { id: "c2", name: "Ananya Iyer", email: "ananya.iyer@yahoo.com", phone: "+91 98123 45678", city: "Bengaluru", rfm_segment: "Champion", rfm_recency_days: 10, rfm_frequency: 18, rfm_monetary: 5200, rfm_score: 5 },
  { id: "c3", name: "Rohan Verma", email: "rohan.verma@outlook.com", phone: "+91 99887 76655", city: "Delhi", rfm_segment: "Loyal", rfm_recency_days: 18, rfm_frequency: 9, rfm_monetary: 2800, rfm_score: 4 },
  { id: "c4", name: "Priya Nair", email: "priya.nair@gmail.com", phone: "+91 97654 32109", city: "Chennai", rfm_segment: "At Risk", rfm_recency_days: 45, rfm_frequency: 8, rfm_monetary: 3100, rfm_score: 3 },
  { id: "c5", name: "Vikram Malhotra", email: "vikram.m@gmail.com", phone: "+91 96543 21098", city: "Mumbai", rfm_segment: "Lost", rfm_recency_days: 120, rfm_frequency: 3, rfm_monetary: 900, rfm_score: 1 },
  { id: "c6", name: "Kavya Patel", email: "kavya.patel@gmail.com", phone: "+91 95432 10987", city: "Ahmedabad", rfm_segment: "New", rfm_recency_days: 4, rfm_frequency: 1, rfm_monetary: 1500, rfm_score: 4 },
  { id: "c7", name: "Aditya Rao", email: "aditya.rao@gmail.com", phone: "+91 94321 09876", city: "Bengaluru", rfm_segment: "Champion", rfm_recency_days: 2, rfm_frequency: 12, rfm_monetary: 3800, rfm_score: 5 },
  { id: "c8", name: "Meera Joshi", email: "meera.j@gmail.com", phone: "+91 93210 98765", city: "Pune", rfm_segment: "At Risk", rfm_recency_days: 55, rfm_frequency: 6, rfm_monetary: 2200, rfm_score: 3 },
  { id: "c9", name: "Kabir Singh", email: "kabir.singh@gmail.com", phone: "+91 92109 87654", city: "Delhi", rfm_segment: "Loyal", rfm_recency_days: 22, rfm_frequency: 10, rfm_monetary: 3200, rfm_score: 4 },
  { id: "c10", name: "Diya Gupta", email: "diya.g@gmail.com", phone: "+91 91098 76543", city: "Hyderabad", rfm_segment: "Lost", rfm_recency_days: 95, rfm_frequency: 2, rfm_monetary: 600, rfm_score: 2 },
];

export const MOCK_PROFILES: Record<string, CustomerProfile> = {
  c1: {
    id: "c1",
    name: "Aarav Sharma",
    email: "aarav.sharma@gmail.com",
    phone: "+91 98765 43210",
    city: "Mumbai",
    gender: "Male",
    rfm_segment: "Champion",
    rfm_recency_days: 5,
    rfm_frequency: 15,
    rfm_monetary: 4500,
    rfm_score: 5,
    ai_summary: "High-value loyal champion. Responds extremely well to exclusivity messaging, especially WhatsApp flash sale promotions. Often purchases in evening hours (7–9 PM) via the App.",
    orders: [
      { id: "o1", amount: 1500, channel: "app", created_at: "2026-06-05T18:30:00Z", items: [{ name: "Premium Polo Tee", price: 900, qty: 1 }, { name: "Cotton Chinos", price: 600, qty: 1 }] },
      { id: "o2", amount: 2000, channel: "store", created_at: "2026-05-12T14:15:00Z", items: [{ name: "Casual Linen Shirt", price: 1200, qty: 1 }, { name: "Leather Belt", price: 800, qty: 1 }] },
      { id: "o3", amount: 1000, channel: "online", created_at: "2026-04-20T11:00:00Z", items: [{ name: "Basic White Sneakers", price: 1000, qty: 1 }] },
    ],
    communications: [
      { id: "com1", campaign_id: "camp1", campaign_name: "Win-back Offer", message: "Hey Aarav, we miss you! Enjoy 20% off your next purchase.", channel: "whatsapp", status: "clicked", sent_at: "2026-06-05T12:00:00Z" },
      { id: "com2", campaign_id: "camp2", campaign_name: "Loyalty Reward", message: "Hi Aarav! Here is an exclusive reward for our champions.", channel: "whatsapp", status: "opened", sent_at: "2026-05-20T15:00:00Z" },
      { id: "com3", campaign_id: "camp3", campaign_name: "Flash Sale", message: "Urgent: Flash Sale ends in 3 hours. Order now!", channel: "sms", status: "delivered", sent_at: "2026-04-15T18:00:00Z" },
    ]
  },
  default: {
    id: "generic",
    name: "Customer Profile",
    email: "customer@xeno.in",
    phone: "+91 99999 88888",
    city: "Delhi",
    gender: "Female",
    rfm_segment: "Loyal",
    rfm_recency_days: 12,
    rfm_frequency: 5,
    rfm_monetary: 2200,
    rfm_score: 4,
    ai_summary: "Loyal shopper who demonstrates steady purchases. Responsive to email marketing containing personalized recommendations. Prefers shopping via website.",
    orders: [
      { id: "o4", amount: 1200, channel: "online", created_at: "2026-05-28T10:30:00Z", items: [{ name: "Printed Kurti", price: 1200, qty: 1 }] },
      { id: "o5", amount: 1000, channel: "online", created_at: "2026-04-15T09:00:00Z", items: [{ name: "Handcrafted Dupatta", price: 1000, qty: 1 }] }
    ],
    communications: [
      { id: "com4", campaign_id: "camp4", campaign_name: "New Arrival Promotion", message: "Check out our latest ethnic styles, customized for you.", channel: "email", status: "opened", sent_at: "2026-05-28T09:00:00Z" }
    ]
  }
};

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "camp1",
    name: "Loyalty Reward - Champions Offer",
    segment_name: "Champions",
    channel: "whatsapp",
    status: "completed",
    sent_count: 85,
    open_count: 72,
    click_count: 48,
    failed_count: 2,
    created_at: "2026-05-20T12:00:00Z",
    ai_summary: "Strong performing campaign. Delivered an exceptional 84% open rate and 66% click-through rate over WhatsApp. Minimal failure rate.",
    message_template: "Hi {{customer_name}}! Voucher loaded."
  },
  {
    id: "camp2",
    name: "Lapsed Win-back Campaign",
    segment_name: "Lapsed Shoppers (60+ Days)",
    channel: "sms",
    status: "completed",
    sent_count: 145,
    open_count: 58,
    click_count: 12,
    failed_count: 15,
    created_at: "2026-05-28T14:30:00Z",
    ai_summary: "Win-back campaign executed over SMS. 40% open rate, with 8.2% click-through. Failure rate was slightly high (10.3%) due to inactive contacts.",
    message_template: "Hi {{customer_name}}! Come back."
  },
  {
    id: "camp3",
    name: "Flash Sale - Monsoon Clearance",
    segment_name: "At-Risk High Spenders",
    channel: "whatsapp",
    status: "draft",
    sent_count: 0,
    open_count: 0,
    click_count: 0,
    failed_count: 0,
    created_at: "2026-06-05T09:00:00Z",
    ai_summary: null,
    message_template: "Hi {{customer_name}}! Clearance sale."
  },
];

export const MOCK_TARGET_SEGMENTS = [
  { id: "s1", name: "Champions", count: 85 },
  { id: "s2", name: "At-Risk High Spenders", count: 68 },
  { id: "s3", name: "Lapsed Shoppers (60+ Days)", count: 145 },
  { id: "s4", name: "New Customers", count: 42 },
];
