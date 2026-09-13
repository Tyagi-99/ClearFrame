"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ComparisonSlider } from "@/components/comparison-slider";
import { RegionEditor } from "@/components/workspace/region-editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { capabilityLabel, getClientCapabilities } from "@/lib/capabilities";
import { FILE_LIMITS } from "@/lib/config";
import { track } from "@/lib/analytics";
import { toUserError } from "@/lib/errors";
import { extractMetadata } from "@/lib/media/metadata";
import { formatBytes, formatDuration, parseMediaKind, validateFile } from "@/lib/media/validate";
import { createProcessingEngine } from "@/lib/processing/engine";
import { defaultOtherRegion } from "@/lib/processing/geometry";

import type {
  CleanerTarget,
  DetectionResult,
  MediaKind,
  MediaMetadata,
  ProcessedMedia,
  ProcessingOptions,
  ProcessingProgress,
} from "@/lib/processing/types";
import { CaretDown, Image as ImageIcon, VideoCamera } from "@phosphor-icons/react";

type Stage = "idle" | "ready" | "working" | "done";

const DEFAULT_OPTIONS: ProcessingOptions = {
  quality: "high",
  engine: "webcodecs",
  previewDuration: 5,
  detectionSensitivity: "auto",
  target: "gemini",
};

function otherDetection(width: number, height: number): DetectionResult {
  const region = defaultOtherRegion();
  return {
    detected: true,
    profileId: "other-manual",
    confidence: 1,
    score: 1,
    region,
    box: {
      x: Math.round(region.x * width),
      y: Math.round(region.y * height),
      size: Math.round(Math.min(region.width * width, region.height * height)),
    },
    markSize: 8,
    anchored: false,
    lowConfidence: false,
    message: null,
  };
}

export function WorkspaceApp({ initialKind = "video" }: { initialKind?: MediaKind }) {
  const router = useRouter();
  const engine = useMemo(() => createProcessingEngine(), []);
  const [mediaKind, setMediaKind] = useState<MediaKind>(initialKind);
  const [target, setTarget] = useState<CleanerTarget>("gemini");
  const [previewOnly, setPreviewOnly] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [result, setResult] = useState<ProcessedMedia | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_OPTIONS);
  const [adjusting, setAdjusting] = useState(false);
  const capability = useSyncExternalStore(
    () => () => undefined,
    getClientCapabilities,
    () => null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    };
  }, [objectUrl, cleanedUrl]);

  const reset = useCallback(() => {
    void engine.cancel();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    setFile(null);
    setObjectUrl(null);
    setCleanedUrl(null);
    setMetadata(null);
    setDetection(null);
    setResult(null);
    setProgress(null);
    setStage("idle");
    setError(null);
    setPreviewOnly(false);
  }, [cleanedUrl, engine, objectUrl]);

  const selectKind = useCallback(
    (kind: MediaKind) => {
      setMediaKind(kind);
      router.replace(kind === "image" ? "/app?kind=image" : "/app?kind=video");
    },
    [router],
  );

  const loadFile = useCallback(
    async (next: File) => {
      const validation = validateFile(next, mediaKind);
      if (!validation.ok) {
        setError(validation.message);
        toast.error(validation.message);
        return;
      }
      track("upload_started");
      setError(null);
      setResult(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
      setCleanedUrl(null);
      setFile(next);
      setObjectUrl(URL.createObjectURL(next));
      setStage("working");
      try {
        const meta = await extractMetadata(next);
        setMetadata(meta);
        if (target === "other") {
          setDetection(otherDetection(meta.width, meta.height));
          setAdjusting(true);
        } else {
          const found = await engine.detectWatermark(next);
          setDetection(found);
          setAdjusting(false);
          if (found.message) toast.message(found.message);
        }
        setStage("ready");
      } catch (err) {
        const message = toUserError(err);
        setError(message);
        setStage("idle");
        toast.error(message);
      }
    },
    [cleanedUrl, engine, mediaKind, objectUrl, target],
  );

  const process = useCallback(
    async (preview: boolean) => {
      if (!file) return;
      if (target === "gemini" && detection && !detection.detected && !adjusting) {
        toast.error("We couldn't confidently identify a supported visible overlay.");
        return;
      }
      if (target === "gemini" && detection?.lowConfidence && !adjusting) {
        toast.message(
          "We found something that may be a supported watermark, but confidence is low.",
        );
      }
      setStage("working");
      setError(null);
      track("processing_started");
      try {
        const workingOptions: ProcessingOptions = {
          ...options,
          target,
          region: detection?.region ?? options.region,
          customPreviewSeconds: preview
            ? options.previewDuration === 10
              ? 10
              : 5
            : undefined,
        };
        const processed = await engine.processMedia(file, workingOptions, setProgress);
        if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
        setCleanedUrl(URL.createObjectURL(processed.blob));
        setResult(processed);
        setDetection(processed.detection);
        setPreviewOnly(Boolean(preview && metadata?.kind === "video"));
        setStage("done");
        track("processing_completed");
        if (processed.detection.message) toast.message(processed.detection.message);
      } catch (err) {
        const message = toUserError(err);
        setError(message);
        setStage("ready");
        track("processing_failed");
        toast.error(message);
      }
    },
    [adjusting, cleanedUrl, detection, engine, file, metadata, options, target],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (dropped) void loadFile(dropped);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = event.clipboardData?.files[0];
      if (item) void loadFile(item);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  const cap = capability ? capabilityLabel(capability) : null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
          <Link href="/" className="text-[15px] font-medium tracking-tight">
            ClearFrame
          </Link>
          <p className="hidden text-sm text-muted-foreground md:block">
            Privacy: Local Processing
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {stage !== "idle" ? (
              <Button variant="outline" size="sm" onClick={reset}>
                Process Another
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-4 py-8 md:px-8">
        {cap ? (
          <p className="text-sm text-muted-foreground">
            <span className="text-signal">{cap.title}.</span> {cap.detail}
          </p>
        ) : null}

        {stage === "idle" ? (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center"
          >
            <ToggleGroup
              value={[mediaKind]}
              onValueChange={(next) => {
                const kind = parseMediaKind(next[0]);
                if (kind) selectKind(kind);
              }}
              className="mb-8 border border-border p-1"
            >
              <ToggleGroupItem value="video" aria-label="Clean a video">
                <VideoCamera data-icon="inline-start" />
                Video
              </ToggleGroupItem>
              <ToggleGroupItem value="image" aria-label="Clean a photo">
                <ImageIcon data-icon="inline-start" />
                Photo
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              value={[target]}
              onValueChange={(next) => {
                if (next[0] === "other" || next[0] === "gemini") setTarget(next[0]);
              }}
              className="mb-8 border border-border p-1"
            >
              <ToggleGroupItem value="gemini" aria-label="Gemini overlay">
                Gemini
              </ToggleGroupItem>
              <ToggleGroupItem value="other" aria-label="Other text or logo">
                Other
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-2xl font-medium tracking-tight">
              {mediaKind === "image" ? "Drop your photo here" : "Drop your video here"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">or</p>
            <Button className="mt-4" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={
                mediaKind === "image"
                  ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  : "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              }
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (next) void loadFile(next);
              }}
            />
            <p className="mt-8 text-sm text-muted-foreground">
              {mediaKind === "image"
                ? "Supported: PNG, JPG, WebP"
                : "Supported: MP4, WebM"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Maximum:{" "}
              {mediaKind === "image"
                ? `${Math.round(FILE_LIMITS.imageBytes / (1024 * 1024))} MB`
                : `${Math.round(FILE_LIMITS.videoBytes / (1024 * 1024))} MB`}
            </p>
            <p className="mt-6 text-sm">Your media stays on your device.</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {target === "other"
                ? "Draw a tight box on the mark after upload. Fill runs locally in your browser. Gemini overlay cleaning stays on Gemini."
                : "Processing happens locally in your browser. Your file is never uploaded."}
            </p>
          </div>
        ) : null}

        {file && metadata && objectUrl ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="flex flex-col gap-4">
              {cleanedUrl ? (
                <ComparisonSlider
                  before={objectUrl}
                  after={cleanedUrl}
                  aspectRatio={metadata.width / metadata.height}
                  kind={metadata.kind}
                />
              ) : detection && (target === "other" || adjusting) ? (
                <RegionEditor
                  region={detection.region}
                  onChange={(region) => setDetection({ ...detection, region })}
                >
                  {metadata.kind === "video" ? (
                    <video
                      src={objectUrl}
                      controls
                      className="h-auto w-full"
                      style={{ aspectRatio: `${metadata.width} / ${metadata.height}` }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={objectUrl} alt="Source" className="h-auto w-full" />
                  )}
                </RegionEditor>
              ) : (
                <div className="overflow-hidden rounded-xl bg-muted">
                  {metadata.kind === "video" ? (
                    <video
                      src={objectUrl}
                      controls
                      className="h-auto w-full"
                      style={{ aspectRatio: `${metadata.width} / ${metadata.height}` }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={objectUrl} alt="Source" className="h-auto w-full" />
                  )}
                </div>
              )}
            </div>

            <aside className="flex flex-col gap-6">
              <div>
                <p className="font-medium">{metadata.filename}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {metadata.width} × {metadata.height}
                  {metadata.frameRate ? `  ${Math.round(metadata.frameRate)} FPS` : ""}
                  {metadata.durationSeconds != null
                    ? `  ${formatDuration(metadata.durationSeconds)}`
                    : ""}
                  {`  ${formatBytes(metadata.sizeBytes)}`}
                </p>
                {metadata.codec ? (
                  <p className="mt-1 text-sm text-muted-foreground">Codec {metadata.codec}</p>
                ) : null}
              </div>

              {detection && target === "gemini" ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">Watermark detection</p>
                  <p className="mt-2 text-2xl font-medium">
                    {Math.round(detection.confidence * 100)}%
                  </p>
                  <p className="mt-1 text-sm">
                    {detection.detected
                      ? metadata.kind === "image"
                        ? "Detected: Google Gemini visible overlay"
                        : "Detected: Google Flow visible overlay"
                      : "No supported overlay found"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Region: {regionLabel(detection)}
                  </p>
                  {detection.message ? (
                    <p className="mt-3 text-sm text-muted-foreground">{detection.message}</p>
                  ) : null}
                </div>
              ) : null}

              {target === "other" ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">Other (manual)</p>
                  <p className="mt-2 text-sm">
                    Draw a tight box on the date stamp or logo, then preview. The first run
                    downloads a local fill model (about 200 MB), then it stays cached.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reconstruction happens on-device. This is not Gemini overlay cleaning, and it
                    does not remove SynthID or C2PA.
                  </p>
                  {detection?.message ? (
                    <p className="mt-3 text-sm text-muted-foreground">{detection.message}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                {target === "gemini" ? (
                  <Button
                    variant={adjusting ? "secondary" : "outline"}
                    onClick={() => setAdjusting((value) => !value)}
                  >
                    {adjusting ? "Region locked" : "Adjust Region"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => void process(metadata.kind === "video")}
                  disabled={stage === "working"}
                >
                  Preview result
                </Button>
                <Button onClick={() => void process(false)} disabled={stage === "working"}>
                  {target === "other"
                    ? "Clean selected area"
                    : `Clean Entire ${metadata.kind === "video" ? "Video" : "Image"}`}
                </Button>
                {stage === "working" ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void engine.cancel();
                      setStage("ready");
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground">
                  Advanced settings
                  <CaretDown />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 flex flex-col gap-3 text-sm">
                  <label className="flex items-center justify-between gap-3">
                    Quality
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1"
                      value={options.quality}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          quality: event.target.value as ProcessingOptions["quality"],
                        }))
                      }
                    >
                      <option value="balanced">Balanced</option>
                      <option value="high">High</option>
                      <option value="maximum">Maximum</option>
                    </select>
                  </label>
                  {metadata.kind === "video" ? (
                    <label className="flex items-center justify-between gap-3">
                      Preview
                      <select
                        className="rounded-md border border-border bg-background px-2 py-1"
                        value={options.previewDuration}
                        onChange={(event) =>
                          setOptions((current) => ({
                            ...current,
                            previewDuration: Number(event.target.value) as 5 | 10,
                          }))
                        }
                      >
                        <option value={5}>5 sec</option>
                        <option value={10}>10 sec</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="flex items-center justify-between gap-3">
                    Detection
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1"
                      value={options.detectionSensitivity}
                      onChange={(event) =>
                        setOptions((current) => ({
                          ...current,
                          detectionSensitivity: event.target
                            .value as ProcessingOptions["detectionSensitivity"],
                        }))
                      }
                    >
                      <option value="auto">Auto</option>
                      <option value="conservative">Conservative</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </label>
                </CollapsibleContent>
              </Collapsible>
            </aside>
          </div>
        ) : null}

        {progress && stage === "working" ? (
          <div className="rounded-xl border border-border p-5">
            <p className="font-medium">{progress.message}</p>
            <Progress value={progress.percent} className="mt-4" />
            <p className="mt-2 text-sm text-muted-foreground">
              {progress.percent}%
              {progress.frame != null && progress.totalFrames
                ? `  Frame ${progress.frame} / ${progress.totalFrames}`
                : ""}
              {progress.etaSeconds != null
                ? `  Estimated time: ${Math.max(1, Math.round(progress.etaSeconds))} seconds`
                : ""}
            </p>
          </div>
        ) : null}

        {stage === "done" && result ? (
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <p className="font-medium">
              {previewOnly
                ? "Preview ready. Check the slider in the original ratio."
                : "Preview ready. Check the slider, then download."}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.width} × {result.height}
              {result.frameRate ? `  ${Math.round(result.frameRate)} FPS` : ""}
              {result.durationSeconds != null
                ? `  ${formatDuration(result.durationSeconds)}`
                : ""}
              {`  ${formatBytes(result.sizeBytes)}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {previewOnly ? (
                <Button onClick={() => void process(false)}>
                  Clean full file
                </Button>
              ) : (
                <Button
                  nativeButton={false}
                  render={
                    <a
                      href={cleanedUrl ?? undefined}
                      download={result.filename}
                    />
                  }
                >
                  Download {result.mimeType === "image/png" ? "PNG" : "MP4"}
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                Process Another
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <p className="mt-auto text-xs text-muted-foreground">
          Only process media you created, own, or have permission to modify. Visible overlays only. SynthID and C2PA are not removed.
        </p>
      </main>
    </div>
  );
}

function regionLabel(detection: DetectionResult): string {
  const x = detection.region.x + detection.region.width / 2;
  const y = detection.region.y + detection.region.height / 2;
  const horizontal = x > 0.66 ? "right" : x < 0.33 ? "left" : "center";
  const vertical = y > 0.66 ? "Bottom" : y < 0.33 ? "Top" : "Middle";
  return `${vertical}-${horizontal}`;
}


