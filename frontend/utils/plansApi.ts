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

export type CurrentPlanResponse = {
  planKey: string;
  displayName: string;
  creditsPerPeriod: number;
  interval: string;
  features: string[];
  sortOrder: number;
  status: string;
  nextBillingDate: string | null;
  cancelAtNextBillingDate: boolean;
} | null;

export async function fetchCurrentPlan(): Promise<CurrentPlanResponse> {
  try {
    const res = await axios.get<{ currentPlan: CurrentPlanResponse }>("/api/billing/current-plan");
    return res.data?.currentPlan ?? null;
  } catch (e) {
    return null;
  }
}

