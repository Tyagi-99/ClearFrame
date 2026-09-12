# ClearFrame

Clean your AI-generated videos. Privately. In your browser.

ClearFrame removes supported visible Google Flow / Gemini / Veo-style overlays from media you own. Processing is local. Files are not uploaded.

This tool does not remove SynthID, C2PA credentials, or other invisible provenance signals.

## Stack

- Next.js App Router, TypeScript, Tailwind, shadcn/ui
- WebCodecs via [Mediabunny](https://mediabunny.dev)
- Reverse alpha blending using a measured 48px Gemini sparkle mask

The overlay reconstruction math and measured mask are adapted from [seeb4-erase](https://github.com/seeb4coding/seeb4-erase) (MIT).

## Develop

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`. Use Chrome or Edge for video. Images work in current browsers.

## Responsible use

Only process media you created, own, or have permission to modify. Do not use this on third-party watermarks, stock marks, or ownership marks you do not control.
