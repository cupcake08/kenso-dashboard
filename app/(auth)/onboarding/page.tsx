"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { auth } from "@/lib/firebase";
import { createCompany, whoami, patchBusinessType, patchCompanyDescription } from "@/lib/api";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BusinessTypePicker } from "@/components/onboarding/business-type-picker";
import type { BusinessType } from "@/types/company";

type Step = "company" | "business_type" | "description" | "success";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("company");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState("");

  // Wait for auth to initialize and check if user already has a company
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      router.replace("/dashboard/devices");
      return;
    }
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      if (!auth) return;
      const unsub = onAuthStateChanged(auth, (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }
        setDisplayName(user.displayName || "");
        setAuthReady(true);
        // Check if user already has a company — redirect away
        whoami().then((who) => {
          if (who?.memberships?.some((m) => m.status === "active")) {
            router.replace("/dashboard/devices");
          }
        });
      });
      return () => unsub();
    });
  }, [router]);

  async function handleSubmitCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setError("");
    setLoading(true);

    try {
      await createCompany(companyName.trim());
      setStep("business_type");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickBusinessType(bt: Exclude<BusinessType, "">) {
    if (loading) return;
    setLoading(true);
    try {
      await patchBusinessType(bt);
      setStep("description");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save business type. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSkipBusinessType() {
    setStep("description");
  }

  async function handleSubmitDescription() {
    if (loading) return;
    setLoading(true);
    try {
      if (description.trim()) {
        await patchCompanyDescription(description.trim());
      }
      completeOnboarding();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save description. Please try again.");
      setLoading(false);
    }
  }

  function handleSkipDescription() {
    completeOnboarding();
  }

  function completeOnboarding() {
    setStep("success");
    setTimeout(() => router.push("/dashboard/devices"), 1000);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Step indicator segments: 3 steps (company, business_type, description)
  const stepIndex = step === "company" ? 0 : step === "business_type" ? 1 : 2;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          <AnimatePresence mode="wait">
            {step === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-12 gap-5"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                  className="glow-primary rounded-full"
                >
                  <CheckCircle2 className="h-20 w-20 text-primary" strokeWidth={1.5} />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-foreground"
                >
                  You&apos;re all set!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  Taking you to your dashboard...
                </motion.p>
              </motion.div>
            ) : step === "company" ? (
              <motion.div key="company" exit={{ opacity: 0 }}>
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-1.5 flex-1 rounded-full bg-primary" />
                  <div className="h-1.5 flex-1 rounded-full bg-muted" />
                  <div className="h-1.5 flex-1 rounded-full bg-muted" />
                </div>

                {displayName && (
                  <p className="text-sm text-muted-foreground mb-1">
                    Welcome, {displayName}
                  </p>
                )}
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  Set up your organization
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                  Name your organization to get started. You can change this later.
                </p>

                <form onSubmit={handleSubmitCompany} className="space-y-4">
                  <div>
                    <label htmlFor="company" className="text-sm font-medium text-foreground mb-1.5 block">
                      Organization name
                    </label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="e.g. Chai Point Koramangala"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        role="alert"
                        className="text-sm text-red-400"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button type="submit" className="w-full" size="lg" disabled={loading || !companyName.trim()}>
                    {loading ? "Setting up..." : "Get Started"}
                  </Button>
                </form>
              </motion.div>
            ) : step === "business_type" ? (
              <motion.div
                key="business_type"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3 }}
              >
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className={`h-1.5 flex-1 rounded-full ${stepIndex >= 0 ? "bg-primary" : "bg-muted"}`} />
                  <div className={`h-1.5 flex-1 rounded-full ${stepIndex >= 1 ? "bg-primary" : "bg-muted"}`} />
                  <div className="h-1.5 flex-1 rounded-full bg-muted" />
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-1">
                  What kind of business do you run?
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                  We&apos;ll tune our analysis for you.
                </p>

                <BusinessTypePicker
                  onPick={handlePickBusinessType}
                  onSkip={handleSkipBusinessType}
                  showSkip={true}
                />
              </motion.div>
            ) : (
              <motion.div
                key="description"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3 }}
              >
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-1.5 flex-1 rounded-full bg-primary" />
                  <div className="h-1.5 flex-1 rounded-full bg-primary" />
                  <div className="h-1.5 flex-1 rounded-full bg-primary" />
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-1">
                  Anything else we should know?
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                  Optional — helps our AI understand your context.
                </p>

                <div className="space-y-4">
                  <Textarea
                    placeholder="e.g., Vada House, South Indian breakfast + coffee, 3 tables + counter"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={4}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {description.length}/500
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    onClick={handleSubmitDescription}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Continue"}
                  </Button>
                  <button
                    type="button"
                    onClick={handleSkipDescription}
                    className="w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
