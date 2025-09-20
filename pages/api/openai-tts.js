export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  const { text, voice, format, cue, scenario } = req.body || {};
  const input = typeof text === "string" ? text.trim() : "";
  if (!input) {
    res.status(400).json({ error: "Missing text" });
    return;
  }
  if (input.length > 800) {
    res.status(400).json({ error: "Text too long" });
    return;
  }

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voiceChoice = (typeof voice === "string" && voice.trim()) || process.env.OPENAI_TTS_VOICE || "alloy";
  const outputFormat = (typeof format === "string" && format.trim()) || "mp3";

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice: voiceChoice,
        input,
        format: outputFormat,
      }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch (err) {
        detail = "";
      }
      console.error("[api/openai-tts] OpenAI request failed", {
        status: response.status,
        cue,
        scenario,
        detail: detail ? detail.slice(0, 500) : undefined,
      });
      res.status(response.status).json({
        error: "OpenAI TTS request failed",
        detail: detail ? detail.slice(0, 200) : undefined,
      });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || (outputFormat === "wav" ? "audio/wav" : "audio/mpeg");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    if (cue) {
      res.setHeader("X-Captain-Cue", String(cue));
    }
    res.status(200).send(buffer);
  } catch (err) {
    console.error("[api/openai-tts] Unexpected error", { cue, scenario, err });
    res.status(500).json({ error: "Failed to generate speech audio" });
  }
}
