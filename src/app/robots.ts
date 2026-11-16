import type { MetadataRoute } from "next";
import { publicOrigin } from "@/server/config/public-origin";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  if (!origin) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
