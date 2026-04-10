"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { setAuthCookie } from "@/components/providers";
import { whoami } from "@/lib/api";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type Tab = "signin" | "signup";

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/wrong-password": "Invalid email or password.",
  "auth/invalid-credential": "Invalid email or password. If you haven't signed up yet, switch to the Sign Up tab.",
  "auth/user-not-found": "No account found with that email. Try signing up first.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Make sure the Firebase emulator is running.",
};

function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const code = (err as { code?: string }).code ?? "";
  return FIREBASE_ERRORS[code] || err.message;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (DEMO_MODE) { router.push("/dashboard/devices"); return; }
    setError("");
    setLoading(true);
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } =
        await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      if (!auth) throw new Error("Firebase not initialized");
      let user;
      if (tab === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
        user = cred.user;
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        user = cred.user;
      }
      const token = await user.getIdToken();
      setAuthCookie(token);
      const who = await whoami();
      const hasCompany = who?.memberships?.some((m) => m.status === "active");
      router.push(hasCompany ? "/dashboard/devices" : "/onboarding");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Brand side ── */}
      <div className="hidden lg:flex flex-col justify-center items-center w-[50%] relative overflow-hidden">
        {/* Layered background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute top-1/4 left-1/3 h-[500px] w-[500px] rounded-full bg-primary/6 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-primary/4 blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
          className="relative z-10 text-center px-12 max-w-lg"
        >
          <Image src="/logo.png" alt="" width={72} height={72} className="mx-auto mb-8" />
          <h1 className="text-4xl font-bold text-foreground tracking-tight leading-tight">
            KnownSense<span className="text-primary">.AI</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Real-time audio intelligence for modern retail
          </p>
          <div className="mt-8 h-px w-16 mx-auto bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <p className="mt-8 text-sm text-muted-foreground/60 max-w-xs mx-auto leading-relaxed">
            Monitor your stores, analyze conversations, and gain actionable insights — all from one dashboard.
          </p>
        </motion.div>
      </div>

      {/* ── Form side ── */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* Logo (mobile/tablet) */}
          <div className="mb-8 lg:hidden flex flex-col items-center gap-3">
            <Image src="/logo.png" alt="KnownSense.AI" width={48} height={48} />
            <span className="text-xl font-bold text-foreground tracking-tight">
              KnownSense<span className="text-primary">.AI</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "signin"
                ? "Sign in to access your dashboard"
                : "Get started with KnownSense.AI"
              }
            </p>
          </div>

          {/* Tabs */}
          <div className="relative flex mb-6 bg-muted rounded-lg p-1">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(""); }}
                className={`relative flex-1 py-2 text-sm font-medium rounded-md transition-colors z-10 ${
                  tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
            <motion.div
              className="absolute inset-y-1 rounded-md bg-card border border-border shadow-sm"
              style={{ width: "calc(50% - 4px)" }}
              animate={{ left: tab === "signin" ? "4px" : "calc(50%)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {tab === "signup" && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label htmlFor="name" className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                  <Input id="name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={tab === "signup" ? "Min 6 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  role="alert"
                  className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-400"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading
                ? tab === "signup" ? "Creating account..." : "Signing in..."
                : tab === "signup" ? "Create Account" : "Sign In"
              }
            </Button>
          </form>

          {/* Footer text */}
          <p className="mt-6 text-center text-xs text-muted-foreground/50">
            {tab === "signin"
              ? "Don\u2019t have an account? Switch to Sign Up above."
              : "Already have an account? Switch to Sign In above."
            }
          </p>
        </motion.div>
      </div>
    </div>
  );
}
