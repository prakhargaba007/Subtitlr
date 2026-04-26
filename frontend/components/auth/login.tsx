"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import FadingCircle from "@/components/FadingCircle";
import AuthForm from "@/components/auth/AuthForm";

const benefits = [
  "Save your generated transcriptions",
  "Access your data from any device",
  "No credit card required to start",
];

const Auth = () => {
  const [initialEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("pendingEmail") || "";
  });

  useEffect(() => {
    localStorage.removeItem("pendingEmail");
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute -top-40 -right-52 z-0">
        <FadingCircle size={900} color="var(--color-primary)" />
      </div>
      <div className="absolute -bottom-40 -left-52 z-0">
        <FadingCircle size={800} color="var(--color-secondary)" />
      </div>

      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-7xl grid md:grid-cols-2 gap-12 lg:gap-80 items-center">
          {/* Left — Benefits */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-headline font-semibold mb-6">
                <Lock className="w-3.5 h-3.5" />
                Secure Storage
              </div>
              <h1 className="font-headline font-bold text-on-surface mb-4 text-h3 md:text-h2">
                Save your progress
              </h1>
              <p className="text-body-lg text-on-surface-variant">
                Create an account to store your transcription data securely and
                access it anytime.
              </p>
            </div>

            <div className="space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-body text-on-surface">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Auth Form */}
          <AuthForm initialEmail={initialEmail} />
        </div>
      </main>
    </div>
  );
};

export default Auth;
