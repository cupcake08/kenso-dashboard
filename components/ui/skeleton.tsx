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

