import axios from "@/utils/axios";

export type PlanInterval = "monthly" | "annual" | "one_time";

export type PublicPlan = {
  _id: string;
  key: string;
  displayName: string;
  priceDisplay?: string;
  discountDisplay?: string;
  originalPrice?: number;
  interval: PlanInterval;
  dodoProductId: string;
  creditsPerPeriod: number;
  version: number;
  featureFlags?: {
    maxInputMinutes?: number | null;
    maxFileSizeMB?: number | null;
    maxConcurrentJobs?: number | null;
    dailyLimitSeconds?: number | null;
    monthlyLimitSeconds?: number | null;
    overageAllowed?: boolean;
    dailySafetyCapSeconds?: number | null;
    dailyCostCapUSD?: number | null;
    ratePerSecondUSD?: number | null;
    ttsProviders?: string[];
    allowLibraryVoices?: boolean;
    allowVoiceCloning?: boolean;
    allowSpeakerDiarization?: boolean;
    allowSourceSeparation?: boolean;
    sourceSeparationMethods?: string[];
    lipSync?: boolean;
    allowBackgroundMixControl?: boolean;
    exportFormats?: string[];
    watermark?: boolean;
    retentionDays?: number | null;
    supportedTargetLanguages?: string[];
    queuePriority?: "normal" | "high" | "highest";
    uiBadges?: string[];
    supportLevel?: string;
  };
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
  if (typeof window !== "undefined" && !localStorage.getItem("token")) {
    return null;
  }

  try {
    const res = await axios.get<{ currentPlan: CurrentPlanResponse }>(
      "/api/billing/current-plan",
    );
    return res.data?.currentPlan ?? null;
  } catch (e) {
    return null;
  }
}
