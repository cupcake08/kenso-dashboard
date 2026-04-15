"use client";
import { useState } from "react";
import { Utensils, ShoppingBag, Ticket, Sparkles, Package } from "lucide-react";
import type { BusinessType } from "@/types/company";

type PickerValue = Exclude<BusinessType, "">; // non-empty vertical

const OPTIONS: Array<{
  value: PickerValue;
  label: string;
  desc: string;
  icon: typeof Utensils;
}> = [
  { value: "restaurant", label: "Restaurant / Cafe / QSR",        desc: "Dining, orders, service",          icon: Utensils },
  { value: "retail",     label: "Retail store",                   desc: "Apparel, electronics, grocery",    icon: ShoppingBag },
  { value: "ticketing",  label: "Ticketing / Booking",            desc: "Bus, travel, events",              icon: Ticket },
  { value: "service",    label: "Service desk / Salon / Clinic",  desc: "Appointments, services",           icon: Sparkles },
  { value: "generic",    label: "Something else",                 desc: "General business",                 icon: Package },
];

type Props = {
  /** Current value — used to render the active state. Empty string means nothing selected. */
  initial?: BusinessType;
  /** Called when the user picks an option. Called ONLY for valid (non-empty) picks. */
  onPick: (bt: PickerValue) => void;
  /** Called when the user clicks "Skip". Omit if skip should be hidden. */
  onSkip?: () => void;
  /** Hide the Skip button entirely. Default: shown IF onSkip is provided. */
  showSkip?: boolean;
};

export function BusinessTypePicker({
  initial = "",
  onPick,
  onSkip,
  showSkip = true,
}: Props) {
  const [selected, setSelected] = useState<BusinessType>(initial);

  function handlePick(value: PickerValue) {
    setSelected(value);
    onPick(value);
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => handlePick(o.value)}
            aria-pressed={active}
            className={[
              "flex items-center gap-3 p-4 rounded-xl border text-left transition-colors",
              active
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-border hover:bg-card/50",
            ].join(" ")}
          >
            <Icon className="w-5 h-5 text-emerald-500 shrink-0" aria-hidden />
            <div>
              <div className="font-medium">{o.label}</div>
              <div className="text-sm text-muted-foreground">{o.desc}</div>
            </div>
          </button>
        );
      })}
      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mt-2"
        >
          Skip — we&apos;ll detect it from your first analysis
        </button>
      )}
    </div>
  );
}
