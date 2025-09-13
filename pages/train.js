// pages/train.js
import { useEffect, useMemo, useRef, useState } from "react";
import {
  unlockAudio,
  playCaptainCue,
  preloadCaptainCues,
  onAudio,
  stopAudio,
} from "../lib/audio";

/* ================= UI Bits ================= */

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

/* ================ Toasts (imperative) ================ */
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

/* ================ Responsive hook ================ */
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

/* ================ CSV export ================ */
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

/* ================ Page ================ */

export default function TrainPage() {
  // scenarios
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);

  // steps / results
  const [stepIndex, setStepIndex] = useState(-1);
  const steps = useMemo(() => current?.steps || [], [current]);
  const total = steps.length;
  const resultsRef = useRef([]); // boolean per step

  // UI state
  const [status, setStatus] = useState("Ready");
  const [answer, setAnswer] = useState("");
  const [lastResultText, setLastResultText] = useState("—");
  const [retryCount, setRetryCount] = useState(0);
  const [avgRespSec, setAvgRespSec] = useState(null);
  const [logText, setLogText] = useState("");

  // mode
  const [forcedMode, setForcedMode] = useState(null);
  const mode = useResponsiveMode(forcedMode);

  // run/mic flags
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const preparedRef = useRef(false);

  // mic visuals
  const micLevelRef = useRef(0);

  // captain audio status (from lib/audio bus)
  const [captainStatus, setCaptainStatus] = useState("idle");

  // derived
  const correct = (resultsRef.current || []).filter(Boolean).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const micStatus = preparedRef.current
    ? runningRef.current && !pausedRef.current
      ? "listening"
      : "ready"
    : "idle";
  const micLevel = micLevelRef.current || 0;

  /* ---------- logging helper ---------- */
  function log(msg) {
    setLogText((t) => (t ? t + "\n" : "") + msg);
  }

  /* ---------- load scenarios (with demo fallback) ---------- */
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
        // demo fallback (has Captain/Iceman alternation; add cue if you want)
        const demo = [
          {
            id: "scn1",
            label: "Full Body Type I Only",
            steps: [
              { role: "Captain", cue: "init", text: "Iceman, this is N443DF, do you copy?" },
              { role: "Iceman", text: "N443DF, this is Iceman, go ahead." },
              { role: "Captain", cue: "ready", text: "Aircraft N443DF ready for deicing." },
              { role: "Iceman", text: "Copy, starting Type I application now." },
              { role: "Captain", cue: "hail", text: "Be advised—hail reported in the area." },
              { role: "Iceman", text: "Acknowledged, monitoring conditions." },
              { role: "Captain", cue: "ack_update", text: "Copy your update, continue as briefed." },
              { role: "Iceman", text: "Deicing complete and equipment clear." },
              { role: "Captain", cue: "final", text: "Thanks Iceman, stay warm out there!" },
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

  /* ---------- subscribe to audio status ---------- */
  useEffect(() => {
    const off = onAudio("status", (e) => {
      setCaptainStatus(e.detail?.status || "idle");
    });
    return () => off && off();
  }, []);

  /* ---------- mock mic level (replace with analyser if you have one) ---------- */
  useEffect(() => {
    const id = setInterval(() => {
      micLevelRef.current =
        runningRef.current && !pausedRef.current ? 10 + Math.round(Math.random() * 80) : 0;
    }, 500);
    return () => clearInterval(id);
  }, []);

  /* ---------- utilities ---------- */
  function speakLineTTS(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      speechSynthesis.speak(u);
    } catch {}
  }

  const normalize = (s) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

  function quickScore(expected, heard) {
    const A = new Set(normalize(expected).split(" "));
    const B = new Set(normalize(heard).split(" "));
    const inter = [...A].filter((x) => B.has(x)).length;
    return A.size ? Math.round((inter / A.size) * 100) : 0;
  }

  // If a step lacks cue, map by index for scn1
  const CAPTAIN_INDEX_MAP = { 0: "init", 2: "ready", 4: "hail", 6: "ack_update", 8: "final" };
  async function playForStep(step, idx) {
    if (!step) return;
    if (step.role === "Captain") {
      const scnId = current?.id || "scn1";
      const cue = step.cue || CAPTAIN_INDEX_MAP[idx];
      if (cue) {
        const ok = await playCaptainCue(scnId, cue);
        if (!ok) speakLineTTS(step.text); // fallback to TTS if file missing
        return;
      }
    }
    // Non-captain: use TTS
    speakLineTTS(step.text);
  }

  /* ---------- controls ---------- */
  async function onPrepareMic() {
    await unlockAudio(); // primes iOS/Safari
    preloadCaptainCues(current?.id || "scn1", ["init", "ready", "hail", "ack_update", "final"]);
    preparedRef.current = true;
    setStatus("Mic ready.");
    log("Mic ready.");
    toast("Mic ready", "success");
  }

  async function onStart() {
    pausedRef.current = false;
    runningRef.current = true;
    setStatus(preparedRef.current ? "Starting simulator…" : "Starting without mic…");
    log("Session started.");
    if (stepIndex < 0) {
      setStepIndex(0);
      // play first line after state applies
      setTimeout(() => {
        const s = steps[0];
        s && playForStep(s, 0);
      }, 50);
    } else {
      const s = steps[stepIndex];
      s && playForStep(s, stepIndex);
    }
    runSimulator();
  }

  function onPause() {
    pausedRef.current = true;
    runningRef.current = false;
    stopAudio();
    setStatus("Paused");
    log("Paused.");
    toast("Paused");
  }

  function onCheck() {
    if (stepIndex < 0 || !steps[stepIndex]) return;
    const exp = steps[stepIndex].text;
    const pct = quickScore(exp, answer);
    const ok = pct >= 60;
    resultsRef.current[stepIndex] = ok;
    setLastResultText(ok ? `✅ Good (${pct}%)` : `❌ Try again (${pct}%)`);
    if (!ok) setRetryCount((n) => n + 1);
    log(`[Step ${stepIndex + 1}] Score ${pct}% → ${ok ? "OK" : "MISS"}`);
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

  /* ---------- simulator loop (lightweight) ---------- */
  function runSimulator() {
    if (!current || !steps.length) {
      setStatus("Select a scenario first.");
      return;
    }
    const startedAt = performance.now();
    setStatus("Running…");

    const tick = () => {
      if (!runningRef.current || pausedRef.current) return;

      // auto-advance demo: if current judged OK, move next
      const judged = resultsRef.current[stepIndex];
      if (judged && stepIndex < steps.length - 1) {
        const next = stepIndex + 1;
        setStepIndex(next);
        const s = steps[next];
        s && playForStep(s, next);
      }

      const dur = (performance.now() - startedAt) / 1000;
      setAvgRespSec((prev) => (prev ? (prev + dur) / 2 : dur));

      const allJudged =
        resultsRef.current.length === steps.length &&
        resultsRef.current.every((v) => v === true || v === false);

      if (allJudged) {
        runningRef.current = false;
        const finalPct =
          steps.length > 0
            ? Math.round(
                (resultsRef.current.filter(Boolean).length / steps.length) * 100
              )
            : 0;
        setStatus(
          `Complete • ${resultsRef.current.filter(Boolean).length}/${steps.length} (${finalPct}%) • ${
            finalPct >= 80 ? "PASS" : "RETRY"
          }`
        );
        toast("Session complete", finalPct >= 80 ? "success" : "info");
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  /* ---------- render ---------- */
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
                onChange={(e) => {
                  const id = e.target.value;
                  const scn = scenarios.find((s) => s.id === id);
                  if (scn) {
                    setCurrent(scn);
                    resultsRef.current = Array(scn.steps.length).fill(undefined);
                    setStepIndex(-1);
                    setStatus("Scenario loaded");
                    log(`Scenario loaded: ${scn.label}`);
                    preloadCaptainCues(scn.id || "scn1", ["init", "ready", "hail", "ack_update", "final"]);
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
            <span className="pm-pill" style={{ marginLeft: 8 }}>
              Captain: {captainStatus}
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
                onClick={() =>
                  setStepIndex((i) => {
                    const n = Math.max(0, (typeof i === "number" ? i : 0) - 1);
                    steps[n] && playForStep(steps[n], n);
                    return n;
                  })
                }
              >
                ⟵ Prev
              </button>
              <button
                className="pm-btn primary"
                onClick={() =>
                  setStepIndex((i) => {
                    const n = Math.min(total - 1, (typeof i === "number" ? i : -1) + 1);
                    steps[n] && playForStep(steps[n], n);
                    return n;
                  })
                }
              >
                Next ⟶
              </button>
              <button
                className="pm-btn"
                onClick={() => {
                  if (stepIndex >= 0 && steps[stepIndex]) playForStep(steps[stepIndex], stepIndex);
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
                  onJump={(i) => {
                    setStepIndex(i);
                    steps[i] && playForStep(steps[i], i);
                  }}
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
              <div className="pm-log" id="pm-log">{logText}</div>
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
