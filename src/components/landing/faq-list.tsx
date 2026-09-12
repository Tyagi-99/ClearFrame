"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ_ITEMS = [
  {
    q: "Does my video get uploaded?",
    a: "No. Processing is designed to happen locally in your browser.",
  },
  {
    q: "Does this remove SynthID?",
    a: "No. The tool is designed only for supported visible overlays. Invisible provenance systems such as SynthID are not removed.",
  },
  {
    q: "Will the audio remain?",
    a: "The original audio is preserved whenever the browser's media pipeline supports stream copying.",
  },
  {
    q: "Will quality decrease?",
    a: "Video frames must normally be encoded again after modification. The application therefore uses source-aware encoding settings and avoids unnecessary resizing.",
  },
  {
    q: "Can I remove any watermark?",
    a: "No. The initial version supports only specifically calibrated visible overlay profiles.",
  },
  {
    q: "Can I use it on someone else's content?",
    a: "Only if you have the legal right or permission to modify that content.",
  },
] as const;

export function FaqList() {
  return (
    <Accordion>
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.q} value={item.q}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
