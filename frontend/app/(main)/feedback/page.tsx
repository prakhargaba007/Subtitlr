"use client";

import { useState } from "react";
import axiosInstance from "@/utils/axios";
import FadingCircle from "@/components/FadingCircle";

const FEEDBACK_TYPES = [
  { id: "praise", label: "Praise", icon: "favorite", desc: "Something you love" },
  { id: "feature", label: "Feature Request", icon: "lightbulb", desc: "Something we should build" },
  { id: "bug", label: "Bug Report", icon: "bug_report", desc: "Something isn't working" },
  { id: "general", label: "General", icon: "chat_bubble", desc: "Anything else on your mind" },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["id"];

type FormState = {
  name: string;
  email: string;
  type: FeedbackType;
  rating: number;
  message: string;
};

const INITIAL: FormState = { name: "", email: "", type: "general", rating: 5, message: "" };

export default function FeedbackPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setErrorMsg("Please fill in all required fields.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      await axiosInstance.post("/api/feedback", form);
      setStatus("success");
      setForm(INITIAL);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  return (
    <main className="relative pt-32 pb-24 overflow-x-clip px-4 md:px-8">
      {/* Background decoration matching pricing & hero pages */}
      <div aria-hidden className="pointer-events-none absolute left-40 top-0 -translate-x-1/2 -translate-y-[15%] -z-10">
        <FadingCircle size={560} color="var(--color-primary)" />
      </div>
      <div aria-hidden className="pointer-events-none absolute right-20 bottom-24 translate-x-1/4 translate-y-1/4 -z-10 opacity-90">
        <FadingCircle size={360} color="var(--color-secondary)" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-primary/5 px-4 py-1.5 rounded-full mb-8">
            <span className="material-symbols-outlined text-base leading-none text-primary">feedback</span>
            <span className="text-xs font-headline font-bold uppercase tracking-widest text-primary">
              Share your thoughts
            </span>
          </div>

          <h1 className="font-headline text-h2 md:text-h1 leading-[1.1] font-bold text-on-surface mb-6 tracking-tight">
            We&apos;d love your <span className="text-primary bg-clip-text bg-linear-to-r from-primary to-secondary">feedback</span>
          </h1>
          <p className="text-on-surface-variant text-body-lg max-w-2xl mx-auto leading-relaxed font-light">
            Every suggestion helps us build a better Kili. Tell us what you think — good, bad, or anywhere in between.
          </p>
        </div>

        {status === "success" ? (
          /* ── Success state ── */
          <div className="bg-surface-container-lowest p-10 rounded-4xl border border-outline-variant/10 shadow-xl text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mx-auto text-on-secondary-container mb-4">
              <span className="material-symbols-outlined text-4xl">volunteer_activism</span>
            </div>
            <h2 className="text-h3 font-bold font-headline">Thank you! 🎉</h2>
            <p className="text-on-surface-variant text-body max-w-md mx-auto">
              Your feedback has been received. We&apos;ll send a confirmation to your email and will use your input to improve Kili.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-8 px-8 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface text-sm font-headline font-semibold hover:bg-surface-container-highest transition-colors inline-block"
            >
              Send more feedback
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="bg-surface-container-lowest p-8 sm:p-12 rounded-4xl border border-outline-variant/10 shadow-2xl editorial-glow space-y-10"
          >
            {/* Feedback type */}
            <div>
              <label className="block text-body font-headline font-bold text-on-surface mb-4">
                What kind of feedback is this?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FEEDBACK_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set("type", t.id)}
                    className={[
                      "relative flex items-start gap-4 p-5 rounded-2xl border text-left transition-all",
                      form.type === t.id
                        ? "bg-primary-container/30 border-primary"
                        : "bg-surface-container-low border-outline-variant/20 hover:bg-surface-container",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "material-symbols-outlined text-2xl mt-0.5 shrink-0 transition-colors text-primary",
                      ].join(" ")}
                    >
                      {t.icon}
                    </span>
                    <div>
                      <p className={["text-body font-headline font-bold", form.type === t.id ? "text-primary" : "text-on-surface"].join(" ")}>
                        {t.label}
                      </p>
                      <p className={["text-xs mt-1", form.type === t.id ? "text-primary opacity-80" : "text-on-surface-variant"].join(" ")}>{t.desc}</p>
                    </div>
                    {form.type === t.id && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Star rating */}
            <div>
              <label className="block text-body font-headline font-bold text-on-surface mb-3">
                How would you rate your experience?
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => set("rating", star)}
                    className="group relative p-1"
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                  >
                    <span
                      className={[
                        "material-symbols-outlined text-4xl transition-all",
                        star <= form.rating
                          ? "text-amber-500 scale-110"
                          : "text-outline/40 group-hover:text-amber-400",
                      ].join(" ")}
                      style={{ fontVariationSettings: star <= form.rating ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      star
                    </span>
                  </button>
                ))}
                <span className="ml-4 text-sm text-on-surface-variant font-headline font-semibold">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][form.rating]}
                </span>
              </div>
            </div>

            <hr className="border-outline-variant/10" />

            {/* Name + Email */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="fb-name" className="block text-sm font-headline font-bold text-on-surface mb-2">
                  Your name <span className="text-primary">*</span>
                </label>
                <input
                  id="fb-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  className="w-full px-5 py-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
                />
              </div>
              <div>
                <label htmlFor="fb-email" className="block text-sm font-headline font-bold text-on-surface mb-2">
                  Email <span className="text-primary">*</span>
                </label>
                <input
                  id="fb-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="ada@example.com"
                  required
                  className="w-full px-5 py-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-body"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="fb-message" className="block text-sm font-headline font-bold text-on-surface mb-2">
                Your message <span className="text-primary">*</span>
              </label>
              <textarea
                id="fb-message"
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Tell us what you think, what's broken, or what you'd love to see next…"
                rows={5}
                required
                className="w-full resize-none px-5 py-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface placeholder:text-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all leading-relaxed font-body"
              />
              <p className="text-xs text-on-surface-variant flex justify-between mt-2">
                <span>Markdown is not supported.</span>
                <span>{form.message.length} characters</span>
              </p>
            </div>

            {/* Error */}
            {status === "error" && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
                <span className="material-symbols-outlined text-xl shrink-0">error</span>
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-4 rounded-xl bg-primary text-on-primary font-headline font-bold text-body hover:bg-primary-container hover:text-on-primary-container active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
            >
              {status === "loading" ? (
                <>
                  <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl leading-none">send</span>
                  Send Feedback
                </>
              )}
            </button>

            <p className="text-center text-xs text-on-surface-variant max-w-sm mx-auto pt-2">
              We read every submission personally. Your email is only used to follow up if needed.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
