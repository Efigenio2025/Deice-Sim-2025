// ======== De-Ice Trainer — Simulator Core (UI: Start/Pause + Live Line) ========

(function () {
  // --- Config ---
  const WRITE_TOKEN = 'wR1te_Train3r_XyZ_90210'; // if you post logs, kept for compatibility
  const STEP_LISTEN_MS = 5000;                   // ~5s per Iceman step
  const EMP_ID_KEY = 'trainer.employeeId';

  // --- DOM helpers ---
  const $ = (id) => document.getElementById(id);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // --- Score helpers (word overlap) ---
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  function wordScore(expected, said) {
    const e = new Set(norm(expected).split(' ').filter(Boolean));
    const s = new Set(norm(said).split(' ').filter(Boolean));
    if (e.size === 0) return 0;
    let hit = 0; e.forEach(w => { if (s.has(w)) hit++; });
    return Math.round((hit / e.size) * 100);
  }

  // --- Phonetic (grade Iceman tails by NATO, display tail normally) ---
  const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
  const tailToPhonetic = (tail) => tail.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');
  function expectedForGrading(step) {
    let exp = String(step?.text || step?.phraseId || '');
    if (step?.role === 'Iceman') {
      exp = exp.replace(/\bN[0-9A-Z]{3,}\b/gi, t => tailToPhonetic(t));
    }
    return exp;
  }

  // --- UI state ---
  let SCENARIOS = [];
  let current = null;
  let stepIndex = -1;
  let running = false;         // simulator is running
  let pauseFlag = false;       // requested pause
  let recActive = null;        // active recognizer (to stop on pause)
  let startTs = 0;
  let stepScores = [];

  // --- Employee ID gate (minimal, using existing modal) ---
  function getEmployeeId() {
    return sessionStorage.getItem(EMP_ID_KEY) || localStorage.getItem(EMP_ID_KEY) || '';
  }
  function setEmployeeId(id) {
    try { sessionStorage.setItem(EMP_ID_KEY, id); localStorage.setItem(EMP_ID_KEY, id); } catch {}
  }
  function openEmpModal() { $('empIdModal')?.classList.remove('hidden'); }
  function closeEmpModal() { $('empIdModal')?.classList.add('hidden'); }
  function ensureEmpGate() {
    const badge = $('empIdBadge'), input = $('empIdInput'), save = $('empIdSave'), cancel = $('empIdCancel');
    const have = getEmployeeId();
    if (!have) openEmpModal(); else { closeEmpModal(); setText(badge, 'ID: ' + have); }
    if (save) save.onclick = () => {
      const v = (input?.value || '').trim();
      if (!/^[A-Za-z0-9_-]{3,}$/.test(v)) { setText($('empIdMsg'), 'Enter a valid ID (min 3 chars).'); return; }
      setEmployeeId(v); setText(badge, 'ID: ' + v); setText($('empIdMsg'), ''); closeEmpModal();
    };
    if (cancel) cancel.onclick = () => { setText($('empIdMsg'), 'Employee ID is required.'); };
    $('changeIdBtn')?.addEventListener('click', openEmpModal);
  }

  // --- Scenarios ---
  async function loadScenarios() {
    const sel = $('scenarioSelect'), desc = $('desc');
    sel.innerHTML = '<option value="">— loading —</option>';
    try {
      const r = await fetch('/scenarios.json?v=' + Date.now(), { cache: 'no-store' });
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error('Invalid scenarios.json');
      SCENARIOS = data;
      sel.innerHTML = '<option value="">— select —</option>' + data.map(s => `<option value="${s.id}">${s.label || s.id}</option>`).join('');
      setText(desc, 'Select a scenario to begin.');
    } catch (e) {
      sel.innerHTML = '<option value="">(load failed)</option>';
      setText(desc, 'Could not load scenarios.json');
    }
  }

  function renderActiveStep() {
    const card = $('stepsCard');
    const box = $('stepsBox');
    if (!current || stepIndex < 0 || stepIndex >= (current.steps?.length || 0)) {
      card?.classList.add('hidden');
      setText(box, '—');
      return;
    }
    card?.classList.remove('hidden');
    const st = current.steps[stepIndex];
    const txt = (st.text || st.phraseId || '').replace(/</g, '&lt;');
    box.innerHTML = `
      <div style="padding:8px;border:1px solid #1f6feb;border-radius:10px;background:#0f1424">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <strong>Step ${stepIndex + 1} • ${st.role || ''}</strong>
          <span class="status">${st.prompt || ''}</span>
        </div>
        <div style="margin-top:6px">${txt}</div>
      </div>`;
  }

  function setScorePct(p) {
    p = clamp(parseInt(p || 0, 10), 0, 100);
    setText($('scorePct'), p + '%');
    $('scoreBar').style.width = p + '%';
  }

  // --- Captain audio (with root fallback) ---
  function playCaptainAudio(src) {
    const a = $('captainAudio');
    if (!a || !src) return Promise.resolve();
    const tryPaths = [`/audio/${src}`, `/${src}`];
    return new Promise(async (resolve) => {
      for (const p of tryPaths) {
        try {
          const head = await fetch(p, { method: 'HEAD', cache: 'no-store' });
          if (head.ok) {
            try { a.pause(); a.currentTime = 0; } catch {}
            a.src = p; a.onended = resolve;
            const pr = a.play(); if (pr && pr.catch) pr.catch(() => resolve());
            setText($('liveInline'), '(captain audio)');
            setText($('status'), 'Playing Captain line…');
            return;
          }
        } catch {}
      }
      setText($('status'), `Audio not found: ${src}`); resolve();
    });
  }
  function stopCaptainAudio(){ try { $('captainAudio')?.pause(); } catch {} }

  // --- Speech Recognition (iOS Safari: webkitSpeechRecognition) ---
  function makeRecognizer() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return null;
    const rec = new R();
    rec.lang = 'en-US';
    rec.continuous = false;           // better stability on iOS
    rec.interimResults = true;        // we want live updates
    rec.maxAlternatives = 1;
    return rec;
  }

  // Listen with interim updates for ~timeoutMs
  async function listenWindow(timeoutMs) {
    const endBy = Date.now() + timeoutMs;
    let bestFinal = ''; let lastInterim = '';
    while (Date.now() < endBy && running && !pauseFlag) {
      const rec = makeRecognizer();
      if (!rec) throw new Error('Speech Recognition not supported (use Safari on iOS).');
      recActive = rec;

      const heard = await new Promise((resolve) => {
        let finalChunk = '';
        rec.onresult = (ev) => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const tr = ev.results[i][0]?.transcript || '';
            if (ev.results[i].isFinal) finalChunk += ' ' + tr;
            else interim += ' ' + tr;
          }
          lastInterim = interim.trim();
          setText($('liveInline'), lastInterim || '(listening…)');
        };
        rec.onerror = () => resolve('');      // swallow and continue
        rec.onend = () => resolve(finalChunk.trim());
        try { rec.start(); } catch { resolve(''); }
      });

      if (heard) bestFinal = (bestFinal + ' ' + heard).trim();
      if (Date.now() >= endBy || pauseFlag || !running) break;
      await wait(120); // tiny gap before restarting one-shot
    }
    recActive = null;
    return { final: bestFinal, interim: lastInterim };
  }

  // --- Simulator ---
  async function runSimulator() {
    if (!current) return;
    running = true; pauseFlag = false; stepIndex = 0; stepScores = []; setScorePct(0);
    setText($('status'), 'Running…'); renderActiveStep(); startTs = Date.now();

    const steps = current.steps || [];
    for (let i = 0; i < steps.length; i++) {
      if (!running || pauseFlag) break;
      stepIndex = i; renderActiveStep();
      const st = steps[i];

      if (st.role === 'Captain') {
        const audioSrc = st.audio || st.audioUrl || '';
        await playCaptainAudio(audioSrc);
        if (pauseFlag || !running) break;
      } else {
        // Iceman: listen with interim, grade at the end of window
        try {
          setText($('status'), 'Listening…');
          const { final, interim } = await listenWindow(STEP_LISTEN_MS);
          const heard = final || interim || '';
          const expected = expectedForGrading(st);
          const score = wordScore(expected, heard);
          stepScores.push(score);
          setScorePct(Math.round(stepScores.reduce((a, b) => a + b, 0) / stepScores.length));
          setText($('status'), heard ? `Heard: "${heard}"` : 'No speech detected.');
        } catch (e) {
          setText($('status'), 'Mic error: ' + (e?.message || e));
          stepScores.push(0);
        }
      }
    }

    if (running && !pauseFlag) {
      // Finalize
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a, b) => a + b, 0) / stepScores.length) : 0;
      setScorePct(finalScore);
      setText($('status'), `Scenario complete. Final score: ${finalScore}%`);
      running = false;
    }
  }

  function pauseSimulator() {
    if (!running) { setText($('status'), 'Idle'); return; }
    pauseFlag = true; running = false;
    try { recActive && recActive.abort && recActive.abort(); } catch {}
    stopCaptainAudio();
    setText($('status'), 'Paused');
  }

  // --- (Optional) Cloud log (kept for compatibility; call when you mark complete elsewhere) ---
  async function logTrainingCloud({ empId, scenarioId, scenarioLabel, outcome = 'completed', score = '', durationSec = '' }) {
    try {
      if (!empId || empId.trim().length < 3) return false;
      const resp = await fetch('/api/logs-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-write-token': WRITE_TOKEN },
        body: JSON.stringify({ emp_id: empId, scenario_id: scenarioId || '', scenario_label: scenarioLabel || '', outcome, score, duration_sec: durationSec || null })
      });
      return resp.ok;
    } catch { return false; }
  }

  // --- Wire UI ---
  document.addEventListener('DOMContentLoaded', () => {
    ensureEmpGate();
    loadScenarios();

    $('reloadScenarios')?.addEventListener('click', loadScenarios);

    $('scenarioSelect')?.addEventListener('change', (e) => {
      const id = e.target.value;
      current = SCENARIOS.find(s => s.id === id) || null;
      stepIndex = -1; renderActiveStep();
      setText($('desc'), current ? (current.desc || '') : 'Select a scenario to begin.');
      setText($('status'), 'Idle'); setText($('liveInline'), '(waiting…)'); setScorePct(0);
    });

    $('startBtn')?.addEventListener('click', () => {
      if (!current) { setText($('status'), 'Select a scenario first.'); return; }
      if (running) { setText($('status'), 'Already running…'); return; }
      runSimulator().catch(() => {});
    });

    $('pauseBtn')?.addEventListener('click', pauseSimulator);
  });
})();