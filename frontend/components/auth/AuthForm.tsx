"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axios";
import { setUserDetails } from "@/redux/slices/userSlice";
import { Button } from "@/components/ui/Button";

interface AuthFormProps {
  initialEmail?: string;
  onSuccess?: (user: unknown) => void;
  className?: string;
  compact?: boolean;
  autoRedirect?: boolean;
}

export default function AuthForm({
  initialEmail = "",
  onSuccess,
  className = "",
  compact = false,
  autoRedirect = true,
}: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { toast } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const codeClientRef = useRef<unknown>(null);
  const googleLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!initialEmail) return;
    setEmail((prev) => (prev.trim() === "" ? initialEmail : prev));
  }, [initialEmail]);

  // If the user changes inputs / tries again, never keep a stale "Verifying…" state.
  useEffect(() => {
    if (!isLoading) return;
    setIsLoading(false);
    if (googleLoadingTimeoutRef.current) {
      clearTimeout(googleLoadingTimeoutRef.current);
      googleLoadingTimeoutRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, otp, agreedToTerms, showOtpInput]);

  const handleRequestOTPWithEmail = useCallback(
    async (emailToUse: string) => {
      if (!emailToUse || !emailToUse.includes("@")) return;

      // If a previous verify/google flow got stuck, requesting OTP should recover UI.
      setIsLoading(false);
      setOtpLoading(true);
      try {
        const response = await axiosInstance.post("/api/auth/opt-generate", {
          email: emailToUse,
          purpose: "email_verification",
        });

        if (response.data.success) {
          setShowOtpInput(true);
          toast({ title: "OTP Sent", description: "OTP has been sent to your email" });
        }
      } catch (error: unknown) {
        console.error("Error requesting OTP:", error);
        const errorMessage =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to send OTP"
            : "Failed to send OTP";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
        setOtpLoading(false);
      }
    },
    [toast]
  );

  const handleGoogleAuthCode = useCallback(
    async (response: { code?: string; error?: string }) => {
      try {
        if (response?.error) throw new Error(response.error);
        const code = response?.code;
        if (!code) throw new Error("Missing authorization code");

        const tempUserId = localStorage.getItem("userId");
        const isTempUser = localStorage.getItem("isTempUser") === "true";

        const res = await axiosInstance.post("/api/auth/google-exchange", {
          code,
          tempUserId: isTempUser && tempUserId ? tempUserId : undefined,
        });

        localStorage.setItem("userData", JSON.stringify(res.data.user));
        if (isTempUser) localStorage.removeItem("isTempUser");

        dispatch(setUserDetails(res.data.user));
        toast({ title: "Success", description: "Signed in with Google successfully!" });

        if (onSuccess) {
          onSuccess(res.data.user);
        } else if (autoRedirect) {
          const nextPath = searchParams.get("next") || localStorage.getItem("redirectAfterLogin") || "/dashboard";
          console.log("[AUTH] Redirecting to:", nextPath);
          localStorage.removeItem("redirectAfterLogin");
          router.push(nextPath);
        }
      } catch (error: unknown) {
        console.error("Google auth code exchange error:", error);
        const errorMessage =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to sign in with Google"
            : "Failed to sign in with Google";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, router, toast, onSuccess, autoRedirect]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const existing = document.getElementById("google-gsi");
    if (existing) {
      const googleWindow = window as typeof window & {
        google?: {
          accounts?: {
            oauth2?: {
              initCodeClient: (config: {
                client_id: string;
                scope: string;
                ux_mode: string;
                redirect_uri: string;
                callback: (response: { code?: string; error?: string }) => void;
              }) => { requestCode: () => void };
            };
          };
        };
      };
      if (googleWindow.google?.accounts?.oauth2) {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (clientId) {
          codeClientRef.current = googleWindow.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: "openid email profile",
            ux_mode: "popup",
            redirect_uri: "postmessage",
            callback: handleGoogleAuthCode,
          });
          setGsiReady(true);
        }
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.id = "google-gsi";
    script.onload = () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
        setGsiReady(false);
        return;
      }
      const googleWindow = window as typeof window & {
        google?: {
          accounts?: {
            oauth2?: {
              initCodeClient: (config: {
                client_id: string;
                scope: string;
                ux_mode: string;
                redirect_uri: string;
                callback: (response: { code?: string; error?: string }) => void;
              }) => { requestCode: () => void };
            };
          };
        };
      };
      if (googleWindow.google?.accounts?.oauth2) {
        codeClientRef.current = googleWindow.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: "openid email profile",
          ux_mode: "popup",
          redirect_uri: "postmessage",
          callback: handleGoogleAuthCode,
        });
        setGsiReady(true);
      }
    };
    document.head.appendChild(script);
  }, [handleGoogleAuthCode]);

  const handleRequestOTP = async () => {
    if (!email || !email.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setIsLoading(false);
    await handleRequestOTPWithEmail(email);
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter a 6-digit OTP", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: "Terms Required", description: "Please agree to the Terms of Service and Privacy Policy.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const tempUserId = localStorage.getItem("userId");
      const isTempUser = localStorage.getItem("isTempUser") === "true";

      const response = await axiosInstance.post("/api/auth/verify-otp", {
        email,
        otp,
        purpose: "email_verification",
        tempUserId: isTempUser && tempUserId ? tempUserId : undefined,
      });

      if (response.data.success) {
        localStorage.setItem("userData", JSON.stringify(response.data.user));
        if (isTempUser) localStorage.removeItem("isTempUser");

        dispatch(setUserDetails(response.data.user));
        toast({ title: "Success", description: "Signed in successfully!" });

        if (onSuccess) {
          onSuccess(response.data.user);
        } else if (autoRedirect) {
          const nextPath = searchParams.get("next") || localStorage.getItem("redirectAfterLogin") || "/dashboard";
          localStorage.removeItem("redirectAfterLogin");
          router.push(nextPath);
        }
      }
    } catch (error: unknown) {
      console.error("Error verifying OTP:", error);
      const errorMessage =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to verify OTP"
          : "Failed to verify OTP";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    if (!gsiReady) {
      toast({
        title: "Google Sign-In",
        description: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
          ? "Initializing Google… please try again in a moment"
          : "Missing Google Client ID. Please configure it and reload.",
        variant: "default",
      });
      setIsLoading(false);
      return;
    }
    const client = codeClientRef.current as { requestCode: () => void } | null;
    if (client && typeof client.requestCode === "function") {
      client.requestCode();
      if (googleLoadingTimeoutRef.current) {
        clearTimeout(googleLoadingTimeoutRef.current);
      }
      // Popup flows can fail silently (blocked/closed) without invoking the callback.
      // Ensure the UI doesn't remain stuck in "Verifying…".
      googleLoadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Google Sign-In",
          description: "Sign-in didn’t complete. Please try again.",
          variant: "default",
        });
      }, 15000);
    } else {
      toast({ title: "Error", description: "Google client not ready", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 text-on-surface placeholder:text-on-surface-variant/60 font-body text-body outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
  const labelClass = "font-headline text-sm font-semibold text-on-surface";

  return (
    <div
      className={`rounded-3xl border border-slate-200/60 bg-surface-container-lowest shadow-xl editorial-glow ${compact ? "p-6" : "p-8"} ${className}`}
    >
      <div className="space-y-6">
        {/* Google Sign In */}
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full text-body"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/70" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest">
            <span className="bg-surface-container-lowest px-3 font-headline font-bold text-on-surface-variant">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className={labelClass}>
            Email Address
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} min-h-12 flex-1`}
              disabled={showOtpInput}
              autoComplete="email"
            />
            {!showOtpInput && (
              <Button
                type="button"
                variant="outline"
                size="md"
                className="min-h-12 shrink-0 whitespace-nowrap sm:px-8"
                onClick={handleRequestOTP}
                disabled={otpLoading}
              >
                {otpLoading ? "Sending…" : "Request OTP"}
              </Button>
            )}
          </div>
        </div>

        {/* OTP Input */}
        {showOtpInput && (
          <>
            <div className="space-y-2">
              <label htmlFor="otp" className={labelClass}>
                Enter OTP
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} min-h-12`}
                maxLength={6}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-on-surface-variant">
                  Didn&apos;t receive the code?
                </span>
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={otpLoading}
                  className="font-headline font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {otpLoading ? "Resending…" : "Resend OTP"}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded-md border-outline-variant text-primary accent-primary focus:ring-2 focus:ring-primary/25"
              />
              <label
                htmlFor="terms"
                className="cursor-pointer font-body text-sm leading-relaxed text-on-surface-variant"
              >
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="font-headline font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-headline font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            {/* Verify OTP Button */}
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full"
              disabled={isLoading}
              onClick={handleVerifyOTP}
            >
              {isLoading ? "Verifying…" : "Verify OTP & Sign In"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
