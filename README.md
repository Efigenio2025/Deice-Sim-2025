# Polar Ice Ops De-Ice Trainer

A Next.js 14 App Router + TypeScript build of the Polar Ice Ops simulator with in-browser comms training tools and an OpenAI-powered pilot/ATC radio demo.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Provide your OpenAI API key by creating an `.env.local` file in the project root:
   ```bash
   echo "OPENAI_API_KEY=sk-..." > .env.local
   ```
   Also add the same `OPENAI_API_KEY` secret in your Vercel project settings before deploying so the `/api/tts` route works in production.
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:3000` to access the control center, training apps, and the pilot/ATC text-to-speech demo.

## Text-to-Speech Demo

- `POST /api/tts` – Generates mp3 speech with GPT-4o mini TTS using a VHF pilot/ATC style prompt and streams the binary audio response.
- `components/PilotATCPlayer` – Fetches the speech, processes it through Web Audio filters that mimic a VHF radio chain, and lets you download the processed playback captured via `captureStream()` + `MediaRecorder`.

## Deployment

Deploy the repository to Vercel. Ensure the `OPENAI_API_KEY` environment variable is set in both `.env.local` and your Vercel project before triggering a production build.
