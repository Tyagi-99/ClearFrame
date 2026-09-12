import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-8">
        <div>
          <p className="text-sm font-medium">ClearFrame</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Visible overlay cleaning for media you own. Processing stays on your device.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href="/how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/video-watermark-remover" className="hover:text-foreground">
            Video cleaner
          </Link>
        </div>
      </div>
    </footer>
  );
}
