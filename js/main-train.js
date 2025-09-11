// ================= De-Ice Trainer — main-train.js (Chrome-friendly, iOS-safe) =================
(() => {
  // ---------- Config ----------
  const EMP_ID_KEY = 'trainer.employeeId';
  const MIN_LISTEN_MS = 1500;
  const MAX_LISTEN_MS = 6000;
  const SILENCE_MS    = 1200;
  const CAPTAIN_DELAY_MS = 900;

  // ---------- DOM helpers ----------
  const $ = id => document.getElementById(id);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm  = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();

  // ---------- Browser capability ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const IS_CHROME = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  function assertSRorExplain(){
    if (!SR) {
      const note = IS_IOS
        ? 'SpeechRecognition unavailable. On iOS, use Safari (or any WebKit-based browser with SR enabled).'
        : 'SpeechRecognition unavailable. Use Chrome desktop or Android Chrome.';
      setText($('status'), note);
      return false;
    }
    return true;
  }

  // ---------- Scoring & highlights ----------
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
  const tokenize = s => norm(s).split(' ').filter(Boolean);
  function diffWords(exp, heard){
    const E = tokenize(exp), H = tokenize(heard);
    const setE = new Set(E), setH = new Set(H);
    const expToks = E.map(w => ({ w, cls: setH.has(w) ? 'ok' : 'miss' }));
    const extraToks = H.filter(w => !setE.has(w)).map(w => ({ w, cls: 'extra' }));
    return { expToks, extraToks, expCount: E.length, hitCount: E.filter(w => setH.has(w)).length };
  }
  function renderToks(el, toks){
    if (!el) return;
    el.innerHTML = toks.map(t => `<span class="tok ${t.cls}">${t.w}</span>`).join(' ');
  }

  // ---------- NATO tails for Iceman grading ----------
  const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
  const toNatoTail = t => t.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');
  function prepareScenarioForGrading(scn){
    (scn.steps||[]).forEach(st=>{
      const base = String(st.text || st.phraseId || '');
      st._displayLine = base;
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
  let stepScores = [];
  let resultsByStep = [];
  let recActive = null;

  // ---------- Employee ID gate ----------
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

  // ---------- Safari/Chrome audio unlock ----------
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

  // ---------- Mic permission (Chrome-friendly) ----------
  async function ensureMicPermission(){
    try{
      if (navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: 'microphone' });
        if (p.state === 'denied') {
          setText($('status'), 'Microphone blocked. In Chrome: lock icon → Site settings → Allow Microphone.');
          throw new Error('mic-denied');
        }
      }
    }catch{}
    try{
      setText($('status'),'Requesting microphone permission…');
      const stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:false } });
      stream.getTracks().forEach(t=>t.stop());
      setText($('status'),'Microphone ready.');
      return true;
    }catch(e){
      setText($('status'), 'Mic permission failed: ' + (e?.message||e));
      return false;
    }
  }

  // ---------- Audio (Captain MP3) ----------
  function playCaptainAudio(src){
    const a=$('captainAudio'); if(!a || !src) return Promise.resolve();
    const candidates=[`/audio/${src}`, `/${src}`];
    return new Promise(resolve=>{
      let settled=false, to=null;
      const clean=()=>{ a.onended=a.onerror=a.oncanplay=a.onloadedmetadata=null; if(to) clearTimeout(to); };
      const tryUrl=(i)=>{
        if(i>=candidates.length){ if(!settled){ settled=true; resolve(); } return; }
        clean(); try{ a.pause(); a.currentTime=0; }catch{}
        a.src=candidates[i];
        a.onloadedmetadata=()=>{ const dur=(isFinite(a.duration)&&a.duration>0)?a.duration*1000+1000:12000; to=setTimeout(()=>{ clean(); if(!settled){ settled=true; resolve(); } }, Math.min(dur,15000)); };
        a.oncanplay=()=>{ a.muted=false; a.onended=()=>{ clean(); if(!settled){ settled=true; resolve(); } }; const p=a.play(); if(p&&p.catch){ p.catch(()=>{ clean(); if(!settled){ settled=true; resolve(); } }); } setText($('liveInline'),'(captain audio)'); setText($('status'),'Playing Captain line…'); };
        a.onerror=()=>tryUrl(i+1);
      };
      tryUrl(0);
    });
  }
  function stopCaptainAudio(){ try{ $('captainAudio')?.pause(); }catch{} }

  // ---------- Mic listening (single-recognizer per step) ----------
  function throttle(fn, ms){ let t=0; return (...a)=>{ const n=Date.now(); if(n-t>=ms){ t=n; fn(...a); } }; }

  async function listenStep({minMs=MIN_LISTEN_MS, maxMs=MAX_LISTEN_MS, silenceMs=SILENCE_MS}={}){
    return new Promise(resolve=>{
      if(!SR){ resolve({final:'', interim:'', ended:'nosr'}); return; }
      const rec = new SR();
      rec.lang='en-US';
      rec.continuous=false;      // Chrome stability
      rec.interimResults=true;
      rec.maxAlternatives=1;

      let finalText='', interimText='';
      let started=Date.now(), lastAct=started, stopped=false;
      const live = throttle(t=> setText($('liveInline'), t || '(listening…)'), 60);

      const shouldStop=()=>{ const now=Date.now(), elapsed=now-started, idle=now-lastAct; if(elapsed<minMs) return false; if(idle>=silenceMs) return true; if(elapsed>=maxMs) return true; return false; };
      const hardEnd = (reason='end') => { if(stopped) return; stopped=true; try{ rec.abort(); }catch{} resolve({ final:finalText.trim(), interim:interimText.trim(), ended:reason }); };

      rec.onstart=()=>{ lastAct=Date.now(); setText($('status'),'Listening…'); live('(listening…)'); };
      rec.onsoundstart=()=>{ lastAct=Date.now(); };
      rec.onspeechstart=()=>{ lastAct=Date.now(); };
      rec.onresult=(ev)=>{
        let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const alt=ev.results[i][0]; const tr=alt?alt.transcript:''; if(tr) lastAct=Date.now(); if(ev.results[i].isFinal){ finalText += (finalText?' ':'') + tr; } else { interim += (interim?' ':'') + tr; } }
        interimText=interim;
        const combined=(finalText?finalText+' ':'')+interimText;
        $('heardLine').textContent=combined.trim();
        live(interimText || combined || '(listening…)');
      };
      rec.onerror=(e)=>{ if(shouldStop()) hardEnd('error'); else rec.start(); };
      rec.onend=()=>{ if(shouldStop()) hardEnd('ended'); else rec.start(); };

      try{ rec.start(); }catch{ if(shouldStop()) hardEnd('start-failed'); else setTimeout(()=>rec.start(), 140); }

      const guard = setInterval(()=>{ if(stopped){ clearInterval(guard); return; } if(paused || !running){ clearInterval(guard); hardEnd('paused'); } else if(shouldStop()){ clearInterval(guard); hardEnd('ok'); } }, 120);
    });
  }

  // ---------- Scenarios ----------
  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    sel.innerHTML='<option value="">— loading —</option>';
    try{
      const r=await fetch(`/scenarios.json?v=${Date.now()}`, {cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const data=await r.json();
      if(!Array.isArray(data)) throw new Error('bad schema');
      SCENARIOS=data;
      sel.innerHTML = data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
      if(data.length){ sel.value=data[0].id; sel.dispatchEvent(new Event('change')); }
      setText(desc,'Select a scenario to begin.');
    }catch(e){
      sel.innerHTML='<option value="">(load failed)</option>';
      setText(desc,'Could not load scenarios.json');
      console.error('scenarios.json load error:', e);
    }
  }

  // ---------- Active step render ----------
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

  // ---------- Simulator ----------
  async function runSimulator(){
    if(!current){ setText($('status'),'Select a scenario first.'); return; }
    if (!assertSRorExplain()) return;
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
        const {final, interim} = await listenStep();
        const heard = (final || interim || '').trim();

        const expectedGrade  = st._expectedForGrade || (st.text||'');
        const expectedDisplay= st._displayLine || st.text || '';

        const score = wordScore(expectedGrade, heard);
        stepScores.push(score);
        resultsByStep.push({ i:i+1, role:st.role, prompt:st.prompt||'', heard, score });

        const {expToks, extraToks, expCount, hitCount} = diffWords(expectedDisplay, heard);
        renderToks($('expLine'), expToks);
        renderToks($('heardLine'), extraToks.length?extraToks:[{w:heard||'—', cls:heard?'ok':'miss'}]);
        setText($('wordStats'), `${hitCount}/${expCount} expected words matched • Step score ${score}%`);

        const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
        setScorePct(avg);
        setText($('status'), heard ? `Heard: "${heard}"` : 'No speech detected.');
        setText($('liveInline'), heard || '(listening done)');
      }
    }

    if(running && !paused){
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
      setScorePct(finalScore);
      const list=$('resultsList'), total=$('finalScore');
      total.textContent=String(finalScore)+'%';
      list.innerHTML=resultsByStep.map(s=>`<li><strong>Step ${s.i}</strong> • ${s.role||''} • <span class="status">${s.prompt||''}</span><br><span>${(s.heard||'—').replace(/</g,'&lt;')}</span> — <strong>${s.score}%</strong></li>`).join('');
      $('resultsCard')?.classList.remove('hidden');
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

  // ---------- UI wiring ----------
  function mountUI(){
    $('scenarioSelect')?.addEventListener('change', (e)=>{
      const id=e.target.value;
      current = SCENARIOS.find(s=>s.id===id) || null;
      if(current) prepareScenarioForGrading(current);
      stepIndex=-1; renderActiveStep();
      setText($('desc'), current ? (current.desc||'') : 'Select a scenario to begin.');
      setText($('status'),'Idle'); setText($('liveInline'),'(waiting…)'); setScorePct(0);
      $('resultsCard')?.classList.add('hidden');
    });
    $('reloadScenarios')?.addEventListener('click', loadScenarios);

    // expose start/pause
    window.__pause = pauseSimulator;
    window.__start = async ()=>{
      try{
        await unlockAudio();
        const ok = await ensureMicPermission();
        if (!ok) return;
        await runSimulator();
      }catch(err){
        setText($('status'),'Start failed: '+(err?.message||err));
        console.error(err);
      }
    };
    $('startBtn')?.addEventListener('click', window.__start);
    $('pauseBtn')?.addEventListener('click', window.__pause);

    // helpful hint
    if (IS_CHROME && !IS_IOS) setText($('status'),'Chrome detected — mic and audio optimized.');
    if (IS_IOS) setText($('status'),'iOS engine detected — mic behavior follows Safari policies.');
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', async ()=>{
    // Employee gate
    mountGate();
    // UI and data
    mountUI();
    await loadScenarios();
  });
})();
