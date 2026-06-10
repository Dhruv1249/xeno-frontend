"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, ArrowLeft, ShoppingBag, Send, AlertTriangle } from "lucide-react";

// Mock profiles mapped by ID
const MOCK_PROFILES: Record<string, any> = {
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
      { id: "com1", campaign_name: "Win-back Offer", message: "Hey Aarav, we miss you! Enjoy 20% off your next purchase.", channel: "whatsapp", status: "clicked", sent_at: "2026-06-05T12:00:00Z" },
      { id: "com2", campaign_name: "Loyalty Reward", message: "Hi Aarav! Here is an exclusive reward for our champions.", channel: "whatsapp", status: "opened", sent_at: "2026-05-20T15:00:00Z" },
      { id: "com3", campaign_name: "Flash Sale", message: "Urgent: Flash Sale ends in 3 hours. Order now!", channel: "sms", status: "delivered", sent_at: "2026-04-15T18:00:00Z" },
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
      { id: "com4", campaign_name: "New Arrival Promotion", message: "Check out our latest ethnic styles, customized for you.", channel: "email", status: "opened", sent_at: "2026-05-28T09:00:00Z" }
    ]
  }
};

export default function CustomerProfilePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/customers/${id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setProfile(json.data);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("API Profile fetch failed, falling back to mock", e);
      }
      // Fallback
      const fallbackProfile = MOCK_PROFILES[id] || {
        ...MOCK_PROFILES.default,
        id: id || "unknown",
        name: id ? `Shopper (${id.substring(0, 6)})` : MOCK_PROFILES.default.name
      };
      setProfile(fallbackProfile);
      setLoading(false);
    }

    if (id) {
      fetchProfile();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        <div className="h-6 bg-text/10 w-24 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-text/10 rounded-xl md:col-span-1" />
          <div className="h-96 bg-text/10 rounded-xl md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4 w-full text-center py-20">
        <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
        <h2 className="font-sans font-bold text-lg uppercase tracking-wider text-text">Customer not found</h2>
        <Link href="/customers">
          <Button variant="default">Go back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      {/* Back button */}
      <div>
        <Link href="/customers" className="inline-flex items-center gap-2 font-sans font-bold text-xs uppercase tracking-wider text-text-muted hover:text-text">
          <ArrowLeft className="w-4 h-4" /> Back to Shoppers
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Customer Profile Card */}
        <div className="space-y-6 md:col-span-1">
          <Card className="p-6 space-y-6 text-center">
            {/* Avatar & Basic Info */}
            <div className="space-y-3">
              <div className="w-20 h-20 rounded-full bg-surface border border-text/10 shadow-extruded mx-auto flex items-center justify-center font-sans font-bold text-2xl text-primary select-none">
                {profile.name.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <div>
                <h2 className="font-sans font-bold text-lg text-text uppercase tracking-normal">{profile.name}</h2>
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">{profile.city} ({profile.gender})</span>
              </div>
              <div className="flex justify-center">
                <Badge
                  variant={
                    profile.rfm_segment === "Champion"
                      ? "primary"
                      : profile.rfm_segment === "Loyal"
                      ? "success"
                      : profile.rfm_segment === "At Risk"
                      ? "warning"
                      : profile.rfm_segment === "Lost"
                      ? "danger"
                      : "default"
                  }
                  type="recessed"
                  className="px-3 py-1 text-xs"
                >
                  {profile.rfm_segment}
                </Badge>
              </div>
            </div>

            {/* Contact Details Inset Box */}
            <div className="bg-surface border border-text/5 p-4 rounded-lg shadow-recessed text-left space-y-2 font-mono text-[11px] text-text-muted">
              <div>EMAIL: <span className="text-text font-bold">{profile.email}</span></div>
              <div>PHONE: <span className="text-text font-bold">{profile.phone}</span></div>
            </div>

            {/* RFM Score breakdown */}
            <div className="grid grid-cols-3 gap-2 border-t border-b border-text/10 py-4 select-none">
              <div className="text-center">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Recency</div>
                <div className="font-mono text-lg font-bold text-text mt-1">{profile.rfm_recency_days}d</div>
              </div>
              <div className="text-center border-l border-r border-text/10">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Freq</div>
                <div className="font-mono text-lg font-bold text-text mt-1">{profile.rfm_frequency}x</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted">Spend</div>
                <div className="font-mono text-lg font-bold text-text mt-1">₹{profile.rfm_monetary}</div>
              </div>
            </div>

            {/* AI Summary Box */}
            <div className="space-y-2 text-left relative overflow-hidden">
              <div className="flex items-center gap-1.5 text-xs font-sans font-bold uppercase tracking-widest text-primary">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span>AI Insight</span>
              </div>
              <p className="font-sans text-xs italic leading-relaxed text-text border-l-2 border-primary/40 pl-3">
                "{profile.ai_summary}"
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Timelines */}
        <div className="space-y-8 md:col-span-2">
          
          {/* Order Timeline */}
          <Card>
            <CardHeader className="border-b border-text/10 pb-4 flex flex-row items-center gap-2 space-y-0">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <CardTitle className="uppercase tracking-widest text-xs font-bold">
                Order History Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {profile.orders && profile.orders.length > 0 ? (
                <div className="space-y-6 relative border-l border-text/10 pl-6 ml-3 font-sans">
                  {profile.orders.map((order: any, idx: number) => (
                    <div key={order.id || idx} className="relative">
                      {/* Bullet icon */}
                      <span className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-surface border-2 border-primary shadow-extruded" />
                      
                      <div className="space-y-2">
                        {/* Header info */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).toUpperCase()}
                          </span>
                          <span className="font-mono font-bold text-sm text-text">
                            ₹{Number(order.amount).toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Order box */}
                        <div className="bg-surface border border-text/5 p-3.5 rounded-lg shadow-recessed flex flex-col md:flex-row justify-between gap-4">
                          {/* Items */}
                          <div className="space-y-1">
                            <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted mb-1">Items:</div>
                            {order.items && Array.isArray(order.items) ? (
                              <ul className="list-disc list-inside text-xs text-text space-y-0.5">
                                {order.items.map((it: any, i: number) => (
                                  <li key={i}>
                                    {it.name} <span className="font-mono font-bold">x{it.qty}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-xs italic text-text-muted">Item details unavailable</span>
                            )}
                          </div>

                          {/* Channel */}
                          <div className="md:text-right self-end md:self-start">
                            <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted mb-1">Channel:</div>
                            <Badge variant="default" type="raised" className="text-[10px]">
                              {order.channel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center font-mono text-xs text-text-muted py-6">
                  NO PURCHASE HISTORY RECORDED
                </p>
              )}
            </CardContent>
          </Card>

          {/* Campaign Interactions */}
          <Card>
            <CardHeader className="border-b border-text/10 pb-4 flex flex-row items-center gap-2 space-y-0">
              <Send className="w-4 h-4 text-primary" />
              <CardTitle className="uppercase tracking-widest text-xs font-bold">
                Campaign Engagements
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {profile.communications && profile.communications.length > 0 ? (
                <div className="space-y-4">
                  {profile.communications.map((com: any, idx: number) => (
                    <div key={com.id || idx} className="bg-surface border border-text/5 p-4 rounded-lg shadow-extruded space-y-3">
                      
                      {/* Top status header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-bold text-xs uppercase tracking-wider text-text">
                            {com.campaign_name}
                          </span>
                          <Badge variant="default" type="recessed" className="text-[9px]">
                            {com.channel}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-text-muted">
                            {new Date(com.sent_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).toUpperCase()}
                          </span>
                          <Badge
                            variant={
                              com.status === "clicked"
                                ? "primary"
                                : com.status === "opened" || com.status === "delivered"
                                ? "success"
                                : com.status === "failed"
                                ? "danger"
                                : "default"
                            }
                            type="recessed"
                            className="text-[9px]"
                          >
                            {com.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Message body */}
                      <p className="font-sans text-xs bg-surface border border-text/5 p-2.5 rounded shadow-recessed leading-relaxed text-text-muted">
                        {com.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center font-mono text-xs text-text-muted py-6">
                  NO CAMPAIGNS RECEIVED YET
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
