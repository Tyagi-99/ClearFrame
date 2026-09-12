import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "ClearFrame detects a supported visible overlay, reconstructs the pixels underneath, and writes a new file locally in your browser.",
};

export default function HowItWorksPage() {
  return (
    <ContentPage title="How it works">
      <p>
        ClearFrame is a local media tool. Your file is decoded in the browser, a
        calibrated visible overlay is detected, and those pixels are reconstructed
        by reversing the alpha blend Google uses for the Gemini sparkle.
      </p>
      <p>
        Video is transcoded with WebCodecs so the overlay can be rewritten. Audio
        is copied whenever the container and codec allow it. Resolution, frame rate,
        and duration are kept.
      </p>
      <p>
        Invisible provenance systems such as SynthID and C2PA credentials are not
        detected and not removed.
      </p>
      <p>
        <Link href="/app" className="text-foreground underline-offset-4 hover:underline">
          Clean a Video
        </Link>
      </p>
    </ContentPage>
  );
}
