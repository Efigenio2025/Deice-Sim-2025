// pages/train.js
import { useEffect, useMemo, useRef, useState } from "react";
import {
  unlockAudio,
  playCaptainCue,
  preloadCaptainCues,
  onAudio,
  stopAudio,
} from "../lib/audio";

function Stepper({ total, current, results = [], onJump }) {
  return (
    <div className="pm-stepper">
      {Array.from({ length: total }).map((_, i) => {
        const r = results[i];
        const cls =
          i === current
            ? "pm-step cur"
            : r === true
            ? "pm-step ok"
            : r === false
            ? "pm-step miss"
            : "pm-step";
        return (
          <button
            key={i}
            type="button"
            className={cls}
            onClick={() => onJump?.(i)}
            aria-label={`Step ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

function ScoreRing({ pct = 0, size = 72 }) {
  const r = (size - 8) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
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
        {pct}%
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

function MicWidget({ status = "idle", level = 0 }) {
  return (
    <div className="pm-mic">
      <span className="pm-pill">Mic: {status}</span>
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

function useResponsiveMode(forced = null) {
  const pick = () => (window.innerWidth <= 860 ? "mobile" : "desktop");
  const [mode, setMode] = useState(
    typeof window === "undefined" ? "desktop" : forced || pick()
  );
  useEffect(() => {
    if (forced) {
      setMode(forced);
      return;
    }
    const onResize = () => setMode(pick());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [forced]);
  return mode;
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

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
function quickScore(expected, heard) {
  const A = new Set(normalize(expected).split(" "));
  const B = new Set(normalize(heard).split(" "));
  const inter = [...A].filter((x) => B.has(x)).length;
  return A.size ? Math.round((inter / A.size) * 100) : 0;
}

export default function TrainPage() {
  const [scenarioList, setScenarioList] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const steps = useMemo(() => current?.steps || [], [current]);
  const total = steps.length;
  const resultsRef = useRef([]);

  const [status, setStatus] = useState("Ready");
  const [answer, setAnswer] = useState("");
  const [lastResultText, setLastResultText] = useState("—");
  const [retryCount, setRetryCount] = useState(0);
  const [avgRespSec, setAvgRespSec] = useState(null);
  const [logText, setLogText] = useState("");

  const [forcedMode, setForcedMode] = useState(null);
  const mode = useResponsiveMode(forcedMode);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const preparedRef = useRef(false);

  const micLevelRef = useRef(0);
  const [captainStatus, setCaptainStatus] = useState("idle");

  const correct = (resultsRef.current || []).filter(Boolean).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const micStatus = preparedRef.current ? (runningRef.current && !pausedRef.current ? "listening" : "ready") : "idle";
  const micLevel = micLevelRef.current || 0;

  const log = (msg) => setLogText((t) => (t ? t + "\n" : "") + msg);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/scenarios/index.json");
        const list = await res.json();
        if (!live) return;
        setScenarioList(list || []);
        if (list && list[0]) {
          const res2 = await fetch(`/scenarios/${list[0].id}.json`);
          const data = await res2.json();
          if (!live) return;
          setCurrent(data);
          resultsRef.current = Array(data.steps.length).fill(undefined);
          setStatus("Scenario loaded");
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

  useEffect(() => {
    const off = onAudio("status", (e) => setCaptainStatus(e.detail?.status || "idle"));
    return () => off && off();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      micLevelRef.current = runningRef.current && !pausedRef.current ? 10 + Math.round(Math.random() * 80) : 0;
    }, 500);
    return () => clearInterval(id);
  }, []);

  function preloadCaptainForScenario(scn) {
    const scnId = scn?.id;
    if (!scnId) return;
    const cues = Array.from(new Set((scn.steps || []).filter((s) => s.role === "Captain" && s.cue).map((s) => s.cue)));
    preloadCaptainCues(scnId, cues);
  }

  const startingRef = useRef(false);
  const startTokenRef = useRef(0);
  const pendingTimerRef = useRef(null);
  const loopIdRef = useRef(null);

  function cancelAllTimersAndLoops() {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (loopIdRef.current != null) {
      cancelAnimationFrame(loopIdRef.current);
      loopIdRef.current = null;
    }
  }
  function bumpStartToken() {
    startTokenRef.current++;
  }

  const tryPlayCue = (cueId) => {
    if (!runningRef.current || pausedRef.current) return;
    if (current?.id && cueId) void playCaptainCue(current.id, cueId);
  };

  async function onStart() {
    if (startingRef.current || runningRef.current) {
      log("Start ignored (already starting/running).");
      return;
    }

    startingRef.current = true;
    const token = ++startTokenRef.current;
    try {
      if (!preparedRef.current) {
        await unlockAudio();
        if (token !== startTokenRef.current) return log("Start aborted (token mismatch).");
        preparedRef.current = true;
        log("Mic auto-prepared by Start.");
      }

      pausedRef.current = false;
      runningRef.current = true;
      setStatus(preparedRef.current ? "Running…" : "Running (no mic)");
      log("Simulation started.");

      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }

      const safePlay = () => {
        if (!runningRef.current || token !== startTokenRef.current) return;
        const idx = stepIndex < 0 ? 0 : stepIndex;
        const s = steps[idx];
        if (s?.role === "Captain" && s.cue && current?.id) {
          void playCaptainCue(current.id, s.cue);
        }
      };

      if (stepIndex < 0 && steps.length) {
        setStepIndex(0);
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          safePlay();
        }, 30);
      } else {
        safePlay();
      }

      runSimulator();
    } catch (e) {
      console.error("Start failed:", e);
      setStatus("Start failed");
      toast(`Start failed: ${e?.message ?? "unknown error"}`, "error");
    } finally {
      startingRef.current = false;
    }
  }

  function onPause() {
    try {
      pausedRef.current = true;
      runningRef.current = false;
      bumpStartToken();
      cancelAllTimersAndLoops();
      stopAudio();
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

  function runSimulator() {
    if (!current || !steps.length) {
      setStatus("Select a scenario first.");
      return;
    }
    if (stepIndex < 0) {
      setStepIndex(0);
    }

    const startedAt = performance.now();
    setStatus("Running…");

    const tick = () => {
      if (!runningRef.current || pausedRef.current) {
        loopIdRef.current = null;
        return;
      }

      const judged = resultsRef.current[stepIndex];
      if (judged && stepIndex < steps.length - 1) {
        const next = stepIndex + 1;
        setStepIndex(next);
        const s = steps[next];
        if (s?.role === "Captain" && s.cue && current?.id) {
          void playCaptainCue(current.id, s.cue);
        }
      }

      const dur = (performance.now() - startedAt) / 1000;
      setAvgRespSec((prev) => (prev ? (prev + dur) / 2 : dur));

      const allJudged = resultsRef.current.length === steps.length && resultsRef.current.every((v) => v === true || v === false);

      if (!allJudged) {
        loopIdRef.current = requestAnimationFrame(tick);
      } else {
        runningRef.current = false;
        loopIdRef.current = null;
        const finalPct = steps.length ? Math.round((resultsRef.current.filter(Boolean).length / steps.length) * 100) : 0;
        setStatus(`Complete • ${resultsRef.current.filter(Boolean).length}/${steps.length} (${finalPct}%) • ${finalPct >= 80 ? "PASS" : "RETRY"}`);
        toast("Session complete", finalPct >= 80 ? "success" : "info");
      }
    };

    loopIdRef.current = requestAnimationFrame(tick);
  }

  const correctCount = (resultsRef.current || []).filter(Boolean).length;

  return (
    <div className="pm-app">
      <div className="pm-card">
        <div className="pm-header">
          <div className="pm-title">
            <img src="/images/piedmont-logo.jpg" alt="Piedmont Airlines" />
            <h1>Deice Verbiage Trainer</h1>
            <span className="pm-badge">V1 • OMA • Training use only</span>
          </div>
          <div className="pm-row">
            <div className="pm-row">
              <span className="pm-label">Scenario</span>
              <select
                className="pm-select"
                value={current?.id || ""}
                onChange={async (e) => {
                  const id = e.target.value;
                  const res = await fetch(`/scenarios/${id}.json`);
                  const scn = await res.json();
                  setCurrent(scn);
                  resultsRef.current = Array(scn.steps.length).fill(undefined);
                  setStepIndex(-1);
                  setStatus("Scenario loaded");
                  log(`Scenario loaded: ${scn.label}`);
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

            <div className
