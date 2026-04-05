"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/redux/store";
import { setUserDetails, fetchUser } from "@/redux/slices/userSlice";

/**
 * Invisible component that hydrates the Redux user store on dashboard load.
 * First tries localStorage for instant load, then validates with the API.
 */
export default function DashboardInit() {
  const dispatch = useDispatch<AppDispatch>();
  const userInfo = useSelector((state: RootState) => state.user.userInfo);

  useEffect(() => {
    if (userInfo) return;

    // Fast path: hydrate from cached localStorage data
    const userDataStr = localStorage.getItem("userData");
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        dispatch(setUserDetails(userData));
      } catch {
        // ignore parse error, fall through to API
      }
    }

    // Always validate with API to get fresh data
    dispatch(fetchUser());
  }, [dispatch, userInfo]);

  return null;
}
