"use client";

import { useEffect } from "react";
import axiosInstance from "@/utils/axios";

/**
 * Invisible component — mounts once per page load and ensures every visitor
 * has a JWT token in localStorage. If none exists a temporary user account
 * is created on the backend (12 welcome credits) and the token is saved.
 */
export default function TempUserInit() {
  useEffect(() => {
    const existing = localStorage.getItem("token");
    if (existing) return;

    axiosInstance
      .post("/api/auth/create-temp-user")
      .then((res) => {
        const { token, user } = res.data;
        if (token) {
          localStorage.setItem("token", token);
        }
        if (user) {
          localStorage.setItem("userData", JSON.stringify(user));
        }
      })
      .catch((err) => {
        console.error("Failed to create temp user:", err?.response?.data ?? err.message);
      });
  }, []);

  return null;
}
