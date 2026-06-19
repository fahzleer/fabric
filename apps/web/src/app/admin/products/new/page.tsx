import { ProductForm } from "@/app/(merchant)/merchant/products/_components/product-form";
import type { Metadata } from "next";
import { createAdminProductAction } from "../_lib/actions";

export const metadata: Metadata = {
  title: "New Product — Admin",
};

export default function AdminNewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">New product</h1>
        <p className="mt-1 text-sm text-gray-400">Create a product from the admin panel</p>
      </div>
      <ProductForm
        mode="create"
        cancelHref="/admin/products"
        formAction={createAdminProductAction}
      />
    </div>
  );
}
