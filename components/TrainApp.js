import { useEffect, useMemo, useRef, useState } from "react";
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
    <div className="pm-stepper">
      {Array.from({ length: total }).map((_, i) => {
        const r = results[i];
        const cls =
          i === current ? "pm-step cur" : r === true ? "pm-step ok" : r === false ? "pm-step miss" : "pm-step";
        return <button key={i} className={cls} onClick={() => onJump?.(i)} aria-label={`Step ${i + 1}`} />;
      })}
    </div>
  );
}

function ScoreRing({ pct = 0, size = 60, label }) {
  const r = (size - 8) / 2, c = size / 2, circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
  const display = label ?? `${pct}%`;
  return (
    <svg className="pm-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} stroke="#dfeaff" strokeWidth="8" fill="none" />
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke="#0e63ff"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={off}
        strokeLinecap="round"
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize="14" fill="#0b1e39">
        {String(display)}
      </text>
    </svg>
  );
}

function WordDiff({ expected = "", heard = "" }) {
  const A = expected.trim().split(/\s+/);
  const B = new Set(heard.trim().toLowerCase().split(/\s+/));
  return (
    <p className="pm-diff">
      {A.map((w, i) => (
        <span key={i} className={B.has(w.toLowerCase()) ? "pm-wok" : "pm-wmiss"}>
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
    <div className={`pm-mic${compact ? " compact" : ""}`}>
      <span className={`pm-pill${compact ? " pm-pillCompact" : ""}`}>Mic: {label}</span>
      <div className="pm-meter">
        <div className="pm-fill" style={{ width: `${Math.min(100, level)}%` }} />
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
    <div className="pm-scoreDetails">
      <div className="pm-pill">
        Correct: <strong>{correct}/{gradedTotal}</strong>
      </div>
      <div className="pm-pill">
        Retries: <strong>{retryCount || 0}</strong>
      </div>
      <div className="pm-pill">
        Avg. Response: <strong>{avgRespSec?.toFixed?.(1) ?? "—"}s</strong>
      </div>
    </div>
  );

  const progressSummary = (
    <div className="pm-row pm-progressRow">
      <div>
        <div className="pm-label">Progress</div>
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
      <div className={`pm-scoreRow${isMobile ? " pm-scoreRowCompact" : ""}`}>
        {!isMobile && <ScoreRing pct={pct} />}
        {scoreDetails}
      </div>
    </div>
  );

  const titleBlock = (
    <div className="pm-title">
      <div className="pm-titleBrand">
        <img src="/images/piedmont-logo.png" alt="Piedmont Airlines" />
        <div className="pm-titleText">
          <h1>Deice Verbiage Trainer</h1>
          <span className="pm-badge pm-titleBadge">V2 • For training purposes only • OMA Station • 2025</span>
        </div>
      </div>
    </div>
  );

  const totalScoreText = totalPossible ? `${pct}% (${totalScore} of ${totalPossible})` : `${pct}%`;
  const scoreBlock = (
    <div className="pm-headerScore" aria-label={`Iceman total ${totalScoreText}`}>
      <ScoreRing pct={pct} size={isMobile ? mobileScoreSize : 60} />
    </div>
  );

  const statusBlock = (
    <div className={`pm-statusGroup${isMobile ? " pm-statusGroupCompact" : ""}`}>
      <span className={`pm-pill${isMobile ? " pm-pillCompact" : ""}`}>{status}</span>
      <span className={`pm-pill${isMobile ? " pm-pillCompact" : ""}`}>Captain: {captainStatus}</span>
    </div>
  );

  const micBlock = <MicWidget status={micStatus} level={micLevel} compact={isMobile} />;

  return (
    <div className={`pm-app ${mode}`}>
      <div className="pm-card">
        {/* Header */}
        {isMobile ? (
          <div className="pm-header mobile">
            <div className="pm-headerSection pm-headerBrand">{titleBlock}</div>
            <div className="pm-headerSection pm-headerScoreWrap">{scoreBlock}</div>
            <div className="pm-headerSection pm-headerStatus">{statusBlock}</div>
            <div className="pm-headerSection pm-headerMic">{micBlock}</div>
          </div>
        ) : (
          <div className="pm-header desktop">
            <div className="pm-headerLeft">
              {titleBlock}
              {scoreBlock}
            </div>
            <div className="pm-headerRight">
              {statusBlock}
              {micBlock}
            </div>
          </div>
        )}

        <div className={`pm-panel pm-scenarioPanel${isMobile ? " mobile" : ""}`}>
          <label className="pm-srOnly" htmlFor="scenario-select">
            Scenario
          </label>
          <select
            id="scenario-select"
            className="pm-select pm-scenarioSelect"
            value={current?.id || ""}
            size={1}
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
        </div>

        {/* Main */}
        <div className={`pm-main ${mode}`}>
          {/* LEFT */}
          <section className="pm-panel">
            {isMobile && <div className="pm-progressTop">{progressSummary}</div>}
            <div className="pm-runRow">
              <div className="pm-row pm-startControls">
                <button
                  type="button"
                  className={`pm-btn${isMobile ? " pm-mobileControl" : ""}`}
                  onClick={onStart}
                >
                  Start
                </button>
                <button
                  type="button"
                  className={`pm-btn ghost${isMobile ? " pm-mobileControl" : ""}`}
                  onClick={onPause}
                >
                  Pause
                </button>
                <div className="pm-row pm-speechToggle">
                  <span className="pm-label" id="speech-mode-label">
                    Speech mode
                  </span>
                  <span id="speech-mode-auto" className={`pm-switchOption${autoAdvance ? " active" : ""}`}>
                    Auto
                  </span>
                  <button
                    type="button"
                    className={`pm-switch${autoAdvance ? "" : " manual"}`}
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
                    <span className="pm-switchTrack">
                      <span className="pm-switchThumb" />
                    </span>
                  </button>
                  <span id="speech-mode-manual" className={`pm-switchOption${autoAdvance ? "" : " active"}`}>
                    Manual
                  </span>
                </div>
              </div>
            </div>

            {captureMode !== "speech" && (
              <div className="pm-manualNotice">
                <span className="pm-pill pm-pillWarn">
                  Speech capture isn't available on this device. Type your response and use Proceed.
                </span>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Current Line</div>
              <div className="pm-coach">
                {stepIndex >= 0 && steps[stepIndex] ? (
                  <>
                    <strong>{steps[stepIndex].role}:</strong> {steps[stepIndex].text}
                  </>
                ) : (
                  "Select a step and press Start."
                )}
              </div>
            </div>

            <div
              className={`pm-row pm-navRow${isMobile ? " pm-navRowCompact" : ""}`}
              style={{ marginTop: 8 }}
            >
              <button
                className={`pm-btn${isMobile ? " pm-mobileNavBtn" : ""}`}
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
                className={`pm-btn primary${isMobile ? " pm-mobileNavBtn" : ""}`}
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
                className={`pm-btn${isMobile ? " pm-mobileNavBtn" : ""}`}
                onClick={() => {
                  const s = steps[stepIndex];
                  if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                }}
              >
                ▶︎ Play line
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Your Response</div>
              <textarea
                rows={3}
                className="pm-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Speak or type your line…"
              />
              <div className="pm-row pm-checkRow" style={{ marginTop: 6 }}>
                <button className="pm-btn" onClick={onCheck}>
                  Check
                </button>
                <span className="pm-pill">{lastResultText}</span>
              </div>
            </div>

            {awaitingAdvance && (
              <div className="pm-row pm-awaitRow" style={{ marginTop: 8 }}>
                <span className="pm-pill">Response captured. Proceed when ready.</span>
                <button
                  className="pm-btn primary"
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
          </section>

          {/* RIGHT */}
          <section className="pm-panel">
            {!isMobile && progressSummary}

            {!isMobile && (
              <div style={{ marginTop: 10 }}>
                <div className="pm-label">Session Log</div>
                <div className="pm-log">{logText}</div>
              </div>
            )}

            <div className="pm-row pm-exportRow" style={{ marginTop: 10 }}>
              <button className="pm-btn ghost" onClick={exportSession}>
                Export CSV
              </button>
              <button className="pm-btn ghost" onClick={() => toast("Saved settings", "success")}>
                Save Settings
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pm-footer">
          <div>V2 • For training purposes only • OMA Station • 2025 • Microphone works only in Safari on iOS</div>
          <div className="pm-pill">Tip: Use headphones to avoid feedback.</div>
        </div>
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