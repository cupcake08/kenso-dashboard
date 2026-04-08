"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// In demo mode, auth is bypassed — Firebase not needed
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (DEMO_MODE) {
      router.push("/dashboard/devices");
      return;
    }
    // Real Firebase auth path — only reached when DEMO_MODE is false
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase");
    setError("");
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase not initialized");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard/devices");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg.includes("wrong-password") ? "Invalid email or password" : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand side */}
      <div className="hidden md:flex flex-col justify-center pl-16 bg-background">
        <div className="relative">
          {/* decorative vertical line */}
          <div className="absolute -left-6 top-0 bottom-0 w-1 bg-primary rounded-full" />
          <h1 className="text-7xl font-bold text-foreground tracking-tight">Kenso</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xs leading-relaxed">
            Real-time shop intelligence for modern retail.
          </p>
        </div>
      </div>
      {/* Form side */}
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Kenso</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-400">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
