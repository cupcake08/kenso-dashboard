"use client";
import Image from "next/image";
import { Menu } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

interface TopbarProps {
  /** Reserved for desktop collapsed state (currently unused in the Topbar body). */
  collapsed: boolean;
  /** Mobile-only: opens the sidebar drawer. Button hidden at md and up. */
  onMobileMenuToggle: () => void;
}

export function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) return;
      return onAuthStateChanged(auth, setUser);
    });
  }, []);

  const name = user?.displayName ?? "User";
  const initial = user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      {/* Left: mobile hamburger + compact logo (logo also hidden on desktop) */}
      <div className="flex items-center gap-2.5 md:gap-0">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMobileMenuToggle}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -ml-1"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="md:hidden flex items-center gap-2">
          <Image src="/logo.png" alt="KnownSense.AI" width={24} height={24} />
          <span className="text-sm font-bold text-foreground tracking-tight">KnownSense.AI</span>
        </div>
      </div>

      {/* Right: user avatar + name (name hidden below sm) */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
          {initial}
        </div>
        <p className="text-sm font-medium text-foreground hidden sm:block">{name}</p>
      </div>
    </header>
  );
}
