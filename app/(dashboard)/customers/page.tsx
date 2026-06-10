/**
 * Shopper Matrix & RFM Analytics Page
 *
 * Renders the customers database dashboard including the interactive RFM Scatter
 * Matrix (allowing segment generation on click), search parameters, and tabular details.
 *
 * Responsibilities:
 * - Load indexed shopper records and active segment types.
 * - Render Recharts interactive scatter charts.
 * - Handle filters and route actions to Profile views.
 */

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Eye, RefreshCw } from "lucide-react";
import { Customer } from "@/types";
import { MOCK_CUSTOMERS } from "@/lib/mockData";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  TooltipContentProps,
} from "recharts";

const SEGMENT_COLORS: Record<string, string> = {
  Champion: "#006666", // Teal
  Loyal: "#00A63D",    // Green
  "At Risk": "#FE9900", // Yellow
  Lost: "#FF2157",      // Red
  New: "#8B5CF6",       // Purple
};

interface ScatterPoint {
  name: string;
  recency: number;
  frequency: number;
  monetary: number;
  segment: string;
}

/**
 * Custom Tooltip Component for Recharts Scatter plot.
 * Declared outside the render function to avoid recreation.
 */
const CustomTooltip: React.FC<Partial<TooltipContentProps<number, string>>> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ScatterPoint;
    return (
      <div className="bg-surface border border-text/15 p-3 rounded-lg shadow-extruded font-sans text-xs">
        <p className="font-bold uppercase tracking-wider text-text mb-1.5">{data.name}</p>
        <p className="text-text-muted">
          Segment:{" "}
          <span className="font-bold" style={{ color: SEGMENT_COLORS[data.segment] }}>
            {data.segment}
          </span>
        </p>
        <p className="text-text-muted">
          Recency: <span className="font-mono">{data.recency} days</span>
        </p>
        <p className="text-text-muted">
          Frequency: <span className="font-mono">{data.frequency} orders</span>
        </p>
        <p className="text-text-muted">
          Monetary: <span className="font-mono">₹{data.monetary}</span>
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Renders the Shopper Directory with RFM Heatmap.
 *
 * @returns React page element
 */
export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("All");
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Avoid synchronous setState warn in React 19 by deferring client mount state
    const timer = setTimeout(() => {
      setIsClient(true);
    }, 0);

    async function fetchCustomers() {
      try {
        const res = await fetch("/api/customers");
        if (res.ok) {
          const json = await res.json();
          if (json.data) setCustomers(json.data);
        }
      } catch (error) {
        console.error("Failed fetching live customers, falling back to mock", error);
      }
    }
    fetchCustomers();

    return () => clearTimeout(timer);
  }, []);

  // Filtered List
  const filteredCustomers = customers.filter((customer) => {
    const nameMatch = customer.name.toLowerCase().includes(search.toLowerCase());
    const emailMatch = customer.email.toLowerCase().includes(search.toLowerCase());
    const cityMatch = customer.city.toLowerCase().includes(search.toLowerCase());
    
    const matchesSearch = nameMatch || emailMatch || cityMatch;

    const matchesSegment =
      selectedSegment === "All" || customer.rfm_segment === selectedSegment;

    const matchesCity =
      selectedCity === "All" || customer.city === selectedCity;

    return matchesSearch && matchesSegment && matchesCity;
  });

  // Unique cities for filter dropdown
  const cities = Array.from(new Set(customers.map((c) => c.city)));

  // Prepare RFM Scatter Data
  const scatterData: ScatterPoint[] = customers.map((c) => ({
    name: c.name,
    recency: c.rfm_recency_days ?? 0,
    frequency: c.rfm_frequency ?? 0,
    monetary: Number(c.rfm_monetary) ?? 0,
    segment: c.rfm_segment ?? "Others",
  }));

  const handleClusterClick = (data: unknown) => {
    const point = data as ScatterPoint;
    if (point && point.segment) {
      // Pre-fill a segment based on the segment name clicked
      router.push(`/segments/new?preset=${encodeURIComponent(point.segment)}`);
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
          Shopper Database
        </span>
        <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
          Shoppers &amp; RFM Analytics
        </h1>
      </div>

      {/* RFM Heatmap Plot */}
      <Card>
        <CardHeader className="border-b border-text/10 pb-4">
          <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
            RFM Shopper Matrix
          </CardTitle>
          <CardDescription>
            X-Axis: Recency (Days since last purchase, lower is better). Y-Axis: Frequency (Total orders). Dot Size: Monetary value. Click any dot to build a segment targeting that cohort.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-72 w-full font-mono text-[10px]">
            {isClient ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                  <XAxis
                    type="number"
                    dataKey="recency"
                    name="Recency"
                    unit=" days"
                    stroke="#57534E"
                    tickLine={false}
                    label={{ value: "Recency (Days since last purchase)", position: "insideBottom", offset: -10, fill: "#57534E" }}
                  />
                  <YAxis
                    type="number"
                    dataKey="frequency"
                    name="Frequency"
                    unit=" orders"
                    stroke="#57534E"
                    tickLine={false}
                    label={{ value: "Frequency (Total orders)", angle: -90, position: "insideLeft", offset: 0, fill: "#57534E" }}
                  />
                  <ZAxis type="number" dataKey="monetary" range={[40, 400]} name="Spend" unit=" INR" />
                  <Tooltip cursor={{ strokeDasharray: "3:3" }} content={<CustomTooltip />} />
                  <Scatter name="Shoppers" data={scatterData} onClick={handleClusterClick}>
                    {scatterData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={SEGMENT_COLORS[entry.segment] || "#1E2938"}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center animate-pulse bg-text/5 rounded-lg">
                Loading Matrix...
              </div>
            )}
          </div>

          {/* Segment Legend / Click Filters */}
          <div className="flex flex-wrap items-center gap-4 justify-center mt-4 border-t border-text/5 pt-4">
            <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-text-muted mr-2">
              Filter / Target Segments:
            </span>
            {Object.keys(SEGMENT_COLORS).map((seg) => (
              <button
                key={seg}
                onClick={() => setSelectedSegment(selectedSegment === seg ? "All" : seg)}
                className={`
                  flex items-center gap-2 px-3 py-1 rounded border transition-all text-xs font-bold uppercase tracking-wider cursor-pointer
                  ${
                    selectedSegment === seg
                      ? "shadow-recessed"
                      : "shadow-extruded hover:shadow-extruded-hover"
                  }
                `}
                style={{
                  borderColor: selectedSegment === seg ? SEGMENT_COLORS[seg] : "rgba(0,0,0,0.05)",
                  color: SEGMENT_COLORS[seg],
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[seg] }} />
                <span>{seg}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Database List */}
      <Card>
        <CardHeader className="border-b border-text/10 pb-4">
          <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
            Customer Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-text-muted" />
              </span>
              <input
                type="text"
                placeholder="SEARCH NAME, EMAIL, OR CITY..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface border border-text/10 rounded-lg py-2 pl-9 pr-4 text-xs font-mono tracking-wider shadow-recessed outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* City Filter */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <MapPin className="w-4 h-4 text-text-muted" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-surface border border-text/10 rounded-lg p-2 text-xs font-mono uppercase tracking-wider shadow-extruded cursor-pointer outline-none focus:border-primary"
              >
                <option value="All">ALL CITIES</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city.toUpperCase()}
                  </option>
                ))}
              </select>

              {(selectedSegment !== "All" || selectedCity !== "All" || search !== "") && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setSelectedSegment("All");
                    setSelectedCity("All");
                    setSearch("");
                  }}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-text/10 rounded-lg bg-surface shadow-recessed">
            <table className="min-w-full divide-y divide-text/10 text-left font-sans">
              <thead className="bg-surface/50 font-bold text-[10px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-6 py-3">City</th>
                  <th className="px-6 py-3">Segment</th>
                  <th className="px-6 py-3">Recency / Freq</th>
                  <th className="px-6 py-3 text-right">Monetary Spend</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text/10 text-xs font-medium">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-text/[0.02]">
                      <td className="px-6 py-4">
                        <div className="font-bold text-text">{customer.name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{customer.email}</div>
                      </td>
                      <td className="px-6 py-4 uppercase tracking-wider text-[11px]">
                        {customer.city}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            customer.rfm_segment === "Champion"
                              ? "primary"
                              : customer.rfm_segment === "Loyal"
                              ? "success"
                              : customer.rfm_segment === "At Risk"
                              ? "warning"
                              : customer.rfm_segment === "Lost"
                              ? "danger"
                              : "default"
                          }
                          type="recessed"
                        >
                          {customer.rfm_segment}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px]">
                        {customer.rfm_recency_days}d / {customer.rfm_frequency}x
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">
                        ₹{Number(customer.rfm_monetary).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link href={`/customers/${customer.id}`}>
                          <Button size="sm" variant="default" className="inline-flex">
                            <Eye className="w-3.5 h-3.5 mr-1" /> Profile
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-text-muted font-mono">
                      NO CUSTOMERS MATCH THE FILTER CRITERIA
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
