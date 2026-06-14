import React from "react";
import { Card } from "@/components/ui/card";

/**
 * Dashboard-wide Loading Skeleton Page
 *
 * Rendered by Next.js automatically during route transitions
 * between dashboard tabs (Brief, Customers, Segments, Campaigns).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8 w-full animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-3 bg-text/10 w-24 rounded font-mono" />
        <div className="h-8 bg-text/10 w-64 rounded" />
      </div>

      {/* Bento Grid Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="flex flex-col justify-between p-6">
            <div className="h-3.5 bg-text/10 w-1/3 rounded" />
            <div className="h-7 bg-text/10 w-1/2 rounded mt-3" />
            <div className="h-3 bg-text/5 w-2/3 rounded mt-2" />
          </Card>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <Card className="p-6 space-y-4">
        <div className="h-4 bg-text/10 w-1/4 rounded" />
        <div className="space-y-3 pt-2">
          <div className="h-3.5 bg-text/10 w-full rounded" />
          <div className="h-3.5 bg-text/10 w-11/12 rounded" />
          <div className="h-3.5 bg-text/10 w-4/5 rounded" />
        </div>
      </Card>
    </div>
  );
}
