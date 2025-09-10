// ================= De-Ice Trainer — Efficient Simulator Core =================
(function () {
  // ---------- Config ----------
  const WRITE_TOKEN = 'wR1te_Train3r_XyZ_90210'; // kept for compatibility if you log later
  const EMP_ID_KEY = 'trainer.employeeId';

  // Timings (activity-based listening)
  const MIN_LISTEN_MS = 1500;  // always listen at least this long
  const MAX_LISTEN_MS = 6000;  // hard cap per Iceman step
  const SILENCE_MS    = 1200;  // end early if this long without activity
  const CAPTAIN_DELAY_MS = 400; // small settle gap after captain audio

  // ---------- DOM helpers ----------
  const $ = id => document.getElementById(id);
  const setText = (el, t) => { if (el) el.textContent = t; };
  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Scoring (word overlap) ----------
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  function wordScore(expected, said) {
    const e = new Set(norm(expected).split(' ').filter(Boolean));
    const s = new Set(norm(said).split(' ').filter(Boolean));
    if (!e.size) return 0;
    let hit = 0; e.forEach(w => { if (s.has(w)) hit++; });
    return Math.round((hit / e.size) * 100);
  }
  function setScorePct(p) {
    p = clamp(parseInt(p || 0, 10), 0, 100);
    setText($('scorePct'), p + '%');
    if ($('scoreBar')) $('scoreBar').style.width = p + '%';
  }

  // ---------- Phonetic handling for Iceman tails (grade by NATO, display tail) ----------
  const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
  const toNato = ch => NATO[ch] || ch;
  function toNatoTail(s){ return s.toUpperCase().split('').map(toNato).join(' '); }
  function prepareExpectedForScenario(scn){
    (scn.steps||[]).forEach(st=>{
      const base = String(st.text || st.phraseId || '');
      st._expectedForGrade = (st.role === 'Iceman')
        ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, t => toNatoTail(t))
        : base;
    });
  }

  // ---------- State ----------
  let SCENARIOS = [];
  let current = null;
  let stepIndex = -1;
  let running = false;
  let pauseFlag = false;
  let recActive = null;
  let stepScores = [];
  let startedAt = 0;

  // ---------- Employee ID gate ----------
  function getEmployeeId(){ return sessionStorage.getItem(EMP_ID_KEY) || localStorage.getItem(EMP_ID_KEY) || ''; }
  function setEmployeeId(id){ try{ sessionStorage.setItem(EMP_ID_KEY,id); localStorage.setItem(EMP_ID_KEY,id);}catch{} }
  function openEmp(){ $('empIdModal')?.classList.remove('hidden'); }
  function closeEmp(){ $('empIdModal')?.classList.add('hidden'); }
  function ensureEmpGate(){
    const badge=$('empIdBadge'), input=$('empIdInput'), save=$('empIdSave'), cancel=$('empIdCancel');
    const have = getEmployeeId();
    if(!have){ openEmp(); } else { closeEmp(); setText(badge,'ID: '+have); }
    if(save) save.onclick = ()=>{
      const v=(input?.value||'').trim();
      if(!/^[A-Za-z0-9_-]{3,}$/.test(v)){ setText($('empIdMsg'),'Enter a valid ID (min 3 chars).'); return; }
      setEmployeeId(v); setText(badge,'ID: '+v); setText($('empIdMsg'), ''); closeEmp();
    };
    if(cancel) cancel.onclick = ()=> setText($('empIdMsg'),'Employee ID is required.');
    $('changeIdBtn')?.addEventListener('click', openEmp);
  }

  // ---------- Scenario loading ----------
  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    if (sel) sel.innerHTML = '<option value="">— loading —</option>';
    try{
      const r = await fetch('/scenarios.json?v='+Date.now(), {cache:'no-store'});
      const data = await r.json();
      if(!Array.isArray(data)) throw new Error('Invalid scenarios.json');
      SCENARIOS = data;
      if (sel) sel.innerHTML = '<option value="">— select —</option>'+data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
      setText(desc, 'Select a scenario to begin.');
    }catch(e){
      if (sel) sel.innerHTML = '<option value="">(load failed)</option>';
      setText(desc, 'Could not load scenarios.json');
    }
  }

  // ---------- Render current step only ----------
  function renderActiveStep(){
    const card=$('stepsCard'), box=$('stepsBox');
    if(!current || stepIndex<0 || stepIndex>=(current.steps?.length||0)){
      card?.classList.add('hidden'); if (box) setText(box,'—'); return;
    }
    card?.classList.remove('hidden');
    const st = current.steps[stepIndex];
    const txt = (st.text || st.phraseId || '').replace(/</g,'&lt;');
    if (box) box.innerHTML = `
      <div style="padding:8px;border:1px solid #1f6feb;border-radius:10px;background:#0f1424">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <strong>Step ${stepIndex+1} • ${st.role||''}</strong>
          <span class="status">${st.prompt||''}</span>
        </div>
        <div style="margin-top:6px">${txt}</div>
      </div>`;
  }

  // ---------- Captain audio with root fallback ----------
  function playCaptainAudio(src){
    const a=$('captainAudio'); if(!a || !src) return Promise.resolve();
    const tryPaths=[`/audio/${src}`, `/${src}`];
    return new Promise(async(resolve)=>{
      for(const p of tryPaths){
        try{
          const head = await fetch(p,{method:'HEAD',cache:'no-store'});
          if(head.ok){ try{ a.pause(); a.currentTime=0; }catch{} a.src=p; a.onended=resolve;
            const pr=a.play(); if(pr && pr.catch) pr.catch(()=>resolve());
            setText($('liveInline'), '(captain audio)'); setText($('status'),'Playing Captain line…'); return;
          }
        }catch{}
      }
      setText($('status'), `Audio not found: ${src}`); resolve();
    });
  }
  function stopCaptainAudio(){ try{ $('captainAudio')?.pause(); }catch{} }

  // ---------- Throttle helper for live updates ----------
  function throttle(fn, ms){ let t=0; return (...a)=>{ const n=Date.now(); if(n-t>=ms){ t=n; fn(...a); } }; }

  // ---------- Single-run listener per step (activity-based) ----------
  async function listenStep({minMs=MIN_LISTEN_MS, maxMs=MAX_LISTEN_MS, silenceMs=SILENCE_MS}={}){
    return new Promise((resolve)=>{
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!R){ resolve({final:'',interim:'',ended:'nosr'}); return; }
      const rec=new R();
      rec.lang='en-US'; rec.continuous=false; rec.interimResults=true; rec.maxAlternatives=1;

      let started=Date.now(); let lastAct=started; let finalText=''; let interimText='';
      const live = throttle((t)=> setText($('liveInline'), t || '(listening…)'), 80);
      const endAll=(reason='end')=>{ try{ rec.onresult=rec.onerror=rec.onend=null; rec.stop(); }catch{} resolve({final:finalText.trim(), interim:interimText.trim(), ended:reason}); };

      rec.onresult=(ev)=>{
        let interim=''; 
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const tr = ev.results[i][0]?.transcript || '';
          if(ev.results[i].isFinal){ finalText += ' ' + tr; lastAct = Date.now(); }
          else { interim += ' ' + tr; }
        }
        interimText = interim.trim();
        live(interimText);
      };
      rec.onerror = ()=> endAll('error');
      rec.onend   = ()=> endAll('ended');

      const tick = setInterval(()=>{
        const now=Date.now(); const elapsed=now-started; const sinceAct=now-lastAct;
        if(pauseFlag || !running){ clearInterval(tick); endAll('paused'); return; }
        if(elapsed < minMs) return;
        if(sinceAct >= silenceMs){ clearInterval(tick); endAll('silence'); return; }
        if(elapsed >= maxMs){ clearInterval(tick); endAll('max'); return; }
      }, 100);

      try{
        rec.start(); recActive = rec;
        setText($('status'),'Listening…');
        setText($('liveInline'), '(listening…)');
      }catch{
        clearInterval(tick);
        endAll('start-failed');
      }
    });
  }

  // ---------- Simulator loop ----------
  async function runSimulator(){
    if(!current){ setText($('status'),'Select a scenario first.'); return; }

    // Pre-warm mic (improves first-start on iOS); ignore errors on desktop
    try{ await navigator.mediaDevices.getUserMedia({audio:true}); }catch{}
    try{ speechSynthesis.cancel(); }catch{}

    running = true; pauseFlag = false; stepIndex = 0; stepScores = []; setScorePct(0);
    setText($('status'),'Running…'); setText($('liveInline'), '(waiting…)');
    renderActiveStep(); startedAt = Date.now();

    const steps = current.steps || [];
    for(let i=0;i<steps.length;i++){
      if(!running || pauseFlag) break;
      stepIndex = i; renderActiveStep();
      const st = steps[i];

      if (st.role === 'Captain') {
        await playCaptainAudio(st.audio || st.audioUrl || '');
        if(!running || pauseFlag) break;
        await wait(CAPTAIN_DELAY_MS);
      } else {
        try{
          const { final, interim } = await listenStep();
          const heard = final || interim || '';
          const expected = st._expectedForGrade || (st.text || '');
          const score = wordScore(expected, heard);
          stepScores.push(score);
          const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
          setScorePct(avg);
          setText($('status'), heard ? `Heard: "${heard}"` : 'No speech detected.');
          setText($('liveInline'), heard || '(listening done)');
        }catch(e){
          stepScores.push(0);
          setText($('status'), 'Mic error: ' + (e?.message || e));
        }
      }
    }

    if (running && !pauseFlag) {
      const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
      setScorePct(finalScore);
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

  // ---------- Optional cloud log (kept; not auto-called here) ----------
  async function logTrainingCloud({ empId, scenarioId, scenarioLabel, outcome='completed', score='', durationSec='' }){
    try{
      if(!empId || empId.trim().length<3) return false;
      const resp = await fetch('/api/logs-write', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-write-token': WRITE_TOKEN },
        body: JSON.stringify({ emp_id: empId, scenario_id: scenarioId||'', scenario_label: scenarioLabel||'', outcome, score, duration_sec: durationSec||null })
      });
      return resp.ok;
    }catch{ return false; }
  }

  // ---------- Wire UI ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureEmpGate();
    loadScenarios();

    $('reloadScenarios')?.addEventListener('click', loadScenarios);

    $('scenarioSelect')?.addEventListener('change', (e)=>{
      const id = e.target.value;
      current = SCENARIOS.find(s=>s.id===id) || null;
      if(current) prepareExpectedForScenario(current);
      stepIndex = -1;
      renderActiveStep();
      setText($('desc'), current ? (current.desc || '') : 'Select a scenario to begin.');
      setText($('status'),'Idle'); setText($('liveInline'), '(waiting…)'); setScorePct(0);
    });

    $('startBtn')?.addEventListener('click', ()=>{
      if(running){ setText($('status'),'Already running…'); return; }
      if(!current){ setText($('status'),'Select a scenario first.'); return; }
      runSimulator().catch(()=>{});
    });

    $('pauseBtn')?.addEventListener('click', pauseSimulator);
  });
})();