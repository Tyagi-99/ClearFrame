"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium tracking-tight">ClearFrame</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Local processing
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!compact ? (
            <Button nativeButton={false} render={<Link href="/app?kind=video" />} size="sm">
              Clean a Video
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
