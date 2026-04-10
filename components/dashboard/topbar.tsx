"use client";
import { auth } from "@/lib/firebase";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

interface TopbarProps {
  collapsed: boolean;
}

export function Topbar({ collapsed }: TopbarProps) {
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
    <header className="flex h-14 items-center justify-end border-b border-border bg-background px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
          {initial}
        </div>
        <p className="text-sm font-medium text-foreground hidden sm:block">{name}</p>
      </div>
    </header>
  );
}
