/**
 * Customer Profile Page
 *
 * Renders the detailed customer file, including purchase timelines,
 * targeted campaigns, engagement status logs, and AI shopper summaries.
 *
 * Responsibilities:
 * - Load specific customer profiles and aggregate metrics.
 * - Render structured order logs and campaign cards.
 * - Handle visual feedback states for communications.
 */

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerProfile, Order, Communication } from "@/types";
import { MOCK_PROFILES } from "@/lib/mockData";
import { Sparkles, Calendar, ArrowLeft, ShoppingBag, Send, AlertTriangle, Check, CheckCheck, XCircle } from "lucide-react";

/**
 * Customer Profile screen featuring order history and campaign receipts.
 *
 * @returns React page element
 */
export default function CustomerProfilePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
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
      } catch (error) {
        console.error("API Profile fetch failed, falling back to mock", error);
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

  const renderStatusTicks = (status: string) => {
    switch (status) {
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
              <div>PHONE: <span className="text-text font-bold">{profile.phone || "N/A"}</span></div>
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
                &ldquo;{profile.ai_summary || "Steady customer behavior"}&rdquo;
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
                  {profile.orders.map((order: Order, idx: number) => (
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
                                {order.items.map((it: { name: string; qty: number }, i: number) => (
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
                  {profile.communications.map((com: Communication, idx: number) => (
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
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-text-muted mr-1 font-bold uppercase">{com.status}</span>
                            <div className="w-7 h-7 rounded bg-surface border border-text/5 shadow-recessed flex items-center justify-center">
                              {renderStatusTicks(com.status)}
                            </div>
                          </div>
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
