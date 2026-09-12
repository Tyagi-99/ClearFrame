import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Gemini video watermark remover",
  description:
    "Remove the supported visible Gemini sparkle overlay from your own videos and images, locally.",
};

export default function GeminiPage() {
  return (
    <ContentPage title="Gemini visible overlay">
      <p>
        Gemini stills and Veo-family videos often composite a 48px sparkle with a
        known alpha map. ClearFrame inverts that blend. It does not claim to remove
        every watermark, and it does not strip SynthID.
      </p>
      <p>
        <Link href="/app" className="text-foreground underline-offset-4 hover:underline">
          Clean a Gemini file
        </Link>
      </p>
    </ContentPage>
  );
}
