import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Video Watermark Cleaner - Private Browser-Based Processing",
    template: "%s | ClearFrame",
  },
  description:
    "Remove supported visible AI-generation overlays from your own videos locally in your browser. No video uploads required.",
  metadataBase: new URL("https://clearframe.app"),
  openGraph: {
    title: "ClearFrame",
    description:
      "Clean your AI videos without uploading them. Visible overlays only. Local processing.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
