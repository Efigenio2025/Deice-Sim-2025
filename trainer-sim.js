// ================= De-Ice Trainer — Duolingo-style Simulator =================
(function () {
  // ---- Config ----
  const EMP_ID_KEY = 'trainer.employeeId';
  const MIN_LISTEN_MS = 1500;   // min time to keep mic open
  const MAX_LISTEN_MS = 6000;   // hard cap per Iceman step
  const SILENCE_MS    = 1200;   // end early if quiet this long
  const CAPTAIN_DELAY_MS = 1000; // settle after captain audio

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();

  // ---- Scoring ----
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

  // ---- Word diff (Duolingo-style highlights) ----
  const tokenize = s => norm(s).split(' ').filter(Boolean);
  function diffWords(exp, heard){
    const E = tokenize(exp), H = tokenize(heard);
    const ok = new Set(H); // overlap view (simple but effective for training)
    const expToks = E.map(w => ({ w, cls: ok.has(w) ? 'ok' : 'miss' }));
    const extraToks = H.filter(w => !new Set(E).has(w)).map(w => ({ w, cls: 'extra' }));
    return { expToks, extraToks, expCount: E.length, hitCount: E.filter(w => ok.has(w)).length };
  }
  function renderToks(el, toks){
    if (!el) return;
    el.innerHTML = toks.map(t => `<span class="tok ${t.cls}">${t.w}</span>`).join(' ');
  }

  // ---- NATO grading only for Iceman tails ----
  const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
  const toNatoTail = t => t.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');
  function prepareExpectedForScenario(scn){
    (scn.steps||[]).forEach(st=>{
      const base = String(st.text || st.phraseId || '');
      // Display line remains as written (tail shown as tail), grading line converts tails to NATO for Iceman
      st._displayLine = base;
      st._expectedForGrade = (st.role === 'Iceman')
        ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
        : base;
    });
  }

  // ---- State ----
  let SCENARIOS = [];
  let current = null;
  let stepIndex = -1;
  let running = false;
  let pauseFlag = false;
  let recActive = null;
  let stepScores = [];
  let perStep = []; // [{i, role, prompt, score, heard}]

  // ---- Employee ID gate (minimal) ----
  function getEmployeeId(){ return sessionStorage.getItem(EMP_ID_KEY) || localStorage.getItem(EMP_ID_KEY) || ''; }
  function setEmployeeId(id){ try{ sessionStorage.setItem(EMP_ID_KEY,id); localStorage.setItem(EMP_ID_KEY,id);}catch{} }
  function openEmp(){ $('empIdModal')?.classList.remove('hidden'); }
  function closeEmp(){ $('empIdModal')?.classList.add('hidden'); }
  function ensureEmpGate(){
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

  // ---- Scenarios loader (robust paths) ----
  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    if (sel) sel.innerHTML = '<option value="">— loading —</option>';
    const tries = [`/scenarios.json?v=${Date.now()}`, `./scenarios.json?v=${Date.now()}`];
    for (const url of tries){
      try{
        const r = await fetch(url, {cache:'no-store'});
        if (!r.ok) continue;
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error('Invalid scenarios.json');
        SCENARIOS = data;
        if (sel) sel.innerHTML = '<option value="">— select —</option>' + data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
        setText(desc,'Select a scenario to begin.');
        return;
      }catch{}
    }
    if (sel) sel.innerHTML = '<option value="">(load failed)</option>';
    setText(desc,'Could not load scenarios.json');
  }

  // ---- Render only the active step ----
  function renderActiveStep(){
    const card=$('stepsCard'), box=$('stepsBox');
    if(!current || stepIndex<0 || stepIndex>=(current.steps?.length||0)){
      card?.classList.add('hidden'); if (box) setText(box,'—'); return;
    }
    card?.classList.remove('hidden');
    const st=current.steps[stepIndex];
    const txt=(st._displayLine||st.text||st.phraseId||'').replace(/</g,'&lt;');
    if (box) box.innerHTML = `
      <div style="padding:8px;border:1px solid #1f6feb;border-radius:10px;background:#0f1424">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <strong>Step ${stepIndex+1} • ${st.role||''}</strong>
          <span class="status">${st.prompt||''}</span>
        </div>
        <div style="margin-top:6px">${txt}</div>
      </div>`;

    // Keep transcript panel up-to-date with expected line (display form)
    setText($('expHeader'), 'Expected');
    renderToks($('expLine'), tokenize(st._displayLine||'').map(w => ({w, cls:'ok'}))); // greyed "ok" styling baseline
    setText($('heardHeader'), 'You said');
    $('heardLine').innerHTML = ''; setText($('wordStats'),'');
  }

  // ---- Captain audio: reliable multi-file play ----
  function playCaptainAudio(src){
    const a=$('captainAudio');
    if(!a || !src) return Promise.resolve();
    const candidates=[`/audio/${src}`, `/${src}`];
    return new Promise(resolve=>{
      let settled=false, timeoutId=null;
      const cleanup=()=>{ a.onended=a.onerror=a.oncanplay=a.onloadedmetadata=null; if(timeoutId) clearTimeout(timeoutId); };
      const tryUrl=(i)=>{
        if(i>=candidates.length){ if(!settled){ settled=true; resolve(); } return; }
        const url=candidates[i];
        cleanup();
        try{ a.pause(); a.currentTime=0; }catch{}
        a.src=url;
        a.onloadedmetadata = () => {
          const dur = (isFinite(a.duration) && a.duration>0) ? a.duration*1000+1000 : 12000;
          timeoutId = setTimeout(()=>{ cleanup(); if(!settled){ settled=true; resolve(); } }, Math.min(dur, 15000));
        };
        a.oncanplay = () => {
          a.onended = () => { cleanup(); if (!settled) { settled = true; resolve(); } };
          const p=a.play();
          if(p && p.catch){
            p.catch(() => { setText($('status'),'Audio blocked (autoplay). Tap Start again if needed.'); cleanup(); if (!settled) { settled = true; resolve(); } });
          }
          setText($('liveInline'),'(captain audio)'); setText($('status'),'Playing Captain line…');
        };
        a.onerror = () => tryUrl(i+1);
      };
      tryUrl(0);
    });
  }
  function stopCaptainAudio(){ try{ $('captainAudio')?.pause(); }catch{} }

  // ---- Throttle (for interim UI spam) ----
  function throttle(fn, ms){ let t=0; return (...a)=>{ const n=Date.now(); if(n-t>=ms){ t=n; fn(...a); } }; }

  // ---- Single recognizer per step; ends on silence or max time; always advance ----
  async function listenStep({minMs=MIN_LISTEN_MS, maxMs=MAX_LISTEN_MS, silenceMs=SILENCE_MS}={}){
    return new Promise(resolve=>{
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!R){ resolve({final:'', interim:'', ended:'nosr'}); return; }

      let finalText='', interimText='';
      let started=Date.now(), lastAct=started, stopped=false;

      const live = throttle((t)=> setText($('liveInline'), t || '(listening…)'), 80);

      const shouldStop = ()=>{
        const now=Date.now(), elapsed=now-started, idle=now-lastAct;
        if (elapsed < minMs) return false;
        if (idle >= silenceMs) return true;
        if (elapsed >= maxMs) return true;
        return false;
      };

      const startOne = ()=>{
        if(stopped) return;
        const rec = new R();
        rec.lang='en-US'; rec.continuous=false; rec.interimResults=true; rec.maxAlternatives=1;

        rec.onresult = (ev)=>{
          let interim='';
          for(let i=ev.resultIndex;i<ev.results.length;i++){
            const tr = ev.results[i][0]?.transcript || '';
            if(ev.results[i].isFinal){ finalText += ' ' + tr; lastAct = Date.now(); }
            else { interim += ' ' + tr; }
          }
          interimText = interim.trim();
          live(interimText);

          // Live Duolingo-style heard line (unstyled interim)
          $('heardLine').textContent = (finalText.trim() + ' ' + interimText).trim();
        };

        rec.onerror = ()=> { if(shouldStop()) endAll('error'); else restart(); };
        rec.onend   = ()=> { if(shouldStop()) endAll('ended'); else restart(); };

        try{
          rec.start();
          recActive = rec;
          setText($('status'),'Listening…'); live('(listening…)');
        }catch{
          if(shouldStop()) endAll('start-failed'); else restart();
        }
      };

      const restart = ()=> setTimeout(()=>{ if(!stopped) startOne(); }, 120);

      const endAll = (reason='end')=>{
        stopped = true;
        try{ recActive && recActive.abort && recActive.abort(); }catch{}
        resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
      };

      // external pause guard
      const guard = setInterval(()=>{
        if(stopped){ clearInterval(guard); return; }
        if(pauseFlag || !running){ clearInterval(guard); endAll('paused'); }
        else if(shouldStop()){ clearInterval(guard); endAll('ok'); }
      }, 100);

      startOne();
    });
  }

  // ---- Simulator loop (always advance; per-step diff + score; final results) ----
  async function runSimulator(){
    if(!current){ setText($('status'),'Select a scenario first.'); return; }

    // iOS: pre-warm mic; cancel any TTS if used elsewhere
    try{ await navigator.mediaDevices.getUserMedia({audio:true}); }catch{}
    try{ speechSynthesis.cancel(); }catch{}

    running = true; pauseFlag = false; stepIndex = 0; stepScores = []; perStep = [];
    setScorePct(0);
    setText($('status'),'Running…'); setText($('liveInline'),'(waiting…)');
    renderActiveStep();

    const steps=current.steps||[];
    for(let i=0;i<steps.length;i++){
      if(!running || pauseFlag) break;
      stepIndex=i; renderActiveStep();
      const st = steps[i];

      if (st.role === 'Captain') {
        await playCaptainAudio(st.audio || st.audioUrl || '');
        if(!running || pauseFlag) break;
        await wait(CAPTAIN_DELAY_MS);
      } else {
        try{
          const { final, interim } = await listenStep();
          const heard = (final || interim || '').trim();

          // Score against NATO-converted expected, but display natural expected text
          const expectedGrade = st._expectedForGrade || (st.text || '');
          const expectedDisplay = st._displayLine || st.text || '';

          const score = wordScore(expectedGrade, heard);
          stepScores.push(score);
          perStep.push({ i: i+1, role: st.role, prompt: st.prompt || '', heard, score });

          // Live Duolingo-style highlights on completion of step
          const { expToks, extraToks, expCount, hitCount } = diffWords(expectedDisplay, heard);
          renderToks($('expLine'), expToks); // ok/miss on expected tokens
          renderToks($('heardLine'), extraToks.length ? extraToks : [{w: heard || '—', cls: heard ? 'ok' : 'miss'}]);
          setText($('wordStats'), `${hitCount}/${expCount} expected words matched • Step score ${score}%`);

          const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
          setScorePct(avg);
          setText($('status'), heard ? `Heard: "${heard}"` : 'No speech detected.');
          setText($('liveInline'), heard || '(listening done)');
        }catch(e){
          stepScores.push(0);
          perStep.push({ i: i+1, role: st.role, prompt: st.prompt || '', heard: '', score: 0 });
          setText($('status'), 'Mic error: ' + (e?.message || e));
        }
      }
    }

    if(running && !pauseFlag){
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
      setScorePct(finalScore);
      showResults(finalScore);
      setText($('status'), `Scenario complete. Final score: ${finalScore}%`);
      running = false;
    }
  }

  function pauseSimulator(){
    if(!running){ setText($('status'),'Idle'); return; }
    pauseFlag = true; running = false;
    try{ recActive && recActive.abort && recActive.abort(); }catch{}
    stopCaptainAudio();
    setText($('status'),'Paused');
  }

  // ---- Results card ----
  function showResults(finalScore){
    const card = $('resultsCard'), list = $('resultsList'), total = $('finalScore');
    if (!card || !list || !total) return;
    total.textContent = String(finalScore) + '%';
    list.innerHTML = perStep.map(s =>
      `<li><strong>Step ${s.i}</strong> • ${s.role||''} • <span class="status">${s.prompt||''}</span><br><span>${(s.heard||'—').replace(/</g,'&lt;')}</span> — <strong>${s.score}%</strong></li>`
    ).join('');
    card.classList.remove('hidden');
  }

  // ---- Wire UI ----
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureEmpGate();
    loadScenarios();

    $('reloadScenarios')?.addEventListener('click', loadScenarios);

    $('scenarioSelect')?.addEventListener('change', (e)=>{
      const id=e.target.value;
      current = SCENARIOS.find(s=>s.id===id) || null;
      if(current) prepareExpectedForScenario(current);
      stepIndex=-1; renderActiveStep();
      setText($('desc'), current ? (current.desc||'') : 'Select a scenario to begin.');
      setText($('status'),'Idle'); setText($('liveInline'),'(waiting…)'); setScorePct(0);
      $('resultsCard')?.classList.add('hidden');
    });

    $('startBtn')?.addEventListener('click', ()=>{
      if(running){ setText($('status'),'Already running…'); return; }
      if(!current){ setText($('status'),'Select a scenario first.'); return; }
      $('resultsCard')?.classList.add('hidden');
      runSimulator().catch(()=>{});
    });

    $('pauseBtn')?.addEventListener('click', pauseSimulator);
  });
})();
