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
          i === current ? "pm-step cur" : r === true ? "pm-step ok" : r === false ? "pm-step miss" : "pm-step";
        return <button key={i} className={cls} onClick={() => onJump?.(i)} aria-label={`Step ${i + 1}`} />;
      })}
    </div>
  );
}
function ScoreRing({ pct = 0, size = 72 }) {
  const r = (size - 8) / 2, c = size / 2, circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
  return (
    <svg className="pm-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} stroke="#dfeaff" strokeWidth="8" fill="none" />
      <circle cx={c} cy={c} r={r} stroke="#0e63ff" strokeWidth="8" fill="none"
              strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
      <text x="50%" y="54%" textAnchor="middle" fontSize="14" fill="#0b1e39">{pct}%</text>
    </svg>
  );
}
function WordDiff({ expected = "", heard = "" }) {
  const A = expected.trim().split(/\s+/);
  const B = new Set(heard.trim().toLowerCase().split(/\s+/));
  return (
    <p className="pm-diff">
      {A.map((w, i) => <span key={i} className={B.has(w.toLowerCase()) ? "pm-wok" : "pm-wmiss"}>{w} </span>)}
    </p>
  );
}
function MicWidget({ status = "idle", level = 0 }) {
  return (
    <div className="pm-mic">
      <span className="pm-pill">Mic: {status}</span>
      <div className="pm-meter"><div className="pm-fill" style={{ width: `${Math.min(100, level)}%` }} /></div>
    </div>
  );
}
const _toasts = [];
function toast(msg, kind = "info", ms = 2200) {
  _toasts.push({ id: Date.now(), msg, kind }); renderToasts();
  setTimeout(() => { _toasts.shift(); renderToasts(); }, ms);
}
function renderToasts() {
  let host = document.getElementById("pm-toast-host");
  if (!host) { host = document.createElement("div"); host.id = "pm-toast-host"; host.className = "pm-toasts"; document.body.appendChild(host); }
  host.innerHTML = _toasts.map(t => `<div class="pm-toast ${t.kind}">${t.msg}</div>`).join("");
}
function useResponsiveMode(forced = null) {
  const pick = () => (window.innerWidth <= 860 ? "mobile" : "desktop");
  const [mode, setMode] = useState(typeof window === "undefined" ? "desktop" : forced || pick());
  useEffect(() => {
    if (forced) { setMode(forced); return; }
    const onResize = () => setMode(pick());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [forced]);
  return mode;
}
function downloadCSV(rows, filename = "deice-results.csv") {
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function TrainPage() {
  // scenario list + current
  const [scenarioList, setScenarioList] = useState([]);
  const [current, setCurrent] = useState(null);

  // steps / results
  const [stepIndex, setStepIndex] = useState(-1);
  const steps = useMemo(() => current?.steps || [], [current]);
  const total = steps.length;
  const resultsRef = useRef([]);

  // UI & control state
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

  const log = (msg) => setLogText(t => (t ? t + "\n" : "") + msg);

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
          setStatus("Scenario loaded");
          preloadCaptainForScenario(data);
        }
      } catch (e) {
        console.error("Load scenario list failed", e);
      }
    })();
    return () => { live = false; };
  }, []);

  // 2) subscribe to captain audio status
  useEffect(() => {
    const off = onAudio("status", (e) => setCaptainStatus(e.detail?.status || "idle"));
    return () => off && off();
  }, []);

  // mic level mock
  useEffect(() => {
    const id = setInterval(() => {
      micLevelRef.current = runningRef.current && !pausedRef.current ? 10 + Math.round(Math.random() * 80) : 0;
    }, 500);
    return () => clearInterval(id);
  }, []);

  function normalize(s){ return s.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim(); }
  function quickScore(expected, heard) {
    const A = new Set(normalize(expected).split(" "));
    const B = new Set(normalize(heard).split(" "));
    const inter = [...A].filter(x => B.has(x)).length;
    return A.size ? Math.round((inter / A.size) * 100) : 0;
  }

  function preloadCaptainForScenario(scn) {
    const scnId = scn?.id;
    if (!scnId) return;
    const cues = Array.from(new Set((scn.steps || []).filter(s => s.role === "Captain" && s.cue).map(s => s.cue)));
    preloadCaptainCues(scnId, cues);
  }

  // Prepare microphone and preload Captain audio
async function onPrepareMic() {
  setStatus("Preparing mic…");
  log("Prepare Mic clicked.");
  try {
    await unlockAudio();
    log("Audio unlocked via unlockAudio().");

    // Optional mic permission (keep if you plan to record speech)
    if (navigator.mediaDevices?.getUserMedia) {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      log("Mic permission granted by getUserMedia().");
    }

    const cues = (current?.steps || []).filter(s => s.role === "Captain" && s.cue).map(s => s.cue);
    if (cues.length) {
      preloadCaptainCues(current?.id || "default", cues);
      log(`Preloaded Captain cues: ${cues.join(", ")}`);
    }

    preparedRef.current = true;
    setStatus("Mic ready");
    toast("Mic ready", "success");
  } catch (err) {
    preparedRef.current = false;
    setStatus("Mic prepare failed");
    toast("Mic prepare failed", "error");
    log(`Prepare Mic ERROR: ${err?.message || err}`);
  }
}


// Outside the function (module scope or component scope)
const startingRef = { current: false };          // reentrancy guard
const startTokenRef = { current: 0 };            // race-cancel token
const pendingTimerRef = { current: null };       // track the s0 timeout

async function onStart() {
  // Reentrancy guard: ignore if we're already starting or running
  if (startingRef.current || runningRef.current) {
    log("Start ignored (already starting/running).");
    return;
  }

  startingRef.current = true;
  const token = ++startTokenRef.current; // capture token; later steps must match
  try {
    // 1) Mic prep fallback (but cancel if a Pause happens mid-await)
    if (!preparedRef.current) {
      log("Attempting mic auto-prepare via Start…");
      await unlockAudio(); // must be user-gesture initiated; Start button qualifies
      if (token !== startTokenRef.current) return log("Start aborted (token mismatch).");
      preparedRef.current = true;
      log("Mic auto-prepared by Start.");
    }

    // 2) Flip run flags atomically
    pausedRef.current = false;
    runningRef.current = true;
    setStatus(preparedRef.current ? "Running…" : "Running (no mic)");
    log("Simulation started.");

    // 3) Play captain cue for the current/first step (non-blocking),
    //    but avoid overlaps and stale timers.
    //    Clear any previous pending timer (e.g., from a prior Start attempt)
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    const safePlay = () => {
      // Bail if we were paused/stopped after scheduling
      if (!runningRef.current || token !== startTokenRef.current) return;

      const idx = stepIndex < 0 ? 0 : stepIndex;
      const s = steps[idx];
      if (s?.role === "Captain" && s.cue && current?.id) {
        // Fire-and-forget; internal function should self-throttle/queue
        void playCaptainCue(current.id, s.cue);
      }
    };

    if (stepIndex < 0 && steps.length) {
      setStepIndex(0);
      // Use rAF for next tick; if you prefer slight delay, keep setTimeout(30)
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        safePlay();
      }, 30);
    } else {
      safePlay();
    }

    // 4) Kick the main loop (make sure it can be stopped by Pause)
    //    If runSimulator is async, we intentionally do not await it here.
    runSimulator();
  } catch (e) {
    console.error("Start failed:", e);
    setStatus("Start failed");
    toast(`Start failed: ${e?.message ?? "unknown error"}`, "error");
  } finally {
    // If Pause happened during awaits, runningRef may already be false.
    startingRef.current = false;
  }
}



// Pause simulator and all audio cleanly
function onPause() {
  try {
    pausedRef.current = true;
    runningRef.current = false;
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
    if (!ok) setRetryCount(n => n + 1);
    log(`[Step ${stepIndex + 1}] Score ${p}% → ${ok ? "OK" : "MISS"}`);
  }

  function exportSession() {
    const rows = [
      ["Scenario", current?.label || ""],
      [],
      ["Step", "Role", "Expected", "Result"],
      ...steps.map((s, i) => [i + 1, s.role, s.text, resultsRef.current[i] ? "OK" : "MISS"])
    ];
    downloadCSV(rows, `deice_${current?.id || "scenario"}.csv`);
    toast("CSV downloaded", "success");
  }

 function runSimulator() {
  if (!current || !steps.length) { setStatus("Select a scenario first."); return; }
  if (stepIndex < 0) { setStepIndex(0); } // safety

  const startedAt = performance.now();
  setStatus("Running…");
  const tick = () => {
    if (!runningRef.current || pausedRef.current) return;

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
    setAvgRespSec(prev => (prev ? (prev + dur) / 2 : dur));

    const allJudged = resultsRef.current.length === steps.length &&
      resultsRef.current.every(v => v === true || v === false);

    if (!allJudged) requestAnimationFrame(tick);
    else {
      runningRef.current = false;
      const finalPct = steps.length ? Math.round((resultsRef.current.filter(Boolean).length / steps.length) * 100) : 0;
      setStatus(`Complete • ${resultsRef.current.filter(Boolean).length}/${steps.length} (${finalPct}%) • ${finalPct >= 80 ? "PASS" : "RETRY"}`);
      toast("Session complete", finalPct >= 80 ? "success" : "info");
    }
  };
  requestAnimationFrame(tick);
}


  return (
    <div className="pm-app">
      <div className="pm-card">
        {/* Header */}
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
                  setStatus("Scenario loaded"); log(`Scenario loaded: ${scn.label}`);
                  preloadCaptainForScenario(scn);
                }}
              >
                {(scenarioList || []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div className="pm-row" style={{ marginLeft: 8 }}>
              <span className="pm-label">View</span>
              <button className="pm-btn ghost" onClick={() => setForcedMode(null)}>Auto</button>
              <button className="pm-btn ghost" onClick={() => setForcedMode("desktop")}>Desktop</button>
              <button className="pm-btn ghost" onClick={() => setForcedMode("mobile")}>Mobile</button>
            </div>

            <span className="pm-pill" style={{ marginLeft: 8 }}>{status}</span>
            <span className="pm-pill" style={{ marginLeft: 8 }}>Captain: {captainStatus}</span>
          </div>
        </div>

        {/* Main */}
        <div className={`pm-main ${mode}`}>
          {/* LEFT */}
          <section className="pm-panel">
            <div className="pm-row" style={{ justifyContent: "space-between" }}>
              <div className="pm-row">
               <button type="button" className="pm-btn ghost" onClick={() => { console.log("CLICK Prepare"); onPrepareMic(); }}>
  Prepare Mic
</button>
<button type="button" className="pm-btn" onClick={() => { console.log("CLICK Start"); onStart(); }}>
  Start
</button>
<button type="button" className="pm-btn ghost" onClick={() => { console.log("CLICK Pause"); onPause(); }}>
  Pause
</button>



              </div>
              <MicWidget status={micStatus} level={micLevel} />
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Current Line</div>
              <div className="pm-coach">
                {stepIndex >= 0 && steps[stepIndex]
                  ? (<><strong>{steps[stepIndex].role}:</strong> {steps[stepIndex].text}</>)
                  : "Select a step and press Start."}
              </div>
            </div>

            <div className="pm-row" style={{ marginTop: 8 }}>
              <button className="pm-btn" onClick={() =>
                setStepIndex(i => {
                  const n = Math.max(0, (typeof i === "number" ? i : 0) - 1);
                  const s = steps[n]; if (s?.role === "Captain" && s.cue) playCaptainCue(current.id, s.cue);
                  return n;
                })}>⟵ Prev</button>
              <button className="pm-btn primary" onClick={() =>
                setStepIndex(i => {
                  const n = Math.min(total - 1, (typeof i === "number" ? i : -1) + 1);
                  const s = steps[n]; if (s?.role === "Captain" && s.cue) playCaptainCue(current.id, s.cue);
                  return n;
                })}>Next ⟶</button>
              <button className="pm-btn" onClick={() => {
                const s = steps[stepIndex]; if (s?.role === "Captain" && s.cue) playCaptainCue(current.id, s.cue);
              }}>▶︎ Play line</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Your Response</div>
              <textarea rows={3} className="pm-input" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Speak or type your line…" />
              <div className="pm-row" style={{ marginTop: 6 }}>
                <button className="pm-btn" onClick={onCheck}>Check</button>
                <span className="pm-pill">{lastResultText}</span>
              </div>
            </div>

            {stepIndex >= 0 && steps[stepIndex] && <WordDiff expected={steps[stepIndex].text} heard={answer} />}
          </section>

          {/* RIGHT */}
          <section className="pm-panel">
            <div className="pm-row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="pm-label">Progress</div>
                <Stepper total={total} current={Math.max(0, stepIndex)} results={resultsRef.current || []}
                         onJump={(i) => { setStepIndex(i); const s = steps[i]; if (s?.role === "Captain" && s.cue) playCaptainCue(current.id, s.cue); }} />
              </div>
              <div className="pm-scoreRow">
                <ScoreRing pct={pct} />
                <div>
                  <div className="pm-pill">Correct: <strong>{correct}/{total}</strong></div>
                  <div className="pm-pill">Retries: <strong>{retryCount || 0}</strong></div>
                  <div className="pm-pill">Avg. Response: <strong>{avgRespSec?.toFixed?.(1) ?? "—"}s</strong></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Session Log</div>
              <div className="pm-log">{logText}</div>
            </div>

            <div className="pm-row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
              <button className="pm-btn ghost" onClick={exportSession}>Export CSV</button>
              <button className="pm-btn ghost" onClick={() => toast("Saved settings","success")}>Save Settings</button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pm-footer">
          <div>V1 • for training purposes only • OMA station • Microphone works only in Safari on iOS</div>
          <div className="pm-pill">Tip: Use headphones to avoid feedback.</div>
        </div>
      </div>
    </div>
  );
}
