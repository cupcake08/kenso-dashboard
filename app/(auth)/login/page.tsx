"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { setAuthCookie } from "@/components/providers";
import { whoami } from "@/lib/api";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Generate a sine wave SVG path for the waveform accent
function generateWavePath(width: number, height: number, period: number, amplitude: number): string {
  const centerY = height / 2;
  const step = 4;
  const points: string[] = [];
  for (let x = 0; x <= width; x += step) {
    const y = centerY + amplitude * Math.sin((2 * Math.PI * x) / period);
    points.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

const WAVES = [
  { period: 400, amplitude: 35, opacity: 0.15, strokeWidth: 1.5, duration: 24 },
  { period: 300, amplitude: 22, opacity: 0.08, strokeWidth: 1, duration: 16 },
  { period: 200, amplitude: 12, opacity: 0.05, strokeWidth: 0.75, duration: 10 },
];

type Tab = "signin" | "signup" | "reset";

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/wrong-password": "Invalid email or password.",
  "auth/invalid-credential": "Invalid email or password. If you haven't signed up yet, switch to the Sign Up tab.",
  "auth/user-not-found": "No account found with that email. Try signing up first.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const code = (err as { code?: string }).code ?? "";
  return FIREBASE_ERRORS[code] || err.message;
}

export default function LoginPage() {
  const router = useRouter();
  const brandRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Basic email validation — catches typos before hitting Firebase
  const emailError = (() => {
    if (!email || tab === "reset") return "";
    const trimmed = email.trim();
    if (trimmed.length > 0 && !trimmed.includes("@")) return "Missing @";
    if (trimmed.includes("@")) {
      const [, domain] = trimmed.split("@");
      if (!domain || !domain.includes(".")) return "Invalid domain";
      if (domain.endsWith(".")) return "Invalid domain";
      // Common typos
      const typos: Record<string, string> = {
        "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmal.com": "gmail.com",
        "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com",
        "outlok.com": "outlook.com", "outloo.com": "outlook.com",
        "hotmal.com": "hotmail.com",
      };
      if (typos[domain]) return `Did you mean ${trimmed.split("@")[0]}@${typos[domain]}?`;
    }
    return "";
  })();

  // Sonar dots — Canvas-based reactive dot grid
  useEffect(() => {
    const canvas = canvasRef.current;
    const brand = brandRef.current;
    if (!canvas || !brand) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId = 0;
    const dpr = window.devicePixelRatio || 1;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPACING = 24;
    const INFLUENCE = 130;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      // Fill with exact background color to prevent two-tone
      ctx.fillStyle = 'hsl(222, 47%, 4%)';
      ctx.fillRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let x = SPACING / 2; x < w; x += SPACING) {
        for (let y = SPACING / 2; y < h; y += SPACING) {
          const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
          const t = Math.max(0, 1 - dist / INFLUENCE);
          const r = 1 + t * 1.5;
          const a = 0.12 + t * 0.65;

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = t > 0.05
            ? `hsla(160, 84%, 39%, ${a})`
            : `hsla(215, 14%, 20%, ${a})`;
          ctx.fill();
        }
      }

      if (!prefersReduced) animationId = requestAnimationFrame(draw);
    }

    const handleMove = (e: MouseEvent) => {
      const rect = brand!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (prefersReduced) draw();
    };
    const handleLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
      if (prefersReduced) draw();
    };

    resize();
    draw();
    brand.addEventListener('mousemove', handleMove);
    brand.addEventListener('mouseleave', handleLeave);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationId);
      brand.removeEventListener('mousemove', handleMove);
      brand.removeEventListener('mouseleave', handleLeave);
      window.removeEventListener('resize', resize);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (DEMO_MODE) { router.push("/dashboard/devices"); return; }
    if (emailError) { setError(emailError); return; }
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
        // Send verification email immediately after signup
        const { sendEmailVerification } = await import("firebase/auth");
        await sendEmailVerification(user);
        router.push("/verify-email");
        return;
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        user = cred.user;
      }
      // Block unverified emails — redirect to verification screen
      if (!user.emailVerified) {
        const { sendEmailVerification } = await import("firebase/auth");
        try { await sendEmailVerification(user); } catch { /* may fail if recently sent */ }
        router.push("/verify-email");
        return;
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

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      if (!auth) throw new Error("Firebase not initialized");
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Brand side ── */}
      <div ref={brandRef} className="hidden lg:flex flex-col justify-center items-center w-[50%] relative overflow-hidden">
        {/* Sonar dots — Canvas replaces CSS dot pattern */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {/* Subtle radial glow from center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(160_84%_39%/0.05)_0%,_transparent_70%)]" />
        {/* Waveform accent — positioned in lower third */}
        <div className="absolute bottom-[15%] inset-x-0 h-64 overflow-hidden pointer-events-none">
          {WAVES.map((wave, i) => (
            <svg
              key={i}
              className="absolute inset-0 w-[200%]"
              viewBox="0 0 2400 200"
              fill="none"
              preserveAspectRatio="none"
              style={{ animation: `waveform-drift ${wave.duration}s linear infinite` }}
            >
              <path
                d={generateWavePath(2400, 200, wave.period, wave.amplitude)}
                stroke="hsl(160, 84%, 39%)"
                strokeOpacity={wave.opacity}
                strokeWidth={wave.strokeWidth}
              />
            </svg>
          ))}
        </div>
        {/* Soft edge fade — no hard border */}
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none z-[5]" />

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
          className="relative z-10 text-center px-12 max-w-lg"
        >
          <Image src="/logo.png" alt="" width={112} height={112} className="mx-auto mb-10" />
          <h1 className="text-5xl font-extrabold text-foreground tracking-tight leading-none">
            KnownSense<span className="text-primary">.AI</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Real-time audio intelligence, everywhere you need it
          </p>
          <div className="mt-10 h-px w-12 mx-auto bg-primary/30" />
          <p className="mt-10 text-sm text-muted-foreground/70 max-w-xs mx-auto leading-relaxed">
            Monitor your locations, analyze conversations, and gain actionable insights — all from one dashboard.
          </p>
        </motion.div>
      </div>

      {/* ── Form side ── */}
      <div className="flex flex-1 items-center justify-center px-5 py-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-lg lg:max-w-[440px]"
        >
          {/* Logo (mobile/tablet) */}
          <div className="mb-10 lg:hidden flex flex-col items-center gap-4">
            <Image src="/logo.png" alt="KnownSense.AI" width={72} height={72} />
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              KnownSense<span className="text-primary">.AI</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground">
              {tab === "signin" ? "Welcome back" : tab === "signup" ? "Create your account" : "Reset password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "signin"
                ? "Sign in to access your dashboard"
                : tab === "signup"
                ? "Get started with KnownSense.AI"
                : "Enter your email and we'll send a reset link"}
            </p>
          </div>

          {/* Tabs — hidden on reset view */}
          {tab !== "reset" && (
            <div className="relative flex mb-6 bg-muted rounded-lg p-1">
              {(["signin", "signup"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(""); }}
                  className={`relative flex-1 py-2.5 text-sm font-medium rounded-md transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
          )}

          {/* Reset password form */}
          {tab === "reset" && (
            <form onSubmit={handleReset} className="space-y-4">
              {resetSent ? (
                <div className="rounded-lg border border-status-online/20 bg-status-online/5 px-4 py-3 text-sm text-status-online">
                  Check your email for a password reset link.
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                    <Input id="reset-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
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
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setTab("signin"); setError(""); setResetSent(false); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* Sign in / Sign up form */}
          {tab !== "reset" && <form onSubmit={handleSubmit} className="space-y-4">
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
              <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={emailError ? "border-amber-400/50" : ""} />
              {emailError && (
                <p className="mt-1 text-xs text-amber-400">{emailError}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
                {tab === "signin" && (
                  <button
                    type="button"
                    onClick={() => { setTab("reset"); setError(""); setResetSent(false); }}
                    className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
          </form>}

          {/* Footer text */}
          {tab !== "reset" && (
            <p className="mt-6 text-center text-xs text-muted-foreground/70">
              {tab === "signin"
                ? "Don\u2019t have an account? Switch to Sign Up above."
                : "Already have an account? Switch to Sign In above."}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
