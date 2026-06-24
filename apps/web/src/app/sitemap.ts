import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { Effect } from "effect";
import type { MetadataRoute } from "next";

function thaiAlternates(url: string): MetadataRoute.Sitemap[number]["alternates"] {
  return { languages: { th: url, "x-default": url } };
}

const GEO_PAGE_LOCALES: Record<string, Record<string, string>> = {
  "/en/my": { "en-MY": "/en/my", "x-default": "/products" },
  "/en/ph": { "en-PH": "/en/ph", "x-default": "/products" },
  "/id": { id: "/id", "x-default": "/products" },
  "/vi": { vi: "/vi", "x-default": "/products" },
};

function geoAlternates(path: string, baseUrl: string): MetadataRoute.Sitemap[number]["alternates"] {
  const mapping = GEO_PAGE_LOCALES[path];
  if (!mapping) return undefined;
  const languages: Record<string, string> = {};
  for (const [locale, pathValue] of Object.entries(mapping)) {
    languages[locale] = `${baseUrl}${pathValue}`;
  }
  return { languages };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

  const intentPages = [
    "/payment/promptpay",
    "/payment/card",
    "/payment/crypto",
    "/payment/compare",
  ];

  const awarenessPages = ["/guides", "/guides/how-to-order", "/guides/returns", "/about"];

  const geoPages = ["/en/my", "/en/ph", "/id", "/vi"];

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: thaiAlternates(`${baseUrl}/`),
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
      alternates: thaiAlternates(`${baseUrl}/products`),
    },
    ...intentPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.85,
      alternates: thaiAlternates(`${baseUrl}${path}`),
    })),
    ...awarenessPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: thaiAlternates(`${baseUrl}${path}`),
    })),
    ...geoPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.65,
      alternates: geoAlternates(path, baseUrl),
    })),
    {
      url: `${baseUrl}/auth/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const productsResult = await Effect.runPromise(Effect.either(productApiAdapter.getProducts()));

  let productPages: MetadataRoute.Sitemap = [];

  if (productsResult._tag === "Right") {
    productPages = productsResult.right.map((product) => {
      const url = `${baseUrl}/product/${product.id.value}`;
      return {
        url,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: thaiAlternates(url),
      };
    });
  }

  return [...staticPages, ...productPages];
}
