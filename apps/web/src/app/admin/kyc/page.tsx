import { createMerchantApi } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "KYC Review — Admin",
};

type KycSubmission = {
  id: string;
  userId: string;
  merchantName: string;
  nationalId: string;
  documentType: "national_id" | "passport";
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
};

function StatusBadge({ status }: { status: KycSubmission["status"] }) {
  const styles: Record<KycSubmission["status"], string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminKycPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Unable to load KYC submissions. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const result = await api.listKycSubmissions();
  const submissions: KycSubmission[] = result.ok ? (result.value as KycSubmission[]) : [];
  const pending = submissions.filter((s) => s.status === "pending");

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">KYC Verification</h1>
          <p className="mt-1 text-sm text-gray-400">
            Thai National Digital ID (NDID) verification submissions for merchant onboarding.
          </p>
        </div>
        {pending.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-amber-400">{pending.length}</p>
            <p className="text-xs text-amber-400/70">pending</p>
          </div>
        )}
      </div>

      {!result.ok && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load KYC submissions: {result.error}
        </div>
      )}

      {result.ok && submissions.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-gray-800/30 px-5 py-12 text-center">
          <p className="text-2xl mb-2">🪪</p>
          <p className="text-sm font-medium text-gray-300">No KYC submissions</p>
          <p className="mt-1 text-xs text-gray-500">
            Identity verification requests will appear here when merchants apply.
          </p>
        </div>
      )}

      {submissions.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-gray-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Submitted
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Merchant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Document type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/30">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4 text-xs text-gray-300 whitespace-nowrap">
                    {formatDate(s.submittedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{s.merchantName}</p>
                    <code className="text-xs text-gray-500">{s.userId.slice(0, 12)}…</code>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400 capitalize">
                    {s.documentType.replace("_", " ")}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">{s.rejectionReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3">
            <span className="text-xs text-gray-500">
              {submissions.length} submission{submissions.length !== 1 ? "s" : ""} ·{" "}
              {pending.length} pending
            </span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-gray-800/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          NDID Verification Process
        </h3>
        <ol className="space-y-1 text-xs text-gray-500 list-decimal list-inside">
          <li>Merchant submits Thai National Digital ID (NDID) via onboarding flow</li>
          <li>NDID adapter calls Digital ID Thailand verification API</li>
          <li>Verification result posted here — admin reviews and confirms</li>
          <li>
            On approval, merchant role promoted to{" "}
            <code className="text-gray-400">store_owner</code> in PostgreSQL
          </li>
          <li>Role propagates to Firebase custom claims within 60 seconds via RoleSyncService</li>
        </ol>
      </div>
    </div>
  );
}
