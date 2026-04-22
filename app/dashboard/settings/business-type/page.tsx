"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useBusinessType } from "@/hooks/use-business-type";
import { patchBusinessType, patchCompanyDescription } from "@/lib/api";
import { BusinessTypePicker } from "@/components/onboarding/business-type-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BusinessType } from "@/types/company";

const DESCRIPTION_MAX = 500;

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.33, 1, 0.68, 1] as const },
};

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SourceLabel({
  source,
  setAtUnix,
}: {
  source: string;
  setAtUnix?: number;
}) {
  const date = setAtUnix ? formatDate(setAtUnix) : null;
  if (source === "admin") {
    return (
      <span className="text-sm text-muted-foreground">
        You set this{date ? ` on ${date}` : ""}
      </span>
    );
  }
  if (source === "ai_confirmed") {
    return (
      <span className="text-sm text-muted-foreground">
        AI suggested, you confirmed{date ? ` on ${date}` : ""}
      </span>
    );
  }
  return (
    <span className="text-sm text-muted-foreground italic">
      Not set — we&apos;ll suggest one based on your first analysis
    </span>
  );
}

export default function BusinessTypeSettingsPage() {
  const router = useRouter();
  const { state, isLoading, error, mutate } = useBusinessType();
  const { mutate: globalMutate } = useSWRConfig();

  // Confirm modal state
  const [pendingPick, setPendingPick] = useState<Exclude<BusinessType, ""> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Description state
  const [description, setDescription] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  // Sync description from loaded state
  const savedDescription = state?.description ?? "";

  useEffect(() => {
    setDescription(savedDescription);
  }, [savedDescription]);

  // Modal: auto-focus confirm button + Escape to close
  useEffect(() => {
    if (!pendingPick) return;
    confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingPick]);

  const descUnchanged = description === savedDescription;

  function handlePick(bt: Exclude<BusinessType, "">) {
    setPendingPick(bt);
  }

  function closeModal() {
    setPendingPick(null);
  }

  async function confirmChange() {
    if (!pendingPick) return;
    setConfirming(true);
    try {
      await patchBusinessType(pendingPick);
      await mutate();
      // Backend's PATCH /business-type also deletes any pending suggestion doc;
      // bust the banner's SWR cache so it disappears without a page reload.
      await globalMutate("company/business-type-suggestion");
      toast.success("Business type updated");
      closeModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update business type");
    } finally {
      setConfirming(false);
    }
  }

  async function saveDescription() {
    if (descUnchanged) return;
    setSavingDesc(true);
    try {
      await patchCompanyDescription(description);
      await mutate();
      toast.success("Description saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save description");
    } finally {
      setSavingDesc(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/settings")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Settings
        </Button>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-72" />
        <div className="space-y-3 mt-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl mt-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/settings")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Settings
        </Button>
        <div className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">Failed to load business type settings. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl space-y-8">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/settings")}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Settings
        </Button>

        {/* Header */}
        <motion.div {...fadeUp}>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">
            Business type
          </h1>
          <div className="mt-2">
            <SourceLabel
              source={state?.source ?? ""}
              setAtUnix={state?.setAtUnix}
            />
          </div>
        </motion.div>

        {/* Change-vertical section */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
          <div className="rounded-xl border border-border bg-card/50 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-5">
              Vertical
            </p>
            <BusinessTypePicker
              initial={state?.businessType ?? ""}
              onPick={handlePick}
              showSkip={false}
            />
          </div>
        </motion.div>

        {/* Description section */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
          <div className="rounded-xl border border-border bg-card/50 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Company description
            </p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              A short description of your business — adds context to your AI analysis reports.
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              placeholder="e.g. A quick-service restaurant in Koramangala serving North Indian food. Peak hours 12–3pm and 7–10pm."
              rows={4}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {description.length} / {DESCRIPTION_MAX}
              </span>
              <Button
                size="sm"
                onClick={saveDescription}
                disabled={descUnchanged || savingDesc}
              >
                {savingDesc ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving</>
                ) : "Save"}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirm-change modal */}
      <AnimatePresence>
        {pendingPick && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <motion.div
              key="confirm-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bt-confirm-heading"
              aria-describedby="bt-confirm-body"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
              className="bg-background rounded-2xl border border-border p-6 max-w-sm w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <h2 id="bt-confirm-heading" className="text-base font-semibold text-foreground leading-snug">
                  Change business type?
                </h2>
                <button
                  onClick={closeModal}
                  disabled={confirming}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-3 mt-0.5 shrink-0"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p id="bt-confirm-body" className="text-sm text-muted-foreground leading-relaxed mb-6">
                Changing this will affect future analyses. Past results keep their original vertical.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                  disabled={confirming}
                >
                  Cancel
                </Button>
                <Button
                  ref={confirmButtonRef}
                  className="flex-1"
                  onClick={confirmChange}
                  disabled={confirming}
                >
                  {confirming ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving</>
                  ) : "Confirm"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
