import { Effect } from "effect";
import { unstable_cache } from "next/cache";
import type { NetworkError, ProductApiPort } from "../application/ports/product-api.port";
import { NetworkError as makeNetworkError } from "../application/ports/product-api.port";
import type { Product, ProductImage, ProductSummary, StockInfo } from "../domain/product/types";
import type { ProductId, ProductName, ProductNotFoundError } from "../domain/product/types";
import { ProductNotFoundError as makeNotFoundError, makeProductId } from "../domain/product/types";

const API_BASE_URL =
  process.env.API_CORE_URL ?? process.env.NEXT_PUBLIC_API_CORE_URL ?? "http://localhost:3010";

const REVALIDATE_SECONDS = Number.parseInt(process.env.ISR_REVALIDATE_SECONDS ?? "60", 10);

const CACHE_TAGS = {
  products: "products",
  product: (id: string) => `product:${id}`,
  featured: "featured-products",
} as const;

type RawProductSummary = {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly priceCurrency: string;
  readonly category: string;
  readonly status: string;
  readonly primaryImage: {
    readonly url: string;
    readonly alt: string;
    readonly isPrimary: boolean;
  } | null;
  readonly isInStock: boolean;
  readonly availableSizes: readonly string[];
};

type RawProductListResponse = {
  readonly items: readonly RawProductSummary[];
  readonly total: number;
  readonly page: number;
  readonly perPage: number;
};

type RawProduct = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly priceCurrency: string;
  readonly category: string;
  readonly status: string;
  readonly stock: Record<string, number>;
  readonly images: readonly {
    readonly url: string;
    readonly alt: string;
    readonly isPrimary: boolean;
    readonly order: number;
  }[];
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function mapSummary(raw: RawProductSummary): ProductSummary {
  return {
    id: makeProductId(raw.id),
    name: raw.name as unknown as ProductName,
    slug: raw.name.toLowerCase().replace(/\s+/g, "-"),
    tagline: "",
    price: {
      __brand: "ProductPrice" as const,
      displayAmount: raw.price,
      cents: Math.round(raw.price * 100),
      currency: raw.priceCurrency as "THB" | "USD" | "EUR" | "GBP" | "JPY" | "SGD",
    },
    primaryImage: raw.primaryImage
      ? ({
          url: raw.primaryImage.url,
          altText: raw.primaryImage.alt,
          isPrimary: raw.primaryImage.isPrimary,
          order: 0,
        } as ProductImage)
      : ({ url: "/placeholder.jpg", altText: "", isPrimary: true, order: 0 } as ProductImage),
    category: raw.category as ProductSummary["category"],
    status: raw.status as ProductSummary["status"],
    inStock: raw.isInStock,
  };
}

function mapProduct(raw: RawProduct): Product {
  const stockEntries = Object.entries(raw.stock).map(
    ([size, qty]): StockInfo => ({
      size: size as StockInfo["size"],
      quantity: qty,
      reserved: 0,
    })
  );

  const images = raw.images.map((img) => ({
    url: img.url as ProductImage["url"],
    altText: img.alt,
    isPrimary: img.isPrimary,
    order: img.order,
  })) as unknown as Product["images"];

  return {
    id: makeProductId(raw.id),
    name: raw.name as unknown as ProductName,
    slug: raw.name.toLowerCase().replace(/\s+/g, "-"),
    description: raw.description,
    tagline: "",
    price: {
      __brand: "ProductPrice" as const,
      displayAmount: raw.price,
      cents: Math.round(raw.price * 100),
      currency: raw.priceCurrency as "THB" | "USD" | "EUR" | "GBP" | "JPY" | "SGD",
    },
    category: raw.category as Product["category"],
    status: raw.status as Product["status"],
    images,
    stock: stockEntries,
    material: "",
    care: "",
    metadata: {
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      viewCount: 0,
      salesCount: 0,
    },
  };
}

const fetchProductsCached = unstable_cache(
  async (): Promise<readonly ProductSummary[]> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/products?perPage=50`);
    } catch {
      return [];
    }

    if (!res.ok) {
      throw new Error(`api-core /products returned ${res.status}`);
    }

    const json = (await res.json()) as RawProductListResponse;
    return json.items.map(mapSummary);
  },
  ["products-list"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [CACHE_TAGS.products],
  }
);

/**
 * Per-product cached fetcher — each unique ID gets its own cache entry
 * tagged with `product:<id>` so `revalidateTag` works after create/update.
 */
async function fetchProductCached(id: string): Promise<Product | null> {
  return unstable_cache(
    async () => {
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/api/products/${id}`);
      } catch {
        return null;
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`api-core /products/${id} returned ${res.status}`);
      const json = (await res.json()) as RawProduct;
      return mapProduct(json);
    },
    ["product-detail", id],
    { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAGS.product(id)] }
  )();
}

const fetchFeaturedProductsCached = unstable_cache(
  async (limit: number): Promise<readonly ProductSummary[]> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/products?perPage=${limit}&sort=created_desc`);
    } catch {
      return [];
    }

    if (!res.ok) {
      throw new Error(`api-core /products returned ${res.status}`);
    }

    const json = (await res.json()) as RawProductListResponse;
    return json.items.slice(0, limit).map(mapSummary);
  },
  ["featured-products"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: [CACHE_TAGS.featured, CACHE_TAGS.products],
  }
);

export class HttpProductApiAdapter implements ProductApiPort {
  getProducts(): Effect.Effect<readonly ProductSummary[], NetworkError> {
    return Effect.tryPromise({
      try: async () => fetchProductsCached(),
      catch: (e) =>
        e instanceof Object && "_tag" in e && (e as NetworkError)._tag === "NetworkError"
          ? (e as NetworkError)
          : makeNetworkError(e),
    });
  }

  getProduct(id: ProductId): Effect.Effect<Product, ProductNotFoundError | NetworkError> {
    return Effect.tryPromise({
      try: async () => {
        // ProductId = Brand<string, "ProductId"> — it IS the string at runtime.
        // Never use .value; cast directly to string.
        const rawId = id as unknown as string;
        const product = await fetchProductCached(rawId);
        if (product === null) {
          throw makeNotFoundError(`Product ${id as unknown as string} not found`);
        }
        return product;
      },
      catch: (e) => {
        if (e instanceof Object && "_tag" in e) {
          const tagged = e as { _tag: string };
          if (tagged._tag === "ProductNotFoundError") return e as ProductNotFoundError;
          if (tagged._tag === "NetworkError") return e as NetworkError;
        }
        return makeNetworkError(e);
      },
    });
  }

  getFeaturedProducts(limit: number): Effect.Effect<readonly ProductSummary[], NetworkError> {
    return Effect.tryPromise({
      try: async () => fetchFeaturedProductsCached(limit),
      catch: (e) =>
        e instanceof Object && "_tag" in e && (e as NetworkError)._tag === "NetworkError"
          ? (e as NetworkError)
          : makeNetworkError(e),
    });
  }

  async revalidateProducts(): Promise<void> {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(CACHE_TAGS.products, {});
    revalidateTag(CACHE_TAGS.featured, {});
  }

  async revalidateProduct(id: string): Promise<void> {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(CACHE_TAGS.product(id), {});
  }
}

export const productApiAdapter = new HttpProductApiAdapter();

export { CACHE_TAGS };
