import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/products", "/product/"],
        disallow: ["/admin/", "/merchant/", "/api/", "/auth/", "/_next/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
