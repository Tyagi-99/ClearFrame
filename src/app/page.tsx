import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ComparisonDemo } from "@/components/landing/comparison-demo";
import { FaqList } from "@/components/landing/faq-list";
import { TrustRow } from "@/components/landing/trust-row";
import { WATERMARK_PROFILES } from "@/lib/watermark/profiles";

export default function HomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main>
        <section className="mx-auto grid min-h-[100dvh] max-w-[1400px] items-center gap-10 px-4 pt-10 pb-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:px-8 md:pt-16">
          <div className="max-w-xl">
            <p className="text-sm text-signal">100% local processing</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl">
              Clean your AI videos.
              <span className="block">Without uploading them.</span>
            </h1>
            <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-muted-foreground">
              Remove supported visible AI-generation overlays directly in your browser. Fast, private, and designed for creators.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button nativeButton={false} render={<Link href="/app" />} size="lg">
                Clean a Video
              </Button>
              <Button nativeButton={false} render={<Link href="/how-it-works" />} variant="outline" size="lg">
                How it works
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Upload, clean, preview, download. No cloud copy.
            </p>
          </div>
          <ComparisonDemo />
        </section>

        <section className="border-y border-border bg-card/60">
          <TrustRow />
        </section>

        <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight">
            Four steps. The file never leaves this tab.
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {[
              ["Upload", "Choose your video."],
              ["Detect", "The application identifies supported visible watermark patterns."],
              ["Clean", "The browser processes the video locally."],
              ["Download", "Save the processed MP4."],
            ].map(([title, body], index) => (
              <li key={title} className="flex flex-col gap-2">
                <span className="font-mono text-xs text-signal">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-card/40">
          <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-20 md:grid-cols-[1fr_1fr] md:px-8">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Built for supported AI-generation overlays
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                ClearFrame is not a generic watermark eraser. It only reconstructs calibrated visible overlays.
              </p>
              <ul className="mt-8 divide-y divide-border border-y border-border">
                {WATERMARK_PROFILES.map((profile) => (
                  <li key={profile.id} className="flex items-baseline justify-between py-4">
                    <span className="font-medium">{profile.name}</span>
                    <span className="text-sm text-muted-foreground">{profile.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Supported files</h2>
              <p className="mt-4 text-sm text-muted-foreground">MP4, WebM, PNG, JPG, WebP.</p>
              <p className="mt-2 text-sm text-muted-foreground">More formats coming soon.</p>
              <div className="mt-8 rounded-xl border border-border p-5 text-sm leading-relaxed text-muted-foreground">
                Only process media you created, own, or have permission to modify. This tool removes supported visible overlays only. It does not remove invisible provenance or authenticity signals.
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[800px] px-4 py-20 md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">Questions, answered plainly</h2>
          <div className="mt-8">
            <FaqList />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}


