"use client";

import { HardDrives, ShieldCheck, SpeakerHigh } from "@phosphor-icons/react";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Processing happens locally in your browser.",
  },
  {
    icon: HardDrives,
    title: "No cloud uploads",
    body: "Your videos are never sent to our servers.",
  },
  {
    icon: SpeakerHigh,
    title: "Original audio",
    body: "The original audio track is preserved whenever technically possible.",
  },
] as const;

export function TrustRow() {
  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-16 md:grid-cols-3 md:px-8">
      {ITEMS.map((item) => (
        <div key={item.title} className="flex flex-col gap-3">
          <item.icon className="text-signal" />
          <h2 className="text-lg font-medium">{item.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
        </div>
      ))}
    </div>
  );
}
