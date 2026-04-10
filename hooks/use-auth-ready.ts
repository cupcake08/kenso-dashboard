"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import type { User } from "firebase/auth";

/**
 * Waits for Firebase Auth to initialize before returning the user.
 * Prevents the "Not authenticated" race condition where pages call
 * APIs before auth.currentUser is available.
 *
 * Returns { user, ready }:
 * - ready=false: auth still initializing (show skeleton)
 * - ready=true, user=null: not signed in
 * - ready=true, user=User: signed in, safe to make API calls
 */
export function useAuthReady() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(process.env.NEXT_PUBLIC_DEMO_MODE === "true");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;
    let unsub: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) { setReady(true); return; }
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      });
    });
    return () => unsub?.();
  }, []);

  return { user, ready };
}
