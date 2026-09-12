import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/app",
    "/video-watermark-remover",
    "/google-flow-watermark-remover",
    "/gemini-video-watermark-remover",
    "/how-it-works",
    "/privacy",
    "/faq",
  ];
  return routes.map((route) => ({
    url: `https://clearframe.app${route}`,
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}
