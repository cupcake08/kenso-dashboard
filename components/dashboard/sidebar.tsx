"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Mic, CreditCard, Settings, ChevronLeft, ChevronRight, BarChart3, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/devices", icon: Mic, label: "Devices" },
  { href: "/dashboard/operating-hours", icon: Clock, label: "Hours" },
  { href: "/dashboard/analysis", icon: BarChart3, label: "Analysis" },
  { href: "/dashboard/usage", icon: CreditCard, label: "Usage" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      layout
      className="flex flex-col border-r border-border bg-background overflow-hidden"
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Logo */}
      <div className={cn("flex h-14 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
        <Image src="/logo.png" alt="KnownSense.AI" width={28} height={28} className="flex-shrink-0" />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap"
          >
            KnownSense.AI
          </motion.span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors duration-150",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex h-12 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </motion.aside>
  );
}
