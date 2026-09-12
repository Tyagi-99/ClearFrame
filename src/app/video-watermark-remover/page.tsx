import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Video watermark remover",
  description:
    "Remove supported visible AI-generation overlays from your own videos in the browser. No uploads.",
};

export default function VideoRemoverPage() {
  return (
    <ContentPage title="Video watermark remover">
      <p>
        ClearFrame cleans supported visible overlays from MP4 and WebM files you
        own. Detection is profile-based, not a generic watermark eraser.
      </p>
      <p>
        <Link href="/app" className="text-foreground underline-offset-4 hover:underline">
          Open the workspace
        </Link>
      </p>
    </ContentPage>
  );
}
