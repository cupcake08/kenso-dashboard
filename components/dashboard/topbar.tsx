"use client";
import { Bell, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TopbarProps {
  collapsed: boolean;
}

export function Topbar({ collapsed }: TopbarProps) {
  const router = useRouter();
  const user = auth?.currentUser ?? null;

  async function handleSignOut() {
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
    router.push("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="text-sm text-muted-foreground">
        Enterprise Dashboard
      </div>

      <div className="flex items-center gap-4">
        <button aria-label="Notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.displayName ?? "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
