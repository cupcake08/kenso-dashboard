"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";

// Cookie outlives the Firebase ID token (which expires every ~1h). The
// onIdTokenChanged listener in Providers refreshes this cookie whenever Firebase
// rotates the token, so a 24h TTL just keeps returning users logged in across
// browser sessions without forcing a password re-entry.
export function setAuthCookie(token: string) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `firebase-token=${token}; path=/${secure}; samesite=lax; max-age=${60 * 60 * 24}`;
}

export function clearAuthCookie() {
  document.cookie = "firebase-token=; path=/; max-age=0";
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;
    let unsubscribe: (() => void) | undefined;
    import("firebase/auth").then(({ onIdTokenChanged }) => {
      import("@/lib/firebase").then(({ auth }) => {
        if (!auth) return;
        unsubscribe = onIdTokenChanged(auth, (user) => {
          if (user && user.emailVerified) {
            user.getIdToken().then((token) => setAuthCookie(token));
          } else if (!user) {
            clearAuthCookie();
          }
          // Unverified user: don't set cookie, don't clear it (they may be
          // on the verify-email page where we intentionally avoid setting it
          // until verification completes).
        });
      });
    });
    return () => unsubscribe?.();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
