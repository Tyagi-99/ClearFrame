import type { Metadata } from "next";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import { parseMediaKind } from "@/lib/media/validate";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Clean a supported visible overlay from a video or image on this device.",
};

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  return <WorkspaceApp initialKind={parseMediaKind(params.kind) ?? "video"} />;
}
