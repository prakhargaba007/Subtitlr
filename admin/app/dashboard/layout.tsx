"use client";
import { useEffect, useState } from "react";
import NavbarNested from "@/components/Navbar/AdminNavbar";
import { Burger, Container } from "@mantine/core";
import classes from "./DashboardLayout.module.css";
import { useViewportSize } from "@mantine/hooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axios";
import { assets } from "@/assets/assets";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpened, setMobileNavOpened] = useState(false);
  const { width } = useViewportSize();
  const router = useRouter();

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    if (!userRole) {
      router.push("/");
    }
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const response = await axiosInstance.get("/api/auth/verify");
      // console.log("response", response);

      if (response.status !== 200) {
        router.push("/");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error verifying admin status:", error);
      router.push("/");
      return false;
    }
  }

  return (
    <div className={classes.layout}>
      {/* Mobile Menu Button */}
      <div
        className={classes.mobileHeader}
        style={{
          display: width < 700 ? "flex" : "none",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Burger
          opened={mobileNavOpened}
          onClick={() => setMobileNavOpened((o) => !o)}
          className={classes.burger}
          size="sm"
          hiddenFrom="sm"
        />
        {width < 700 && (
          <Image
            src={assets.MPCLogo}
            alt="School Logo"
            width={70}
            height={70}
          />
        )}
      </div>

      {/* Navbar */}
      <NavbarNested
        opened={mobileNavOpened}
        onClose={() => setMobileNavOpened(false)}
      />

      {/* Main Content */}
      <main className={classes.main}>{children}</main>
    </div>
  );
}
