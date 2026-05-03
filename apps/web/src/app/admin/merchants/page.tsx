import { createMerchantApi } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Merchants — Admin",
};

type Merchant = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: string;
  status: "pending" | "active" | "suspended";
  createdAt: string;
};

function StatusBadge({ status }: { status: Merchant["status"] }) {
  const styles: Record<Merchant["status"], string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminMerchantsPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Unable to load merchants. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const result = await api.listMerchants();
  const merchants: Merchant[] = result.ok ? (result.value as Merchant[]) : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Merchants</h1>
          <p className="mt-1 text-sm text-gray-400">
            Registered store owners and their account status.
          </p>
        </div>
        {merchants.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-gray-800/40 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-white">{merchants.length}</p>
            <p className="text-xs text-gray-400">total</p>
          </div>
        )}
      </div>

      {!result.ok && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load merchants: {result.error}
        </div>
      )}

      {result.ok && merchants.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-gray-800/30 px-5 py-12 text-center">
          <p className="text-2xl mb-2">🏪</p>
          <p className="text-sm font-medium text-gray-300">No merchants registered</p>
          <p className="mt-1 text-xs text-gray-500">
            Merchants will appear here once they register their stores.
          </p>
        </div>
      )}

      {merchants.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-gray-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Merchant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  User ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/30">
              {merchants.map((m) => (
                <tr key={m.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{m.displayName}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                      {m.userId.slice(0, 12)}…
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">{formatDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3">
            <span className="text-xs text-gray-500">
              {merchants.length} merchant{merchants.length !== 1 ? "s" : ""} registered
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
