import axios from "@/utils/axios";

export type PlanInterval = "monthly" | "annual" | "one_time";

export type PublicPlan = {
  _id: string;
  key: string;
  displayName: string;
  priceDisplay?: string;
  discountDisplay?: string;
  interval: PlanInterval;
  dodoProductId: string;
  creditsPerPeriod: number;
  version: number;
  featureFlags?: Record<string, unknown>;
  sortOrder?: number;
};

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const res = await axios.get<{ plans: PublicPlan[] }>("/api/plans");
  return res.data?.plans ?? [];
}
