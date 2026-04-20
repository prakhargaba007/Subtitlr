"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchCurrentPlan, type CurrentPlanResponse } from "@/utils/plansApi";
import PricingPlansGrid from "@/components/PricingPlansGrid";
import { Button } from "@/components/ui/Button";

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerifying = searchParams.get("verifying") === "true";

  const [currentPlan, setCurrentPlan] = useState<CurrentPlanResponse>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(isVerifying);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    const expiresAt = Date.now() + 30000; // 30s timeout

    const pollPlan = async () => {
      try {
        const plan = await fetchCurrentPlan();
        console.log("plan", plan);


        // If we are actively verifying, check if we found an active plan
        if (isVerifying && plan?.status === "active") {
          setCurrentPlan(plan);
          setIsPolling(false);
          setLoading(false);
          router.replace("/dashboard/billing"); // Drop the query param cleanly
          return;
        }

        setCurrentPlan(plan);
      } finally {
        if (!isVerifying) setLoading(false);
      }

      if (isVerifying && Date.now() < expiresAt) {
        timerId = setTimeout(pollPlan, 2000);
      } else {
        setIsPolling(false);
        setLoading(false);
        if (isVerifying) router.replace("/dashboard/billing");
      }
    };

    pollPlan();

    return () => clearTimeout(timerId);
  }, [isVerifying, router]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <h1 className="text-h2 md:text-h1 font-headline font-bold mb-8">Billing & Subscription</h1>

      {loading || isPolling ? (
        <div className="flex flex-col items-center justify-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 mb-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant font-bold animate-pulse text-sm">
            {isPolling ? "Confirming upgrade & syncing latest status..." : "Loading..."}
          </p>
        </div>
      ) : currentPlan ? (
        <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-8 mb-16 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-primary mb-2">Current Plan</p>
              <h2 className="text-h3 font-headline font-bold mb-2">{currentPlan.displayName}</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-on-surface-variant font-body">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">toll</span>
                  <span className="font-semibold text-on-surface">{currentPlan.creditsPerPeriod} credits</span> / {currentPlan.interval}
                </div>
                {currentPlan.nextBillingDate && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">event</span>
                    <span>
                      Renews on <span className="font-semibold text-on-surface">{new Date(currentPlan.nextBillingDate).toLocaleDateString()}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-container rounded-2xl p-4 flex flex-col md:items-end">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${currentPlan.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} mb-2`}>
                {currentPlan.status}
              </span>
              {currentPlan.cancelAtNextBillingDate && (
                <p className="text-xs text-red-500 font-medium">Cancels at next billing date</p>
              )}
            </div>
          </div>

          {currentPlan.features && currentPlan.features.length > 0 && (
            <div className="mt-8 pt-8 border-t border-outline-variant/20">
              <p className="text-sm font-bold text-on-surface-variant mb-4">Included Features</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentPlan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-8 mb-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant">wallet</span>
          </div>
          <h2 className="text-h4 font-headline font-bold mb-2">No Active Subscription</h2>
          <p className="text-on-surface-variant max-w-md">
            You are currently on the free plan. Upgrade below to access premium features and more credits.
          </p>
        </section>
      )}

      {/* Pricing Grids visible directly on Billing page */}
      <div className="mt-12">
        <PricingPlansGrid variant="section" />
      </div>
    </div>
  );
}
