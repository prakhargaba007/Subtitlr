import type { Metadata } from "next";
import CreditHistoryView from "@/components/dashboard/CreditHistoryView";

export const metadata: Metadata = {
  title: "Credit history | Kili",
  description: "Credits added and spent on your Kili account.",
};

export default function CreditHistoryPage() {
  return <CreditHistoryView />;
}
