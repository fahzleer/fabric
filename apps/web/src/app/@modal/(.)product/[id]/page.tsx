import { ModalClient } from "@/components/modal/modal-client";
import { makeProductId } from "@/domain/product/types";
import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { preloadProduct } from "@/lib/data";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductModalContent } from "./_components";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductModalPage({ params }: PageProps) {
  const { id } = await params;

  preloadProduct(id);

  await connection();

  const productId = makeProductId(id);

  const result = await Effect.runPromise(Effect.either(productApiAdapter.getProduct(productId)));

  if (result._tag === "Left") {
    notFound();
  }

  const product = result.right;

  return (
    <ModalClient>
      <ProductModalContent product={product} />
    </ModalClient>
  );
}
