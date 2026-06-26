import type { Metadata } from "next";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = {
  title: "New Product — Merchant Portal",
};

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a product to your catalogue</p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
