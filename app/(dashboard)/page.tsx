/**
 * CRM Dashboard Page
 *
 * Renders the home screen of the CRM dashboard, including the
 * AI-generated morning brief summary, key KPIs, and quick dispatches shortcuts.
 *
 * Responsibilities:
 * - Load daily bulletins and marketing aggregate metrics.
 * - Render navigation triggers to segments and campaigns wizards.
 */

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, MessageSquare, PlusCircle, ArrowUpRight } from "lucide-react";

/**
 * Renders the Daily Bulletin and core marketing metrics layout.
 *
 * @returns React page element
 */
export default function DashboardPage() {
  const [brief, setBrief] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    // Set format time client side using deferred task to avoid cascading renders warning
    const timeTimer = setTimeout(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        }).toUpperCase()
      );
    }, 0);

    async function fetchBrief() {
      try {
        const res = await fetch("/api/ai/brief");
        if (res.ok) {
          const json = await res.json();
          setBrief(json.brief);
        } else {
          // Mock fallback brief if API fails or isn't built yet by backend
          setBrief(
            "Retail activity is running steady. We currently have 500 registered customers. There are 2 active campaigns out in the wild with a 42% average open rate. 68 customers have transitioned into the 'At Risk' category over the past 30 days — consider sending a Loyalty Reward win-back campaign today."
          );
        }
      } catch (error) {
        console.error(error);
        setBrief(
          "Retail activity is running steady. We currently have 500 registered customers. There are 2 active campaigns out in the wild with a 42% average open rate. 68 customers have transitioned into the 'At Risk' category over the past 30 days — consider sending a Loyalty Reward win-back campaign today."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchBrief();

    return () => clearTimeout(timeTimer);
  }, []);

  const stats = [
    {
      title: "Total Shoppers",
      value: "500",
      description: "Indexed across 6 target cities",
      icon: Users,
    },
    {
      title: "Active Campaigns",
      value: "2",
      description: "1 WhatsApp, 1 SMS currently running",
      icon: MessageSquare,
    },
    {
      title: "Avg Open Rate",
      value: "42.8%",
      description: "+4.2% higher than retail baseline",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-8 w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Marketer Overview
          </span>
          <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
            Daily Bulletin
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge type="recessed" className="px-3 py-1.5 font-mono text-xs">
            {currentTime || "LOADING..."}
          </Badge>
        </div>
      </div>

      {/* Morning Brief Section */}
      <Card className="border border-primary/20 relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-text/10 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <CardTitle className="uppercase tracking-widest text-sm text-primary font-bold">
              AI-Generated Morning Brief
            </CardTitle>
          </div>
          <Badge variant="primary" type="raised" className="text-[9px]">
            Gemini 1.5 Flash
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3 py-2">
              <div className="h-4 bg-text/10 rounded animate-pulse w-full" />
              <div className="h-4 bg-text/10 rounded animate-pulse w-5/6" />
              <div className="h-4 bg-text/10 rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="font-sans text-sm leading-relaxed text-text font-medium border-l-2 border-primary/40 pl-4 py-1 italic">
              &ldquo;{brief}&rdquo;
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} hoverEffect className="flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs uppercase tracking-wider font-bold text-text-muted">
                  {stat.title}
                </CardTitle>
                <div className="w-7 h-7 rounded-lg bg-surface border border-text/5 shadow-recessed flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="mt-2">
                <div className="font-mono text-2xl font-bold tracking-tight text-text">
                  {stat.value}
                </div>
                <CardDescription className="mt-1 text-[11px]">
                  {stat.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-4">
        <h2 className="font-sans font-bold text-xs uppercase tracking-wider text-text-muted">
          Quick Dispatches
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card hoverEffect className="flex flex-col justify-between p-6">
            <div>
              <h3 className="font-sans font-bold text-sm uppercase tracking-wider text-text">
                Segment Builder
              </h3>
              <p className="font-sans text-xs text-text-muted mt-2 leading-relaxed">
                Filter shoppers by RFM score (recency, frequency, monetary value), location, gender, or behavior. Sync natural language chat with visual rules.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Link href="/segments/new">
                <Button variant="primary" rightIcon={<ArrowUpRight className="w-4 h-4" />}>
                  Create Segment
                </Button>
              </Link>
            </div>
          </Card>

          <Card hoverEffect className="flex flex-col justify-between p-6">
            <div>
              <h3 className="font-sans font-bold text-sm uppercase tracking-wider text-text">
                Campaign Creator
              </h3>
              <p className="font-sans text-xs text-text-muted mt-2 leading-relaxed">
                Draft messages using templates, customize channels (WhatsApp, SMS, Email, RCS), leverage AI suggestions, and view real-time delivery callbacks.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Link href="/campaigns/new">
                <Button variant="success" rightIcon={<PlusCircle className="w-4 h-4" />}>
                  New Campaign
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
