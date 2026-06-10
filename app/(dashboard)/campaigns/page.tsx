/**
 * Campaigns List Page
 *
 * Displays all marketing campaign dispatches, their current statuses
 * (draft, scheduled, running, completed), and high-level delivery summaries.
 *
 * Responsibilities:
 * - Load campaigns from history.
 * - Render stats deltas and summaries.
 * - Direct users to Analytics and Creator wizards.
 */

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, AlertCircle, PlusCircle, BarChart3 } from "lucide-react";
import { Campaign } from "@/types";
import { MOCK_CAMPAIGNS } from "@/lib/mockData";

/**
 * Lists campaign records and statuses.
 *
 * @returns React page element
 */
export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) {
          const json = await res.json();
          if (json.data) setCampaigns(json.data);
        }
      } catch (error) {
        console.error("Failed fetching live campaigns, falling back to mock", error);
      }
    }
    fetchCampaigns();
  }, []);

  const getChannelLabel = (ch: string) => {
    const channelMap: Record<string, string> = {
      whatsapp: "WhatsApp",
      sms: "SMS",
      email: "Email",
      rcs: "RCS",
    };
    return channelMap[ch] || ch;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" type="recessed">completed</Badge>;
      case "running":
        return <Badge variant="primary" type="recessed" className="animate-pulse">running</Badge>;
      case "scheduled":
        return <Badge variant="warning" type="recessed">scheduled</Badge>;
      default:
        return <Badge variant="default" type="recessed">draft</Badge>;
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Campaign Dispatcher
          </span>
          <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
            Campaigns History
          </h1>
        </div>
        <Link href="/campaigns/new">
          <Button variant="success" leftIcon={<PlusCircle className="w-4.5 h-4.5" />}>
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Campaigns list */}
      <div className="space-y-6">
        {campaigns.map((camp) => (
          <Card key={camp.id} hoverEffect className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-text/10 pb-4">
              {/* Title & Target */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-sans font-bold text-sm uppercase tracking-wider text-text">
                    {camp.name}
                  </h2>
                  {getStatusBadge(camp.status)}
                </div>
                <p className="text-xs text-text-muted">
                  Target Audience: <span className="font-bold text-primary">{camp.segment_name}</span>
                </p>
              </div>

              {/* Channel & Date */}
              <div className="flex items-center gap-4 text-right self-start md:self-auto">
                <div className="text-left md:text-right font-mono text-[10px] text-text-muted">
                  <div>DISPATCH: <span className="text-text uppercase font-bold">{getChannelLabel(camp.channel)}</span></div>
                  <div>CREATED: {new Date(camp.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Campaign Metrics / Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 items-center">
              {camp.status === "completed" || camp.status === "running" ? (
                <>
                  {/* Stats columns */}
                  <div className="md:col-span-2 grid grid-cols-4 gap-2 select-none">
                    <div className="text-center bg-surface border border-text/5 p-2 rounded shadow-recessed">
                      <div className="text-[9px] uppercase tracking-wider text-text-muted">Sent</div>
                      <div className="font-mono text-sm font-bold text-text mt-0.5">{camp.sent_count}</div>
                    </div>
                    <div className="text-center bg-surface border border-text/5 p-2 rounded shadow-recessed">
                      <div className="text-[9px] uppercase tracking-wider text-text-muted">Open %</div>
                      <div className="font-mono text-sm font-bold text-success mt-0.5">
                        {camp.sent_count ? Math.round((camp.open_count / camp.sent_count) * 100) : 0}%
                      </div>
                    </div>
                    <div className="text-center bg-surface border border-text/5 p-2 rounded shadow-recessed">
                      <div className="text-[9px] uppercase tracking-wider text-text-muted">Click %</div>
                      <div className="font-mono text-sm font-bold text-primary mt-0.5">
                        {camp.sent_count ? Math.round((camp.click_count / camp.sent_count) * 100) : 0}%
                      </div>
                    </div>
                    <div className="text-center bg-surface border border-text/5 p-2 rounded shadow-recessed">
                      <div className="text-[9px] uppercase tracking-wider text-text-muted">Fail</div>
                      <div className="font-mono text-sm font-bold text-danger mt-0.5">{camp.failed_count}</div>
                    </div>
                  </div>

                  {/* AI post campaign summary */}
                  <div className="md:col-span-2 bg-surface border border-text/5 p-3 rounded-lg shadow-recessed flex items-start gap-2 relative overflow-hidden">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-pulse" />
                    <p className="font-sans text-[11px] text-text-muted leading-relaxed italic">
                      &ldquo;{camp.ai_summary || "Summarizing campaign results..."}&rdquo;
                    </p>
                  </div>
                </>
              ) : (
                <div className="md:col-span-4 bg-surface border border-text/5 p-4 rounded-lg shadow-recessed flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span>This campaign is currently a draft and has not been dispatched.</span>
                  </div>
                  <Link href={`/campaigns/new?draft=${camp.id}`}>
                    <Button variant="primary" size="sm" rightIcon={<Send className="w-3.5 h-3.5" />}>
                      Resume Draft
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Footer action to analytics page */}
            {(camp.status === "completed" || camp.status === "running") && (
              <div className="flex justify-end mt-4 pt-3 border-t border-text/5">
                <Link href={`/campaigns/${camp.id}`}>
                  <Button variant="default" size="sm" rightIcon={<BarChart3 className="w-3.5 h-3.5" />}>
                    View Analytics &amp; Live Feed
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
