import { AtAGlance } from "./at-a-glance";
import { NotableMoments } from "./notable-moments";
import { WorthAttention } from "./worth-attention";
import { Recommendations } from "./recommendations";
import { RestaurantDeepDive } from "./vertical/restaurant-deep-dive";
import { TicketingDeepDive } from "./vertical/ticketing-deep-dive";
import { GenericDeepDive } from "./vertical/generic-deep-dive";
import type { AnalysisResultV2 } from "@/types/analysis";

export function SectionRenderer({
  section,
  result,
}: {
  section: string;
  result: AnalysisResultV2;
}) {
  switch (section) {
    case "at_a_glance":
      return <AtAGlance result={result} />;
    case "notable_moments":
      return <NotableMoments result={result} />;
    case "worth_attention":
      return <WorthAttention result={result} />;
    case "deep_dive":
      if (result.vertical === "restaurant") {
        return <RestaurantDeepDive metrics={result.restaurantMetrics} />;
      }
      if (result.vertical === "ticketing") {
        return <TicketingDeepDive metrics={result.ticketingMetrics} />;
      }
      if (result.vertical === "generic") {
        return <GenericDeepDive metrics={result.genericMetrics} />;
      }
      return null;
    case "recommendations":
      return <Recommendations items={result.recommendations} />;
    default:
      return null;
  }
}
