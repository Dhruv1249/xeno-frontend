/**
 * Dashboard Sidebar Layout
 *
 * Provides the global navigation layout, including the sidebar with links
 * to pages (Brief, Customers, Segments, Campaigns) and the top bar branding.
 *
 * Responsibilities:
 * - Render navigation elements and track current active pathname.
 * - Enforce full-screen neumorphic surface containment.
 */

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Layers, Send } from "lucide-react";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

/**
 * Main dashboard layout wrapping all child views with sidebar.
 *
 * @param props SidebarLayoutProps
 * @returns React page layout element
 */
export default function DashboardLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { name: "Brief", href: "/", icon: LayoutDashboard },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Segments", href: "/segments", icon: Layers },
    { name: "Campaigns", href: "/campaigns", icon: Send },
  ];

  return (
    <div className="flex h-screen w-screen bg-surface overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-text/10 bg-surface flex flex-col h-full select-none">
        {/* Branding Area */}
        <div className="h-16 flex items-center px-6 border-b border-text/10">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-sans font-bold text-lg tracking-widest text-primary uppercase">
              XENO // CRM
            </span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Check if active: exact match for /, prefix match for other routes
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-sans font-bold text-xs uppercase tracking-wider transition-all duration-150 border
                  ${
                    isActive
                      ? "text-primary border-primary/30 shadow-recessed bg-surface"
                      : "text-text-muted border-transparent hover:text-text hover:border-text/5 hover:shadow-extruded"
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary animate-pulse" : "text-text-muted"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-text/10">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface border border-text/5 shadow-recessed">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-ping" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
              Simulator Online
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-surface overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-text/10 px-8 flex items-center justify-between shrink-0 bg-surface select-none">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
              SYSTEM // READY
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-text-muted">MARKETER.SESSION</span>
            <div className="w-8 h-8 rounded-lg bg-surface border border-text/10 shadow-extruded flex items-center justify-center font-bold text-xs">
              M
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-surface">
          {children}
        </div>
      </main>
    </div>
  );
}
