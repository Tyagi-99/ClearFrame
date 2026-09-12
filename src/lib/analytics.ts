export type AnalyticsEvent =
  | "page_view"
  | "upload_started"
  | "processing_started"
  | "processing_completed"
  | "processing_failed";

const STORAGE_KEY = "clearframe.analytics";

export function analyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setAnalyticsAllowed(allowed: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, allowed ? "1" : "0");
}

export function track(event: AnalyticsEvent): void {
  if (!analyticsAllowed()) return;
  // Anonymous product events only. Never filenames, frames, or media bytes.
  console.debug("[analytics]", event);
}
