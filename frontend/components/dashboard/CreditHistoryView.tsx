"use client";

import { useCallback, useEffect, useState } from "react";
import axiosInstance from "@/utils/axios";

const PAGE_SIZE = 15;

export type CreditTransactionRow = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  description: string;
  metadata: Record<string, unknown>;
  date: string;
};

type HistoryResponse = {
  transactions: CreditTransactionRow[];
  total: number;
  page: number;
  pages: number;
};

const SOURCE_LABELS: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  subtitle_job: "Transcription",
  dubbing_job: "Dubbing",
  purchase: "Purchase",
  refund: "Refund",
  admin_grant: "Admin",
  subscription_initial: "Subscription",
  subscription_renewal: "Renewal",
};

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export default function CreditHistoryView() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<HistoryResponse>("/api/subtitles/credits/history", {
        params: { page: p, limit: PAGE_SIZE },
      });
      setData(res.data);
    } catch {
      setError("Could not load credit history. Try again in a moment.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  const totalPages = data?.pages ?? 0;
  const transactions = data?.transactions ?? [];

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline mb-2">
          Credit history
        </h1>
        <p className="text-on-surface-variant font-body text-sm">
          Every credit added or spent on your account, newest first.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-body">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-16 text-center text-on-surface-variant text-sm font-body">
            No transactions yet. Credits from sign-up and jobs will show up here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-body">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container/40">
                  <th className="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Date
                  </th>
                  <th className="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Type
                  </th>
                  <th className="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Source
                  </th>
                  <th className="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Details
                  </th>
                  <th className="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">
                    Change
                  </th>
                  <th className="px-5 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap">
                      {new Date(tx.date).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={
                          tx.type === "credit"
                            ? "text-emerald-700 font-semibold"
                            : "text-on-surface font-medium"
                        }
                      >
                        {tx.type === "credit" ? "Added" : "Spent"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-on-surface">{sourceLabel(tx.source)}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant max-w-[220px] truncate" title={tx.description}>
                      {tx.description || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-headline font-bold tabular-nums">
                      <span className={tx.type === "credit" ? "text-emerald-700" : "text-on-surface"}>
                        {tx.type === "credit" ? "+" : "−"}
                        {tx.amount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-on-surface-variant tabular-nums">
                      {tx.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-on-surface-variant font-body">
            Page {page} of {totalPages}
            {data?.total != null ? ` · ${data.total} total` : null}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-outline-variant/30 px-4 py-2 text-xs font-headline font-bold text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-outline-variant/30 px-4 py-2 text-xs font-headline font-bold text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
