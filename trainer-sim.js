// ================= De-Ice Trainer — Simulator Logic (stable) =================
(function () {
  // ---- Config ----
  const EMP_ID_KEY = 'trainer.employeeId';
  const MIN_LISTEN_MS = 1500, MAX_LISTEN_MS = 6000, SILENCE_MS = 1200, CAPTAIN_DELAY_MS = 900;

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const throttle = (fn, ms)=>{ let t=0; return (...a)=>{ const n=Date.now(); if(n-t>=ms){ t=n; fn(...a); } }; };

  function statusOk(msg){ setText($('status'), msg); }
  function statusErr(msg){ setText($('status'), 'Error: ' + msg); console.error('[trainer]', msg); }

  // ---- Scoring / diff (Duolingo-style) ----
  function wordScore(expected, said){
    const e=new Set(norm(expected).split(' ').filter(Boolean));
    const s=new Set(norm(said).split(' ').filter(Boolean));
    if(!e.size) return 0;
    let hit=0; e.forEach(w=>{ if(s.has(w)) hit++; });
    return Math.round((hit/e.size)*100);
  }
  function setScorePct(p){
    p = Math.max(0, Math.min(100, p|0));
    setText($('scorePct'), p + '%');
    const bar=$('scoreBar'); if(bar) bar.style.width = p + '%';
  }
  const tokenize = s=>norm(s).split(' ').filter(Boolean);
  function diffWords(exp, heard){
    const E=tokenize(exp), H=tokenize(heard);
    const setE=new Set(E), setH=new Set(H);
    const expToks=E.map(w=>({w,cls:setH.has(w)?'ok':'miss'}));
    const extraToks=H.filter(w=>!setE.has(w)).map(w=>({w,cls:'extra'}));
    return {expToks,extraToks,expCount:E.length,hitCount:E.filter(w=>setH.has(w)).length};
  }
  function renderToks(el,toks){ el.innerHTML = toks.map(t=>`<span class="tok ${t.cls}">${t.w}</span>`).join(' '); }

  // ---- NATO for Iceman tail grading only ----
  const NATO={A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
  const toNatoTail = t => t.toUpperCase().split('').map(ch=>NATO[ch]||ch).join(' ');
  function prepareExpectedForScenario(scn){
    (scn.steps||[]).forEach(st=>{
      const base=String(st.text||st.phraseId||'');
      st._displayLine = base; // what we show
      st._expectedForGrade = (st.role==='Iceman')
        ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m=>toNatoTail(m))
        : base;
    });
  }

  // ---- State ----
  let SCENARIOS=[], current=null, stepIndex=-1, running=false, pauseFlag=false;
  let stepScores=[], perStep=[], recActive=null;

  // ---- Employee ID gate ----
  function getEmployeeId(){ return localStorage.getItem(EMP_ID_KEY)||''; }
  function setEmployeeId(id){ localStorage.setItem(EMP_ID_KEY,id); }
  function openEmp(){ $('empIdModal')?.classList.remove('hidden'); }
  function closeEmp(){ $('empIdModal')?.classList.add('hidden'); }
  function ensureEmpGate(){
    const badge=$('empIdBadge'), input=$('empIdInput'), save=$('empIdSave'), cancel=$('empIdCancel');
    const have=getEmployeeId();
    if(!have){ openEmp(); } else { closeEmp(); setText(badge,'ID: '+have); }
    save.onclick=()=>{ const v=(input.value||'').trim(); if(v.length<3){ setText($('empIdMsg'),'Enter valid ID'); return; }
      setEmployeeId(v); setText(badge,'ID: '+v); setText($('empIdMsg'),''); closeEmp(); };
    cancel.onclick=()=> setText($('empIdMsg'),'Employee ID is required.');
    $('changeIdBtn').onclick=openEmp;
  }

  // ---- Scenarios load (auto-select first) ----
  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    try{
      const r=await fetch('scenarios.json?'+Date.now(), {cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const data=await r.json();
      if(!Array.isArray(data)) throw new Error('Invalid JSON (array expected).');
      SCENARIOS=data;
      sel.innerHTML = '<option value="">— select —</option>' + data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
      setText(desc,'Select a scenario to begin.');

      // Auto-select first scenario
      if (data.length>0) {
        sel.value = data[0].id;
        sel.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }catch(e){
      sel.innerHTML='<option value="">(load failed)</option>';
      setText(desc,'Could not load scenarios.json');
      statusErr('scenarios.json failed to load: ' + (e.message||e));
    }
  }

  // ---- Render active step only ----
  function renderActiveStep(){
    const card=$('stepsCard'), box=$('stepsBox');
    if(!current || stepIndex<0 || stepIndex>=(current.steps?.length||0)){
      card?.classList.add('hidden'); return;
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
    $('expLine').textContent = st._displayLine || st.text || '';
    $('heardLine').textContent = '';
    setText($('wordStats'),'');
  }

  // ---- Safari audio unlock ----
  let audioUnlocked=false;
  async function unlockAudio(){
    if(audioUnlocked) return true;
    try{
      const a=$('captainAudio');
      if(a){ a.muted=true; await a.play().catch(()=>{}); a.pause(); a.currentTime=0; }
    }catch{}
    // WebAudio tick (extra safety)
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(Ctx){ const ctx=new Ctx(); await ctx.resume(); const osc=ctx.createOscillator(); const g=ctx.createGain(); g.gain.value=0; osc.connect(g).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+0.01); }
    }catch{}
    audioUnlocked=true; return true;
  }

  // ---- Captain audio (reliable playback w/ unmute) ----
  function playCaptainAudio(src){
    const a=$('captainAudio'); if(!a||!src) return Promise.resolve();
    const url = src.startsWith('http') ? src : `audio/${src}`;
    return new Promise(resolve=>{
      let settled=false, to=null;
      const cleanup=()=>{ a.onended=a.onerror=a.oncanplay=a.onloadedmetadata=null; if(to) clearTimeout(to); };
      try{ a.pause(); a.currentTime=0; }catch{}
      a.src=url;
      a.onloadedmetadata=()=>{ const dur=isFinite(a.duration)&&a.duration>0 ? a.duration*1000+800 : 10000; to=setTimeout(()=>{ cleanup(); if(!settled){ settled=true; resolve(); } }, Math.min(dur,12000)); };
      a.oncanplay=()=>{ a.muted=false; const p=a.play(); if(p&&p.catch){ p.catch(()=>{ cleanup(); if(!settled){ settled=true; resolve(); } }); } statusOk('Playing Captain line…'); };
      a.onended=()=>{ cleanup(); if(!settled){ settled=true; resolve(); } };
      a.onerror =()=>{ cleanup(); if(!settled){ settled=true; resolve(); } };
    });
  }
  function stopCaptainAudio(){ try{ $('captainAudio')?.pause(); }catch{} }

  // ---- Listen (single-recognizer loop per step, ends on silence/max) ----
  async function listenStep({minMs=MIN_LISTEN_MS,maxMs=MAX_LISTEN_MS,silenceMs=SILENCE_MS}={}){
    return new Promise(resolve=>{
      const R=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!R){ statusErr('SpeechRecognition unavailable (use Safari iOS).'); resolve({final:'',interim:'',ended:'nosr'}); return; }
      let finalText='', interimText='', started=Date.now(), lastAct=started, stopped=false;
      const live = throttle(t=> setText($('liveInline'), t||'(listening…)'), 80);

      const shouldStop=()=>{ const now=Date.now(), elapsed=now-started, idle=now-lastAct;
        if(elapsed<minMs) return false; if(idle>=silenceMs) return true; if(elapsed>=maxMs) return true; return false; };

      const startOne=()=>{
        if(stopped) return;
        const rec=new R(); rec.lang='en-US'; rec.continuous=false; rec.interimResults=true; rec.maxAlternatives=1; recActive=rec;
        rec.onresult=ev=>{
          let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const tr=ev.results[i][0]?.transcript||''; if(ev.results[i].isFinal){ finalText+=' '+tr; lastAct=Date.now(); } else interim+=' '+tr; }
          interimText=interim.trim(); live((finalText+' '+interimText).trim()); $('heardLine').textContent=(finalText+' '+interimText).trim();
        };
        rec.onerror =()=>{ if(shouldStop()) endAll('error'); else restart(); };
        rec.onend   =()=>{ if(shouldStop()) endAll('end');   else restart(); };
        try{ rec.start(); statusOk('Listening…'); live('(listening…)'); }catch{ if(shouldStop()) endAll('startfail'); else restart(); }
      };
      const restart =()=> setTimeout(()=>{ if(!stopped) startOne(); }, 120);
      const endAll  =(reason)=>{ stopped=true; try{ recActive && recActive.abort && recActive.abort(); }catch{}; resolve({final:finalText.trim(),interim:interimText.trim(),ended:reason}); };
      const guard=setInterval(()=>{ if(stopped) return clearInterval(guard);
        if(pauseFlag||!running){ clearInterval(guard); endAll('paused'); }
        else if(shouldStop()){ clearInterval(guard); endAll('ok'); }
      },100);
      startOne();
    });
  }

  // ---- Simulator ----
  async function runSimulator(){
    if(!current){ statusOk('Select a scenario first.'); return; }
    // Pre-warm mic permission (non-blocking)
    try{ await navigator.mediaDevices.getUserMedia({audio:true}); }catch{}
    try{ speechSynthesis.cancel(); }catch{}

    running=true; pauseFlag=false; stepIndex=0; stepScores=[]; perStep=[];
    setScorePct(0); setText($('liveInline'),'(waiting…)'); statusOk('Running…'); renderActiveStep();

    const steps=current.steps||[];
    for(let i=0;i<steps.length;i++){
      if(!running || pauseFlag) break;
      stepIndex=i; renderActiveStep();
      const st=steps[i];

      if(st.role==='Captain'){
        await playCaptainAudio(st.audio||st.audioUrl||'');
        if(!running || pauseFlag) break;
        await wait(CAPTAIN_DELAY_MS);
      }else{
        const {final,interim}=await listenStep(); const heard=(final||interim||'').trim();
        const expectedGrade = st._expectedForGrade || (st.text||'');
        const expectedShow  = st._displayLine || (st.text||'');
        const score = wordScore(expectedGrade, heard);
        stepScores.push(score); perStep.push({i:i+1, role:st.role, prompt:st.prompt||'', heard, score});

        const {expToks,extraToks,expCount,hitCount}=diffWords(expectedShow, heard);
        renderToks($('expLine'), expToks);
        renderToks($('heardLine'), extraToks.length ? extraToks : [{w:heard||'—',cls:heard?'ok':'miss'}]);
        setText($('wordStats'), `${hitCount}/${expCount} expected words matched • Step score ${score}%`);

        const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
        setScorePct(avg);
        statusOk(heard ? `Heard: "${heard}"` : 'No speech detected.');
        setText($('liveInline'), heard || '(listening done)');
      }
    }

    if(running && !pauseFlag){
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
      setScorePct(finalScore); showResults(finalScore);
      statusOk(`Scenario complete. Final score: ${finalScore}%`);
      running=false;
    }
  }

  function showResults(finalScore){
    const card=$('resultsCard'), list=$('resultsList'), total=$('finalScore');
    if(!card||!list||!total) return;
    total.textContent = String(finalScore) + '%';
    list.innerHTML = perStep.map(s=>`<li><strong>Step ${s.i}</strong> • ${s.role||''} • <span class="status">${s.prompt||''}</span><br><span>${(s.heard||'—').replace(/</g,'&lt;')}</span> — <strong>${s.score}%</strong></li>`).join('');
    card.classList.remove('hidden');
  }

  function pauseSimulator(){
    if(!running){ statusOk('Idle'); return; }
    pauseFlag=true; running=false;
    try{ recActive && recActive.abort && recActive.abort(); }catch{}
    try{ $('captainAudio')?.pause(); }catch{}
    statusOk('Paused');
  }

  // ---- Wire UI ----
  document.addEventListener('DOMContentLoaded', ()=>{
    // Gate + scenarios
    ensureEmpGate();
    loadScenarios();

    $('reloadScenarios')?.addEventListener('click', loadScenarios);
    $('scenarioSelect')?.addEventListener('change', (e)=>{
      const id=e.target.value;
      current = SCENARIOS.find(s=>s.id===id) || null;
      if(current) prepareExpectedForScenario(current);
      stepIndex=-1; renderActiveStep();
      setText($('desc'), current ? (current.desc||'') : 'Select a scenario to begin.');
      setText($('liveInline'),'(waiting…)'); setScorePct(0);
      $('resultsCard')?.classList.add('hidden');
      statusOk(current ? 'Scenario loaded.' : 'Idle');
    });

    $('startBtn')?.addEventListener('click', async ()=>{
      if(running){ statusOk('Already running…'); return; }
      if(!current){ statusOk('Select a scenario first.'); return; }
      await unlockAudio(); // important for iOS
      $('resultsCard')?.classList.add('hidden');
      runSimulator().catch(e=>statusErr(e?.message||e));
    });

    $('pauseBtn')?.addEventListener('click', pauseSimulator);
  });
})();