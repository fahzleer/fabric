import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductForm } from "../../_components/product-form";

export const metadata: Metadata = {
  title: "Edit Product — Merchant Portal",
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;
  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) notFound();
  const api = maybeApi.value;

  const productResult = await api.getProductById(id);
  if (isErr(productResult)) notFound();

  const product = productResult.value;

  if (product.ownerId !== api.userId && api.role !== "admin") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Edit product</h1>
        <p className="mt-1 text-sm text-gray-400">{product.name}</p>
      </div>
      <ProductForm mode="edit" productId={id} defaultValues={product} />
    </div>
  );
}
