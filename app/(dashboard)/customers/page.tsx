/**
 * Shopper Matrix & RFM Analytics Page
 *
 * Renders the customers database dashboard including the interactive RFM Scatter
 * Matrix, search parameters, tabular details, CSV Ingest, and Manual Add options.
 *
 * Responsibilities:
 * - Load indexed shopper records and active segment types.
 * - Render Recharts interactive scatter charts.
 * - Support CSV bulk ingestion and manual shoppers profiling.
 */

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Eye, RefreshCw, Plus, Upload } from "lucide-react";
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Legend,
  CartesianGrid,
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
 * Renders the Shopper Directory with RFM Heatmap, CSV upload, and manual entry forms.
 */
export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("All");
  const [selectedCity, setSelectedCity] = useState<string>("All");
  // Table page — only the current 50 rows
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Separate 500-record sample used only for charts
  const [chartCustomers, setChartCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [chartType, setChartType] = useState<"rfm" | "city" | "segment">("rfm");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 50;
  const totalPages = Math.ceil(total / itemsPerPage);

  // Modal Display Toggles
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Manual Customer Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCity, setNewCity] = useState("Mumbai");
  const [newGender, setNewGender] = useState("Female");
  const [initialOrderAmount, setInitialOrderAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Upload State
  const [customersFile, setCustomersFile] = useState<File | null>(null);
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const CITIES_LIST = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune"];

  // Debounce search input so we don't fire a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 0 whenever filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, selectedSegment, selectedCity]);

  // Fetch the current page from the server whenever page or filters change
  useEffect(() => {
    setIsClient(true);
    async function fetchPage() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(itemsPerPage),
          offset: String(currentPage * itemsPerPage),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (selectedSegment !== "All") params.set("rfmSegment", selectedSegment);
        if (selectedCity !== "All") params.set("city", selectedCity);

        const res = await fetch(`/api/customers?${params}`);
        if (res.ok) {
          const json = await res.json();
          setCustomers(json.data ?? []);
          setTotal(json.total ?? 0);
        }
      } catch (err) {
        console.error("Failed fetching customers", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPage();
  }, [currentPage, debouncedSearch, selectedSegment, selectedCity]);

  // Fetch a fixed 500-customer sample for the charts — independent of table pagination.
  // 500 scatter points gives a good distribution read without overloading the browser.
  useEffect(() => {
    async function fetchChartSample() {
      try {
        const res = await fetch("/api/customers?limit=500");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.length) setChartCustomers(json.data);
        }
      } catch (err) {
        console.error("Chart sample fetch failed", err);
      }
    }
    fetchChartSample();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) {
      alert("Name and Email are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone || undefined,
          city: newCity,
          gender: newGender,
          initial_order_amount: initialOrderAmount || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setCustomers((prev) => [json.data, ...prev]);
        setShowAddModal(false);
        setNewName("");
        setNewEmail("");
        setNewPhone("");
        setInitialOrderAmount(0);
        alert("Customer successfully added!");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add customer");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customersFile || !ordersFile) {
      alert("Both customers and orders files are required");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("customers", customersFile);
      formData.append("orders", ordersFile);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert("Data successfully imported!");
        setShowUploadModal(false);
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Ingest failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading files");
    } finally {
      setIsUploading(false);
    }
  };

  // Chart scatter data uses the 500-sample, not the paginated table data
  const scatterData: ScatterPoint[] = chartCustomers.map((c) => ({
    name: c.name,
    recency: c.rfm_recency_days ?? 0,
    frequency: c.rfm_frequency ?? 0,
    monetary: Number(c.rfm_monetary) ?? 0,
    segment: c.rfm_segment ?? "Others",
  }));

  const handleClusterClick = (data: unknown) => {
    const point = data as ScatterPoint;
    if (point && point.segment) {
      router.push(`/segments/new?preset=${encodeURIComponent(point.segment)}`);
    }
  };

  return (
    <>
      <div className="space-y-8 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
              Shopper Database
            </span>
            <h1 className="font-sans font-bold text-3xl uppercase tracking-wider text-text mt-1">
              Shoppers &amp; RFM Analytics
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setShowUploadModal(true)}
              className="cursor-pointer"
            >
              Import CSV
            </Button>
            <Button
              variant="success"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
              className="cursor-pointer"
            >
              Add Customer
            </Button>
          </div>
        </div>

        {/* Dynamic Heatmap/Distributions Plot */}
        <Card>
          <CardHeader className="border-b border-text/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="uppercase tracking-widest text-xs font-bold text-primary">
                {chartType === "rfm"
                  ? "RFM Shopper Matrix"
                  : chartType === "city"
                  ? "City Distribution Matrix"
                  : "Segment Cohorts Distribution"}
              </CardTitle>
              <CardDescription className="text-[11px] mt-1">
                {chartType === "rfm"
                  ? "X-Axis: Recency (Days since last purchase). Y-Axis: Frequency (Total orders). Dot Size: Spend volume. Click dot to build segments."
                  : chartType === "city"
                  ? "Total shopper counts segmented by regional Indian target cities."
                  : "Percentage composition of database shopper profiles categorized by RFM segments."}
              </CardDescription>
            </div>

            {/* Chart Type Toggle */}
            <div className="shrink-0">
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as any)}
                className="bg-surface border border-text/10 rounded px-2.5 py-1 text-xs font-mono uppercase tracking-wider shadow-extruded cursor-pointer outline-none focus:border-primary"
              >
                <option value="rfm">RFM SCATTER MATRIX</option>
                <option value="city">CITY BAR CHART</option>
                <option value="segment">SEGMENT PIE CHART</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-72 w-full font-mono text-[10px]">
              {isClient ? (
                chartType === "rfm" ? (
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
                ) : chartType === "city" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={
                      CITIES_LIST.map((city) => ({
                        name: city.toUpperCase(),
                        shoppers: chartCustomers.filter((c) => c.city === city).length,
                      }))
                    } margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                      <XAxis dataKey="name" stroke="#57534E" tickLine={false} />
                      <YAxis stroke="#57534E" tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="shoppers" fill="#006666" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          ["Champion", "Loyal", "At Risk", "Lost", "New"].map((seg) => ({
                            name: seg.toUpperCase(),
                            value: chartCustomers.filter((c) => c.rfm_segment === seg).length,
                          }))
                        }
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : "0"}%`}
                        outerRadius={85}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {["Champion", "Loyal", "At Risk", "Lost", "New"].map((seg, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={SEGMENT_COLORS[seg] || "#1E2938"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )
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
                  {CITIES_LIST.map((city) => (
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-text-muted font-mono animate-pulse">
                        LOADING SHOPPERS...
                      </td>
                    </tr>
                  ) : customers.length > 0 ? (
                    customers.map((customer) => (
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

            {/* Pagination Controls */}
            {total > 0 && (
              <div className="flex items-center justify-between border-t border-text/10 pt-4 mt-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  Showing {currentPage * itemsPerPage + 1}–{Math.min((currentPage + 1) * itemsPerPage, total)} of {total.toLocaleString()} Shoppers
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={currentPage === 0 || isLoading}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="shadow-extruded hover:shadow-recessed disabled:opacity-40 disabled:pointer-events-none transition-all text-xs cursor-pointer"
                  >
                    Previous
                  </Button>
                  <span className="font-mono text-xs text-text px-2">
                    {currentPage + 1} / {totalPages || 1}
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={currentPage + 1 >= totalPages || isLoading}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="shadow-extruded hover:shadow-recessed disabled:opacity-40 disabled:pointer-events-none transition-all text-xs cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-text/10 rounded-xl shadow-extruded max-w-md w-full p-6 space-y-4">
            <h3 className="font-sans font-bold text-sm uppercase tracking-wider text-text">Add Customer Profile</h3>
            <form onSubmit={handleAddCustomer} className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="E.G. AARAV SHARMA"
                  className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="AARAV.SHARMA@EMAIL.COM"
                  className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Phone</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 99999 88888"
                  className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase">City</label>
                  <select
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                  >
                    {CITIES_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                  >
                    <option value="Female">FEMALE</option>
                    <option value="Male">MALE</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Initial Order Amount (₹)</label>
                <input
                  type="number"
                  value={initialOrderAmount || ""}
                  onChange={(e) => setInitialOrderAmount(Number(e.target.value))}
                  placeholder="0 (OPTIONAL)"
                  className="w-full bg-surface border border-text/10 rounded-lg p-2.5 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-text/5">
                <Button type="button" variant="default" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" variant="success" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Add Shopper"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-text/10 rounded-xl shadow-extruded max-w-md w-full p-6 space-y-4">
            <h3 className="font-sans font-bold text-sm uppercase tracking-wider text-text">Ingest CSV Datasets</h3>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              Provide `customers.csv` and `orders.csv` containing shopper files to run bulk ingestion.
            </p>
            <div className="bg-surface border border-text/5 p-3 rounded-lg shadow-recessed flex justify-between items-center gap-4 text-[10px] font-mono">
              <span className="text-text-muted uppercase tracking-wider">Example Templates:</span>
              <div className="flex gap-2">
                <a
                  href="/customers_example.csv"
                  download="customers_example.csv"
                  className="text-primary hover:underline font-bold"
                >
                  CUSTOMERS.CSV
                </a>
                <span className="text-text-muted">|</span>
                <a
                  href="/orders_example.csv"
                  download="orders_example.csv"
                  className="text-primary hover:underline font-bold"
                >
                  ORDERS.CSV
                </a>
              </div>
            </div>
            <form onSubmit={handleUploadCsv} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Customers CSV *</label>
                <input
                  type="file"
                  required
                  accept=".csv"
                  onChange={(e) => setCustomersFile(e.target.files?.[0] || null)}
                  className="w-full bg-surface border border-text/10 rounded-lg p-2 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">Orders CSV *</label>
                <input
                  type="file"
                  required
                  accept=".csv"
                  onChange={(e) => setOrdersFile(e.target.files?.[0] || null)}
                  className="w-full bg-surface border border-text/10 rounded-lg p-2 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-text/5">
                <Button type="button" variant="default" size="sm" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Import Files"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
