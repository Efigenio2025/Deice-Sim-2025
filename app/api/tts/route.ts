import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body === "object" && body && "text" in body ? (body as { text?: unknown }).text : undefined;

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Request body must include a non-empty text field" }, { status: 400 });
  }

  const prompt = `Speak the following text as if you are an airline pilot transmitting on VHF with ATC. Keep the cadence tight, slight static, but legible for tower review. Text to read: ${text}`;

  try {
    const openai = new OpenAI({ apiKey });

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: prompt,
      response_format: "mp3",
    });

    const audioBuffer = await speech.arrayBuffer();
    return new NextResponse(Buffer.from(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Failed to generate TTS", error);
    return NextResponse.json({ error: "Unable to generate speech audio" }, { status: 502 });
  }
}
