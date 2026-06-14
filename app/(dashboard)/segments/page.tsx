/**
 * Segments List Page
 *
 * Displays all saved segment definitions, target shopper counts,
 * and parameters. Highlights options to launch campaigns directly.
 *
 * Responsibilities:
 * - Load saved shopper segment rules.
 * - Render parameter badges representing SQL rules.
 * - Manage redirection to Campaign Composer with target parameters.
 */

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, PlusCircle, ArrowRight, Filter } from "lucide-react";
import { Segment, FilterRule } from "@/types";



/**
 * Ghost Skeleton Loader representing placeholder segment cards during load.
 */
function SegmentsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-6 space-y-6 select-none flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Layers className="w-4 h-4 text-text/10 animate-pulse" />
                <div className="h-5 w-1/2 bg-text/10 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-text/10 rounded-full animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-text/10 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-text/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-text/5">
            <div className="h-3 w-1/4 bg-text/10 rounded animate-pulse" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[1, 2].map((j) => (
                <div key={j} className="h-6 w-16 bg-text/10 rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 mt-2 border-t border-text/5">
            <div className="h-3 w-20 bg-text/10 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-12 bg-text/10 rounded animate-pulse" />
              <div className="h-8 w-20 bg-text/10 rounded animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Lists current shopper segments and their details.
 *
 * @returns React page element
 */
export default function SegmentsListPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSegments() {
      try {
        const res = await fetch("/api/segments");
        if (res.ok) {
          const json = await res.json();
          if (json.data) setSegments(json.data);
        }
      } catch (error) {
        console.error("Failed fetching live segments, falling back to mock", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSegments();
  }, []);

  const getRuleSummaryString = (rule: FilterRule) => {
    const fieldMapping: Record<string, string> = {
      rfm_recency_days: "Recency",
      rfm_frequency: "Frequency",
      rfm_monetary: "Monetary",
      rfm_score: "RFM Score",
      rfm_segment: "RFM Segment",
      city: "City",
      gender: "Gender",
    };

    const opMapping: Record<string, string> = {
      eq: "=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
      in: "in",
    };

    const f = fieldMapping[rule.field] || rule.field;
    const o = opMapping[rule.op] || rule.op;
    let v = rule.value;
    if (Array.isArray(v)) {
      v = `[${v.join(", ")}]`;
    }
    return `${f} ${o} ${v}`;
  };

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            Audience Control
          </span>
          <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
            Shopper Segments
          </h1>
        </div>
        <Link href="/segments/new">
          <Button variant="success" leftIcon={<PlusCircle className="w-4.5 h-4.5" />}>
            Create Segment
          </Button>
        </Link>
      </div>

      {/* Segment Grid */}
      {loading ? (
        <SegmentsSkeleton />
      ) : segments.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-4">
          <Layers className="w-12 h-12 text-text-muted opacity-40 animate-pulse" />
          <div>
            <h3 className="font-sans font-bold text-sm uppercase tracking-wider text-text">No Segments Created</h3>
            <p className="text-xs text-text-muted mt-1">Use the visual rules builder or chat-based builder to define custom shopper cohorts.</p>
          </div>
          <Link href="/segments/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4.5 h-4.5" />}>
              Create Segment
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {segments.map((segment) => (
            <Card key={segment.id} hoverEffect className="flex flex-col justify-between">
              <CardHeader className="border-b border-text/10 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <CardTitle className="uppercase tracking-wide text-sm font-bold">
                      {segment.name}
                    </CardTitle>
                  </div>
                  <Badge variant="primary" type="recessed" className="font-mono text-[10px]">
                    {segment.customer_count} Shoppers
                  </Badge>
                </div>
                <CardDescription className="pt-2 leading-relaxed text-xs">
                  {segment.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                    <Filter className="w-3 h-3 text-text-muted" /> Filter Parameters:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {segment.filter_rules?.rules?.map((rule: FilterRule, i: number) => (
                      <Badge key={i} variant="default" type="recessed" className="font-mono text-[9px] lowercase tracking-normal bg-text/[0.02] border-text/5 px-2">
                        {getRuleSummaryString(rule)}
                      </Badge>
                    )) || <span className="text-xs italic text-text-muted">No rules defined</span>}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center bg-surface/50 border-t border-text/10 pt-3 mt-4">
                <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider">
                  Created: {new Date(segment.created_at).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <Link href={`/segments/new?edit=${segment.id}`}>
                    <Button size="sm" variant="default" className="text-xs">
                      Edit
                    </Button>
                  </Link>
                  <Link href={`/campaigns/new?segment=${segment.id}`}>
                    <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Dispatch
                    </Button>
                  </Link>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
