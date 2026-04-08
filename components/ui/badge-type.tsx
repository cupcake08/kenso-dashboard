import { BadgeVariant } from "@/components/ui/badge-variant";

type TransactionType = "topup" | "analysis" | "refund" | string;

const typeVariants: Record<string, "emerald" | "amber" | "blue" | "slate"> = {
  topup: "emerald",
  analysis: "blue",
  refund: "amber",
};

export function TransactionBadge({ type }: { type: TransactionType }) {
  return (
    <BadgeVariant variant={typeVariants[type] ?? "slate"}>
      {type}
    </BadgeVariant>
  );
}
