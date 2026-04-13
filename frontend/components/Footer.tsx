"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  "Privacy Policy",
  "Terms of Service",
  "Help Center",
  "API Status",
  "Twitter",
  "GitHub",
];

export default function Footer() {
  const pathname = usePathname();
  const isBillingSuccess = pathname === "/billing/success";

  if (isBillingSuccess) {
    return (
      <footer className="border-t border-white/10 py-10 bg-[#0a0b14] text-slate-400">
        <div className="flex flex-col items-center px-8 max-w-7xl mx-auto gap-6">
          <p className="text-center text-sm text-slate-500">
            Exclusive Priority Support active.{" "}
            <a className="text-[#d4af37] font-semibold hover:underline" href="#">
              Talk to an Agent
            </a>
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-slate-500 hover:text-[#d4af37] transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="text-center border-t border-white/5 pt-8 w-full">
            <p className="font-headline font-bold text-white mb-0.5">Subtitlr</p>
            <p className="text-sm text-slate-500">© 2026 Subtitlr AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-outline-variant/20 py-10 bg-surface">
      <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-4">
        <div className="mb-4 md:mb-0 text-center md:text-left">
          <p className="font-headline font-bold text-on-surface mb-0.5">Subtitlr</p>
          <p className="text-sm text-on-surface-variant">
            © 2026 Subtitlr AI. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
