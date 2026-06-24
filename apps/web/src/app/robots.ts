import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/products",
          "/product/",
          "/store/",
          "/payment/",
          "/guides/",
          "/about",
          "/en/",
          "/en/my",
          "/en/ph",
          "/id",
          "/vi",
        ],
        disallow: [
          "/admin/",
          "/merchant/",
          "/api/",
          "/auth/",
          "/_next/",
          "/checkout/",
          "/cart/",
          "/order/",
          "/analytics/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
