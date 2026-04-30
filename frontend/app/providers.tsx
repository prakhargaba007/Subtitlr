"use client";

import { Provider } from "react-redux";
import Toaster from "@/components/Toaster";
import store from "@/redux/store";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DeviceTracker } from "@/components/DeviceTracker";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <DeviceTracker />
      {/* <Navbar /> */}
      {children}
      <Toaster />
      {/* <Footer /> */}
    </Provider>
  );
}
