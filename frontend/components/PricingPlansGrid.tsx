"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fetchPublicPlans, fetchCurrentPlan, type PublicPlan, type CurrentPlanResponse } from "@/utils/plansApi";
import {
  type BillingMode,
  billingSubtext,
  featureBullets,
  featuredPlanIndex,
  filterPlans,
  getPriceBlock,
  isFreePlan,
  promoBadge,
  sortPlans,
} from "@/utils/pricingDisplay";

export type PricingPlansGridProps = {
  variant?: "section" | "page";
};

export default function PricingPlansGrid({ variant = "section" }: PricingPlansGridProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanResponse>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingMode>("monthly");
  const [checkoutPlanKey, setCheckoutPlanKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedPlans, fetchedCurrent] = await Promise.all([
        fetchPublicPlans(),
        fetchCurrentPlan()
      ]);
      setPlans(fetchedPlans);
      setCurrentPlan(fetchedCurrent);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load plans");
      setPlans([]);
      setCurrentPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => sortPlans(filterPlans(plans, billing)), [plans, billing]);

  const popularIndex = useMemo(() => featuredPlanIndex(visible.length), [visible.length]);

  const titleClass = variant === "page" ? "text-h2 md:text-h1" : "text-h3 md:text-h2";

  async function startDodoCheckout(planKey: string) {
    if (typeof window === "undefined") return;
    if (checkoutPlanKey) return; // Strict lock to prevent multi-click spam
    
    const token = localStorage.getItem("token");
    if (!token) {
      // login page does not support redirect params yet; keep it simple
      router.push("/login");
      return;
    }

    setCheckoutPlanKey(planKey);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/billing/dodo/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || `Checkout failed (${res.status})`);
      }
      const url = json?.checkoutUrl as string | undefined;
      if (!url) throw new Error("Missing checkoutUrl from backend.");
      window.location.href = url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      setError(msg);
      setCheckoutPlanKey(null);
    }
  }

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10 md:mb-12">
        <div className="text-center sm:text-left">
          <h2 className={`font-headline font-bold mb-2 ${titleClass}`}>Transparent Pricing</h2>
          <p className="text-on-surface-variant text-body max-w-xl">
            Compare plans. Prices are for display; billing runs through Dodo at checkout.
          </p>
        </div>

        <div
          className="inline-flex rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-1 self-center sm:self-auto"
          role="group"
          aria-label="Billing period"
        >
          {(["monthly", "yearly"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setBilling(mode)}
              className={`rounded-xl px-5 py-2 text-sm font-headline font-semibold transition-colors ${billing === mode
                ? "bg-primary text-white shadow-md"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              {mode === "monthly" ? "Monthly" : "Yearly · save 20%"}
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface-container-lowest p-10 rounded-4xl border border-outline-variant/10 animate-pulse h-96"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-center text-on-surface-variant text-body mb-8">{error}</p>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className="text-center text-on-surface-variant text-body">
          No plans for this billing period. Add plans in the admin catalog.
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {visible.map((plan, index) => {
            const free = isFreePlan(plan);
            const popular = index === popularIndex;
            const price = getPriceBlock(plan, billing, free);
            const bullets = featureBullets(plan);
            const bill = billingSubtext(plan, billing, free);

            const cardClass = popular
              ? "border-2 border-primary editorial-glow transform md:scale-105 shadow-2xl z-10"
              : "border-outline-variant/10 hover:shadow-xl transition-all";

            return (
              <article
                key={plan._id}
                className={`bg-surface-container-lowest p-10 rounded-4xl border relative flex flex-col ${cardClass}`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
                    Most popular
                  </div>
                )}

                <h3 className="font-headline text-h4 font-bold mb-2">{plan.displayName}</h3>

                <div className="mb-6 min-h-10">
                  {price.type === "sale" ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-body text-on-surface-variant line-through">{price.original}</p>
                        <p className="font-bold text-h3 text-primary">{price.sale}</p>
                      </div>

                    </div>
                  ) : (
                    <p className="font-bold text-h3">{price.text}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    {bill ? (
                      <div className="text-xs text-on-surface-variant">
                        <div className="font-headline font-semibold">{bill.line1}</div>
                        {bill.line2 ? <div>{bill.line2}</div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <ul className="space-y-4 mb-10 text-on-surface-variant text-sm flex-1">
                  {bullets.map((line) => (
                    <li key={line} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {free ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-full rounded-xl"
                    onClick={() => router.push("/login")}
                    disabled={currentPlan?.planKey === plan.key}
                  >
                    {currentPlan?.planKey === plan.key ? "Current Plan" : "Start free"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={popular && currentPlan?.planKey !== plan.key ? "primary" : "outline"}
                    size="md"
                    className={`w-full rounded-xl ${popular ? "hover:scale-[1.02]" : ""}`}
                    style={popular ? { boxShadow: "0 10px 30px -8px rgba(57,44,193,0.3)" } : undefined}
                    disabled={checkoutPlanKey === plan.key || currentPlan?.planKey === plan.key}
                    onClick={() => startDodoCheckout(plan.key)}
                  >
                    {currentPlan?.planKey === plan.key
                      ? "Current Plan"
                      : currentPlan && (plan.sortOrder ?? 0) < currentPlan.sortOrder
                        ? "Downgrade"
                        : currentPlan && (plan.sortOrder ?? 0) > currentPlan.sortOrder
                          ? "Upgrade"
                          : checkoutPlanKey === plan.key ? "Redirecting…" : "Get started"}
                  </Button>
                )}
              </article>
            );
          })}

          {/* <article className="bg-surface-container-lowest p-10 rounded-4xl border relative flex flex-col border-outline-variant/10 hover:shadow-xl transition-all">
            <h3 className="font-headline text-h4 font-bold mb-2">Enterprise</h3>
            <div className="mb-6 min-h-10">
              <p className="font-bold text-h3">Custom</p>
              <div className="flex items-center gap-1 mt-2">
                <div className="text-xs text-on-surface-variant">
                  <div className="font-headline font-semibold">Volume-based pricing</div>
                </div>
              </div>
            </div>

            <ul className="space-y-4 mb-10 text-on-surface-variant text-sm flex-1">
              <li className="flex items-center gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Volume-based pricing</li>
              <li className="flex items-center gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Team Sync workspaces</li>
              <li className="flex items-center gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Service level agreements</li>
              <li className="flex items-center gap-3"><span className="material-symbols-outlined text-primary text-lg">check_circle</span> Dedicated account manager</li>
            </ul>

            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-full rounded-xl"
              onClick={() => router.push("/feedback")}
            >
              Contact sales
            </Button>
          </article> */}
        </div>
      )}
    </>
  );
}
