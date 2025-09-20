"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SAMPLE_LINE = "Iceman, this is American eight zero five Alpha Whiskey, do you copy?";

function createNoiseBuffer(context: AudioContext) {
  const durationSeconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * durationSeconds, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

type StartPlaybackOptions = {
  buffer: ArrayBuffer;
  record?: boolean;
};

export default function PilotATCPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const latestBufferRef = useRef<ArrayBuffer | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopPlayback = useCallback(() => {
    const source = sourceRef.current;
    if (source) {
      try {
        source.stop(0);
      } catch (err) {
        // ignore
      }
      source.disconnect();
      sourceRef.current = null;
    }

    const noiseSource = noiseSourceRef.current;
    if (noiseSource) {
      try {
        noiseSource.stop(0);
      } catch (err) {
        // ignore
      }
      noiseSource.disconnect();
      noiseSourceRef.current = null;
    }

    const masterGain = masterGainRef.current;
    if (masterGain) {
      try {
        masterGain.disconnect();
      } catch (err) {
        // ignore
      }
      masterGainRef.current = null;
    }

    const mediaDest = mediaStreamDestRef.current;
    if (mediaDest) {
      try {
        mediaDest.disconnect();
      } catch (err) {
        // ignore
      }
      mediaStreamDestRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (err) {
        // ignore
      }
    }
    recorderRef.current = null;
    recordedChunksRef.current = [];

    const audioElement = audioElementRef.current;
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      if (audioElement.srcObject) {
        audioElement.srcObject = null;
      }
    }

    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => undefined);
      }
    };
  }, [stopPlayback]);

  const startPlayback = useCallback(
    async ({ buffer, record = false }: StartPlaybackOptions) => {
      const audioElement = audioElementRef.current;
      if (!audioElement) {
        throw new Error("Audio element is not ready yet.");
      }

      stopPlayback();

      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();

      const audioBuffer = await context.decodeAudioData(buffer.slice(0));

      const source = context.createBufferSource();
      source.buffer = audioBuffer;

      const highpass = context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 300;

      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 3400;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;

      const masterGain = context.createGain();
      masterGain.gain.value = 0.92;

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(compressor);
      compressor.connect(masterGain);

      const noiseSource = context.createBufferSource();
      noiseSource.buffer = createNoiseBuffer(context);
      noiseSource.loop = true;

      const noiseGain = context.createGain();
      noiseGain.gain.value = 0.04;

      noiseSource.connect(noiseGain);
      noiseGain.connect(masterGain);

      const mediaDestination = context.createMediaStreamDestination();
      masterGain.connect(mediaDestination);

      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.srcObject = mediaDestination.stream;

      let recorder: MediaRecorder | null = null;
      if (record) {
        const capture = (audioElement as HTMLAudioElement & {
          captureStream?: () => MediaStream;
        }).captureStream;
        if (typeof capture !== "function") {
          throw new Error("captureStream is not supported in this browser.");
        }
        const stream = capture.call(audioElement);
        recorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "pilot_ATC.webm";
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          setStatus("Processed playback downloaded as pilot_ATC.webm.");
          window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        };
        recorder.onerror = () => {
          setError("Recording failed. Please try again.");
        };
        recorderRef.current = recorder;
      }

      sourceRef.current = source;
      noiseSourceRef.current = noiseSource;
      masterGainRef.current = masterGain;
      mediaStreamDestRef.current = mediaDestination;

      source.onended = () => {
        setIsPlaying(false);
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        if (noiseSourceRef.current) {
          try {
            noiseSourceRef.current.stop();
          } catch (err) {
            // ignore
          }
          noiseSourceRef.current.disconnect();
          noiseSourceRef.current = null;
        }
        if (masterGainRef.current) {
          try {
            masterGainRef.current.disconnect();
          } catch (err) {
            // ignore
          }
          masterGainRef.current = null;
        }
        if (mediaStreamDestRef.current) {
          mediaStreamDestRef.current.disconnect();
          mediaStreamDestRef.current = null;
        }
        if (audioElementRef.current) {
          const element = audioElementRef.current;
          element.pause();
          element.currentTime = 0;
          element.srcObject = null;
        }
      };

      try {
        if (recorder && recorder.state === "inactive") {
          recorder.start();
        }
      } catch (err) {
        setError("Unable to start recorder.");
      }

      noiseSource.start();
      source.start();

      try {
        await audioElement.play();
        setIsPlaying(true);
        setStatus(record ? "Recording processed playback…" : "Playing pilot/ATC mix.");
      } catch (err) {
        setError("Playback was blocked. Please interact with the page and try again.");
        stopPlayback();
      }
    },
    [stopPlayback]
  );

  const fetchSpeech = useCallback(async () => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: SAMPLE_LINE }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "TTS request failed");
    }

    return response.arrayBuffer();
  }, []);

  const handlePlay = useCallback(async () => {
    setError(null);
    setStatus(null);
    setIsLoading(true);
    try {
      const buffer = await fetchSpeech();
      latestBufferRef.current = buffer;
      await startPlayback({ buffer, record: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start playback.");
      stopPlayback();
    } finally {
      setIsLoading(false);
    }
  }, [fetchSpeech, startPlayback, stopPlayback]);

  const handleDownload = useCallback(async () => {
    setError(null);
    setStatus(null);
    setIsLoading(true);
    try {
      const buffer = latestBufferRef.current ?? (await fetchSpeech());
      latestBufferRef.current = buffer;
      await startPlayback({ buffer, record: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record playback.");
      stopPlayback();
    } finally {
      setIsLoading(false);
    }
  }, [fetchSpeech, startPlayback, stopPlayback]);

  return (
    <div className="frost-card relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-neutral-200/30 bg-white/10 p-6 text-sky-200/80 shadow-[0_8px_30px_rgba(3,105,161,0.12)] backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-neutral-100">Pilot/ATC Radio Demo</h2>
        <p className="text-sm text-sky-200/70">
          Synthesizes OpenAI VHF chatter, filters it through in-browser racks, and lets you capture the processed mix.
        </p>
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-sky-200/60">Sample line</p>
      <p className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-sky-100">{SAMPLE_LINE}</p>
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handlePlay}
          disabled={isLoading || isPlaying}
          className="rounded-2xl border border-cyan-400/40 bg-cyan-500/20 px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading && !isPlaying ? "Loading…" : isPlaying ? "Playing" : "Play Pilot/ATC"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading}
          className="rounded-2xl border border-white/10 bg-slate-900/40 px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Download Processed
        </button>
      </div>
      {status ? <p className="text-xs text-cyan-200/80">{status}</p> : null}
      {error ? <p className="text-xs text-rose-300/80">{error}</p> : null}
      <audio ref={audioElementRef} className="hidden" />
    </div>
  );
}
