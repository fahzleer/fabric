import { Skeleton } from "@fabric/ui";

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-8 h-8 w-56" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Address + payment column */}
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-4 rounded-lg bg-card p-6">
              <Skeleton className="h-5 w-40" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {["a-0", "a-1", "a-2", "a-3"].map((key) => (
                  <Skeleton key={key} className="h-10 w-full rounded-md" />
                ))}
              </div>
            </div>
            <div className="space-y-4 rounded-lg bg-card p-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
          {/* Order summary */}
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
