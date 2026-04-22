"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Loader2, Pencil, Plus } from "lucide-react";
import {
  listOperatingHours,
  apiFetch,
  normalizeDevice,
  upsertOperatingHours,
  pauseOperatingHours,
  resumeOperatingHours,
} from "@/lib/api";
import type { RawDevice, Device } from "@/types/api";
import type { OperatingSchedule, DaySchedule } from "@/types/analysis";
import { BadgeVariant } from "@/components/ui/badge-variant";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OperatingHoursEditor } from "@/components/dashboard/operating-hours-editor";
import { cn } from "@/lib/utils";

// ── Demo Mode ──────────────────────────────────────────────────────────────────

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const DEMO_DEVICES: Device[] = [
  { device_id: "mic_krmgl_01", shop_id: "shop_001", label: "Main Counter", location: "Koramangala, Bangalore", status: "streaming", last_seen_at: new Date().toISOString() },
  { device_id: "mic_krmgl_02", shop_id: "shop_001", label: "Entry", location: "Koramangala, Bangalore", status: "online", last_seen_at: new Date().toISOString() },
  { device_id: "mic_indr_01", shop_id: "shop_002", label: "Counter", location: "Indiranagar, Bangalore", status: "online", last_seen_at: new Date().toISOString() },
  { device_id: "mic_whtf_01", shop_id: "shop_003", label: "Main Floor", location: "Whitefield, Bangalore", status: "offline", last_seen_at: new Date(Date.now() - 7200000).toISOString() },
];

const DEMO_SCHEDULES: OperatingSchedule[] = [
  {
    company_id: "comp_demo",
    shop_id: "shop_001",
    timezone: "Asia/Kolkata",
    weekly_hours: [
      { day: "monday", open: "09:00", close: "21:00", closed: false },
      { day: "tuesday", open: "09:00", close: "21:00", closed: false },
      { day: "wednesday", open: "09:00", close: "21:00", closed: false },
      { day: "thursday", open: "09:00", close: "21:00", closed: false },
      { day: "friday", open: "09:00", close: "22:00", closed: false },
      { day: "saturday", open: "10:00", close: "22:00", closed: false },
      { day: "sunday", open: "11:00", close: "20:00", closed: false },
    ],
    device_overrides: {},
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    company_id: "comp_demo",
    shop_id: "shop_002",
    timezone: "Asia/Kolkata",
    weekly_hours: [
      { day: "monday", open: "10:00", close: "20:00", closed: false },
      { day: "tuesday", open: "10:00", close: "20:00", closed: false },
      { day: "wednesday", open: "10:00", close: "20:00", closed: false },
      { day: "thursday", open: "10:00", close: "20:00", closed: false },
      { day: "friday", open: "10:00", close: "20:00", closed: false },
      { day: "saturday", open: "10:00", close: "20:00", closed: false },
      { day: "sunday", open: "00:00", close: "00:00", closed: true },
    ],
    device_overrides: {},
    paused_until: new Date(Date.now() + 5 * 86400000).toISOString(),
    pause_reason: "Renovation",
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt12(time: string): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${mStr}${ampm}`;
}

function summarizeHours(hours: DaySchedule[]): string {
  if (!hours || hours.length === 0) return "No hours set";
  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Group consecutive days with same schedule
  interface Group {
    startIndex: number;
    endIndex: number;
    open: string;
    close: string;
    closed: boolean;
  }

  const groups: Group[] = [];
  let current: Group | null = null;

  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    if (
      current &&
      current.closed === h.closed &&
      current.open === h.open &&
      current.close === h.close
    ) {
      current.endIndex = i;
    } else {
      if (current) groups.push(current);
      current = { startIndex: i, endIndex: i, open: h.open, close: h.close, closed: h.closed };
    }
  }
  if (current) groups.push(current);

  return groups
    .map((g) => {
      const start = DAY_SHORT[g.startIndex];
      const end = DAY_SHORT[g.endIndex];
      const label = start === end ? start : `${start}–${end}`;
      if (g.closed) return `${label} Closed`;
      return `${label} ${fmt12(g.open)}–${fmt12(g.close)}`;
    })
    .join(", ");
}

// ── Shop data model ────────────────────────────────────────────────────────────

interface ShopInfo {
  shopId: string;
  name: string;
  devices: Device[];
  schedule: OperatingSchedule | null;
}

function buildShops(devices: Device[], schedules: OperatingSchedule[]): ShopInfo[] {
  const shopMap = new Map<string, ShopInfo>();
  for (const d of devices) {
    if (!shopMap.has(d.shop_id)) {
      shopMap.set(d.shop_id, {
        shopId: d.shop_id,
        name: d.location || d.shop_id,
        devices: [],
        schedule: null,
      });
    }
    shopMap.get(d.shop_id)!.devices.push(d);
  }
  for (const s of schedules) {
    if (shopMap.has(s.shop_id)) {
      shopMap.get(s.shop_id)!.schedule = s;
    }
  }
  return Array.from(shopMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ShopCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ── Shop Card ──────────────────────────────────────────────────────────────────

function ShopCard({
  shop,
  editing,
  onEdit,
  onSave,
  onPause,
  onResume,
  onCancel,
}: {
  shop: ShopInfo;
  editing: boolean;
  onEdit: () => void;
  onSave: (data: { timezone: string; weekly_hours: DaySchedule[]; device_overrides: Record<string, import("@/types/analysis").DeviceOverride> }) => Promise<void>;
  onPause: (pausedUntil: string, reason: string) => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => void;
}) {
  const { schedule } = shop;
  const isPaused = !!(schedule?.paused_until && new Date(schedule.paused_until) > new Date());
  const overrideCount = schedule ? Object.keys(schedule.device_overrides ?? {}).length : 0;

  const deviceItems = shop.devices.map((d) => ({ micId: d.device_id, label: d.label }));

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Card header */}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{shop.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {schedule
                ? summarizeHours(schedule.weekly_hours)
                : "No hours configured"}
            </p>
          </div>
          <BadgeVariant
            variant={!schedule ? "slate" : isPaused ? "amber" : "emerald"}
            className="shrink-0"
          >
            {!schedule ? "Not set" : isPaused ? `Paused` : "Active"}
          </BadgeVariant>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {shop.devices.length} device{shop.devices.length !== 1 ? "s" : ""}
            </span>
            {overrideCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span>{overrideCount} override{overrideCount !== 1 ? "s" : ""}</span>
              </>
            )}
            {isPaused && schedule?.paused_until && (
              <>
                <span className="text-border">·</span>
                <span className="text-amber-400">
                  Until{" "}
                  {new Date(schedule.paused_until).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className={cn(editing && "border-primary text-primary")}
          >
            {schedule ? (
              <>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Set Hours
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Inline editor */}
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="editor"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4">
              <OperatingHoursEditor
                shopId={shop.shopId}
                shopName={shop.name}
                initial={schedule}
                devices={deviceItems}
                onSave={onSave}
                onPause={onPause}
                onResume={onResume}
                onCancel={onCancel}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OperatingHoursPage() {
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingShopId, setEditingShopId] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (IS_DEMO) {
      setShops(buildShops(DEMO_DEVICES, DEMO_SCHEDULES));
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase").then(({ auth }) => {
        if (!auth || cancelled) { setLoading(false); return; }
        unsub = onAuthStateChanged(auth, async (user) => {
          if (!user) { setLoading(false); return; }
          try {
            const [rawDevices, schedules] = await Promise.all([
              apiFetch<RawDevice[]>("/devices"),
              listOperatingHours(),
            ]);
            if (cancelled) return;
            const devices = rawDevices.map(normalizeDevice);
            setShops(buildShops(devices, schedules));
            setError("");
          } catch (e: unknown) {
            if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
          } finally {
            if (!cancelled) setLoading(false);
          }
        });
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  async function loadData() {
    if (IS_DEMO) {
      setShops(buildShops(DEMO_DEVICES, DEMO_SCHEDULES));
      setLoading(false);
      return;
    }
    try {
      const [rawDevices, schedules] = await Promise.all([
        apiFetch<RawDevice[]>("/devices"),
        listOperatingHours(),
      ]);
      const devices = rawDevices.map(normalizeDevice);
      setShops(buildShops(devices, schedules));
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async function handleSave(
    shopId: string,
    data: { timezone: string; weekly_hours: DaySchedule[]; device_overrides: Record<string, import("@/types/analysis").DeviceOverride> }
  ) {
    if (IS_DEMO) {
      setShops((prev) =>
        prev.map((s) => {
          if (s.shopId !== shopId) return s;
          const updated: OperatingSchedule = s.schedule
            ? { ...s.schedule, ...data, updated_at: new Date().toISOString() }
            : {
                company_id: "comp_demo",
                shop_id: shopId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...data,
              };
          return { ...s, schedule: updated };
        })
      );
      setEditingShopId(null);
      return;
    }
    await upsertOperatingHours(shopId, data);
    await loadData();
    setEditingShopId(null);
  }

  async function handlePause(shopId: string, pausedUntil: string, reason: string) {
    if (IS_DEMO) {
      setShops((prev) =>
        prev.map((s) =>
          s.shopId === shopId && s.schedule
            ? { ...s, schedule: { ...s.schedule, paused_until: pausedUntil, pause_reason: reason } }
            : s
        )
      );
      return;
    }
    await pauseOperatingHours(shopId, pausedUntil, reason);
    await loadData();
  }

  async function handleResume(shopId: string) {
    if (IS_DEMO) {
      setShops((prev) =>
        prev.map((s) =>
          s.shopId === shopId && s.schedule
            ? { ...s, schedule: { ...s.schedule, paused_until: undefined, pause_reason: undefined } }
            : s
        )
      );
      return;
    }
    await resumeOperatingHours(shopId);
    await loadData();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 bg-muted rounded-lg animate-pulse" />
          <div className="mt-1 h-4 w-72 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <ShopCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operating Hours</h1>
        </div>
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => { setError(""); setLoading(true); loadData(); }}
            className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 ml-4 shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operating Hours</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set business hours per shop location</p>
        </div>
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            No devices found. Add devices to set operating hours.
          </p>
        </div>
      </div>
    );
  }

  const configuredCount = shops.filter((s) => s.schedule).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operating Hours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {shops.length} location{shops.length !== 1 ? "s" : ""}
            {" · "}
            {configuredCount} configured
          </p>
        </div>
        {IS_DEMO && (
          <BadgeVariant variant="amber">Demo</BadgeVariant>
        )}
      </div>

      {/* Unconfigured notice */}
      {configuredCount < shops.length && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-amber-400 shrink-0 hidden" />
          <p className="text-xs text-amber-400">
            {shops.length - configuredCount} shop{shops.length - configuredCount !== 1 ? "s" : ""} have no hours set — analysis scheduling may be affected.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {shops.map((shop) => (
          <ShopCard
            key={shop.shopId}
            shop={shop}
            editing={editingShopId === shop.shopId}
            onEdit={() => setEditingShopId(editingShopId === shop.shopId ? null : shop.shopId)}
            onSave={(data) => handleSave(shop.shopId, data)}
            onPause={(until, reason) => handlePause(shop.shopId, until, reason)}
            onResume={() => handleResume(shop.shopId)}
            onCancel={() => setEditingShopId(null)}
          />
        ))}
      </div>
    </div>
  );
}
