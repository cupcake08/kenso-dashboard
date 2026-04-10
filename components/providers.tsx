"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";

export function setAuthCookie(token: string) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `firebase-token=${token}; path=/${secure}; samesite=lax; max-age=${60 * 60}`;
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
          if (user) {
            user.getIdToken().then((token) => setAuthCookie(token));
          } else {
            clearAuthCookie();
          }
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
