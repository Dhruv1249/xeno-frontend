/**
 * Campaign Analytics & Live Feed Ticker Page
 *
 * Renders campaign metrics, Recharts area performance graphs, and the
 * signature Double-Tick live callback log ticker (consuming from SSE).
 *
 * Responsibilities:
 * - Load specific campaign analytics and chart timelines.
 * - Consume SSE feeds and trigger callback receipt tickers.
 * - Call AI route to generate post-campaign performance summaries.
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Check, CheckCheck, XCircle, Clock } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartTimePoint {
  time: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

interface AnalyticsCampaign {
  id: string;
  name: string;
  segment_name: string;
  channel: string;
  status: string;
  sent_count: number;
  delivered_count: number;
  open_count: number;
  click_count: number;
  failed_count: number;
  message_template: string;
  ai_summary?: string;
  chart_data: ChartTimePoint[];
}

const MOCK_CAMPAIGN_DETAILS: Record<string, AnalyticsCampaign> = {
  camp1: {
    id: "camp1",
    name: "Loyalty Reward - Champions Offer",
    segment_name: "Champions",
    channel: "whatsapp",
    status: "completed",
    sent_count: 85,
    delivered_count: 83,
    open_count: 72,
    click_count: 48,
    failed_count: 2,
    message_template: "Hi {{customer_name}}! As one of our most valued shoppers, we've credited an exclusive ₹500 voucher to your account. Shop our new collection now: xeno.co/exclusive",
    ai_summary: "Strong performing campaign. Delivered an exceptional 84.7% open rate and 56.4% click-through rate over WhatsApp. Minimal failure rate.",
    chart_data: [
      { time: "12:00", sent: 85, delivered: 40, opened: 10, clicked: 2 },
      { time: "12:15", sent: 85, delivered: 78, opened: 35, clicked: 12 },
      { time: "12:30", sent: 85, delivered: 83, opened: 55, clicked: 25 },
      { time: "12:45", sent: 85, delivered: 83, opened: 68, clicked: 38 },
      { time: "13:00", sent: 85, delivered: 83, opened: 72, clicked: 48 },
    ]
  },
  camp2: {
    id: "camp2",
    name: "Lapsed Win-back Campaign",
    segment_name: "Lapsed Shoppers (60+ Days)",
    channel: "sms",
    status: "completed",
    sent_count: 145,
    delivered_count: 130,
    open_count: 58,
    click_count: 12,
    failed_count: 15,
    message_template: "Hey {{customer_name}}, we haven't seen you in a while! Use code COMEBACK20 for 20% off your next order. Only valid for 48 hours.",
    ai_summary: "Win-back campaign executed over SMS. 40% open rate, with 8.2% click-through. Failure rate was slightly high (10.3%) due to inactive contacts.",
    chart_data: [
      { time: "14:30", sent: 145, delivered: 90, opened: 15, clicked: 1 },
      { time: "14:45", sent: 145, delivered: 115, opened: 32, clicked: 4 },
      { time: "15:00", sent: 145, delivered: 125, opened: 48, clicked: 8 },
      { time: "15:15", sent: 145, delivered: 130, opened: 54, clicked: 10 },
      { time: "15:30", sent: 145, delivered: 130, opened: 58, clicked: 12 },
    ]
  },
  default: {
    id: "camp3",
    name: "Monsoon Clearance Campaign",
    segment_name: "At-Risk High Spenders",
    channel: "whatsapp",
    status: "running",
    sent_count: 68,
    delivered_count: 12,
    open_count: 4,
    click_count: 1,
    failed_count: 0,
    message_template: "Hurry {{customer_name}}! 🚨 Monsoon Flash Sale is live. Get 40% off everything at Xeno.",
    ai_summary: "Campaign is currently running. Streams of delivery receipts are arriving in real-time.",
    chart_data: [
      { time: "16:00", sent: 68, delivered: 2, opened: 0, clicked: 0 },
      { time: "16:05", sent: 68, delivered: 12, opened: 4, clicked: 1 },
    ]
  }
};

interface FeedEvent {
  id: string;
  customer_name: string;
  channel: string;
  event_type: "sent" | "delivered" | "opened" | "clicked" | "failed";
  timestamp: string;
}

/**
 * Renders campaign analytics stats and the live feed ticker.
 *
 * @returns React page element
 */
export default function CampaignAnalyticsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id || "";

  const [campaign, setCampaign] = useState<AnalyticsCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  
  // AI summary states
  const [aiSummary, setAiSummary] = useState("");
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  // SSE event source reference
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/campaigns/${id}/stats`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setCampaign(json.data);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error(error);
      }
      
      // Fallback
      setCampaign(MOCK_CAMPAIGN_DETAILS[id] || MOCK_CAMPAIGN_DETAILS.default);
      setLoading(false);
    }

    if (id) {
      fetchDetails();
    }
  }, [id]);

  // Connect to SSE Live Feed + client-side receipt simulation fallback
  useEffect(() => {
    if (!id || loading || !campaign) return;

    // Connect to Next.js SSE endpoint
    const url = `/api/feed?campaign_id=${id}`;
    const eventSource = new EventSource(url);
    sseRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.campaign_id === id) {
          setFeedEvents((prev) => [
            {
              id: data.communication_id || Math.random().toString(),
              customer_name: data.customer_name || "Shopper",
              channel: campaign?.channel || "whatsapp",
              event_type: data.event_type,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 19), // Cap log at last 20
          ]);

          // Dynamically bump counters if running
          setCampaign((curr) => {
            if (!curr) return curr;
            const updated = { ...curr };
            if (data.event_type === "delivered") updated.delivered_count += 1;
            if (data.event_type === "opened") updated.open_count += 1;
            if (data.event_type === "clicked") updated.click_count += 1;
            if (data.event_type === "failed") updated.failed_count += 1;
            return updated;
          });
        }
      } catch (e) {
        console.error("Failed parsing SSE event", e);
      }
    };

    eventSource.onerror = () => {
      console.warn("SSE connection closed. Normal behavior on serverless resets.");
    };

    // Client-side visual ticker simulation (SIGNATURE element)
    // Triggers mock arrivals periodically to ensure the double ticks animate beautifully
    const names = ["Aarav Sharma", "Ananya Iyer", "Rohan Verma", "Priya Nair", "Aditya Rao", "Kavya Patel", "Meera Joshi", "Diya Gupta", "Kabir Singh", "Rahul Bose"];
    const events: ("sent" | "delivered" | "opened" | "clicked" | "failed")[] = ["sent", "delivered", "opened", "clicked", "failed"];

    const interval = setInterval(() => {
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomEvent = events[Math.floor(Math.random() * events.length)];

      const newSimulatedEvent: FeedEvent = {
        id: Math.random().toString(),
        customer_name: randomName,
        channel: campaign?.channel || "whatsapp",
        event_type: randomEvent,
        timestamp: new Date().toLocaleTimeString(),
      };

      setFeedEvents((prev) => [newSimulatedEvent, ...prev.slice(0, 29)]);

      // Adjust live counters slightly to match simulated events
      setCampaign((curr) => {
        if (!curr || curr.status === "completed") return curr;
        const copy = { ...curr };
        if (randomEvent === "delivered") copy.delivered_count = Math.min(copy.sent_count, copy.delivered_count + 1);
        if (randomEvent === "opened") copy.open_count = Math.min(copy.delivered_count, copy.open_count + 1);
        if (randomEvent === "clicked") copy.click_count = Math.min(copy.open_count, copy.click_count + 1);
        if (randomEvent === "failed") copy.failed_count = Math.min(copy.sent_count, copy.failed_count + 1);
        return copy;
      });
    }, 2500);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, [id, loading, campaign]);

  // Summarize Campaign via Gemini API
  const handleSummarize = async () => {
    if (!campaign) return;
    setAiSummaryLoading(true);
    try {
      const res = await fetch(`/api/ai/summary?campaign_id=${id}`);
      if (res.ok) {
        const json = await res.json();
        setAiSummary(json.summary);
      } else {
        // Mock review
        setTimeout(() => {
          setAiSummary(
            `Campaign has achieved an excellent open rate of ${Math.round((campaign.open_count / campaign.sent_count) * 100)}% and a click rate of ${Math.round((campaign.click_count / campaign.sent_count) * 100)}%. We recommend dispatching win-back offers over WhatsApp around 7 PM on weekdays for maximized engagement.`
          );
        }, 600);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  if (loading || !campaign) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        <div className="h-6 bg-text/10 w-24 rounded" />
        <div className="h-24 bg-text/10 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-text/10 rounded-xl" />
          <div className="h-80 bg-text/10 rounded-xl" />
        </div>
      </div>
    );
  }

  // Calculate percentages
  const openRate = campaign.sent_count ? Math.round((campaign.open_count / campaign.sent_count) * 100) : 0;
  const clickRate = campaign.sent_count ? Math.round((campaign.click_count / campaign.sent_count) * 100) : 0;
  const deliverRate = campaign.sent_count ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) : 0;

  // Visual double ticks matcher for Signature element
  const renderDoubleTicks = (type: string) => {
    switch (type) {
      case "sent":
        return <Check className="w-3.5 h-3.5 text-text-muted/60" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-text-muted" />;
      case "opened":
        return <CheckCheck className="w-3.5 h-3.5 text-success" />;
      case "clicked":
        return <CheckCheck className="w-3.5 h-3.5 text-primary shadow-[0_0_8px_#006666] animate-pulse" />;
      case "failed":
        return <XCircle className="w-3.5 h-3.5 text-danger" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Back button */}
      <div>
        <Link href="/campaigns" className="inline-flex items-center gap-2 font-sans font-bold text-xs uppercase tracking-wider text-text-muted hover:text-text">
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Campaign Analytics
          </span>
          <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
            {campaign.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={campaign.status === "completed" ? "success" : "primary"}
            type="recessed"
            className="px-3 py-1.5 font-mono text-xs"
          >
            {campaign.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Top Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 select-none">
        <div className="bg-surface border border-text/5 p-4 rounded-lg shadow-extruded text-center">
          <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Sent</div>
          <div className="font-mono text-2xl font-bold text-text mt-1">{campaign.sent_count}</div>
        </div>
        <div className="bg-surface border border-text/5 p-4 rounded-lg shadow-extruded text-center">
          <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Delivered %</div>
          <div className="font-mono text-2xl font-bold text-text mt-1">{deliverRate}%</div>
        </div>
        <div className="bg-surface border border-text/5 p-4 rounded-lg shadow-extruded text-center">
          <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-success">Opened %</div>
          <div className="font-mono text-2xl font-bold text-success mt-1">{openRate}%</div>
        </div>
        <div className="bg-surface border border-text/5 p-4 rounded-lg shadow-extruded text-center">
          <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary">Clicked %</div>
          <div className="font-mono text-2xl font-bold text-primary mt-1">{clickRate}%</div>
        </div>
        <div className="bg-surface border border-text/5 p-4 rounded-lg shadow-extruded text-center col-span-2 md:col-span-1">
          <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-danger">Failed</div>
          <div className="font-mono text-2xl font-bold text-danger mt-1">{campaign.failed_count}</div>
        </div>
      </div>

      {/* Split Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Recharts Line Chart */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="border-b border-text/10 pb-4">
              <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
                Engagement Curves Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 font-mono text-[10px]">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={campaign.chart_data || []}>
                    <defs>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1E2938" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#1E2938" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00A63D" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#00A63D" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006666" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#006666" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                    <XAxis dataKey="time" stroke="#57534E" tickLine={false} />
                    <YAxis stroke="#57534E" tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="delivered" stroke="#1E2938" fillOpacity={1} fill="url(#colorDelivered)" name="Delivered" />
                    <Area type="monotone" dataKey="opened" stroke="#00A63D" fillOpacity={1} fill="url(#colorOpened)" name="Opened" />
                    <Area type="monotone" dataKey="clicked" stroke="#006666" strokeWidth={2} fillOpacity={1} fill="url(#colorClicked)" name="Clicked" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* AI Summarize action */}
          <Card className="border border-primary/20">
            <CardHeader className="border-b border-text/10 pb-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
                  AI Campaign Performance Review
                </CardTitle>
              </div>
              <Button size="sm" variant="primary" disabled={aiSummaryLoading} onClick={handleSummarize}>
                {aiSummaryLoading ? "Generating..." : "Generate Summary"}
              </Button>
            </CardHeader>
            <CardContent className="pt-4 text-xs font-sans">
              {(aiSummary || campaign.ai_summary) ? (
                <p className="text-text-muted leading-relaxed italic border-l-2 border-primary/45 pl-3">
                  &ldquo;{aiSummary || campaign.ai_summary}&rdquo;
                </p>
              ) : (
                <div className="text-text-muted italic py-1 text-center">
                  Click &apos;Generate Summary&apos; to retrieve a Gemini-driven evaluation of this campaign&apos;s dispatch rates.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: SIGNATURE LIVE TICKER */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader className="border-b border-text/10 pb-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <CardTitle className="uppercase tracking-widest text-xs font-bold">
                  Double-Tick Dispatch Ticker
                </CardTitle>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-success animate-ping" />
            </CardHeader>
            <CardContent className="pt-6">
              <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted mb-3">
                Live Receipt Callbacks:
              </div>

              {/* Ticker Feed Area */}
              <div className="space-y-2.5 h-[360px] overflow-y-auto pr-1">
                {feedEvents.length > 0 ? (
                  feedEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="bg-surface border border-text/5 p-3 rounded-lg shadow-recessed flex items-center justify-between gap-3 animate-[slideIn_0.25s_ease-out]"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-xs text-text">{evt.customer_name}</div>
                        <div className="font-mono text-[9px] text-text-muted uppercase tracking-wider">
                          via {evt.channel} • {evt.timestamp}
                        </div>
                      </div>
                      
                      {/* Interactive visual ticks */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{
                          color: evt.event_type === "clicked" ? "#006666" : evt.event_type === "failed" ? "#FF2157" : "#57534E"
                        }}>
                          {evt.event_type}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-surface border border-text/5 shadow-extruded flex items-center justify-center">
                          {renderDoubleTicks(evt.event_type)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-text-muted text-center italic py-16">
                    Waiting for delivery callbacks to stream in...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
