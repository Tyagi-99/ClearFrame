import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { FaqList } from "@/components/landing/faq-list";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about local processing, SynthID, audio, and supported overlays.",
};

export default function FaqPage() {
  return (
    <ContentPage title="FAQ">
      <FaqList />
    </ContentPage>
  );
}
