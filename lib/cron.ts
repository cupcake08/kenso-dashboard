// Shared cron parsing utilities used by schedule-form and schedules/page.

/**
 * Expand a cron day-of-week field into an array of day numbers (0=Sun, 6=Sat).
 * Handles: "*", single digits, comma-separated lists, ranges (2-4), step values (1/2, *\/2).
 */
export function expandCronDays(dowField: string): number[] {
  if (dowField === "*") return [0, 1, 2, 3, 4, 5, 6];
  const result = new Set<number>();
  for (const part of dowField.split(",")) {
    // Handle step values like */2 or 1-5/2
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr) || 1;
      let start = 0;
      let end = 6;
      if (range !== "*") {
        if (range.includes("-")) {
          const bounds = range.split("-").map(Number);
          start = bounds[0];
          end = bounds[1] ?? start;
        } else {
          start = parseInt(range);
          end = start;
        }
      }
      for (let i = start; i <= end; i += step) result.add(i);
      continue;
    }
    // Handle ranges like 2-4
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr);
      const end = parseInt(endStr);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) result.add(i);
      }
      continue;
    }
    // Single digit
    const n = parseInt(part);
    if (!isNaN(n)) result.add(n);
  }
  return Array.from(result).sort((a, b) => a - b);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Parse a 5-part cron expression into its components.
 * Returns sensible defaults (Mon–Fri, 9:00) on parse failure.
 */
export function parseCron(cron: string): { days: number[]; hour: number; minute: number } {
  const parts = cron.split(" ");
  if (parts.length !== 5) return { days: [1, 2, 3, 4, 5], hour: 9, minute: 0 };
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 9;
  const days = expandCronDays(parts[4]);
  return { days: days.length > 0 ? days : [1, 2, 3, 4, 5], hour, minute };
}

/**
 * Convert a 5-part cron expression to a human-readable string.
 * e.g. "0 9 * * 1-5" → "Mon–Fri at 9:00 AM"
 */
export function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const days = expandCronDays(parts[4]);

  let dayStr: string;
  if (days.length === 7) {
    dayStr = "Daily";
  } else if (days.length === 0) {
    dayStr = "No days";
  } else {
    // Check if days form a consecutive range
    let isConsecutive = true;
    for (let i = 1; i < days.length; i++) {
      if (days[i] !== days[i - 1] + 1) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive && days.length > 2) {
      dayStr = `${DAY_NAMES[days[0]]}\u2013${DAY_NAMES[days[days.length - 1]]}`;
    } else {
      dayStr = days.map((d) => DAY_NAMES[d]).join(", ");
    }
  }

  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const timeStr = `${h12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  return `${dayStr} at ${timeStr}`;
}
