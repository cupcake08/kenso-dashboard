"use client";
import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DemoBanner } from "@/components/demo-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950">
      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && <DemoBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar collapsed={collapsed} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
