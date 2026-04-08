"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;
    let unsubscribe: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase").then(({ auth }) => {
        if (!auth) return;
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            user.getIdToken().then((token) => {
              document.cookie = `firebase-token=${token}; path=/; secure; samesite=strict; max-age=${60 * 60}`;
            });
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
