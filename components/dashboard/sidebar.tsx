"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, CreditCard, Settings, ChevronLeft, ChevronRight, BarChart3, X, Shield, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";

const navItems = [
  { href: "/dashboard/devices", icon: Mic, label: "Devices" },
  { href: "/dashboard/analysis", icon: BarChart3, label: "Analysis" },
  { href: "/dashboard/usage", icon: CreditCard, label: "Usage" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

const adminItems = [
  { href: "/dashboard/admin/billing", icon: Shield, label: "Billing Admin" },
  { href: "/dashboard/admin/topups",  icon: Coins,  label: "Top-ups" },
];

interface SidebarProps {
  /** Desktop-only: collapsed/expanded state. Ignored on mobile. */
  collapsed: boolean;
  onToggle: () => void;
  /** Mobile-only: drawer open state. Ignored on desktop. */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const { planName, isLoading: subLoading } = useSubscription();

  // Check for admin key in localStorage
  useEffect(() => {
    setIsAdmin(!!localStorage.getItem("admin-api-key"));
  }, []);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Shared nav list — one source of truth, rendered inside both modes.
  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems;
  const navList = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-1 p-2">
      {allItems.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium transition-colors duration-150",
              // Mobile drawer always shows labels + generous hit target.
              // Desktop follows collapsed state.
              "md:data-[collapsed=true]:justify-center md:data-[collapsed=true]:p-2.5",
              "gap-3 px-3 py-3 min-h-[44px]",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            data-collapsed={collapsed ? "true" : "false"}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap",
                // Only hide the label on desktop when collapsed.
                collapsed && "md:hidden"
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* ────── Desktop sidebar (md and up) ────── */}
      <motion.aside
        layout
        className="hidden md:flex flex-col border-r border-border bg-background overflow-hidden"
        animate={{ width: collapsed ? 64 : 224 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className={cn("flex h-14 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
          <Image src="/logo.png" alt="KnownSense.AI" width={28} height={28} className="flex-shrink-0" />
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 min-w-0"
            >
              <span className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">
                KnownSense.AI
              </span>
              {!subLoading && (
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                  {planName}
                </span>
              )}
            </motion.div>
          )}
        </div>
        {navList()}
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-12 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </motion.aside>

      {/* ────── Mobile drawer (below md) ────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close menu"
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onMobileClose}
            />
            {/* Drawer panel */}
            <motion.aside
              className="md:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82vw] flex-col border-r border-border bg-background shadow-2xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              role="dialog"
              aria-modal="true"
              aria-label="Main navigation"
            >
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2.5">
                  <Image src="/logo.png" alt="KnownSense.AI" width={28} height={28} />
                  <span className="text-sm font-bold text-foreground tracking-tight">KnownSense.AI</span>
                  {!subLoading && (
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {planName}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={onMobileClose}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {navList(onMobileClose)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
