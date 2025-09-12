// pages/train.js
import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- local responsive hook ---------- */
function useResponsiveMode() {
  const [mode, setMode] = useState(
    typeof window !== "undefined" && window.innerWidth <= 860 ? "mobile" : "desktop"
  );
  useEffect(() => {
    const h = () => setMode(window.innerWidth <= 860 ? "mobile" : "desktop");
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mode;
}

/* ---------- fallback scenario (used if /scenarios.json is missing) ---------- */
const FALLBACK = [
  {
    id: "type1",
    label: "Type I Only (Demo)",
    steps: [
      { role: "Captain", text: "Iceman, this is N443DF, do you copy?" },
      { role: "Iceman", text: "N443DF, this is Iceman, go ahead." },
      { role: "Captain", text: "Requesting full body Type I deicing today." },
      { role: "Iceman", text: "Copy full body Type I. Prepare the aircraft for deicing." }
    ]
  }
];

/* ---------- similarity helper ---------- */
function jaccard(a, b) {
  const A = new Set(String(a).toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
  const B = new Set(String(b).toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}

/* ---------- small UI pieces ---------- */
function Stepper({ total, currentIndex, results = [], onJump }) {
  return (
    <div className="stepper">
      {Array.from({ length: total }).map((_, i) => {
        const r = results[i];
        const cls = i === currentIndex ? "cur" : r === true ? "ok" : r === false ? "miss" : "";
        return (
          <button
            key={i}
            className={`step ${cls}`}
            onClick={() => onJump?.(i)}
            aria-label={`Step ${i + 1}`}
            title={`Step ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

function ScoreRing({ pct = 0, size = 72 }) {
  const r = (size - 8) / 2,
    c = size / 2,
    circ = 2 * Math.PI * r,
    off = circ * (1 - pct / 100);
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} stroke="#223b66" strokeWidth="8" fill="none" />
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke="var(--accent)"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={off}
        strokeLinecap="round"
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize="14" fill="var(--ink)">
        {pct}%
      </text>
    </svg>
  );
}

function MicWidget({ status = "idle", level = 0 }) {
  return (
    <div className="mic">
      <span className="pill">Mic: {status}</span>
      <div className="meter">
        <div className="fill" style={{ width: `${Math.min(100, Math.max(0, level))}%` }} />
      </div>
    </div>
  );
}

/* ============================== PAGE ============================== */
export default function TrainPage() {
  // background
  useEffect(() => {
    document.body.classList.add("deice-bg");
    return () => document.body.classList.remove("deice-bg");
  }, []);

  // sim flags/refs
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const preparedRef = useRef(false);
  const recRef = useRef(null);
  const audioRef = useRef(null);

  const [status, setStatus] = useState("Ready");
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);

  const resultsRef = useRef([]); // true/false/undefined
  const [results, setResults] = useState([]); // mirrors ref for UI

  // responsive
  const autoMode = useResponsiveMode();
  const [forcedMode, setForcedMode] = useState(null);
  const mode = forcedMode ?? autoMode;

  // mic meter
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
        const lvl = Math.min(100, Math.round(data.reduce((a, b) => a + b, 0) / data.length / 2));
        setMicLevel(lvl);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore
    }
  }

  // load scenarios with fallback
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/scenarios.json");
        if (!res.ok) throw new Error("no file");
        const list = await res.json();
        if (cancelled) return;
        initScenarioList(list);
      } catch {
        if (!cancelled) initScenarioList(FALLBACK);
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function initScenarioList(list) {
    setScenarios(list || []);
    const first = (list && list[0]) || null;
    if (first) {
      setCurrent(first);
      setStepIndex(-1);
      resultsRef.current = new Array(first.steps.length).fill(undefined);
      setResults(resultsRef.current.slice());
      setStatus(`Loaded scenario: ${first.label || first.id}`);
    }
  }

  const steps = useMemo(() => current?.steps || [], [current]);

  // controls
  async function onPrepareMic() {
    setStatus("Unlocking audio…");
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
    try {
      speechSynthesis.cancel();
    } catch {}
    setStatus(preparedRef.current ? "Starting simulator…" : "Starting without mic…");
    // move to first step if needed
    if (stepIndex < 0 && steps.length) setStepIndex(0);
    runSimulatorSafe();
  }

  function onPause() {
    pausedRef.current = true;
    runningRef.current = false;
    try {
      recRef.current?.abort?.();
    } catch {}
    try {
      audioRef.current?.pause?.();
    } catch {}
    setStatus("Paused");
  }

  // nav
  function onPrev() {
    if (!current) return;
    setStepIndex((i) => Math.max(0, i - 1));
  }
  function onNext() {
    if (!current) return;
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  // check response (demo scoring)
  function checkResponse(heard) {
    if (stepIndex < 0) return;
    const expected = steps[stepIndex]?.text || "";
    const score = jaccard(heard || "", expected);
    const ok = score >= 0.6;
    writeResult(stepIndex, ok);
    setStatus(ok ? `Good (${Math.round(score * 100)}%)` : `Try again (${Math.round(score * 100)}%)`);
  }

  function writeResult(idx, ok) {
    if (idx < 0) return;
    resultsRef.current[idx] = ok;
    setResults(resultsRef.current.slice());
  }

  // score ring
  const scorePct = useMemo(() => {
    const arr = resultsRef.current || [];
    const tot = arr.filter((v) => v !== undefined).length;
    const oks = arr.filter(Boolean).length;
    return tot ? Math.round((oks / tot) * 100) : 0;
  }, [results]);

  // placeholder sim loop (replace with your real runSimulator if you have it)
  function runSimulatorSafe() {
    if (typeof window.__DEICE_DEMO_LOOP__ !== "undefined") return;
    window.__DEICE_DEMO_LOOP__ = true;
    (function loop() {
      if (!runningRef.current || pausedRef.current) return;
      // no-op; your real loop would do step logic here
      setTimeout(loop, 400);
    })();
  }

  // render
  return (
    <>
      <div className="deice-card">
        <div className="deice-header">
          <h1 className="deice-title">
            <img src="/branding/piedmont-logo.jpg" alt="Piedmont" />
            Deice Verbiage Trainer
          </h1>
          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="row">
              <label className="label" htmlFor="scenario">
                Scenario
              </label>
              <select
                id="scenario"
                className="select"
                value={current?.id || current?.label || ""}
                onChange={(e) => {
                  const key = e.target.value;
                  const scn =
                    scenarios.find((s) => s.id === key) ||
                    scenarios.find((s) => s.label === key);
                  if (scn) {
                    setCurrent(scn);
                    setStepIndex(-1);
                    resultsRef.current = new Array(scn.steps.length).fill(undefined);
                    setResults(resultsRef.current.slice());
                    setStatus(`Loaded scenario: ${scn.label || scn.id}`);
                  }
                }}
              >
                {(scenarios || []).map((s) => (
                  <option key={s.id || s.label} value={s.id || s.label}>
                    {s.label || s.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="row">
              <label className="label">View</label>
              <button className="btn ghost" onClick={() => setForcedMode(null)}>
                Auto
              </button>
              <button className="btn ghost" onClick={() => setForcedMode("desktop")}>
                Desktop
              </button>
              <button className="btn ghost" onClick={() => setForcedMode("mobile")}>
                Mobile
              </button>
            </div>

            <span className="pill">{status}</span>
          </div>
        </div>

        <div className={`deice-main ${mode}`}>
          {/* LEFT */}
          <section className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row">
                <button className="btn ghost" onClick={onPrepareMic}>
                  Prepare Mic
                </button>
                <button className="btn" onClick={onStart}>
                  Start
                </button>
                <button className="btn ghost" onClick={onPause}>
                  Pause
                </button>
              </div>
              <MicWidget
                status={
                  preparedRef.current
                    ? runningRef.current && !pausedRef.current
                      ? "listening"
                      : "ready"
                    : "idle"
                }
                level={micLevel}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="label">Current Line</div>
              <div className="coach">
                {stepIndex < 0 ? (
                  "Press Start to begin the scenario."
                ) : (
                  <>
                    <strong>{steps[stepIndex]?.role}:</strong> {steps[stepIndex]?.text}
                  </>
                )}
              </div>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={onPrev} disabled={stepIndex <= 0}>
                ⟵ Prev
              </button>
              <button
                className="btn primary"
                onClick={onNext}
                disabled={stepIndex >= steps.length - 1 || stepIndex < 0}
              >
                Next ⟶
              </button>
              <button className="btn" onClick={() => {/* hook your TTS here */}}>▶︎ Play line</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="label">Your Response</div>
              <textarea rows={3} className="input" placeholder="Speak or type your line…" id="resp" />
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

            {stepIndex >= 0 && (
              <div className="diff">
                {/* simple example; replace with real diff if you have one */}
                <span className="w-ok">Iceman,</span> <span className="w-miss">this</span>{" "}
                <span className="w-ok">is</span> <span className="w-ok">N443DF,</span>{" "}
                <span className="w-miss">do</span> <span className="w-ok">you copy?</span>
              </div>
            )}
          </section>

          {/* RIGHT */}
          <section className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="label">Progress</div>
                <Stepper
                  total={steps.length}
                  currentIndex={Math.max(0, stepIndex)}
                  results={resultsRef.current}
                  onJump={(i) => setStepIndex(i)}
                />
              </div>
              <div className="scoreRow">
                <ScoreRing pct={scorePct} />
                <div>
                  <div className="pill">
                    WPM: <strong>—</strong>
                  </div>
                  <div className="pill">
                    Avg. Response: <strong>—</strong>
                  </div>
                  <div className="pill">
                    Retries: <strong>—</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="label">Session Log</div>
              <div className="log" id="log">
{`[Step 1]
Expected: Iceman, this is N443DF, do you copy?
Heard:    Iceman, this is N443DF, can you copy?
Score:    82%`}
              </div>
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

      {/* ---------- global CSS (styled-jsx) ---------- */}
      <style jsx global>{`
        :root{
          --bg-hi:#0f1f4a; --bg-mid:#1c3f8a; --bg-low:#0a1330;
          --card:#10192b; --ink:#eef4ff; --muted:#b9c6e6;
          --accent:#3da0ff; --accent-2:#e11d2e; --border:#2a3b66;
          --chip:#152443; --ok:#22c55e; --warn:#f59e0b; --err:#ef4444;
        }
        body.deice-bg{
          background:
            linear-gradient(180deg, rgba(15,31,74,.85), rgba(10,19,48,.9)),
            url('/branding/deice-hero.jpg') center -80px / cover no-repeat fixed;
          color:var(--ink);
        }
        .deice-card{background:rgba(16,25,43,.92);border:1px solid var(--border);border-radius:16px;box-shadow:0 16px 50px rgba(0,0,0,.45);max-width:1100px;margin:24px auto;padding:0 16px}
        .deice-header{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border)}
        .deice-title{display:flex;align-items:center;gap:10px;margin:0;font:700 18px/1.2 system-ui}
        .deice-title img{height:22px}
        .deice-main{display:grid;gap:16px;padding:16px 0}
        .deice-main.desktop{grid-template-columns:1.3fr .9fr}
        .deice-main.mobile{grid-template-columns:1fr}
        .panel{background:#0f1a33;border:1px solid var(--border);border-radius:12px;padding:12px}
        .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .btn{cursor:pointer;border:1px solid var(--border);background:#0e1a34;color:var(--ink);border-radius:12px;padding:10px 14px;font-weight:650;min-height:40px}
        .btn.primary{background:linear-gradient(180deg,#3aa4ff,#2b79d8);border-color:#2a6acc}
        .btn.ghost{background:transparent}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .select,.input,textarea{width:100%;background:#0b162f;color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px}
        .label{color:var(--muted);font-size:12px}
        .pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--chip);color:var(--muted);font-size:12px}
        .coach{font-size:15px;background:#0e1f43;border-left:3px solid var(--accent);padding:12px;border-radius:8px}
        .log{height:160px;overflow:auto;background:#07122a;border:1px dashed var(--border);border-radius:8px;padding:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap}
        .stepper{display:flex;gap:6px;flex-wrap:wrap}
        .step{width:14px;height:14px;border-radius:6px;border:1px solid var(--border);background:#1a2a50}
        .step.cur{outline:2px solid var(--accent)}
        .step.ok{background:var(--ok)}
        .step.miss{background:var(--err)}
        .scoreRow{display:flex;align-items:center;gap:12px}
        .ring{width:72px;height:72px}
        .diff{padding:8px;border-radius:8px;background:#0e1f43;margin:8px 0}
        .w-ok{color:#a8f0c9}
        .w-miss{color:#ffd1d1;text-decoration:underline dotted}
        .mic{display:flex;align-items:center;gap:8px}
        .meter{flex:1;height:8px;background:#0b162f;border:1px solid var(--border);border-radius:999px;overflow:hidden}
        .fill{height:100%;background:var(--ok)}
        .deice-footer{padding:12px 0;border-top:1px solid var(--border);display:flex;justify-content:space-between;color:var(--muted);font-size:12px;margin-top:8px}
        @media (max-width:860px){.deice-main{padding:12px 0}.log{height:140px}}
        @media (max-width:480px){.log{height:120px}}
      `}</style>
    </>
  );

  // export CSV
  function exportSession() {
    if (!current) return;
    const arr = resultsRef.current || [];
    const rows = [
      ["Scenario", current.label || current.id || ""],
      [],
      ["Step", "Role", "Expected", "Result"],
      ...steps.map((s, i) => [i + 1, s.role, s.text, arr[i] ? "OK" : arr[i] === false ? "MISS" : ""])
    ];
    downloadCSV(rows, `deice_${current.id || "scenario"}.csv`);
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
}
