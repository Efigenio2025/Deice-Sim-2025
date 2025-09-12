// pages/train.js
import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------ Helpers: UI components ------------------------ */

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
  const r = (size - 8) / 2,
    c = size / 2,
    circ = 2 * Math.PI * r;
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

/* ------------------------ Toasts ------------------------ */

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
  host.innerHTML = _toasts
    .map((t) => `<div class="pm-toast ${t.kind}">${t.msg}</div>`)
    .join("");
}

/* ------------------------ Responsive hook ------------------------ */

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

/* ------------------------ CSV export ------------------------ */

function downloadCSV(rows, filename = "deice-results.csv") {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------ Page ------------------------ */

export default function TrainPage() {
  // scenarios
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);

  // step state
  const [stepIndex, setStepIndex] = useState(-1);
  const steps = useMemo(() => current?.steps || [], [current]);
  const total = steps.length;

  // results
  const resultsRef = useRef([]); // boolean per step
  const [lastResultText, setLastResultText] = useState("—");
  const [retryCount, setRetryCount] = useState(0);
  const [avgRespSec, setAvgRespSec] = useState(null);

  // controls/state
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const preparedRef = useRef(false);
  const recRef = useRef(null);
  const audioRef = useRef(null);
  const micLevelRef = useRef(0);

  // UI
  const [status, setStatus] = useState("Ready");
  const [answer, setAnswer] = useState("");
  const [forcedMode, setForcedMode] = useState(null);
  const mode = useResponsiveMode(forcedMode);

  // derived
  const correct = (resultsRef.current || []).filter(Boolean).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const micStatus = preparedRef.current
    ? runningRef.current && !pausedRef.current
      ? "listening"
      : "ready"
    : "idle";
  const micLevel = micLevelRef.current || 0;

  /* -------- Load scenarios from /public/scenarios.json -------- */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/scenarios.json");
        const data = await res.json();
        if (!live) return;
        setScenarios(data || []);
        const first = (data && data[0]) || null;
        if (first) {
          setCurrent(first);
          resultsRef.current = Array(first.steps.length).fill(undefined);
          setStatus("Scenario loaded");
        }
      } catch {
        // fallback demo
        const demo = [
          {
            id: "demo",
            label: "Full Body Type I Only",
            steps: [
              { role: "Captain", text: "Iceman, this is N443DF, do you copy?" },
              { role: "Iceman", text: "N443DF, this is Iceman, go ahead." },
              {
                role: "Captain",
                text: "Requesting full body Type I deicing today.",
              },
            ],
          },
        ];
        if (!live) return;
        setScenarios(demo);
        setCurrent(demo[0]);
        resultsRef.current = Array(demo[0].steps.length).fill(undefined);
        setStatus("Demo scenario loaded");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /* -------- Mic level mock (replace with real analyser if you have one) -------- */
  useEffect(() => {
    const id = setInterval(() => {
      if (runningRef.current && !pausedRef.current) {
        micLevelRef.current = 10 + Math.round(Math.random() * 80);
      } else {
        micLevelRef.current = 0;
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  /* --------------------------- Controls --------------------------- */

  async function unlockAudio() {
    // If you have a real audio unlock (e.g., creating AudioContext), call it here.
    return;
  }

  async function ensureMicPermission() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("no gUM");
    await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  async function onPrepareMic() {
    setStatus("Unlocking audio…");
    await unlockAudio();
    try {
      setStatus("Requesting microphone permission…");
      await ensureMicPermission();
      preparedRef.current = true;
      setStatus("Mic ready.");
      toast("Mic ready", "success");
    } catch {
      preparedRef.current = false;
      setStatus("Mic permission denied. Running without voice input.");
      toast("Mic blocked. Will run without voice.", "error");
    }
  }

  async function onStart() {
    pausedRef.current = false;
    runningRef.current = true;
    try {
      speechSynthesis.cancel();
    } catch {}
    setStatus(preparedRef.current ? "Starting simulator…" : "Starting without mic…");
    if (stepIndex < 0) setStepIndex(0);
    runSimulator();
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
    toast("Paused");
  }

  function speakLine(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      speechSynthesis.speak(u);
    } catch {}
  }

  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }
  function quickScore(expected, heard) {
    const A = new Set(normalize(expected).split(" "));
    const B = new Set(normalize(heard).split(" "));
    const inter = [...A].filter((x) => B.has(x)).length;
    const pct = A.size ? Math.round((inter / A.size) * 100) : 0;
    return pct;
  }

  function onCheck() {
    if (stepIndex < 0 || !steps[stepIndex]) return;
    const exp = steps[stepIndex].text;
    const pct = quickScore(exp, answer);
    const ok = pct >= 60;
    resultsRef.current[stepIndex] = ok;
    setLastResultText(ok ? `✅ Good (${pct}%)` : `❌ Try again (${pct}%)`);
    if (!ok) setRetryCount((n) => n + 1);
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

  /* --------------------------- Simulator loop (lightweight) --------------------------- */

  function runSimulator() {
    if (!current || !steps.length) {
      setStatus("Select a scenario first.");
      return;
    }
    const startedAt = performance.now();
    setStatus("Running…");

    // speak current line once on start
    const s = steps[Math.max(0, stepIndex)];
    if (s) speakLine(s.text);

    const tick = () => {
      if (!runningRef.current || pausedRef.current) return;

      // when user has checked, auto-advance to next step (demo logic)
      const done = resultsRef.current[stepIndex];
      if (done && stepIndex < steps.length - 1) {
        setStepIndex((i) => i + 1);
        const next = steps[stepIndex + 1];
        if (next) {
          setTimeout(() => speakLine(next.text), 120);
        }
      }

      // average response mock timing
      const dur = (performance.now() - startedAt) / 1000;
      setAvgRespSec((prev) => (prev ? (prev + dur) / 2 : dur));

      // finish condition
      const allJudged =
        resultsRef.current.length === steps.length &&
        resultsRef.current.every((v) => v === true || v === false);

      if (allJudged) {
        runningRef.current = false;
        setStatus(`Complete • ${correct}/${total} (${pct}%) • ${pct >= 80 ? "PASS" : "RETRY"}`);
        toast("Session complete", pct >= 80 ? "success" : "info");
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* --------------------------- Render --------------------------- */

  return (
    <div className="pm-app">
      <div className="pm-card">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-title">
            <img src="/images/piedmont-logo.png" alt="Piedmont Airlines" />
            <h1 className="pm-h1">Deice Verbiage Trainer</h1>
            <span className="pm-badge">V1 • OMA • Training use only</span>
          </div>
          <div className="pm-row">
            <div className="pm-row">
              <span className="pm-label">Scenario</span>
              <select
                className="pm-select"
                value={current?.id || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const scn = scenarios.find((s) => s.id === id);
                  if (scn) {
                    setCurrent(scn);
                    resultsRef.current = Array(scn.steps.length).fill(undefined);
                    setStepIndex(-1);
                    setStatus("Scenario loaded");
                  }
                }}
              >
                {(scenarios || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="pm-row" style={{ marginLeft: 8 }}>
              <span className="pm-label">View</span>
              <button className="pm-btn ghost" onClick={() => setForcedMode(null)}>
                Auto
              </button>
              <button className="pm-btn ghost" onClick={() => setForcedMode("desktop")}>
                Desktop
              </button>
              <button className="pm-btn ghost" onClick={() => setForcedMode("mobile")}>
                Mobile
              </button>
            </div>

            <span className="pm-pill" style={{ marginLeft: 8 }}>
              {status}
            </span>
          </div>
        </div>

        {/* Main */}
        <div className={`pm-main ${mode}`}>
          {/* LEFT */}
          <section className="pm-panel">
            <div className="pm-row" style={{ justifyContent: "space-between" }}>
              <div className="pm-row">
                <button className="pm-btn ghost" onClick={onPrepareMic}>
                  Prepare Mic
                </button>
                <button className="pm-btn" onClick={onStart}>
                  Start
                </button>
                <button className="pm-btn ghost" onClick={onPause}>
                  Pause
                </button>
              </div>
              <MicWidget status={micStatus} level={micLevel} />
            </div>

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

            <div className="pm-row" style={{ marginTop: 8 }}>
              <button
                className="pm-btn"
                onClick={() => setStepIndex((i) => Math.max(0, (typeof i === "number" ? i : 0) - 1))}
              >
                ⟵ Prev
              </button>
              <button
                className="pm-btn primary"
                onClick={() =>
                  setStepIndex((i) => Math.min(total - 1, (typeof i === "number" ? i : -1) + 1))
                }
              >
                Next ⟶
              </button>
              <button
                className="pm-btn"
                onClick={() => {
                  if (stepIndex >= 0 && steps[stepIndex]) speakLine(steps[stepIndex].text);
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
              <div className="pm-row" style={{ marginTop: 6 }}>
                <button className="pm-btn" onClick={onCheck}>
                  Check
                </button>
                <span className="pm-pill">{lastResultText}</span>
              </div>
            </div>

            {stepIndex >= 0 && steps[stepIndex] && (
              <WordDiff expected={steps[stepIndex].text} heard={answer} />
            )}
          </section>

          {/* RIGHT */}
          <section className="pm-panel">
            <div className="pm-row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="pm-label">Progress</div>
                <Stepper
                  total={total}
                  current={Math.max(0, stepIndex)}
                  results={resultsRef.current || []}
                  onJump={(i) => setStepIndex(i)}
                />
              </div>
              <div className="pm-scoreRow">
                <ScoreRing pct={pct} />
                <div>
                  <div className="pm-pill">
                    Correct: <strong>{correct}/{total}</strong>
                  </div>
                  <div className="pm-pill">
                    Retries: <strong>{retryCount || 0}</strong>
                  </div>
                  <div className="pm-pill">
                    Avg. Response: <strong>{avgRespSec?.toFixed?.(1) ?? "—"}s</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Session Log</div>
              <div className="pm-log" id="pm-log">
                {/* If you have a real log string, replace below */}
                {/* Example: {logText} */}
              </div>
            </div>

            <div className="pm-row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
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
          <div>V1 • for training purposes only • OMA station • Microphone works only in Safari on iOS</div>
          <div className="pm-pill">Tip: Use headphones to avoid feedback.</div>
        </div>
      </div>
    </div>
  );
}
