import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/checkout", "/cart", "/order"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
