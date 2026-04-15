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
  const dollar = `$${n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2)}`;
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
  const v = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
  return `$${v}`;
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
  return { line1: "Billed yearly" };
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

  // Percent discount mode (requested behavior):
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

export function featureBullets(plan: PublicPlan): string[] {
  const f = (plan.featureFlags || {}) as Record<string, unknown>;
  const out: string[] = [];
  if (plan.creditsPerPeriod > 0) {
    out.push(`${plan.creditsPerPeriod} credits per billing period`);
    out.push("1 credit = 1 minute of dubbing processing");
  } else {
    out.push("Starter credits included");
    out.push("1 credit = 1 minute of dubbing processing");
  }
  if (typeof f.maxInputMinutes === "number") {
    if (isFreePlan(plan) && f.maxInputMinutes < 10) {
      // out.push(`Up to 10 min per video`);
      out.push(`Get 30 credits free`);
    } else {
      out.push(`Up to ${f.maxInputMinutes} min per file`);
    }
  }
  if (f.lipSync === true) {
    out.push("Lip-sync dubbing");
  }
  if (Array.isArray(f.exportFormats) && f.exportFormats.length) {
    out.push(`Exports: ${(f.exportFormats as string[]).join(", ")}`);
  }
  if (typeof f.maxConcurrentJobs === "number") {
    out.push(`${f.maxConcurrentJobs} concurrent job(s)`);
  }
  return out.slice(0, 6);
}
