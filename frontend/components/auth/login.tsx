"use client";

import { useState } from "react";
import { Lock, Check } from "lucide-react";
import FadingCircle from "@/components/FadingCircle";
import AuthForm from "@/components/auth/AuthForm";

const Auth = () => {
  // Check for pending email from localStorage (e.g., from ExportSave page)
  // Use lazy initializer to avoid setState in useEffect
  const [initialEmail] = useState(() => {
    if (typeof window !== "undefined") {
      const pendingEmail = localStorage.getItem("pendingEmail");
      if (pendingEmail) {
        // Clear pending email after pre-filling
        localStorage.removeItem("pendingEmail");
        return pendingEmail;
      }
    }
    return "";
  });

  const benefits = [
    "Save your 3 generated resumes",
    "Access your data from any device",
    "No credit card required to start",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Header */}
      {/* <MainNav /> */}
      <div className="absolute -top-40 -right-52 z-0">
        <FadingCircle size={900} color="#3b82f6" />
      </div>
      <div className="absolute -bottom-40 -left-52 z-0">
        <FadingCircle size={800} color="#4c2b94" />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-7xl grid md:grid-cols-2 gap-12 lg:gap-80 items-center">
          {/* Left - Benefits */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                <Lock className="w-3.5 h-3.5" />
                SECURE STORAGE
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
                Save your progress
              </h1>
              <p className="text-lg text-muted-foreground">
                Create an account to store your resume data securely and access
                it anytime.
              </p>
            </div>

            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Auth Form */}
          <AuthForm initialEmail={initialEmail} />
        </div>
      </main>
    </div>
  );
};

export default Auth;
