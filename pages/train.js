// pages/train.js
import { useEffect, useMemo, useRef, useState } from "react";
import useResponsiveMode from "../lib/useResponsiveMode";

const MIN_LISTEN_MS = 1500;
const MAX_LISTEN_MS = 25000;
const SILENCE_MS = 4500;
const CAPTAIN_DELAY_MS = 2500;

const NATO = {
  A: "Alpha", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliet", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X-ray",
  Y: "Yankee", Z: "Zulu",
  "0": "Zero","1":"One","2":"Two","3":"Three","4":"Four","5":"Five","6":"Six","7":"Seven","8":"Eight","9":"Nine"
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (s) => norm(s).split(" ").filter(Boolean);

function toNatoTail(t) {
  return t.toUpperCase().split("").map((ch) => NATO[ch] || ch).join(" ");
}
function prepScenarioForGrading(scn) {
  (scn.steps || []).forEach((st) => {
    const base = String(st.text || st.phraseId || "");
    st._displayLine = base;
    st._expectedForGrade =
      st.role === "Iceman"
        ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, (m) => toNatoTail(m))
        : base;
  });
}
function wordScore(expected, said) {
  const e = new Set(tokenize(expected));
  const s = new Set(tokenize(said));
  if (!e.size) return 0;
  let hit = 0;
  e.forEach((w) => { if (s.has(w)) hit++; });
  return Math.round((hit / e.size) * 100);
}
function diffWords(exp, heard) {
  const E = tokenize(exp), H = tokenize(heard);
  const setE = new Set(E), setH = new Set(H);
  const expToks = E.map((w) => ({ w, cls: setH.has(w) ? "ok" : "miss" }));
  const extras = H.filter((w) => !setE.has(w)).map((w) => ({ w, cls: "extra" }));
  return { expToks, extras, expCount: E.length, hitCount: E.filter((w) => setH.has(w)).length };
}

export default function TrainPage() {  
  const mode = useResponsiveMode();   // 'desktop' or 'mobile'
  // UI state
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [status, setStatus] = useState("Idle");
  const [live, setLive] = useState("(waiting…)");
  const [score, setScore] = useState(0);
  const [expTokens, setExpTokens] = useState([]);
  const [heardTokens, setHeardTokens] = useState([]);
  const [wordStats, setWordStats] = useState("");
  const [results, setResults] = useState([]);

  // run state
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const recRef = useRef(null);

  // employee id gate
  const [empOpen, setEmpOpen] = useState(false);
  const [empInput, setEmpInput] = useState("");
  const badge = useRef(null);
  useEffect(() => {
    const prior = window.localStorage.getItem("trainer.employeeId") || window.sessionStorage.getItem("trainer.employeeId");
    if (!prior) setEmpOpen(true);
    else { try { badge.current.textContent = "ID: " + prior; } catch {} }
  }, []);
  function saveEmp() {
    const v = (empInput || "").trim();
    if (!/^[A-Za-z0-9_-]{3,}$/.test(v)) { alert("Enter a valid ID (min 3 chars)"); return; }
    try {
      window.localStorage.setItem("trainer.employeeId", v);
      window.sessionStorage.setItem("trainer.employeeId", v);
      if (badge.current) badge.current.textContent = "ID: " + v;
    } catch {}
    setEmpOpen(false);
  }

  // audio
  const audioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  async function unlockAudio() {
    if (audioUnlockedRef.current) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) { const ctx = new Ctx(); await ctx.resume(); }
    } catch {}
    try {
      const a = audioRef.current;
      if (a) { a.muted = true; await a.play().catch(() => {}); a.pause(); a.currentTime = 0; }
    } catch {}
    audioUnlockedRef.current = true;
    return true;
  }
  function playCaptainAudio(file) {
    const a = audioRef.current;
    if (!a || !file) return Promise.resolve();
    const candidates = [`/audio/${file}`, `/${file}`];

    return new Promise((resolve) => {
      let i = 0;
      const tryOne = () => {
        if (i >= candidates.length) { setStatus("Audio not available"); resolve(); return; }
        const url = candidates[i++];
        const clean = () => { a.onended = a.onerror = a.oncanplay = a.onloadedmetadata = null; };

        try { a.pause(); a.currentTime = 0; } catch {}
        a.src = url;

        a.oncanplay = () => {
          a.muted = false;
          const p = a.play();
          if (p && p.catch) {
            p.catch(() => { clean(); tryOne(); }); // try next path on autoplay block
          }
          setStatus("Playing Captain line…");
          setLive("(captain audio)");
        };

        a.onended = () => { clean(); resolve(); };
        a.onerror = () => { clean(); tryOne(); };
        a.onloadedmetadata = () => {};
      };
      tryOne();
    });
  }

  // permissions
  async function ensureMicPermission() {
    try {
      if (navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: "microphone" });
        if (p.state === "denied") { setStatus("Microphone blocked. Enable it in site settings."); throw new Error("mic-denied"); }
      }
    } catch {}
    setStatus("Requesting microphone permission…");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
    });
    stream.getTracks().forEach((t) => t.stop());
    setStatus("Microphone ready.");
    return true;
  }

  // scenarios
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/scenarios.json?${Date.now()}`, { cache: "no-store" });
        const data = await r.json();
        setScenarios(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length) {
          const scn = JSON.parse(JSON.stringify(data[0]));
          prepScenarioForGrading(scn);
          setCurrent(scn);
          setStepIndex(-1);
          setStatus(`Loaded scenario: ${scn.label || scn.id}`); // ← added feedback
        }
      } catch {
        setScenarios([]);
      }
    })();
  }, []);

  // listening (patched: generation guard + explicit abort)
  async function listenStep({ minMs = MIN_LISTEN_MS, maxMs = MAX_LISTEN_MS, silenceMs = SILENCE_MS } = {}) {
    return new Promise((resolve) => {
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) { resolve({ final: "", interim: "", ended: "nosr" }); return; }

      let finalText = "";
      let interimText = "";
      let started = Date.now();
      let lastAct = started;
      let stopped = false;
      let rec = null;

      let gen = 0; // generation guard

      const shouldStop = () => {
        const now = Date.now();
        const elapsed = now - started;
        const idle = now - lastAct;
        if (elapsed < minMs) return false;
        if (idle >= silenceMs) return true;
        if (elapsed >= maxMs) return true;
        return false;
      };

      const endAll = (reason = "end") => {
        if (stopped) return;
        stopped = true;
        try {
          if (rec) rec.stop();
          if (recRef.current?.abort) recRef.current.abort(); // explicit abort
        } catch {}
        resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
      };

      const startOne = () => {
        if (stopped || !runningRef.current || pausedRef.current) return;
        const myGen = ++gen;

        rec = new R();
        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        recRef.current = rec;

        rec.onstart = () => { lastAct = Date.now(); setStatus("Listening…"); setLive("(listening…)"); };
        rec.onsoundstart = () => { lastAct = Date.now(); };
        rec.onspeechstart = () => { lastAct = Date.now(); };

        rec.onresult = (ev) => {
          let interim = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const tr = ev.results[i][0]?.transcript || "";
            if (tr) lastAct = Date.now();
            if (ev.results[i].isFinal) finalText += (finalText ? " " : "") + tr;
            else interim += (interim ? " " : "") + tr;
          }
          interimText = interim;
          const combined = (finalText ? finalText + " " : "") + interimText;
          setLive(combined || "(listening…)");
        };

        rec.onerror = () => {
          if (myGen !== gen) return;
          if (shouldStop()) endAll("error");
          else setTimeout(startOne, 140);
        };
        rec.onend   = () => {
          if (myGen !== gen) return;
          if (shouldStop()) endAll("ended");
          else setTimeout(startOne, 140);
        };

        try { rec.start(); } catch { if (shouldStop()) endAll("start-failed"); else setTimeout(startOne, 200); }
      };

      // safety guard
      const guard = setInterval(() => {
        if (stopped) { clearInterval(guard); return; }
        if (!runningRef.current || pausedRef.current) { clearInterval(guard); endAll("paused"); return; }
        if (shouldStop()) { clearInterval(guard); endAll("ok"); return; }
      }, 120);

      startOne();
    });
  }

  // simulator
  async function runSimulator() {
    if (!current) { setStatus("Select a scenario first."); return; }
    runningRef.current = true; pausedRef.current = false;
    setScore(0); setResults([]); setLive("(waiting…)"); setStatus("Running…");
    try { speechSynthesis.cancel(); } catch {}

    const steps = current.steps || [];
    let stepScores = [];

    for (let i = 0; i < steps.length; i++) {
      if (!runningRef.current || pausedRef.current) break;
      setStepIndex(i);
      const st = steps[i];

      // render expected line
      const expectedDisplay = st._displayLine || st.text || "";
      setExpTokens(tokenize(expectedDisplay).map((w) => ({ w, cls: "ok" })));
      setHeardTokens([]);
      setWordStats("");

      if (st.role === "Captain") {
        await playCaptainAudio(st.audio || "");
        if (!runningRef.current || pausedRef.current) break;
        await new Promise((r) => setTimeout(r, CAPTAIN_DELAY_MS));
      } else {
        setStatus("Listening… please speak the Iceman line");
        setLive("(listening…)");
        const { final, interim } = await listenStep();
        const heard = (final || interim || "").trim();

        const expectedGrade = st._expectedForGrade || (st.text || "");
        const s = wordScore(expectedGrade, heard);
        stepScores.push(s);

        const { expToks, extras, expCount, hitCount } = diffWords(expectedDisplay, heard);
        setExpTokens(expToks);
        setHeardTokens(extras.length ? extras : [{ w: heard || "—", cls: heard ? "ok" : "miss" }]);
        setWordStats(`${hitCount}/${expCount} expected words matched • Step score ${s}%`);

        const avg = Math.round(stepScores.reduce((a, b) => a + b, 0) / stepScores.length);
        setScore(avg);
        setStatus(heard ? `Heard: "${heard}"` : "No speech detected.");
        setLive(heard || "(listening done)");

        setResults((r) => r.concat([{ i: i + 1, role: st.role, prompt: st.prompt || "", heard, score: s }]));
      }
    }

    if (runningRef.current && !pausedRef.current) {
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a, b) => a + b, 0) / stepScores.length) : 0;
      setScore(finalScore);
      setStatus(`Scenario complete. Final score: ${finalScore}%`);
      runningRef.current = false;
    }
  }

  async function onStart() {
    setStatus("Unlocking audio…");
    await unlockAudio();
    try {
      setStatus("Requesting microphone permission…");
      await ensureMicPermission();
      setStatus("Starting simulator…");
    } catch (e) {
      setStatus("Mic permission denied. You can still run, but speech won’t be captured.");
    }
    runSimulator();
  }
  function onPause() {
    pausedRef.current = true; runningRef.current = false;
    try { recRef.current && recRef.current.abort && recRef.current.abort(); } catch {}
    try { audioRef.current && audioRef.current.pause && audioRef.current.pause(); } catch {}
    setStatus("Paused");
  }

  const steps = useMemo(() => current?.steps || [], [current]);

return (
  <div className={`wrap train-wrap ${mode}`}>
    {/* top bar */}
    ...
      <div className="row" style={{ justifyContent: "space-between" }}>
        <a className="btn ghost" href="/">← Home</a>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <span className="pill" id="empIdBadge" ref={badge}>ID: —</span>
          <button className="btn ghost" onClick={() => setEmpOpen(true)}>Change ID</button>
        </div>
      </div>

      {/* controls */}
      <div className="row">
        <button className="btn" onClick={onStart}>Start Simulator</button>
        <button className="btn ghost" onClick={onPause}>Pause Simulator</button>
      </div>

      {/* scenario select */}
      <div className="card">
        <h2>Trainer</h2>
        <div className="row">
          <label style={{ flex: "1 1 260px" }}>
            Select scenario
            <select
              onChange={(e) => {
                const scn = JSON.parse(JSON.stringify(scenarios.find((s) => s.id === e.target.value)));
                if (scn) {
                  prepScenarioForGrading(scn);
                  setCurrent(scn);
                  setStepIndex(-1);
                  setScore(0);
                  setResults([]);
                  setStatus("Idle");
                  setLive("(waiting…)");
                  setStatus(`Loaded scenario: ${scn.label || scn.id}`);
                }
              }}
              value={current?.id || ""}
            >
              {scenarios.length === 0 && <option value="">— loading —</option>}
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
            </select>
          </label>
          <button
            className="btn ghost"
            onClick={async () => {
              setStatus("Reloading scenarios…");
              try {
                const r = await fetch("/scenarios.json?" + Date.now(), { cache: "no-store" });
                const data = await r.json();
                setScenarios(data || []);
                if (data?.length) {
                  const scn = JSON.parse(JSON.stringify(data[0]));
                  prepScenarioForGrading(scn);
                  setCurrent(scn);
                  setStatus("Scenarios loaded.");
                }
              } catch {
                setStatus("Reload failed");
              }
            }}
          >
            Reload
          </button>
        </div>
        <div id="desc" className="status" style={{ marginTop: 6 }}>
          {current?.desc || "Select a scenario to begin."}
        </div>
      </div>

      {/* live line */}
      <div className="card" aria-live="polite" aria-label="Live microphone input">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Live Input</strong>
          <span className="status">{status}</span>
        </div>
        <div className="live-inline">{live}</div>
      </div>

      {/* current step */}
      {current && stepIndex >= 0 && stepIndex < steps.length && (
        <div className="card">
          <h2>Step</h2>
          <div className="status" id="stepsBox">
            <div style={{ padding: 8, border: "1px solid #1f6feb", borderRadius: 10, background: "#0f1424" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong>Step {stepIndex + 1} • {steps[stepIndex].role}</strong>
                <span className="status">{steps[stepIndex].prompt || ""}</span>
              </div>
              <div style={{ marginTop: 6 }}>{steps[stepIndex]._displayLine || steps[stepIndex].text}</div>
            </div>
          </div>
          <div className="scoreline">
            <div className="status">Score: <span id="scorePct">{score}%</span></div>
            <div style={{ flex: 1 }} />
            <div className="progress" style={{ width: 300 }}>
              <div className="bar" style={{ width: `${score}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* transcript */}
      <div className="card">
        <h2>Transcript</h2>
        <div className="status">Expected</div>
        <div>
          {expTokens.map((t, i) => <span key={i} className={`tok ${t.cls}`}>{t.w}</span>)}
        </div>
        <div className="status" style={{ marginTop: 8 }}>You said</div>
        <div>
          {heardTokens.map((t, i) => <span key={i} className={`tok ${t.cls}`}>{t.w}</span>)}
        </div>
        <div className="status" style={{ marginTop: 6 }}>{wordStats}</div>
      </div>

      {/* results */}
      {results.length > 0 && !runningRef.current && (
        <div className="card">
          <h2>Results</h2>
          <p className="status">Final score: <strong>{score}%</strong></p>
          <ol style={{ paddingLeft: 18, margin: "8px 0 0" }}>
            {results.map((r) => (
              <li key={r.i}>
                <strong>Step {r.i}</strong> • {r.role} • <span className="status">{r.prompt}</span><br />
                <span>{r.heard || "—"}</span> — <strong>{r.score}%</strong>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* employee modal & captain audio */}
      {empOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card" style={{ maxWidth: 380, width: "92%" }}>
            <h2 style={{ margin: "0 0 8px" }}>Enter Employee ID</h2>
            <p className="status" style={{ margin: "0 0 10px" }}>Required to log trainings.</p>
            <input placeholder="e.g., 123456" value={empInput} onChange={(e) => setEmpInput(e.target.value)} />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => alert("Employee ID is required.")}>Cancel</button>
              <button className="btn" onClick={saveEmp}>Continue</button>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} preload="metadata" playsInline muted />
    </div>
  );
}
