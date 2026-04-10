import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}

export function DeviceCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 space-y-5">
      {/* Zone 1 — Identity */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full shrink-0" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-16 shrink-0" />
      </div>
      {/* Zone 2 — Context */}
      <div className="space-y-0.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      {/* Zone 3 — Actions */}
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <tr className="border-border text-sm">
      <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
      <td className="py-3 px-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
    </tr>
  );
}

export function WindowSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>
      <div className="rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-5 w-16" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-5 w-12" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="rounded-xl border border-border p-6 space-y-4">
        <Skeleton className="h-5 w-28" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-9 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
