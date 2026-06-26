import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ProductListClient } from "./_components/product-list-client";

export const metadata: Metadata = {
  title: "Products — Merchant Portal",
};

export default async function MerchantProductsPage() {
  await connection();

  const maybeApi = await createMerchantApi();

  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unable to load products. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const result = await api.getMyProducts(1, 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your store catalogue</p>
        </div>
        <Link
          href="/merchant/products/new"
          className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-foreground hover:bg-success"
        >
          + New product
        </Link>
      </div>

      {/* Error state */}
      {isErr(result) ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
          <p className="text-sm text-destructive">{result.error}</p>
          {result.error.startsWith("[SubscriptionInactive]") && (
            <Link
              href="/merchant/billing"
              className="mt-3 inline-block text-sm text-success hover:text-success"
            >
              Activate your plan →
            </Link>
          )}
        </div>
      ) : result.value.items.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <p className="text-lg font-medium text-foreground">No products yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first product to start selling
          </p>
          <Link
            href="/merchant/products/new"
            className="mt-5 inline-block rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-foreground hover:bg-success"
          >
            Create product
          </Link>
        </div>
      ) : (
        /* Interactive client view — all three atom patterns */
        <ProductListClient initialProducts={result.value.items} />
      )}
    </div>
  );
}
