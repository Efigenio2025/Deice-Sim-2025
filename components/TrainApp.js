import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { FrostCard } from "./frost/FrostCard";
import {
  unlockAudio,
  playCaptainCue,
  preloadCaptainCues,
  onAudio,
  stopAudio,
} from "../lib/audio";
import { listenOnce } from "../lib/speech";

function Stepper({ total, current, results = [], onJump }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const r = results[i];
        const state = i === current ? "current" : r === true ? "ok" : r === false ? "miss" : "idle";
        const className = clsx(
          "h-3 w-3 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
          state === "current"
            ? "border-cyan-200/80 bg-cyan-400/80 shadow-[0_0_0_4px_rgba(56,189,248,0.25)]"
            : state === "ok"
            ? "border-emerald-300/70 bg-emerald-400/80"
            : state === "miss"
            ? "border-rose-300/60 bg-rose-400/80"
            : "border-white/20 bg-white/10"
        );
        return (
          <button
            key={i}
            type="button"
            className={className}
            onClick={() => onJump?.(i)}
            aria-label={`Jump to step ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

function ScoreRing({ pct = 0, size = 60, label }) {
  const r = (size - 8) / 2, c = size / 2, circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
  const display = label ?? `${pct}%`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} stroke="rgba(148, 163, 184, 0.25)" strokeWidth="8" fill="none" />
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke="#38bdf8"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={off}
        strokeLinecap="round"
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize="14" fill="#e2e8f0">
        {String(display)}
      </text>
    </svg>
  );
}

function WordDiff({ expected = "", heard = "" }) {
  const A = expected.trim().split(/\s+/);
  const B = new Set(heard.trim().toLowerCase().split(/\s+/));
  return (
    <p className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm leading-relaxed text-slate-200">
      {A.map((w, i) => (
        <span
          key={i}
          className={clsx(
            "rounded-md px-1.5 py-0.5 text-sm font-medium",
            B.has(w.toLowerCase())
              ? "bg-emerald-500/20 text-emerald-100"
              : "bg-rose-500/20 text-rose-100 underline decoration-rose-300/70"
          )}
        >
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

function MicWidget({ status = "idle", level = 0, compact = false }) {
  const normalized = status || "idle";
  const label = normalized === "manual" ? "Manual entry" : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <div className={clsx("flex w-full flex-col gap-2", compact ? "sm:flex-row sm:items-center" : "")}
      aria-label={`Microphone status: ${label}`}
    >
      <span className={clsx("frost-pill", compact && "w-full justify-center sm:w-auto")}>Mic: {label}</span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 transition-all duration-500"
          style={{ width: `${Math.min(100, level)}%` }}
        />
      </div>
    </div>
  );
}

const _toasts = [];
function toast(msg, kind = "info", ms = 2200) {
  _toasts.push({ id: Date.now(), msg, kind });
  renderToasts();
  setTimeout(() => {
    _toasts.shift();
    renderToasts();
  }, ms);
}

function renderToasts() {
  let host = document.getElementById("pm-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "pm-toast-host";
    host.className = "pm-toasts";
    document.body.appendChild(host);
  }
  host.innerHTML = _toasts.map((t) => `<div class="pm-toast ${t.kind}">${t.msg}</div>`).join("");
}

function useResponsiveMode(forcedMode) {
  const pick = () => (window.innerWidth <= 860 ? "mobile" : "desktop");
  const [mode, setMode] = useState(() => {
    if (forcedMode) return forcedMode;
    return typeof window === "undefined" ? "desktop" : pick();
  });

  useEffect(() => {
    if (forcedMode) return;
    const onResize = () => setMode(pick());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [forcedMode]);

  useEffect(() => {
    if (forcedMode) setMode(forcedMode);
  }, [forcedMode]);

  return mode;
}

function useViewportSize() {
  const getSize = () => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  });
  const [size, setSize] = useState(getSize);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handle = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("orientationchange", handle);
    };
  }, []);

  return size;
}

function downloadCSV(rows, filename = "deice-results.csv") {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TrainApp({ forcedMode }) {
  // scenario list + current
  const [scenarioList, setScenarioList] = useState([]);
  const [current, setCurrent] = useState(null);

  // steps / results
  const [stepIndex, setStepIndex] = useState(-1);
  const steps = useMemo(() => current?.steps || [], [current]);
  const total = steps.length;
  const resultsRef = useRef([]);
  const scoresRef = useRef([]);

  // UI & control state
  const [status, setStatus] = useState("Ready");
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
  const [lastResultText, setLastResultText] = useState("—");
  const [retryCount, setRetryCount] = useState(0);
  const [avgRespSec, setAvgRespSec] = useState(null);
  const [logText, setLogText] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [captureMode, setCaptureMode] = useState(() => {
    if (typeof window === "undefined") return "speech";
    return window.SpeechRecognition || window.webkitSpeechRecognition ? "speech" : "manual";
  });
  const captureModeRef = useRef(captureMode);
  const [resultsVersion, setResultsVersion] = useState(0);

  const mode = useResponsiveMode(forcedMode);
  const { width: viewportWidth } = useViewportSize();

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const preparedRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);
  const awaitingAdvanceRef = useRef(awaitingAdvance);
  const runIdRef = useRef(0);
  const proceedResolverRef = useRef(null);

  const micLevelRef = useRef(0);
  const [captainStatus, setCaptainStatus] = useState("idle");
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
    if (autoAdvance && awaitingAdvanceRef.current && proceedResolverRef.current) {
      resolvePrompt();
    }
  }, [autoAdvance]);
  useEffect(() => {
    awaitingAdvanceRef.current = awaitingAdvance;
  }, [awaitingAdvance]);

  const gradedTotal = useMemo(() => (steps || []).filter((s) => s.role === "Iceman").length, [steps]);
  const correct = useMemo(() => {
    return (resultsRef.current || []).reduce((acc, val, idx) => {
      return acc + (steps[idx]?.role === "Iceman" && val === true ? 1 : 0);
    }, 0);
  }, [steps, resultsVersion]);
  const totalScore = useMemo(() => {
    return (scoresRef.current || []).reduce((acc, val, idx) => {
      return acc + (steps[idx]?.role === "Iceman" && typeof val === "number" ? val : 0);
    }, 0);
  }, [steps, resultsVersion]);
  const totalPossible = gradedTotal * 100;
  const pct = totalPossible ? Math.round((totalScore / totalPossible) * 100) : 0;
  const speechSupported = captureMode === "speech";
  const micStatus = speechSupported
    ? preparedRef.current
      ? runningRef.current && !pausedRef.current
        ? "listening"
        : "ready"
      : "idle"
    : "manual";
  const micLevel = micLevelRef.current || 0;
  const activeSpeechLabelId = autoAdvance ? "speech-mode-auto" : "speech-mode-manual";
  const isMobile = mode === "mobile";
  const mobileScoreSize = useMemo(() => {
    if (!isMobile) return 72;
    const min = 44;
    const max = 56;
    const computed = Math.round((viewportWidth || 0) * 0.15);
    const withinRange = Math.max(min, Math.min(max, computed || min));
    return withinRange;
  }, [isMobile, viewportWidth]);

  const log = (msg) => setLogText((t) => (t ? t + "\n" : "") + msg);

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSpeech = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setCaptureMode(hasSpeech ? "speech" : "manual");
  }, []);

  useEffect(() => {
    if (captureMode === "manual") {
      if (autoAdvanceRef.current) {
        autoAdvanceRef.current = false;
      }
      if (autoAdvance) setAutoAdvance(false);
    }
  }, [captureMode, autoAdvance]);

  // 1) Load scenario list for dropdown
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/scenarios/index.json");
        const list = await res.json();
        if (!live) return;
        setScenarioList(list || []);
        if (list && list[0]) {
          // auto-load first scenario
          const res2 = await fetch(`/scenarios/${list[0].id}.json`);
          const data = await res2.json();
          setCurrent(data);
          resultsRef.current = Array(data.steps.length).fill(undefined);
          scoresRef.current = Array(data.steps.length).fill(null);
          setResultsVersion((v) => v + 1);
          setStatus("Scenario loaded");
          setStepIndex(-1);
          setAnswer("");
          setLastResultText("—");
          setRetryCount(0);
          setAvgRespSec(null);
          setAwaitingAdvance(false);
          awaitingAdvanceRef.current = false;
          proceedResolverRef.current = null;
          preloadCaptainForScenario(data);
        }
      } catch (e) {
        console.error("Load scenario list failed", e);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // 2) subscribe to captain audio status
  useEffect(() => {
    const off = onAudio("status", (e) => setCaptainStatus(e.detail?.status || "idle"));
    return () => off && off();
  }, []);

  // mic level mock
  useEffect(() => {
    const id = setInterval(() => {
      if (captureModeRef.current !== "speech") {
        micLevelRef.current = 0;
        return;
      }
      micLevelRef.current = runningRef.current && !pausedRef.current ? 10 + Math.round(Math.random() * 80) : 0;
    }, 500);
    return () => clearInterval(id);
  }, []);

  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }
  function quickScore(expected, heard) {
    const A = new Set(normalize(expected).split(" "));
    const B = new Set(normalize(heard).split(" "));
    const inter = [...A].filter((x) => B.has(x)).length;
    return A.size ? Math.round((inter / A.size) * 100) : 0;
  }

  function preloadCaptainForScenario(scn) {
    const scnId = scn?.id;
    if (!scnId) return;
    const cues = Array.from(new Set((scn.steps || []).filter((s) => s.role === "Captain" && s.cue).map((s) => s.cue)));
    preloadCaptainCues(scnId, cues);
  }

  async function prepareMic() {
    if (preparedRef.current) {
      log("Microphone already prepared.");
      return true;
    }

    setStatus("Preparing mic…");
    log("Preparing microphone.");
    let speechModeActive = captureModeRef.current === "speech";
    if (typeof window !== "undefined") {
      const hasSpeech = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!hasSpeech) {
        speechModeActive = false;
        if (captureModeRef.current !== "manual") setCaptureMode("manual");
      }
    }
    try {
      await unlockAudio();
      log("Audio unlocked via unlockAudio().");

      if (speechModeActive) {
        if (navigator.mediaDevices?.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          log("Mic permission granted by getUserMedia().");
        } else {
          log("getUserMedia unavailable; switching to manual capture mode.");
          setCaptureMode("manual");
          speechModeActive = false;
        }
      } else {
        log("Speech capture not supported; running in manual mode.");
      }

      const cues = (current?.steps || []).filter((s) => s.role === "Captain" && s.cue).map((s) => s.cue);
      if (cues.length) {
        preloadCaptainCues(current?.id || "default", cues);
        log(`Preloaded Captain cues: ${cues.join(", ")}`);
      }

      preparedRef.current = true;
      setStatus(speechModeActive ? "Mic ready" : "Ready (manual)");
      toast(speechModeActive ? "Mic ready" : "Manual mode ready", "success");
      return true;
    } catch (err) {
      if (speechModeActive) {
        preparedRef.current = false;
        setStatus("Mic prepare failed");
        toast("Mic prepare failed", "error");
      } else {
        preparedRef.current = true;
        setStatus("Ready (manual)");
      }
      log(`Prepare Mic ERROR: ${err?.message || err}`);
      if (!speechModeActive) return true;
      return false;
    }
  }

  async function onStart() {
    try {
      const ok = await prepareMic();
      if (!ok) return;

      pausedRef.current = false;
      runningRef.current = true;
      setStatus(preparedRef.current ? "Running…" : "Running (no mic)");
      log("Simulation started.");

      // First start: move to step 0 if needed
      if (stepIndex < 0 && steps.length) {
        setStepIndex(0);
      }

      runSimulator();
    } catch (e) {
      console.error("Start failed:", e);
      setStatus("Start failed");
      toast("Start failed", "error");
    }
  }

  // Pause simulator and all audio cleanly
  function onPause() {
    try {
      pausedRef.current = true;
      runningRef.current = false;
      stopAudio();
      resolvePrompt({ silent: true });
      setStatus("Paused");
      log("Simulation paused.");
      toast("Paused", "info");
    } catch (e) {
      console.error("Pause failed:", e);
      toast("Pause failed", "error");
    }
  }

  function onCheck() {
    if (stepIndex < 0 || !steps[stepIndex]) return;
    const exp = steps[stepIndex].text;
    const p = quickScore(exp, answer);
    const ok = p >= 60;
    resultsRef.current[stepIndex] = ok;
    scoresRef.current[stepIndex] = p;
    setResultsVersion((v) => v + 1);
    setLastResultText(ok ? `✅ Good (${p}%)` : `❌ Try again (${p}%)`);
    if (!ok) setRetryCount((n) => n + 1);
    log(`[Step ${stepIndex + 1}] Score ${p}% → ${ok ? "OK" : "MISS"}`);
  }

  function exportSession() {
    const rows = [
      ["Scenario", current?.label || ""],
      [],
      ["Step", "Role", "Expected", "Result"],
      ...steps.map((s, i) => [i + 1, s.role, s.text, resultsRef.current[i] ? "OK" : "MISS"]),
    ];
    downloadCSV(rows, `deice_${current?.id || "scenario"}.csv`);
    toast("CSV downloaded", "success");
  }

  function resolvePrompt({ silent = false } = {}) {
    const hadPending = Boolean(proceedResolverRef.current) || awaitingAdvanceRef.current;
    if (proceedResolverRef.current) {
      const resolve = proceedResolverRef.current;
      proceedResolverRef.current = null;
      resolve();
    }
    awaitingAdvanceRef.current = false;
    setAwaitingAdvance(false);
    if (hadPending && !silent && runningRef.current && !pausedRef.current) setStatus("Running…");
  }

  async function runSimulator() {
    if (!current || !steps.length) {
      setStatus("Select a scenario first.");
      return;
    }

    const runId = Date.now();
    runIdRef.current = runId;

    let idx = stepIndex >= 0 ? stepIndex : 0;
    if (idx !== stepIndex) setStepIndex(idx);

    let responseCount = 0;
    let responseTotal = 0;

    const awaitManualResponse = async (step) => {
      setAnswer("");
      setStatus("Type your line and tap Proceed…");
      log(`[Step ${idx + 1}] Manual response mode.`);

      const started = performance.now();
      awaitingAdvanceRef.current = true;
      setAwaitingAdvance(true);

      await new Promise((resolve) => {
        proceedResolverRef.current = () => {
          const heard = (answerRef.current || "").trim();
          const expected = step.text || "";
          const score = quickScore(expected, heard);
          const ok = score >= 60;
          resultsRef.current[idx] = ok;
          scoresRef.current[idx] = score;
          setResultsVersion((v) => v + 1);
          setLastResultText(ok ? `✅ Good (${score}%)` : `❌ Try again (${score}%)`);
          if (!ok) {
            setRetryCount((n) => n + 1);
            toast("Let's try that line again.", "info");
          }
          const took = (performance.now() - started) / 1000;
          responseCount += 1;
          responseTotal += took;
          setAvgRespSec(responseCount ? responseTotal / responseCount : null);
          log(`[Step ${idx + 1}] Manual score ${score}% → ${ok ? "OK" : "MISS"}`);
          resolve();
        };
      });

      return runningRef.current && !pausedRef.current && runIdRef.current === runId;
    };

    while (runningRef.current && !pausedRef.current && runIdRef.current === runId && idx < steps.length) {
      const step = steps[idx];
      if (!step) break;

      setStepIndex(idx);

      if (step.role === "Captain") {
        if (step.cue && current?.id) {
          try {
            await playCaptainCue(current.id, step.cue);
          } catch (err) {
            console.error("Captain cue failed", err);
          }
        }
        if (resultsRef.current[idx] !== true) {
          resultsRef.current[idx] = true;
          setResultsVersion((v) => v + 1);
        }
      } else if (step.role === "Iceman") {
        if (captureModeRef.current !== "speech") {
          const shouldContinue = await awaitManualResponse(step);
          if (!shouldContinue) break;
          if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;
          if (runningRef.current && !pausedRef.current) setStatus("Running…");
          idx += 1;
          continue;
        }

        setAnswer("");
        setStatus("Listening…");
        log(`[Step ${idx + 1}] Listening for response.`);

        const started = performance.now();
        let speech;
        try {
          speech = await listenOnce({
            onInterim: (txt) => setAnswer(txt),
            onStatus: (msg) => setStatus(msg),
          });
        } catch (err) {
          console.error("listenOnce failed", err);
          toast("Speech capture failed", "error");
          setStatus("Speech capture failed");
          runningRef.current = false;
          break;
        }

        if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;

        if (speech?.ended === "nosr") {
          log("Speech recognition unavailable; switching to manual mode.");
          toast("Speech capture not supported in this browser. Using manual mode.", "info");
          setCaptureMode("manual");
          const shouldContinue = await awaitManualResponse(step);
          if (!shouldContinue) break;
          if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;
          if (runningRef.current && !pausedRef.current) setStatus("Running…");
          idx += 1;
          continue;
        }

        const heard = (speech?.final || speech?.interim || "").trim();
        setAnswer(heard);

        const took = (performance.now() - started) / 1000;
        responseCount += 1;
        responseTotal += took;
        setAvgRespSec(responseCount ? responseTotal / responseCount : null);

        const expected = step.text || "";
        const score = quickScore(expected, heard);
        const ok = score >= 60;
        resultsRef.current[idx] = ok;
        scoresRef.current[idx] = score;
        setResultsVersion((v) => v + 1);
        setLastResultText(ok ? `✅ Good (${score}%)` : `❌ Try again (${score}%)`);
        if (!ok) {
          setRetryCount((n) => n + 1);
          toast("Let's try that line again.", "info");
        }
        log(`[Step ${idx + 1}] Auto score ${score}% → ${ok ? "OK" : "MISS"}`);

        if (!autoAdvanceRef.current && idx < steps.length - 1) {
          setStatus("Awaiting proceed…");
          awaitingAdvanceRef.current = true;
          setAwaitingAdvance(true);
          log("Awaiting confirmation to proceed.");
          await new Promise((resolve) => {
            proceedResolverRef.current = resolve;
          });
          proceedResolverRef.current = null;
          awaitingAdvanceRef.current = false;
          setAwaitingAdvance(false);
          if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;
          setStatus("Running…");
        }
      } else {
        if (resultsRef.current[idx] === undefined) {
          resultsRef.current[idx] = true;
          setResultsVersion((v) => v + 1);
        }
      }

      if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;

      if (runningRef.current && !pausedRef.current) setStatus("Running…");
      idx += 1;
    }

    if (runIdRef.current !== runId) return;

    if (idx >= steps.length) {
      runningRef.current = false;
      const okCount = (resultsRef.current || []).reduce((acc, val, i) => {
        return acc + (steps[i]?.role === "Iceman" && val === true ? 1 : 0);
      }, 0);
      const finalPct = gradedTotal ? Math.round((okCount / gradedTotal) * 100) : 0;
      setStatus(`Complete • ${okCount}/${gradedTotal} (${finalPct}%) • ${finalPct >= 80 ? "PASS" : "RETRY"}`);
      toast("Session complete", finalPct >= 80 ? "success" : "info");
    }
  }

  const scoreDetails = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
      <span className="frost-pill">Correct {correct}/{gradedTotal}</span>
      <span className="frost-pill muted">Retries {retryCount || 0}</span>
      <span className="frost-pill muted">Avg {avgRespSec?.toFixed?.(1) ?? "—"}s</span>
    </div>
  );

  const progressSummary = (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="frost-label">Progress</p>
        <Stepper
          total={total}
          current={Math.max(0, stepIndex)}
          results={resultsRef.current || []}
          onJump={(i) => {
            resolvePrompt({ silent: true });
            setStepIndex(i);
            const s = steps[i];
            if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
          }}
        />
      </div>
      {scoreDetails}
    </div>
  );

  const totalScoreText = totalPossible ? `${pct}% (${totalScore} of ${totalPossible})` : `${pct}%`;
  const statusBlock = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="frost-pill">{status}</span>
      <span className="frost-pill muted">Captain: {captainStatus}</span>
    </div>
  );

  const micBlock = <MicWidget status={micStatus} level={micLevel} compact={isMobile} />;

  return (
    <div className="space-y-6 pb-16">
      <FrostCard padding="lg" interactive={false}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-1 items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/40 via-cyan-400/20 to-transparent text-2xl text-cyan-100 shadow-[0_15px_40px_rgba(34,211,238,0.35)]">
              🧊
            </span>
            <div className="space-y-3">
              <span className="frost-pill muted">Live Iceman Session</span>
              <div className="space-y-2">
                <h1 className="font-display text-3xl font-semibold text-slate-100 sm:text-4xl">
                  Deice Verbiage Trainer
                </h1>
                <p className="text-sm text-slate-300/80">
                  V2 • For training purposes only • OMA Station • {new Date().getFullYear()}
                </p>
              </div>
              <p className="text-sm text-slate-300/80">
                Captain cues preload with each scenario. Iceman responses capture via mic or manual entry with frost-diff scoring.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 rounded-3xl bg-white/5 p-4 shadow-inner shadow-cyan-900/20 sm:flex-row sm:items-center lg:w-auto lg:flex-col lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center">
                <ScoreRing pct={pct} size={isMobile ? mobileScoreSize : 70} label={totalScoreText} />
              </div>
              <div className="text-xs text-slate-300/80">
                <p className="uppercase tracking-[0.3em] text-slate-400">Iceman Accuracy</p>
                <p className="text-sm font-semibold text-slate-100">{totalScoreText}</p>
                <p className="text-xs text-slate-400">{gradedTotal} graded steps</p>
              </div>
            </div>
            {statusBlock}
            {micBlock}
          </div>
        </div>
      </FrostCard>

      <FrostCard padding="lg" interactive={false}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <label htmlFor="scenario-select" className="frost-label">
              Scenario Library
            </label>
            <select
              id="scenario-select"
              className="frost-input appearance-none bg-gradient-to-r from-white/5 via-white/10 to-white/5 text-base"
              value={current?.id || ""}
              onChange={async (e) => {
                const id = e.target.value;
                const res = await fetch(`/scenarios/${id}.json`);
                const scn = await res.json();
                setCurrent(scn);
                resultsRef.current = Array(scn.steps.length).fill(undefined);
                scoresRef.current = Array(scn.steps.length).fill(null);
                setResultsVersion((v) => v + 1);
                setStepIndex(-1);
                setStatus("Scenario loaded");
                log(`Scenario loaded: ${scn.label}`);
                setAnswer("");
                setLastResultText("—");
                setRetryCount(0);
                setAvgRespSec(null);
                setAwaitingAdvance(false);
                awaitingAdvanceRef.current = false;
                proceedResolverRef.current = null;
                preloadCaptainForScenario(scn);
              }}
            >
              {(scenarioList || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Select a scenario to load captain cues and scoring rubric. Cards shimmer with frost wipe on hover.
            </p>
          </div>
          <div className="space-y-4">
            {progressSummary}
          </div>
        </div>
      </FrostCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
        <FrostCard padding="lg" interactive={false}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={clsx("frost-btn text-xs", isMobile && "w-full justify-center")} onClick={onStart}>
                Start
              </button>
              <button
                type="button"
                className={clsx("frost-btn ghost text-xs", isMobile && "w-full justify-center")}
                onClick={onPause}
              >
                Pause
              </button>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300/80">
                <span id="speech-mode-label" className="frost-label">
                  Speech Mode
                </span>
                <span id="speech-mode-auto" className={clsx("font-semibold", autoAdvance ? "text-cyan-200" : "text-slate-500")}>Auto</span>
                <button
                  type="button"
                  className={clsx(
                    "relative inline-flex h-8 w-16 items-center rounded-full border border-white/10 bg-white/10 transition",
                    captureMode !== "speech" && "opacity-40",
                    autoAdvance ? "bg-cyan-400/30" : "bg-slate-800/70"
                  )}
                  role="switch"
                  aria-checked={!autoAdvance}
                  aria-labelledby={`speech-mode-label ${activeSpeechLabelId}`}
                  disabled={captureMode !== "speech"}
                  onClick={() => {
                    if (captureMode !== "speech") return;
                    const next = !autoAdvance;
                    setAutoAdvance(next);
                    log(`Speech mode: ${next ? "Auto" : "Manual"}.`);
                  }}
                >
                  <span
                    className={clsx(
                      "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition",
                      autoAdvance ? "translate-x-8 bg-cyan-100" : "translate-x-0"
                    )}
                  />
                  <span className="sr-only">Toggle speech auto advance</span>
                </button>
                <span id="speech-mode-manual" className={clsx("font-semibold", autoAdvance ? "text-slate-500" : "text-cyan-200")}>
                  Manual
                </span>
              </div>
            </div>

            {captureMode !== "speech" && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Speech capture isn't available on this device. Type your response and use Proceed.
              </div>
            )}

            <div className="space-y-3">
              <p className="frost-label">Current Line</p>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/10 to-white/5 p-4 text-sm text-slate-200">
                {stepIndex >= 0 && steps[stepIndex] ? (
                  <>
                    <span className="text-cyan-200">{steps[stepIndex].role}:</span> {steps[stepIndex].text}
                  </>
                ) : (
                  "Select a step and press Start."
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className={clsx("frost-btn ghost text-xs", isMobile && "flex-1 justify-center")}
                onClick={() => {
                  resolvePrompt({ silent: true });
                  setStepIndex((i) => {
                    const n = Math.max(0, (typeof i === "number" ? i : 0) - 1);
                    const s = steps[n];
                    if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                    return n;
                  });
                }}
              >
                ⟵ Prev
              </button>
              <button
                className={clsx("frost-btn text-xs", isMobile && "flex-1 justify-center")}
                onClick={() => {
                  if (awaitingAdvanceRef.current) {
                    log("Advance confirmed via Next button.");
                    resolvePrompt();
                    return;
                  }
                  setStepIndex((i) => {
                    const n = Math.min(total - 1, (typeof i === "number" ? i : -1) + 1);
                    const s = steps[n];
                    if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                    return n;
                  });
                }}
              >
                Next ⟶
              </button>
              <button
                className={clsx("frost-btn ghost text-xs", isMobile && "flex-1 justify-center")}
                onClick={() => {
                  const s = steps[stepIndex];
                  if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                }}
              >
                ▶︎ Play line
              </button>
            </div>

            <div className="space-y-3">
              <p className="frost-label">Your Response</p>
              <textarea
                rows={3}
                className="frost-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Speak or type your line…"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button className="frost-btn text-xs" onClick={onCheck}>
                  Check
                </button>
                <span className="frost-pill muted">{lastResultText}</span>
              </div>
            </div>

            {awaitingAdvance && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                <span>Response captured. Proceed when ready.</span>
                <button
                  className="frost-btn text-xs"
                  onClick={() => {
                    log("Advance confirmed.");
                    resolvePrompt();
                  }}
                >
                  Proceed
                </button>
              </div>
            )}

            {stepIndex >= 0 && steps[stepIndex] && <WordDiff expected={steps[stepIndex].text} heard={answer} />}
          </div>
        </FrostCard>

        <FrostCard padding="lg" interactive={false}>
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <p className="frost-label">Progress Recap</p>
              {progressSummary}
            </div>
            <div className="space-y-3">
              <p className="frost-label">Session Log</p>
              <div className="frost-log">{logText || "No log entries yet."}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="frost-btn ghost text-xs" onClick={exportSession}>
                Export CSV
              </button>
              <button className="frost-btn ghost text-xs" onClick={() => toast("Saved settings", "success")}>
                Save Settings
              </button>
            </div>
          </div>
        </FrostCard>
      </div>
    </div>
  );
}

export function DesktopTrainApp() {
  return <TrainApp forcedMode="desktop" />;
}

export function MobileTrainApp() {
  return <TrainApp forcedMode="mobile" />;
}

export default TrainApp;