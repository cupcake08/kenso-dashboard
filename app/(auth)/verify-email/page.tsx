"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Mail, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { setAuthCookie, clearAuthCookie } from "@/components/providers";
import { whoami } from "@/lib/api";

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailPage() {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);
  const [userEmail, setUserEmail] = useState("");

  // If no user is signed in, redirect to login. Otherwise grab their email.
  useEffect(() => {
    const a = auth;
    if (!a) { router.replace("/login"); return; }
    let unsub: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      unsub = onAuthStateChanged(a, (user) => {
        if (!user) { router.replace("/login"); return; }
        setUserEmail(user.email ?? "");
      });
    });
    return () => unsub?.();
  }, [router]);

  // Poll for verification status every 5 seconds
  const checkVerification = useCallback(async () => {
    if (checkingRef.current) return;
    const user = auth?.currentUser;
    if (!user) return;

    checkingRef.current = true;
    try {
      await user.reload();
      if (user.emailVerified) {
        setVerified(true);
        if (pollRef.current) clearInterval(pollRef.current);

        // Set auth cookie and redirect
        const token = await user.getIdToken(true);
        setAuthCookie(token);
        const who = await whoami();
        const hasCompany = who?.memberships?.some((m) => m.status === "active");

        setTimeout(() => {
          router.push(hasCompany ? "/dashboard/devices" : "/onboarding");
        }, 1500);
      }
    } catch {
      // Network error — silently retry on next poll tick
    } finally {
      checkingRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    // Start polling
    pollRef.current = setInterval(checkVerification, 5000);
    // Check immediately on mount
    checkVerification();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkVerification]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  const resendEmail = async () => {
    const user = auth?.currentUser;
    if (!user || resending || cooldown > 0) return;

    setResending(true);
    setError("");
    try {
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(user);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes.");
        setCooldown(RESEND_COOLDOWN);
      } else {
        setError("Failed to send email. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const signOut = async () => {
    const { signOut: fbSignOut } = await import("firebase/auth");
    if (auth) await fbSignOut(auth);
    clearAuthCookie();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
        className="w-full max-w-sm text-center"
      >
        <Image
          src="/logo.png"
          alt="KnownSense.AI"
          width={64}
          height={64}
          className="mx-auto mb-8"
        />

        {verified ? (
          <>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
            </motion.div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Email Verified
            </h1>
            <p className="text-sm text-muted-foreground">
              Redirecting to your dashboard...
            </p>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
              <Mail className="h-6 w-6 text-primary" />
            </div>

            <h1 className="text-xl font-semibold text-foreground mb-2">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground mb-1">
              We sent a verification link to
            </p>
            <p className="text-sm font-medium text-foreground mb-6">
              {userEmail}
            </p>

            <p className="text-xs text-muted-foreground/60 mb-6">
              Click the link in the email to verify your account.
              This page will update automatically.
            </p>

            {error && (
              <p className="text-sm text-red-400 mb-4">{error}</p>
            )}

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={resendEmail}
                disabled={resending || cooldown > 0}
              >
                {resending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Resend Email</>
                )}
              </Button>

              <button
                type="button"
                onClick={signOut}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Sign in with a different account
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
