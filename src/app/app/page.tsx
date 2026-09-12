import type { Metadata } from "next";
import { WorkspaceApp } from "@/components/workspace/workspace-app";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Clean a supported visible overlay from a video or image on this device.",
};

export default function AppPage() {
  return <WorkspaceApp />;
}
