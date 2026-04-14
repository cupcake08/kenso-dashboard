// types/company.ts

export type BusinessType =
  | "restaurant"
  | "retail"
  | "ticketing"
  | "service"
  | "generic"
  | ""; // empty string = unset

export type BusinessTypeSource = "admin" | "ai_confirmed" | "";

export type BusinessTypeState = {
  businessType: BusinessType;
  source: BusinessTypeSource;
  setAtUnix?: number;
};

export type BusinessTypeSuggestion = {
  vertical: Exclude<BusinessType, "">;
  confidence: number;
  reason: string;
  createdAtUnix: number;
};

export type CompanyFeatures = {
  analysis_v2?: boolean;
  [k: string]: boolean | undefined;
};
