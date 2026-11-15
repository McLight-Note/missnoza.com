import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/checkout", "/cart", "/order", "/auth", "/sign-in"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
