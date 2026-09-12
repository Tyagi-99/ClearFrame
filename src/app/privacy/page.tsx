import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "ClearFrame processes media locally. Files are never uploaded to a server.",
};

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy">
      <p>Your media stays on your device.</p>
      <p>
        Processing happens locally in your browser. Your video is never uploaded.
        There is no media storage, no frame upload, and no filename telemetry.
      </p>
      <p>
        The server only delivers the application. Optional anonymous product events
        (page view, processing started, processing completed) can be enabled later.
        Those events never include media bytes, thumbnails, or filenames.
      </p>
    </ContentPage>
  );
}
