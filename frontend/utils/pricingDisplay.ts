import type { PublicPlan } from "@/utils/plansApi";

export type BillingMode = "monthly" | "yearly";

export function isFreePlan(plan: PublicPlan): boolean {
  if (plan.key === "free") return true;
  const f = plan.featureFlags as { isFree?: boolean } | undefined;
  return !!f?.isFree;
}

function parseFirstNumber(s: string): number | null {
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Original list price is higher than sale price (both parse as numbers). */
export function hasStrikeThroughSale(
  originalRaw: string,
  saleRaw: string,
): boolean {
  const o = parseFirstNumber(originalRaw);
  const s = parseFirstNumber(saleRaw);
  return o != null && s != null && o > s;
}

/** "$9" from "9"; "9/mo" → "$9/mo"; keep "20% off" as-is. */
function normalizeMoney(s: string): string {
  const t = s.trim();
  if (!t || t === "—") return t;
  if (/\$\s*\d/.test(t)) return t;
  if (/[%]/.test(t)) return t;
  const n = parseFirstNumber(t);
  if (n == null) return t;
  const dollar = `$${Math.round(n)}`;
  const slash = t.indexOf("/");
  if (slash >= 0) {
    return dollar + t.slice(slash);
  }
  return dollar;
}

/** Whether this line is a price we should attach /mo or /yr to (not "20% off" copy). */
function isPriceLike(s: string): boolean {
  const t = s.trim();
  if (!t || t === "—") return false;
  if (/[%]/.test(t) || /\boff\b/i.test(t)) return false;
  return /\$/.test(t) || parseFirstNumber(t) != null;
}

/**
 * Always align interval suffix with Monthly vs Yearly toggle.
 * Replaces an existing /mo or /yr so Free "$0/mo" becomes "$0/yr" when Yearly is on.
 */
export function withBillingSuffix(line: string, billing: BillingMode): string {
  const t = line.trim();
  if (!t || t === "—") return t;
  if (!isPriceLike(t)) return t;
  const base = t.replace(/\/(mo|yr)\b/gi, "").trim();
  const suffix = billing === "yearly" ? "/yr" : "/mo";
  return `${base}${suffix}`;
}

export type PriceBlock =
  | { type: "single"; text: string }
  | { type: "sale"; original: string; sale: string; percent: number };

function formatMoneyNumber(n: number): string {
  return `$${Math.round(n)}`;
}

export function billingSubtext(
  plan: PublicPlan,
  billing: BillingMode,
  free: boolean,
): { line1: string; line2?: string } | null {
  if (free) return null;

  if (billing === "monthly") {
    return { line1: "Billed monthly" };
  }

  // Yearly view: pricing is shown per-month (derived from annual), but billed yearly.
  return { line1: "Billed " + plan.priceDisplay };
}

function parsePercent(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  // "20" or "20%" -> 20
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 100) return null;
  return n;
}

export function getPriceBlock(
  plan: PublicPlan,
  billing: BillingMode,
  free: boolean,
): PriceBlock {
  const priceDisplay = plan.priceDisplay?.trim() || "";
  const discountDisplay = plan.discountDisplay?.trim() || "";
  const showMonthlyOnly = billing === "yearly";
  const divisor = showMonthlyOnly && plan.interval === "annual" ? 12 : 1;
  const suffixBilling: BillingMode = showMonthlyOnly ? "monthly" : billing;

  if (free) {
    const line = withBillingSuffix(
      normalizeMoney(priceDisplay || "$0"),
      suffixBilling,
    );
    return { type: "single", text: line };
  }

  // Explicit originalPrice vs final price mode (new structured data)
  if (plan.originalPrice != null && priceDisplay) {
    const saleN = parseFirstNumber(priceDisplay);
    if (saleN != null && plan.originalPrice > saleN) {
      const o = plan.originalPrice;
      const percent = Math.round((1 - saleN / o) * 100);
      return {
        type: "sale",
        original: withBillingSuffix(
          formatMoneyNumber(o / divisor),
          suffixBilling,
        ),
        sale: withBillingSuffix(
          formatMoneyNumber(saleN / divisor),
          suffixBilling,
        ),
        percent: Math.max(0, percent),
      };
    }
  }

  // Percent discount mode (legacy/fallback):
  // priceDisplay = original/list (e.g. "$10"), discountDisplay = "10%" => sale becomes "$9".
  if (priceDisplay && discountDisplay) {
    const pct = parsePercent(discountDisplay);
    const originalN = parseFirstNumber(priceDisplay);
    if (pct != null && originalN != null && pct < 100) {
      const saleN = originalN * (1 - pct / 100);
      return {
        type: "sale",
        original: withBillingSuffix(
          formatMoneyNumber(originalN / divisor),
          suffixBilling,
        ),
        sale: withBillingSuffix(
          formatMoneyNumber(saleN / divisor),
          suffixBilling,
        ),
        percent: Math.round(pct),
      };
    }
  }

  // Explicit original vs sale numbers mode:
  // priceDisplay = sale, discountDisplay = original (higher)
  if (
    priceDisplay &&
    discountDisplay &&
    hasStrikeThroughSale(discountDisplay, priceDisplay)
  ) {
    const o = parseFirstNumber(discountDisplay)!;
    const s = parseFirstNumber(priceDisplay)!;
    const percent = Math.round((1 - s / o) * 100);
    return {
      type: "sale",
      original: withBillingSuffix(
        formatMoneyNumber(o / divisor),
        suffixBilling,
      ),
      sale: withBillingSuffix(formatMoneyNumber(s / divisor), suffixBilling),
      percent: Math.max(0, percent),
    };
  }

  if (priceDisplay) {
    const n = parseFirstNumber(priceDisplay);
    if (n != null) {
      return {
        type: "single",
        text: withBillingSuffix(formatMoneyNumber(n / divisor), suffixBilling),
      };
    }
  }
  const single = priceDisplay
    ? withBillingSuffix(normalizeMoney(priceDisplay), suffixBilling)
    : "—";
  return { type: "single", text: single };
}

/**
 * Short marketing line under the title (e.g. "20% off", "Spring sale").
 * Do not show bare numbers here — those belong in strike-through pricing; otherwise you get a stray "20" above $250.
 */
export function promoBadge(
  plan: PublicPlan,
  priceBlock: PriceBlock,
): string | null {
  const disc = plan.discountDisplay?.trim();
  if (!disc) return null;
  if (priceBlock.type === "sale") return null;
  const compact = disc.replace(/\s/g, "");
  // If it's a bare number, treat 1–100 as percent off (e.g. "20" => "Save 20%")
  if (/^\d+(\.\d+)?$/.test(compact)) {
    const n = parseFirstNumber(compact);
    if (n != null && n > 0 && n <= 100) return `Save ${Math.round(n)}%`;
    return null;
  }
  // If it's a bare money amount, don't show as a promo badge (likely meant as list price).
  if (/^\$?\d+(\.\d+)?$/.test(compact)) return null;
  return disc;
}

export function filterPlans(
  plans: PublicPlan[],
  mode: BillingMode,
): PublicPlan[] {
  const free = (p: PublicPlan) => isFreePlan(p);
  if (mode === "monthly") {
    return plans.filter(
      (p) => p.interval === "monthly" || p.interval === "one_time" || free(p),
    );
  }
  return plans.filter((p) => p.interval === "annual" || free(p));
}

export function sortPlans(plans: PublicPlan[]): PublicPlan[] {
  return [...plans].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Index of the card that gets "Most popular" (middle column in a 3-up row). */
export function featuredPlanIndex(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 0;
  return Math.floor(count / 2);
}

export function featureBullets(plan: PublicPlan, lowerPlan?: PublicPlan): string[] {
  const f = plan.featureFlags || {};
  const lf = lowerPlan?.featureFlags || {};
  const out: string[] = [];

  const creditsPerMonth =
    plan.interval === "annual" ? plan.creditsPerPeriod / 12 : plan.creditsPerPeriod;
  const creditsPerMonthLabel = Number.isInteger(creditsPerMonth)
    ? String(creditsPerMonth)
    : String(Number(creditsPerMonth.toFixed(2)));

  if (lowerPlan) {
    out.push(`Everything in ${lowerPlan.displayName} plan`);
  }

  // 1. Credits
  if (plan.creditsPerPeriod > (lowerPlan?.creditsPerPeriod || 0)) {
    out.push(`${creditsPerMonthLabel} credits per month`);
  } else if (!lowerPlan) {
    if (plan.creditsPerPeriod > 0) {
      out.push(`${creditsPerMonthLabel} credits per month`);
    } else {
      out.push("Starter credits included");
    }
  }

  // 2. Processing Rate (only for first plan)
  if (!lowerPlan) {
    out.push("1 credit = 1 second processing");
  }

  // 3. Max Duration
  if (f.maxInputMinutes && f.maxInputMinutes !== lf.maxInputMinutes) {
    out.push(`Up to ${f.maxInputMinutes} min per file`);
  }

  // 4. Max File Size
  if (f.maxFileSizeMB && f.maxFileSizeMB !== lf.maxFileSizeMB) {
    out.push(`Up to ${f.maxFileSizeMB} MB file size`);
  }

  // 5. Features that become enabled
  if (f.allowSpeakerDiarization && !lf.allowSpeakerDiarization) {
    out.push("Multi-speaker detection");
  }
  if (f.lipSync && !lf.lipSync) {
    out.push("Lip-sync dubbing");
  }
  if (f.watermark === false && lf.watermark !== false) {
    out.push("No watermark");
  }

  // 6. Support level upgrade
  if (f.supportLevel && f.supportLevel !== lf.supportLevel) {
    if (f.supportLevel !== "email") {
      const level = f.supportLevel.replace(/_/g, " ");
      out.push(`${level.charAt(0).toUpperCase() + level.slice(1)} support`);
    }
  }

  // 7. Export formats
  const currFmt = JSON.stringify([...(f.exportFormats || [])].sort());
  const prevFmt = JSON.stringify([...(lf.exportFormats || [])].sort());
  if (currFmt !== prevFmt && (f.exportFormats?.length ?? 0) > 0) {
    out.push(`Exports: ${f.exportFormats?.join(", ")}`);
  }

  return out.slice(0, 8);
}
