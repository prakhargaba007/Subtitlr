"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import axios from "@/utils/axios";
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

const SUBTITLE_CREDITS_PER_MINUTE = 5;
const DUBBING_CREDITS_PER_SECOND = 1;

function getMonthlyCredits(plan: PublicPlan): number {
  return plan.interval === "annual" ? plan.creditsPerPeriod / 12 : plan.creditsPerPeriod;
}

function formatCreditAllowance(plan: PublicPlan): string {
  const monthlyCredits = getMonthlyCredits(plan);
  const roundedCredits = Math.floor(monthlyCredits);
  return roundedCredits.toLocaleString();
}

function formatSubtitleMinutes(plan: PublicPlan): string {
  const monthlyCredits = getMonthlyCredits(plan);
  const minutes = Math.floor(monthlyCredits / SUBTITLE_CREDITS_PER_MINUTE);
  return `${minutes.toLocaleString()} min`;
}

function formatDubbingMinutes(plan: PublicPlan): string {
  const monthlyCredits = getMonthlyCredits(plan);
  const seconds = Math.floor(monthlyCredits / DUBBING_CREDITS_PER_SECOND);
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toLocaleString()} min`;
}

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

    setCheckoutPlanKey(planKey);
    try {
      const res = await axios.post("/api/billing/dodo/checkout-session", { planKey });
      const url = res.data?.checkoutUrl as string | undefined;
      if (!url) throw new Error("Missing checkoutUrl from backend.");
      window.location.href = url;
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else if (typeof e === "string") {
        setError(e);
      } else {
        setError("An unknown error occurred");
      }
      setCheckoutPlanKey(null);
    }
  }

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10 md:mb-12">
        <div className="text-center sm:text-left">
          <h2 className={`font-headline font-bold mb-2 ${titleClass}`}>Transparent Pricing</h2>
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
              {mode === "monthly" ? "Monthly" : "Yearly · save 18%"}
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {visible.map((plan, index) => {
              const free = isFreePlan(plan);
              const popular = index === popularIndex;
              const price = getPriceBlock(plan, billing, free);
              const bullets = featureBullets(plan, index > 0 ? visible[index - 1] : undefined);
              const bill = billingSubtext(plan, billing, free);

              const cardClass = popular
                ? "border-2 border-primary editorial-glow transform md:scale-105 shadow-2xl z-10"
                : "border-outline-variant/10 hover:shadow-xl transition-all";

              return (
                <article
                  key={plan._id}
                  className={`bg-surface-container-lowest p-10 rounded-4xl border relative flex flex-col ${cardClass}`}
                >
                  {(plan.featureFlags?.uiBadges?.length ?? 0) > 0 ? (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {plan.featureFlags?.uiBadges?.map((badge) => (
                        <div
                          key={badge}
                          className="bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-lg"
                        >
                          {badge.replace(/_/g, " ")}
                        </div>
                      ))}
                    </div>
                  ) : popular ? (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
                      Most popular
                    </div>
                  ) : null}

                  <h3 className="font-headline text-h4 font-bold mb-2">{plan.displayName}</h3>

                  <div className="mb-6 min-h-10">
                    {price.type === "sale" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-body text-on-surface-variant line-through">{price.original}</p>
                          <p className="font-bold text-h3 text-primary">{price.sale}</p>
                          {price.percent > 0 && (
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded ml-2 uppercase tracking-wide">
                              Save {price.percent}%
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-h3">{price.text}</p>
                        {promoBadge(plan, price) && (
                          <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded ml-2 uppercase tracking-wide">
                            {promoBadge(plan, price)}
                          </span>
                        )}
                      </div>
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

          <section className="mt-16 md:mt-20 rounded-4xl border border-outline-variant/10 bg-surface-container-lowest p-8 md:p-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Credit details</p>
                <h3 className="font-headline text-h4 md:text-h3 font-bold">What your credits include</h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-outline-variant/10 text-xs uppercase tracking-widest text-on-surface-variant">
                    <th className="py-4 pr-6 font-headline font-bold">Plan</th>
                    <th className="py-4 px-6 font-headline font-bold">Credits / month</th>
                    <th className="py-4 px-6 font-headline font-bold">Subtitle credits</th>
                    <th className="py-4 px-6 font-headline font-bold">Dubbing credits</th>
                    <th className="py-4 pl-6 font-headline font-bold">Best for</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {visible.map((plan) => (
                    <tr key={`credit-details-${plan._id}`} className="text-sm">
                      <td className="py-5 pr-6">
                        <div className="font-headline font-bold text-on-surface">{plan.displayName}</div>
                        <div className="text-xs text-on-surface-variant">
                          {plan.interval === "annual" && billing === "yearly"
                            ? "Annual allowance shown monthly"
                            : "Monthly allowance"}
                        </div>
                      </td>
                      <td className="py-5 px-6 font-bold text-on-surface">
                        {formatCreditAllowance(plan)}
                      </td>
                      <td className="py-5 px-6 text-on-surface-variant">
                        Up to {formatSubtitleMinutes(plan)} subtitles
                      </td>
                      <td className="py-5 px-6 text-on-surface-variant">
                        Up to {formatDubbingMinutes(plan)} dubbing
                      </td>
                      <td className="py-5 pl-6 text-on-surface-variant">
                        {isFreePlan(plan)
                          ? "Trying short clips"
                          : plan.featureFlags?.queuePriority === "highest"
                            ? "Teams and high volume"
                            : plan.featureFlags?.queuePriority === "high"
                              ? "Regular creators"
                              : "Growing projects"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl bg-surface-container p-5">
                <p className="font-headline font-bold mb-1">Subtitle generation</p>
                <p className="text-sm text-on-surface-variant">5 credits per started minute.</p>
              </div>
              <div className="rounded-3xl bg-surface-container p-5">
                <p className="font-headline font-bold mb-1">Dubbing</p>
                <p className="text-sm text-on-surface-variant">1 credit per second, rounded up.</p>
              </div>
              <div className="rounded-3xl bg-surface-container p-5">
                <p className="font-headline font-bold mb-1">Unused credits</p>
                <p className="text-sm text-on-surface-variant">Credits are checked before each job starts.</p>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
