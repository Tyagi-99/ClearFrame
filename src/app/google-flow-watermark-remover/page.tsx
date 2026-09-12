import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Google Flow watermark remover",
  description:
    "Remove the supported visible Google Flow overlay from your own videos, locally in the browser.",
};

export default function FlowPage() {
  return (
    <ContentPage title="Google Flow visible overlay">
      <p>
        Flow exports can carry a visible Gemini-family sparkle. ClearFrame reconstructs
        that overlay when it matches the calibrated profile. Invisible SynthID signals
        stay in the file.
      </p>
      <p>
        <Link href="/app" className="text-foreground underline-offset-4 hover:underline">
          Clean a Flow video
        </Link>
      </p>
    </ContentPage>
  );
}
