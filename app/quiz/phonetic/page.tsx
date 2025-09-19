"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../../components/Badge";
import { Card } from "../../../components/Card";
import { ProgressRing } from "../../../components/ProgressRing";
import { RANDOM_ITEMS, normalize, toPhonetic } from "../../../lib/phonetics";
import { requiredTokens, scoreTokens } from "../../../lib/scoring";

type Mode = "letters" | "numbers" | "mixed" | "callsigns";

type RoundStats = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
  tokensHit: number;
  tokensTotal: number;
};

type BestEntry = {
  accuracy: number;
  wpm: number;
  streak: number;
};

type FeedbackState = {
  status: "idle" | "correct" | "incorrect";
  expected?: string;
  prompt?: string;
  misses?: string[];
};

const ROUND_SECONDS = 60;
const STORAGE_KEY = "deice.phonetic.bests";

const initialStats: RoundStats = {
  correct: 0,
  total: 0,
  streak: 0,
  bestStreak: 0,
  tokensHit: 0,
  tokensTotal: 0
};

const createBestTemplate = (): Record<Mode, BestEntry> => ({
  letters: { accuracy: 0, wpm: 0, streak: 0 },
  numbers: { accuracy: 0, wpm: 0, streak: 0 },
  mixed: { accuracy: 0, wpm: 0, streak: 0 },
  callsigns: { accuracy: 0, wpm: 0, streak: 0 }
});

function evaluate(prompt: string, response: string) {
  const expectedPhrase = toPhonetic(prompt);
  const tokens = requiredTokens(expectedPhrase);
  const cleaned = normalize(response);
  const directMatch = cleaned.replace(/\s+/g, "") === prompt.toLowerCase();
  const tokenScore = scoreTokens(tokens, response);
  const correct = directMatch || tokenScore.pct >= 0.8;

  return {
    correct,
    expectedPhrase,
    misses: directMatch ? [] : tokenScore.misses,
    hit: directMatch ? tokens.length : tokenScore.hit,
    totalTokens: tokens.length
  };
}

export default function PhoneticQuizPage() {
  const [mode, setMode] = useState<Mode>("letters");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [stats, setStats] = useState<RoundStats>(initialStats);
  const [feedback, setFeedback] = useState<FeedbackState>({ status: "idle" });
  const [bests, setBests] = useState<Record<Mode, BestEntry>>(() => createBestTemplate());

  const currentPrompt = queue[index] ?? "";
  const elapsedSeconds = ROUND_SECONDS - timeLeft;
  const elapsedMinutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;

  const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  const tokenAccuracy = stats.tokensTotal > 0 ? (stats.tokensHit / stats.tokensTotal) * 100 : 0;
  const wpm = elapsedMinutes > 0 ? stats.tokensHit / elapsedMinutes : 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<Mode, BestEntry>>;
        setBests((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      return;
    }
    const tick = window.setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [running, timeLeft]);

  useEffect(() => {
    if (stats.total === 0) return;
    setBests((prev) => {
      const entry = prev[mode];
      const updated: BestEntry = {
        accuracy: Math.max(entry.accuracy, accuracy),
        wpm: Math.max(entry.wpm, wpm),
        streak: Math.max(entry.streak, stats.bestStreak)
      };
      if (
        updated.accuracy === entry.accuracy &&
        updated.wpm === entry.wpm &&
        updated.streak === entry.streak
      ) {
        return prev;
      }
      const next = { ...prev, [mode]: updated };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, [accuracy, mode, stats.bestStreak, stats.total, wpm]);

  const ensureQueue = useCallback((targetMode: Mode, nextIndex: number, amount = 100) => {
    setQueue((prev) => {
      if (prev.length - nextIndex > 5) {
        return prev;
      }
      const extra = RANDOM_ITEMS(targetMode, amount);
      return prev.length ? [...prev, ...extra] : extra;
    });
  }, []);

  const handleStart = () => {
    if (!running) {
      if (stats.total === 0 || timeLeft === ROUND_SECONDS) {
        setStats(initialStats);
        setIndex(0);
        setFeedback({ status: "idle" });
        setQueue(RANDOM_ITEMS(mode, 120));
      }
      setRunning(true);
    }
  };

  const handlePause = () => {
    setRunning(false);
  };

  const handleReset = useCallback(() => {
    setRunning(false);
    setTimeLeft(ROUND_SECONDS);
    setStats(initialStats);
    setIndex(0);
    setInput("");
    setQueue([]);
    setFeedback({ status: "idle" });
  }, []);

  useEffect(() => {
    handleReset();
  }, [mode, handleReset]);

  const submitAnswer = useCallback(
    (response: string) => {
      if (!currentPrompt) return;
      const result = evaluate(currentPrompt, response);
      setStats((prev) => {
        const next: RoundStats = {
          correct: prev.correct + (result.correct ? 1 : 0),
          total: prev.total + 1,
          streak: result.correct ? prev.streak + 1 : 0,
          bestStreak: result.correct ? Math.max(prev.bestStreak, prev.streak + 1) : prev.bestStreak,
          tokensHit: prev.tokensHit + result.hit,
          tokensTotal: prev.tokensTotal + result.totalTokens
        };
        if (!result.correct) {
          next.streak = 0;
        }
        return next;
      });
      setFeedback({
        status: result.correct ? "correct" : "incorrect",
        expected: result.expectedPhrase,
        misses: result.misses,
        prompt: currentPrompt
      });
      setInput("");
      const nextIndex = index + 1;
      setIndex(nextIndex);
      ensureQueue(mode, nextIndex, 60);
    },
    [currentPrompt, ensureQueue, index, mode]
  );

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!input.trim() || timeLeft <= 0) return;
      submitAnswer(input);
    },
    [input, submitAnswer, timeLeft]
  );

  const modeOptions: Array<{ value: Mode; label: string }> = useMemo(
    () => [
      { value: "letters", label: "Letters" },
      { value: "numbers", label: "Numbers" },
      { value: "mixed", label: "Mixed" },
      { value: "callsigns", label: "Callsigns" }
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
        <header className="space-y-2 text-center sm:text-left">
          <Badge tone="sky" className="mx-auto sm:mx-0">
            Quiz Module
          </Badge>
          <h1 className="text-3xl font-semibold text-slate-100">Phonetic Alphabet — Timed Quiz</h1>
          <p className="text-sm text-slate-300">
            Sixty-second drills to keep your ICAO / NATO phonetics sharp across letters, numbers, and live callsigns.
          </p>
        </header>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <span>Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as Mode)}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Start
              </button>
              <button
                type="button"
                onClick={handlePause}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-sky-100"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-rose-500/60 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10"
              >
                Reset
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <ProgressRing value={timeLeft / ROUND_SECONDS} size={120} />
              <span className="text-lg font-semibold text-slate-100">{timeLeft}s</span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Prompt</p>
                <p className="mt-1 text-4xl font-bold text-slate-50" aria-live="polite">
                  {currentPrompt || "—"}
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-3">
                <label htmlFor="response" className="text-sm font-semibold text-slate-200">
                  Your read-back
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="response"
                    name="response"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Type the phonetic phrase"
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-100 shadow-inner focus-visible:ring-2 focus-visible:ring-sky-500"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setMicActive((prev) => !prev)}
                    aria-pressed={micActive}
                    aria-label="Toggle microphone placeholder"
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      micActive
                        ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
                        : "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-sky-500/60 hover:text-slate-100"
                    }`}
                  >
                    {micActive ? "Mic prepped" : "Mic placeholder"}
                  </button>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Submit
                </button>
              </form>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center gap-3">
            {feedback.status === "correct" && <Badge tone="sky">Correct</Badge>}
            {feedback.status === "incorrect" && <Badge tone="critical">Check phrasing</Badge>}
            {feedback.status !== "idle" && (
              <span className="text-sm text-slate-300">
                Expected: <span className="font-semibold text-slate-100">{feedback.expected}</span>
              </span>
            )}
            {feedback.status === "incorrect" && feedback.misses?.length ? (
              <span className="text-xs text-slate-400">Missing: {feedback.misses.join(", ")}</span>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Round stats</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                <li>
                  Accuracy: <span className="font-semibold text-slate-100">{accuracy.toFixed(0)}%</span>
                </li>
                <li>
                  Token accuracy: <span className="font-semibold text-slate-100">{tokenAccuracy.toFixed(0)}%</span>
                </li>
                <li>
                  Best streak: <span className="font-semibold text-slate-100">{stats.bestStreak}</span>
                </li>
                <li>
                  WPM (tokens/min): <span className="font-semibold text-slate-100">{wpm.toFixed(1)}</span>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Personal best — {modeOptions.find((m) => m.value === mode)?.label}</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                <li>
                  Accuracy: <span className="font-semibold text-slate-100">{bests[mode].accuracy.toFixed(0)}%</span>
                </li>
                <li>
                  WPM: <span className="font-semibold text-slate-100">{bests[mode].wpm.toFixed(1)}</span>
                </li>
                <li>
                  Streak: <span className="font-semibold text-slate-100">{bests[mode].streak}</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
