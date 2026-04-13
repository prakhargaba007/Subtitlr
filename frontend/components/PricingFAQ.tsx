"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

export type FAQItem = {
  q: string;
  a: string;
};

const DEFAULT_FAQ: FAQItem[] = [
  {
    q: "How does pricing work?",
    a: "Plans include credits. Subtitles and dubbing spend credits based on media length and features used.",
  },
  {
    q: "Do you charge monthly or yearly?",
    a: "You can choose monthly or yearly billing. In yearly mode we show the equivalent monthly price, but you are billed once per year.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can upgrade your plan or purchase more credits (if enabled). Your jobs will require enough credits to start.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription from your billing settings. Access continues until the end of the billing period.",
  },
  {
    q: "Can old users keep their price?",
    a: "Yes. Existing subscriptions can stay on their original billing terms, and we can update included credits per renewal if needed.",
  },
];

export default function PricingFAQ({ items = DEFAULT_FAQ }: { items?: FAQItem[] }) {
  const ids = useMemo(
    () =>
      items.map((it) =>
        it.q
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      ),
    [items]
  );
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="mt-20">
      <div className="text-center mb-10">
        <h2 className="font-headline font-bold text-h3 md:text-h2 mb-3">FAQ</h2>
        <p className="text-on-surface-variant text-body">
          Common questions about billing, credits, and subscriptions.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {items.map((it, idx) => {
          const id = ids[idx] || String(idx);
          const isOpen = openId === id;
          return (
            <div
              key={it.q}
              className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${id}`}
                onClick={() => setOpenId((cur) => (cur === id ? null : id))}
                className="w-full text-left p-6 font-headline font-semibold text-on-surface flex items-center justify-between"
              >
                <span>{it.q}</span>
                <span
                  className={`text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`}
                >
                  <ChevronDown size={18} />
                </span>
              </button>
              {isOpen ? (
                <div id={`faq-${id}`} className="px-6 pb-6">
                  <p className="text-on-surface-variant text-sm leading-relaxed">{it.a}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

