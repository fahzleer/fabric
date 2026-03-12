import type {
  CurrencyCode,
  NonEmptyArray,
  ProductCategory,
  ProductImage,
  ProductSize,
  ProductStatus,
  Result,
} from "@fabric/types";
import {
  Err,
  Ok,
  makeProductId,
  makeProductImage,
  makeProductName,
  makeProductPrice,
} from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Product, StockInfo } from "./types";
import { makeStockInfo } from "./types";

export const makeProduct = (data: {
  id: string;
  name: string;
  slug: string;
  description: string;
  tagline: string;
  priceInDollars: number;
  currency: CurrencyCode;
  category: ProductCategory;
  status: ProductStatus;
  images: Array<{ url: string; alt: string; isPrimary: boolean; order: number }>;
  stock: Array<{ size: ProductSize; quantity: number; reserved: number }>;
  material: string;
  care: string;
}): Result<Product, { _tag: "ProductConstructionError"; message: string }> => {
  const nameResult = makeProductName(data.name);
  if ("_tag" in nameResult)
    return Err({ _tag: "ProductConstructionError", message: nameResult.message });

  const priceResult = makeProductPrice(data.priceInDollars, data.currency);
  if ("_tag" in priceResult)
    return Err({ _tag: "ProductConstructionError", message: priceResult.message });

  const imageResults = data.images.map((img) =>
    makeProductImage(img.url, img.alt, img.isPrimary, img.order)
  );
  for (const r of imageResults) {
    if ("_tag" in r) return Err({ _tag: "ProductConstructionError", message: r.message });
  }

  const images = imageResults.filter((r): r is ProductImage => !("_tag" in r));
  if (images.length === 0)
    return Err({
      _tag: "ProductConstructionError",
      message: "Product must have at least one image",
    });

  const stockItems: StockInfo[] = data.stock.map((s) =>
    makeStockInfo(s.size, s.quantity, s.reserved)
  );

  const now = Temporal.Now.instant().toString();

  return Ok({
    id: makeProductId(data.id),
    name: nameResult,
    slug: data.slug,
    description: data.description,
    tagline: data.tagline,
    price: priceResult,
    category: data.category,
    status: data.status,
    images: images as unknown as NonEmptyArray<ProductImage>,
    stock: stockItems,
    material: data.material,
    care: data.care,
    metadata: {
      createdAt: now,
      updatedAt: now,
      viewCount: 0,
      salesCount: 0,
    },
  });
};
