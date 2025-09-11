// ================= De-Ice Trainer — Main (Start/Pause, immediate mic prompt, audio unlock, scoring) =================
(() => {
  // ---------- Config ----------
  const EMP_ID_KEY = 'trainer.employeeId';
  const MIN_LISTEN_MS = 1500;   // min time mic stays open each Iceman step
  const MAX_LISTEN_MS = 6000;   // hard cap per Iceman step
  const SILENCE_MS    = 1200;   // stop early if no speech for this long
  const CAPTAIN_DELAY_MS = 900; // short settle after captain audio

  // ---------- DOM helpers ----------
  const $ = id => document.getElementById(id);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm  = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();

  // ---------- Scoring ----------
  function wordScore(expected, said){
    const e = new Set(norm(expected).split(' ').filter(Boolean));
    const s = new Set(norm(said).split(' ').filter(Boolean));
    if (!e.size) return 0;
    let hit = 0; e.forEach(w => { if (s.has(w)) hit++; });
    return Math.round((hit / e.size) * 100);
  }
  function setScorePct(p){
    p = clamp(+(p||0)|0, 0, 100);
    setText($('scorePct'), p + '%');
    const bar = $('scoreBar'); if (bar) bar.style.width = p + '%';
  }

  // ---------- Duolingo-style highlights ----------
  const tokenize = s => norm(s).split(' ').filter(Boolean);
  function diffWords(exp, heard){
    const E = tokenize(exp), H = tokenize(heard);
    const setE = new Set(E), setH = new Set(H);
    const expToks = E.map(w => ({ w, cls: setH.has(w) ? 'ok' : 'miss' }));
    const extras  = H.filter(w => !setE.has(w)).map(w => ({ w, cls: 'extra' }));
    return { expToks, extras, expCount: E.length, hitCount: E.filter(w => setH.has(w)).length };
  }
  function renderToks(el, toks){
    if (!el) return;
    el.innerHTML = toks.map(t => `<span class="tok ${t.cls}">${t.w}</span>`).join(' ');
  }

  // ---------- NATO for Iceman tail grading ----------
  const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
  const toNatoTail = t => t.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');
  function prepareScenarioForGrading(scn){
    (scn.steps||[]).forEach(st=>{
      const base = String(st.text || st.phraseId || '');
      st._displayLine = base; // what we show
      st._expectedForGrade = (st.role === 'Iceman')
        ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
        : base;
    });
  }

  // ---------- State ----------
  let SCENARIOS = [];
  let current = null;
  let stepIndex = -1;
  let running = false;
  let paused  = false;
  let recActive = null;
  let stepScores = [];
  let resultsByStep = [];

  // ---------- Employee gate ----------
  function getEmployeeId(){ return sessionStorage.getItem(EMP_ID_KEY) || localStorage.getItem(EMP_ID_KEY) || ''; }
  function setEmployeeId(id){ try{ sessionStorage.setItem(EMP_ID_KEY,id); localStorage.setItem(EMP_ID_KEY,id);}catch{} }
  function openEmp(){ $('empIdModal')?.classList.remove('hidden'); }
  function closeEmp(){ $('empIdModal')?.classList.add('hidden'); }
  function mountGate(){
    const badge=$('empIdBadge'), input=$('empIdInput'), save=$('empIdSave'), cancel=$('empIdCancel');
    const have=getEmployeeId();
    if(!have){ openEmp(); } else { closeEmp(); setText(badge,'ID: '+have); }
    if(save) save.onclick=()=>{
      const v=(input?.value||'').trim();
      if(!/^[A-Za-z0-9_-]{3,}$/.test(v)){ setText($('empIdMsg'),'Enter a valid ID (min 3 chars).'); return; }
      setEmployeeId(v); setText(badge,'ID: '+v); setText($('empIdMsg'),''); closeEmp();
    };
    if(cancel) cancel.onclick=()=> setText($('empIdMsg'),'Employee ID is required.');
    $('changeIdBtn')?.addEventListener('click', openEmp);
  }

  // ---------- Scenarios ----------
  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    sel.innerHTML='<option value="">— loading —</option>';
    const url = `/scenarios.json?v=${Date.now()}`;
    try{
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const data=await r.json();
      if(!Array.isArray(data)) throw new Error('bad schema');
      SCENARIOS=data;
      sel.innerHTML=data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
      // Auto-select first scenario
      if (data.length) {
        sel.value = data[0].id;
        const evt = new Event('change');
        sel.dispatchEvent(evt);
      }
      setText(desc,'Select a scenario to begin.');
    }catch(e){
      sel.innerHTML='<option value="">(load failed)</option>';
      setText(desc,'Could not load scenarios.json');
      console.error('scenarios.json load error:', e);
    }
  }

  // ---------- UI for active step ----------
  function renderActiveStep(){
    const card=$('stepsCard'), box=$('stepsBox');
    if(!current || stepIndex<0 || stepIndex>=(current.steps?.length||0)){
      card?.classList.add('hidden'); setText(box,'—'); return;
    }
    card?.classList.remove('hidden');
    const st=current.steps[stepIndex];
    const txt=(st._displayLine||st.text||'').replace(/</g,'&lt;');
    box.innerHTML = `
      <div style="padding:8px;border:1px solid #1f6feb;border-radius:10px;background:#0f1424">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <strong>Step ${stepIndex+1} • ${st.role||''}</strong>
          <span class="status">${st.prompt||''}</span>
        </div>
        <div style="margin-top:6px">${txt}</div>
      </div>`;
    setText($('expHeader'),'Expected');
    renderToks($('expLine'), tokenize(st._displayLine||'').map(w=>({w,cls:'ok'})));
    $('heardLine').innerHTML=''; setText($('wordStats'),'');
  }

  // ---------- Safari audio unlock ----------
  let audioUnlocked=false;
  async function unlockAudio(){
    if(audioUnlocked) return true;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(Ctx){ const ctx=new Ctx(); await ctx.resume(); const osc=ctx.createOscillator(), g=ctx.createGain(); g.gain.value=0; osc.connect(g).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+0.01); }
    }catch{}
    try{
      const a=$('captainAudio'); if(a){ a.muted=true; await a.play().catch(()=>{}); a.pause(); a.currentTime=0; }
    }catch{}
    audioUnlocked=true; return true;
  }

  // ---------- Mic permission (prompt immediately on Start) ----------
  async function ensureMicPermission() {
    try {
      if (navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: 'microphone' });
        if (p.state === 'denied') {
          setText($('status'), 'Microphone is blocked. Enable it in Settings for this site.');
          throw new Error('mic-denied');
        }
      }
    } catch {}
    try {
      setText($('status'), 'Requesting microphone permission…');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:false }
      });
      stream.getTracks().forEach(t => t.stop());
      setText($('status'), 'Microphone ready.');
      return true;
    } catch (e) {
      setText($('status'), 'Microphone permission was not granted.');
      throw e;
    }
  }

  // ---------- Captain audio ----------
  function playCaptainAudio(src){
    const a=$('captainAudio'); if(!a || !src) return Promise.resolve();
    const candidates=[`/audio/${src}`, `/${src}`];
    return new Promise(resolve=>{
      let settled=false, to=null;
      const clean=()=>{ a.onended=a.onerror=a.oncanplay=a.onloadedmetadata=null; if(to) clearTimeout(to); };
      const tryUrl=(i)=>{
        if(i>=candidates.length){ if(!settled){ settled=true; resolve(); } return; }
        clean();
        try{ a.pause(); a.currentTime=0; }catch{}
        a.src=candidates[i];
        a.onloadedmetadata=()=>{ const dur=(isFinite(a.duration)&&a.duration>0)?a.duration*1000+1000:12000; to=setTimeout(()=>{ clean(); if(!settled){ settled=true; resolve(); } }, Math.min(dur,15000)); };
        a.oncanplay=()=>{ a.muted=false; a.onended=()=>{ clean(); if(!settled){ settled=true; resolve(); } }; const p=a.play(); if(p&&p.catch){ p.catch(()=>{ clean(); if(!settled){ settled=true; resolve(); } }); } setText($('liveInline'),'(captain audio)'); setText($('status'),'Playing Captain line…'); };
        a.onerror=()=>tryUrl(i+1);
      };
      tryUrl(0);
    });
  }
  function stopCaptainAudio(){ try{ $('captainAudio')?.pause(); }catch{} }

  // ---------- Mic (single-recognizer per step, silence/timeout end) ----------
function throttle(fn, ms){ let t=0; return (...a)=>{ const n=Date.now(); if(n - t >= ms){ t=n; fn(...a); } }; }

async function listenStep({minMs=MIN_LISTEN_MS, maxMs=MAX_LISTEN_MS, silenceMs=SILENCE_MS} = {}) {
  return new Promise(resolve => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { resolve({ final: '', interim: '', ended: 'nosr' }); return; }

    // generation guard: ignore stale restarts after we decide to end
    const gen = Math.random().toString(36).slice(2);
    let activeGen = gen;

    let finalText = '';
    let interimText = '';
    let started = Date.now();
    let lastAct = started;   // refreshed on ANY audio/speech activity
    let stopped = false;

    const live = throttle(t => setText($('liveInline'), t || '(listening…)'), 60);

    const shouldStop = () => {
      const now = Date.now();
      const elapsed = now - started;
      const idle = now - lastAct;
      if (elapsed < minMs) return false;
      if (idle >= silenceMs) return true;
      if (elapsed >= maxMs) return true;
      return false;
    };

    // clean abort for the active recognizer only
    const hardEnd = (reason='end') => {
      if (stopped) return;
      stopped = true;
      // abort any current SR instance
      try { if (recActive && recActive.abort) recActive.abort(); } catch {}
      resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
    };

    const startOne = () => {
      if (stopped || activeGen !== gen) return;

      const rec = new R();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      // Keep a reference for pause/abort from outside
      recActive = rec;

      // Any of these indicate live audio detected – refresh lastAct
      rec.onstart = () => { lastAct = Date.now(); setText($('status'), 'Listening…'); live('(listening…)'); };
      rec.onsoundstart = () => { lastAct = Date.now(); };
      rec.onspeechstart = () => { lastAct = Date.now(); };

      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const alt = ev.results[i][0];
          const tr = (alt && alt.transcript) ? alt.transcript : '';
          if (tr) lastAct = Date.now(); // any text is activity
          if (ev.results[i].isFinal) {
            finalText += (finalText ? ' ' : '') + tr;
          } else {
            interim += (interim ? ' ' : '') + tr;
          }
        }
        interimText = interim;
        const combined = (finalText ? finalText + ' ' : '') + interimText;
        $('heardLine').textContent = combined.trim();
        live(interimText || combined || '(listening…)');
      };

      rec.onerror = (e) => {
        // Common Safari errors: 'no-speech', 'aborted', 'network'
        // - If within minMs, keep trying.
        // - After minMs, allow guard to decide end vs restart.
        const type = e && e.error ? e.error : 'error';
        // If we already met minMs and idle says stop, end. Otherwise restart.
        if (shouldStop()) hardEnd(type);
        else restart();
      };

      rec.onend = () => {
        // Natural onend fires frequently on iOS; decide using guard.
        if (shouldStop()) hardEnd('ended');
        else restart();
      };

      try {
        rec.start();
        setText($('status'), 'Listening…');
        live('(listening…)');
      } catch (err) {
        // If start throws before minMs, try again; otherwise end gracefully
        if (shouldStop()) hardEnd('start-failed');
        else restart();
      }
    };

    const restart = () => {
      if (stopped || activeGen !== gen) return;
      // brief delay prevents hot-loop thrash that iOS sometimes triggers
      setTimeout(() => { if (!stopped && activeGen === gen) startOne(); }, 140);
    };

    // Safety guard timer: ends when paused/stopped OR min/idle/max satisfied
    const guard = setInterval(() => {
      if (stopped) { clearInterval(guard); return; }
      if (paused || !running) { clearInterval(guard); hardEnd('paused'); return; }
      if (shouldStop()) { clearInterval(guard); hardEnd('ok'); return; }
    }, 120);

    // Prime UI and begin
    setText($('heardLine'), '');
    live('(listening…)');
    startOne();
  });
}

  // ---------- Results ----------
  function showResults(finalScore){
    const card=$('resultsCard'), list=$('resultsList'), total=$('finalScore');
    total.textContent=String(finalScore)+'%';
    list.innerHTML=resultsByStep.map(s=>
      `<li><strong>Step ${s.i}</strong> • ${s.role||''} • <span class="status">${s.prompt||''}</span><br><span>${(s.heard||'—').replace(/</g,'&lt;')}</span> — <strong>${s.score}%</strong></li>`
    ).join('');
    card.classList.remove('hidden');
  }

  // ---------- Main simulator ----------
  async function runSimulator(){
    if(!current){ setText($('status'),'Select a scenario first.'); return; }
    try{ speechSynthesis.cancel(); }catch{}

    running=true; paused=false; stepIndex=0; stepScores=[]; resultsByStep=[];
    setScorePct(0); setText($('status'),'Running…'); setText($('liveInline'),'(waiting…)');
    $('resultsCard')?.classList.add('hidden');

    const steps=current.steps||[];
    for(let i=0;i<steps.length;i++){
      if(!running || paused) break;
      stepIndex=i; renderActiveStep();
      const st=steps[i];

      if(st.role==='Captain'){
        await playCaptainAudio(st.audio||'');
        if(!running || paused) break;
        await wait(CAPTAIN_DELAY_MS);
      }else{
        try{
          const {final, interim}=await listenStep();
          const heard=(final||interim||'').trim();

          const expectedGrade=st._expectedForGrade || (st.text||'');
          const expectedDisplay=st._displayLine || st.text || '';

          const score=wordScore(expectedGrade, heard);
          stepScores.push(score);
          resultsByStep.push({ i:i+1, role:st.role, prompt:st.prompt||'', heard, score });

          const {expToks, extras, expCount, hitCount}=diffWords(expectedDisplay, heard);
          renderToks($('expLine'), expToks);
          renderToks($('heardLine'), extras.length?extras:[{w:heard||'—', cls:heard?'ok':'miss'}]);
          setText($('wordStats'), `${hitCount}/${expCount} expected words matched • Step score ${score}%`);

          const avg=Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
          setScorePct(avg);
          setText($('status'), heard ? `Heard: "${heard}"` : 'No speech detected.');
          setText($('liveInline'), heard || '(listening done)');
        }catch(e){
          stepScores.push(0);
          resultsByStep.push({ i:i+1, role:st.role, prompt:st.prompt||'', heard:'', score:0 });
          setText($('status'),'Mic error: '+(e?.message||e));
        }
      }
    }

    if(running && !paused){
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
      setScorePct(finalScore);
      showResults(finalScore);
      setText($('status'), `Scenario complete. Final score: ${finalScore}%`);
      running=false;
    }
  }

  function pauseSimulator(){
    if(!running){ setText($('status'),'Idle'); return; }
    paused=true; running=false;
    try{ recActive&&recActive.abort&&recActive.abort(); }catch{}
    stopCaptainAudio();
    setText($('status'),'Paused');
  }

  // ---------- Wire UI ----------
  function mountUI(){
    // Scenario selection
    $('scenarioSelect')?.addEventListener('change', (e)=>{
      const id=e.target.value;
      current = SCENARIOS.find(s=>s.id===id) || null;
      if(current) prepareScenarioForGrading(current);
      stepIndex=-1; renderActiveStep();
      setText($('desc'), current ? (current.desc||'') : 'Select a scenario to begin.');
      setText($('status'),'Idle'); setText($('liveInline'),'(waiting…)'); setScorePct(0);
      $('resultsCard')?.classList.add('hidden');
    });

    // Reload scenarios
    $('reloadScenarios')?.addEventListener('click', loadScenarios);

    // Start/Pause wiring (listeners + inline fallback)
    $('startBtn')?.addEventListener('click', window.__start);
    $('pauseBtn')?.addEventListener('click', window.__pause);
  }

  // ---------- Expose inline fallbacks ----------
  window.__start = async () => {
    try { await unlockAudio(); } catch {}
    try { await ensureMicPermission(); } catch { return; }  // prompt immediately
    if (!current) {
      setText($('status'), 'Select a scenario first.');
      return;
    }
    $('resultsCard')?.classList.add('hidden');
    runSimulator().catch(()=>{});
  };
  window.__pause = pauseSimulator;

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', async () => {
    mountGate();
    mountUI();
    await loadScenarios();       // auto-selects first scenario
  });
})();
