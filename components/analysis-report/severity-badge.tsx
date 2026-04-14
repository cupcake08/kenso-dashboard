import { Info, TriangleAlert, CircleX } from "lucide-react";

type Severity = "info" | "warning" | "critical";

const CLS: Record<Severity, string> = {
  info:     "bg-blue-500/10 text-blue-300 border-blue-500/30",
  warning:  "bg-amber-500/10 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
};

const ICON: Record<Severity, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  critical: CircleX,
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = ICON[severity];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${CLS[severity]}`}>
      <Icon className="w-3 h-3" aria-hidden />
      {severity}
    </span>
  );
}
