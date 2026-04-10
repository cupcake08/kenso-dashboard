"use client";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DemoBanner } from "@/components/demo-banner";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { getSubscriptionStatus } from "@/lib/api";

type PlanState = "active" | "grace" | "expired" | "loading";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [planState, setPlanState] = useState<PlanState>("loading");
  const [graceDaysLeft, setGraceDaysLeft] = useState(0);
  const [dismissedGrace, setDismissedGrace] = useState(false);
  const pathname = usePathname();

  // Check subscription state on mount
  const checkPlan = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setPlanState("active");
      return;
    }
    try {
      const status = await getSubscriptionStatus();
      if (!status) { setPlanState("active"); return; }
      if (status.hard_blocked) {
        setPlanState("expired");
      } else if (status.in_grace_period) {
        setGraceDaysLeft(status.grace_days_remaining);
        setPlanState("grace");
      } else {
        setPlanState("active");
      }
    } catch {
      setPlanState("active"); // Don't block on errors
    }
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      setPlanState("active");
      return;
    }
    let unsub: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) { setPlanState("active"); return; }
      unsub = onAuthStateChanged(auth, (user) => {
        if (!user) { setPlanState("active"); return; }
        checkPlan();
      });
    });
    return () => unsub?.();
  }, [checkPlan]);

  // Reset grace dismissal on navigation
  useEffect(() => {
    setDismissedGrace(false);
  }, [pathname]);

  // Hard-blocked: all paths except usage/settings (so they can recharge)
  const allowedWhenBlocked = ["/dashboard/usage", "/dashboard/settings"];
  const isBlocked = planState === "expired" && !allowedWhenBlocked.some((p) => pathname.startsWith(p));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && <DemoBanner />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar collapsed={collapsed} />
          <main className="flex-1 overflow-y-auto p-6 relative">
            <div className="absolute inset-0 bg-dot-pattern opacity-[0.15] pointer-events-none" />

            {/* Grace period modal overlay */}
            <AnimatePresence>
              {planState === "grace" && !dismissedGrace && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="bg-background rounded-2xl border border-border p-8 max-w-sm mx-4 text-center shadow-2xl"
                  >
                    <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-foreground mb-2">Plan Expired</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      {graceDaysLeft > 0
                        ? `You have ${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""} to recharge before service is suspended.`
                        : "Recharge now to avoid service interruption."}
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setDismissedGrace(true)}>
                        Continue
                      </Button>
                      <Button className="flex-1" asChild>
                        <Link href="/dashboard/usage">Recharge Now</Link>
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expired hard block overlay */}
            {isBlocked ? (
              <div className="relative flex flex-col items-center justify-center h-full gap-4 text-center">
                <AlertTriangle className="h-10 w-10 text-red-400/60" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Service Paused</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your plan has expired. Recharge to resume live listening, recordings, and analysis.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/dashboard/usage">Recharge Now</Link>
                </Button>
              </div>
            ) : (
              <div className="relative">{children}</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
