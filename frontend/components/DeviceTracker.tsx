"use client";

import { useEffect, useRef } from "react";
import axiosInstance from "@/utils/axios";

// Extend the Window/Navigator interface for User-Agent Client Hints API
declare global {
  interface Navigator {
    userAgentData?: {
      brands: { brand: string; version: string }[];
      mobile: boolean;
      platform: string;
      getHighEntropyValues(hints: string[]): Promise<{
        architecture?: string;
        model?: string;
        platformVersion?: string;
        uaFullVersion?: string;
        fullVersionList?: { brand: string; version: string }[];
      }>;
    };
  }
}

/**
 * Minimal fallback parser if navigator.userAgentData is unsupported.
 * Strictly separates this logic from the modern Client Hints approach.
 */
function minimalUAParse(ua: string) {
  const isMobile = /\bMobile\b/i.test(ua);
  const os = /\bAndroid\b/i.test(ua)
    ? "Android"
    : /\b(iPhone|iPad|iPod)\b/i.test(ua)
    ? "iOS"
    : /\bWindows NT\b/i.test(ua)
    ? "Windows"
    : /\bMac OS X\b/i.test(ua)
    ? "macOS"
    : /\bLinux\b/i.test(ua)
    ? "Linux"
    : "Unknown OS";

  const browser = /\bEdg\//i.test(ua)
    ? "Edge"
    : /\bOPR\//i.test(ua)
    ? "Opera"
    : /\bChrome\//i.test(ua)
    ? "Chrome"
    : /\bFirefox\//i.test(ua)
    ? "Firefox"
    : /\bSafari\//i.test(ua) && /\bVersion\//i.test(ua)
    ? "Safari"
    : "Browser";

  return {
    os: { name: os },
    browser: { name: browser },
    device: { type: isMobile ? "mobile" : "desktop" },
    fallbackUserAgent: ua,
  };
}

export function DeviceTracker() {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    async function trackDevice() {
      try {
        let deviceInfo: any = {};

        if (navigator.userAgentData) {
          // Modern UA-CH approach
          const uaData = navigator.userAgentData;
          deviceInfo.mobile = uaData.mobile;
          deviceInfo.brands = uaData.brands;
          
          try {
            const highEntropy = await uaData.getHighEntropyValues([
              "architecture",
              "model",
              "platform",
              "platformVersion",
              "fullVersionList",
            ]);
            
            deviceInfo.os = { 
              name: highEntropy.platform || uaData.platform,
              version: highEntropy.platformVersion
            };
            deviceInfo.device = {
              model: highEntropy.model,
              architecture: highEntropy.architecture,
              type: uaData.mobile ? "mobile" : "desktop"
            };
            deviceInfo.browser = {
              fullVersionList: highEntropy.fullVersionList
            };
          } catch (e) {
            console.warn("Failed to get high entropy values", e);
            deviceInfo.os = { name: uaData.platform };
          }
        } else {
          // Fallback strategy using minimal UA parsing ONLY
          deviceInfo = minimalUAParse(navigator.userAgent);
        }

        // Send this data securely to backend
        // We catch errors silently because if the user isn't logged in, it will 401
        await axiosInstance.post("/api/auth/device-info", { deviceInfo }).catch(() => {});
        
      } catch (err) {
        console.error("Device tracking failed:", err);
      }
    }

    trackDevice();
  }, []);

  return null;
}
