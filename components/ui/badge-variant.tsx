import { cn } from "@/lib/utils";

type BadgeVariant = "emerald" | "amber" | "blue" | "slate";

const variantClasses: Record<BadgeVariant, string> = {
  emerald: "bg-emerald-950/50 text-emerald-400 border-emerald-800",
  amber: "bg-amber-950/50 text-amber-400 border-amber-800",
  blue: "bg-blue-950/50 text-blue-400 border-blue-800",
  slate: "bg-slate-800 text-slate-400 border-slate-700",
};

interface BadgeVariantProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function BadgeVariant({ variant = "slate", children, className }: BadgeVariantProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", variantClasses[variant], className)}>
      {children}
    </span>
  );
}
