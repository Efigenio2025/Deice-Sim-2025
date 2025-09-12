// pages/train.js
import { useEffect, useMemo, useRef, useState } from "react";
import useResponsiveMode from "../lib/useResponsiveMode";

export default function TrainPage() {
  // --- BODY CLASS FOR BRIGHTER BACKGROUND ---
  useEffect(() => {
    document.body.classList.add("deice-bg");
    return () => document.body.classList.remove("deice-bg");
  }, []);

  // --- EXISTING SIM REFS (keep yours; these are common names) ---
  const runningRef  = useRef(false);
  const pausedRef   = useRef(false);
  const preparedRef = useRef(false);
  const recRef      = useRef(null);
  const audioRef    = useRef(null);

  // Provided by your app (adjust if different)
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent]     = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [status, setStatus]       = useState("Ready");
  const resultsRef = useRef([]);      // if you have this already, keep your copy
  const [results, setResults] = useState([]); // fallback mirror for UI

  // --- LAYOUT MODE ---
  const autoMode = useResponsiveMode();
  const [forcedMode, setForcedMode] = useState(null); // 'desktop' | 'mobile' | null
  const mode = forcedMode ?? autoMode;

  // --- MIC LEVEL (simple analyser on prepare) ---
  const [micLevel, setMicLevel] = useState(0);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  function startMicMeter(stream) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const lvl = Math.min(100, Math.round((Array.from(data).reduce((a,b)=>a+b,0)/data.length)/2));
        setMicLevel(lvl);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }

  // --- LOAD SCENARIOS (uses your public/scenarios.json) ---
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/scenarios.json");
        const list = await res.json();
        setScenarios(list || []);
        const first = (list && list[0]) || null;
        if (first) {
          setCurrent(first);
          setStepIndex(-1);
          resultsRef.current = new Array(first.steps.length).fill(undefined);
          setResults(resultsRef.current.slice());
          setStatus(`Loaded scenario: ${first.label}`);
        }
      } catch {
        setStatus("Could not load scenarios.json");
      }
    })();
  }, []);

  const steps = useMemo(() => current?.steps || [], [current]);

  // --- CONTROLS: PREP / START / PAUSE ---
  async function onPrepareMic() {
    setStatus("Unlocking audio…");
    // if you have your own unlockAudio/ensureMicPermission, use those:
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      preparedRef.current = true;
      setStatus("Mic ready.");
      startMicMeter(stream);
    } catch {
      preparedRef.current = false;
      setStatus("Mic permission denied. Running without voice.");
    }
  }

  async function onStart() {
    pausedRef.current = false;
    runningRef.current = true;
    try { speechSynthesis.cancel(); } catch {}
    setStatus(preparedRef.current ? "Starting simulator…" : "Starting without mic…");

    // if you have your own runSimulator, call it:
    runSimulatorSafe();
    // also move to first line if not started
    if (stepIndex < 0 && steps.length) setStepIndex(0);
  }

  function onPause() {
    pausedRef.current = true;
    runningRef.current = false;
    try { recRef.current?.abort?.(); } catch {}
    try { audioRef.current?.pause?.(); } catch {}
    setStatus("Paused");
  }

  // --- NAV ---
  function onPrev() {
    if (!current) return;
    setStepIndex(i => Math.max(0, i - 1));
  }
  function onNext() {
    if (!current) return;
    setStepIndex(i => Math.min(steps.length - 1, i + 1));
  }

  // --- CHECK RESPONSE (demo/fallback) ---
  function checkResponse(heard) {
    const expected = steps[stepIndex]?.text || "";
    const score = jaccard(heard || "", expected);
    const ok = score >= 0.6;
    // write into results
    writeResult(stepIndex, ok);
    setStatus(ok ? `Good (${Math.round(score*100)}%)` : `Try again (${Math.round(score*100)}%)`);
  }

  function writeResult(idx, ok) {
    if (idx < 0) return;
    if (Array.isArray(resultsRef.current)) {
      resultsRef.current[idx] = ok;
      setResults(resultsRef.current.slice());
    } else {
      const copy = results.slice(); copy[idx] = ok; setResults(copy);
    }
  }

  // --- SCORE RING ---
  const scorePct = useMemo(() => {
    const arr = (Array.isArray(resultsRef.current) ? resultsRef.current : results) || [];
    const tot = arr.filter(v => v !== undefined).length;
    const ok = arr.filter(Boolean).length;
    return tot ? Math.round((ok / tot) * 100) : 0;
  }, [results]);

  // --- SIMPLE SIM LOOP SAFETY (no-op if you have your own) ---
  function runSimulatorSafe() {
    if (typeof window.__HAS_SIM__ !== "undefined") return; // avoid duplicate demo loops
    window.__HAS_SIM__ = true;
    // If you already have runSimulator() defined elsewhere, call it instead and delete this.
    // This demo loop just toggles status text while running flags are true.
    (function loop(){
      if (!runningRef.current || pausedRef.current) return;
      setTimeout(loop, 500);
    })();
  }

  // --- HELPERS ---
  function jaccard(a, b) {
    const A = new Set(String(a).toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(Boolean));
    const B = new Set(String(b).toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(Boolean));
    const inter = [...A].filter(x => B.has(x)).length;
    const union = new Set([...A, ...B]).size || 1;
    return inter / union;
  }

  // --- UI PIECES ---
  function Stepper({ total, currentIndex, results = [], onJump }) {
    return (
      <div className="stepper">
        {Array.from({ length: total }).map((_, i) => {
          const r = results[i]; // true/false/undefined
          const cls = i === currentIndex ? "cur" : r === true ? "ok" : r === false ? "miss" : "";
          return (
            <button key={i} className={`step ${cls}`} onClick={() => onJump?.(i)} aria-label={`Step ${i+1}`} />
          );
        })}
      </div>
    );
  }

  function ScoreRing({ pct = 0, size = 72 }) {
    const r = (size - 8) / 2, c = size / 2, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100);
    return (
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} stroke="#223b66" strokeWidth="8" fill="none"/>
        <circle cx={c} cy={c} r={r} stroke="var(--accent)" strokeWidth="8" fill="none"
                strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"/>
        <text x="50%" y="54%" textAnchor="middle" fontSize="14" fill="var(--ink)">{pct}%</text>
      </svg>
    );
  }

  function MicWidget({ status="idle", level=0 }) {
    return (
      <div className="mic">
        <span className="pill">Mic: {status}</span>
        <div className="meter"><div className="fill" style={{ width: `${Math.min(100, level)}%` }} /></div>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="deice-card">
      <div className="deice-header">
        <h1 className="deice-title">
          <img src="/branding/piedmont-logo.svg" alt="Piedmont" />
          Deice Verbiage Trainer
        </h1>
        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row">
            <label className="label" htmlFor="scenario">Scenario</label>
            <select
              id="scenario" className="select"
              value={current?.id || ""}
              onChange={(e) => {
                const scn = scenarios.find(s => (s.id || s.label) === e.target.value);
                if (scn) {
                  setCurrent(scn);
                  setStepIndex(-1);
                  resultsRef.current = new Array(scn.steps.length).fill(undefined);
                  setResults(resultsRef.current.slice());
                  setStatus(`Loaded scenario: ${scn.label || scn.id}`);
                }
              }}
            >
              {(scenarios || []).map(s => (
                <option key={s.id || s.label} value={s.id || s.label}>{s.label || s.id}</option>
              ))}
            </select>
          </div>

          <div className="row">
            <label className="label">View</label>
            <button className="btn ghost" onClick={() => setForcedMode(null)}>Auto</button>
            <button className="btn ghost" onClick={() => setForcedMode("desktop")}>Desktop</button>
            <button className="btn ghost" onClick={() => setForcedMode("mobile")}>Mobile</button>
          </div>

          <span className="pill">{status}</span>
        </div>
      </div>

      <div className={`deice-main ${mode}`}>
        {/* LEFT: Script + Controls */}
        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <button className="btn ghost" onClick={onPrepareMic}>Prepare Mic</button>
              <button className="btn" onClick={onStart}>Start</button>
              <button className="btn ghost" onClick={onPause}>Pause</button>
            </div>
            <MicWidget status={preparedRef.current ? (runningRef.current && !pausedRef.current ? "listening" : "ready") : "idle"} level={micLevel}/>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="label">Current Line</div>
            <div className="coach">
              {stepIndex < 0 ? "Press Start to begin the scenario." : (
                <>
                  <strong>{steps[stepIndex]?.role}:</strong> {steps[stepIndex]?.text}
                </>
              )}
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={onPrev} disabled={stepIndex <= 0}>⟵ Prev</button>
            <button className="btn primary" onClick={onNext} disabled={stepIndex >= steps.length - 1 || stepIndex < 0}>Next ⟶</button>
            <button className="btn" onClick={() => {/* hook your TTS here */}}>▶︎ Play line</button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="label">Your Response</div>
            <textarea rows={3} className="input" placeholder="Speak or type your line…" id="resp"></textarea>
            <div className="row" style={{ marginTop: 6 }}>
              <button
                className="btn"
                onClick={() => {
                  const val = document.getElementById("resp").value;
                  checkResponse(val);
                }}
                disabled={stepIndex < 0}
              >
                Check
              </button>
              <span className="pill">{scorePct ? `Session: ${scorePct}%` : "—"}</span>
            </div>
          </div>

          {/* Example diff placeholder; wire to your checker output if you want */}
          {stepIndex >= 0 && (
            <div className="diff">
              {/* simple expected vs heard visualization goes here */}
              <span className="w-ok">Iceman,</span>{" "}
              <span className="w-miss">this</span>{" "}
              <span className="w-ok">is</span>{" "}
              <span className="w-ok">N443DF,</span>{" "}
              <span className="w-miss">do</span>{" "}
              <span className="w-ok">you copy?</span>
            </div>
          )}
        </section>

        {/* RIGHT: Progress + KPIs + Log */}
        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="label">Progress</div>
              <Stepper
                total={steps.length}
                currentIndex={Math.max(0, stepIndex)}
                results={Array.isArray(resultsRef.current) ? resultsRef.current : results}
                onJump={(i) => setStepIndex(i)}
              />
            </div>
            <div className="scoreRow">
              <ScoreRing pct={scorePct} />
              <div>
                <div className="pill">WPM: <strong>—</strong></div>
                <div className="pill">Avg. Response: <strong>—</strong></div>
                <div className="pill">Retries: <strong>—</strong></div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="label">Session Log</div>
            <div className="log" id="log">{
`[Step 1]
Expected: Iceman, this is N443DF, do you copy?
Heard:    Iceman, this is N443DF, can you copy?
Score:    82%`
            }</div>
          </div>

          <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={exportSession}>Export CSV</button>
            <button className="btn ghost" onClick={() => alert("Settings saved")}>Save Settings</button>
          </div>
        </section>
      </div>

      <div className="deice-footer">
        <div>V1 • training purposes only • OMA station • Mic works in Safari on iOS</div>
        <div className="pill">Tip: Use headphones to avoid feedback</div>
      </div>
    </div>
  );

  // --- CSV EXPORT ---
  function exportSession() {
    if (!current) return;
    const arr = (Array.isArray(resultsRef.current) ? resultsRef.current : results) || [];
    const rows = [
      ["Scenario", current.label || current.id || ""],
      [],
      ["Step", "Role", "Expected", "Result"],
      ...steps.map((s, i) => [i + 1, s.role, s.text, arr[i] ? "OK" : (arr[i] === false ? "MISS" : "")])
    ];
    downloadCSV(rows, `deice_${(current.id || "scenario")}.csv`);
  }

  function downloadCSV(rows, filename='deice-results.csv') {
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
