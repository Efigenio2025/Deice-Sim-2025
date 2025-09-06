// trainer-sim.js
(function(){
  // ===== constants =====
  const WRITE_TOKEN = 'wR1te_Train3r_XyZ_90210'; // your write token
  const EMP_ID_KEY  = 'trainer.employeeId';
  const STEP_TIMEOUT_MS = 5000;       // 5s listen per Iceman step
  const CAPTAIN_POST_DELAY_MS = 600;  // pause after Captain audio

  // ===== dom helpers =====
  const $ = id => document.getElementById(id);
  const setText = (el, t)=>{ if(el) el.textContent = t; };
  const wait = (ms)=> new Promise(res=> setTimeout(res, ms));
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  function getParam(name){ const v = new URLSearchParams(location.search).get(name); return v===null? null : String(v); }

  // ===== scoring =====
  function wordScore(expected, said){
    const e = new Set(norm(expected).split(' ').filter(Boolean));
    const s = new Set(norm(said).split(' ').filter(Boolean));
    if(e.size===0) return 0;
    let hit=0; e.forEach(w=>{ if(s.has(w)) hit++; });
    return Math.round((hit / e.size) * 100);
  }
  function setScore(pct){
    pct = Math.max(0, Math.min(100, pct|0));
    setText($('scorePct'), pct + '%');
    const bar = $('scoreBar'); if (bar) bar.style.width = pct + '%';
  }

  // ===== NATO phonetics (grade Iceman by phonetic tail only) =====
  const NATO = {
    A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',
    K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',
    U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu',
    '0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'
  };
  function tailToPhonetic(tail){
    const m = String(tail||'').toUpperCase().match(/\bN[0-9A-Z]{3,}\b/);
    if (!m) return null;
    return m[0].split('').map(ch => NATO[ch] || ch).join(' ');
  }
  function expectedForGrading(step){
    let exp = String(step?.text || step?.phraseId || '');
    if (step?.role === 'Iceman') {
      exp = exp.replace(/\bN[0-9A-Z]{3,}\b/gi, t => tailToPhonetic(t) || t);
    }
    return exp;
  }

  // ===== transcript / diff =====
  function tokens(s){ return norm(s).split(' ').filter(Boolean); }
  function buildHighlights(expected, heard){
    const eT=tokens(expected), hT=tokens(heard);
    const eSet=new Set(eT), hSet=new Set(hT);
    const expHTML = eT.map(w=>`<span class="tok ${hSet.has(w)?'ok':'miss'}">${w}</span>`).join(' ');
    const heardHTML= hT.map(w=>`<span class="tok ${eSet.has(w)?'ok':'extra'}">${w}</span>`).join(' ');
    return { expHTML, heardHTML };
  }
  function gradeDetails(expected, heard){
    const eSet=new Set(tokens(expected)), hSet=new Set(tokens(heard));
    const matched=[...eSet].filter(w=>hSet.has(w)).length;
    return { matchedCount: matched, total: eSet.size };
  }
  function renderTranscript(expected, heard, pct){
    const expLine=$('expLine'), heardLine=$('heardLine'), stats=$('wordStats');
    if(!expLine||!heardLine||!stats) return;
    const {expHTML, heardHTML} = buildHighlights(expected, heard);
    const {matchedCount, total} = gradeDetails(expected, heard);
    expLine.innerHTML=expHTML; heardLine.innerHTML=heardHTML;
    stats.textContent = `Matched ${matchedCount}/${total} • Score ${pct}%`;
  }
  function primeTranscriptForStep(st){
    const expLine=$('expLine'), heardLine=$('heardLine'), stats=$('wordStats'), live=$('liveBox');
    if(st?.role==='Iceman'){
      const expected=expectedForGrading(st);
      if(expLine) expLine.innerHTML = expected.split(' ').map(w=>`<span class="tok miss">${w}</span>`).join(' ');
      if(heardLine) heardLine.innerHTML='—';
      if(live) live.textContent='(waiting…)';
      if(stats) stats.textContent='Waiting for input…';
    }else{
      if(expLine) expLine.textContent='—';
      if(heardLine) heardLine.textContent='—';
      if(live) live.textContent='(captain audio)';
      if(stats) stats.textContent='Captain step (no grading)';
    }
  }

  // ===== Employee ID gate =====
  function getEmployeeId(){ return sessionStorage.getItem(EMP_ID_KEY) || localStorage.getItem(EMP_ID_KEY) || ''; }
  function setEmployeeId(id){ try{ sessionStorage.setItem(EMP_ID_KEY,id); localStorage.setItem(EMP_ID_KEY,id);}catch{} }
  function ensureEmpGate(){
    const modal=$('empIdModal'), input=$('empIdInput'),
          save=$('empIdSave'), cancel=$('empIdCancel'),
          msg=$('empIdMsg'), badge=$('empIdBadge'),
          changeBtn=$('changeIdBtn'); // optional; only if you added it in HTML

    function open(){
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      setTimeout(()=> input && input.focus(), 40);
    }
    function close(){
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }

    // Optional one-time reset via URL: ?reset=1
    if (getParam('reset') === '1') {
      try { sessionStorage.removeItem(EMP_ID_KEY); localStorage.removeItem(EMP_ID_KEY); } catch {}
    }

    const existing = (getEmployeeId() || '').trim();
    if (!/^[A-Za-z0-9_-]{3,}$/.test(existing)) { open(); }
    else { setText(badge,'ID: '+existing); close(); }

    if (save) save.onclick = ()=>{
      const v=(input?.value||'').trim();
      if(!/^[A-Za-z0-9_-]{3,}$/.test(v)){ setText(msg,'Enter a valid ID (min 3 chars).'); return; }
      setEmployeeId(v); setText(badge,'ID: '+v); setText(msg,''); close();
    };
    if (cancel) cancel.onclick = ()=>{ setText(msg,'Employee ID is required to proceed.'); };

    if (changeBtn) {
      changeBtn.onclick = ()=>{
        try { sessionStorage.removeItem(EMP_ID_KEY); localStorage.removeItem(EMP_ID_KEY); } catch {}
        if (input) input.value=''; setText(msg,''); open();
      };
    }
  }

  // ===== Scenarios =====
  const SCENARIOS=[]; let current=null; let stepIndex=0; let startTs=0; let stopFlag=false;

  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    sel.innerHTML='<option value="">— loading —</option>';
    const tried=[], urls=[ `/scenarios.json?v=${Date.now()}`, `./scenarios.json?v=${Date.now()}` ];
    let data=null, lastErr='';

    for (const u of urls){
      try{
        tried.push(u);
        const r = await fetch(u, { cache:'no-store' });
        if(!r.ok){ lastErr = `HTTP ${r.status} ${r.statusText}`; continue; }
        const txt = await r.text();
        try{
          const parsed = JSON.parse(txt);
          if(!Array.isArray(parsed)) throw new Error('JSON is not an array');
          data = parsed; break;
        }catch(je){ lastErr = `JSON parse error: ${je.message}`; continue; }
      }catch(e){ lastErr = `Fetch error: ${e.message||e}`; continue; }
    }

    if(!data){
      sel.innerHTML='<option value="">(load failed)</option>';
      setText(desc, `Could not load scenarios.json. Last error: ${lastErr}. Tried: ${tried.join(' , ')}`);
      return;
    }

    SCENARIOS.splice(0, SCENARIOS.length, ...data);
    sel.innerHTML = '<option value="">— select —</option>' + data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
    setText(desc,'Select a scenario to begin.');
  }

  function renderSteps(){
    const box=$('stepsBox');
    if(!current){ setText(box,'—'); return; }
    const steps=current.steps||[];
    box.innerHTML = steps.map((s,i)=>{
      const active = i===stepIndex;
      const txt = String(s.text||s.phraseId||'');
      return `<div style="padding:8px;border:1px solid ${active?'#1f6feb':'#1e2230'};border-radius:10px;margin:6px 0;background:${active?'#0f1424':'#141822'}">
        <div style="display:flex;justify-content:space-between;align-items:center"><strong>Step ${i+1} • ${s.role||''}</strong><span class="status">${s.prompt||''}</span></div>
        <div style="margin-top:6px">${txt.replace(/</g,'&lt;')}</div>
      </div>`;
    }).join('');
  }
  function renderStepsAndPrime(){ renderSteps(); const st = current?.steps?.[stepIndex]; primeTranscriptForStep(st); }

  // ===== Captain audio =====
  function playCaptainAudio(src){
    const audio = $('captainAudio'); if(!audio) return;
    try{
      audio.pause(); audio.currentTime=0;
      audio.src = (/^https?:\/\//i.test(src)) ? src : `/audio/${src}`;
      const p = audio.play();
      if(p&&p.catch) p.catch(err=> setText($('status'),'Audio failed: '+(err?.message||err)));
    }catch(e){ setText($('status'),'Audio error: '+(e?.message||e)); }
  }
  function stopCaptainAudio(){ const a=$('captainAudio'); try{ a.pause(); }catch{} }

  // ===== Speech Recognition (iOS Safari) with streaming =====
  function hasSTT(){ return !!(window.webkitSpeechRecognition || window.SpeechRecognition); }
  function makeRecognizer(){
    const R = window.webkitSpeechRecognition || window.SpeechRecognition;
    if(!R) return null;
    const rec = new R();
    rec.lang='en-US';
    rec.continuous=false;    // single window; we restart as needed
    rec.interimResults=true; // STREAMING partials
    rec.maxAlternatives=1;
    return rec;
  }

  // Stream listen for up to windowMs; update live box; return best final text/score
  async function listenWindowStream(step, windowMs){
    return new Promise((resolve) => {
      const rec = makeRecognizer();
      const statusEl = $('status');
      const liveEl   = $('liveBox');
      if(!rec){
        if(statusEl) statusEl.textContent='Mic not supported. Use Safari on iOS.';
        return resolve({ score:0, heard:'' });
      }

      const expected = expectedForGrading(step);
      let finalText='', interimText='', bestScore=0, bestHeard='';
      const deadline = Date.now() + (windowMs || STEP_TIMEOUT_MS);
      let ended=false;

      function pushLive(){
        const show = (finalText + (interimText? ' '+interimText : '')).trim();
        if(liveEl) liveEl.textContent = show || '…';
        const liveScore = wordScore(expected, show);
        setScore(liveScore);
      }

      rec.onresult = (ev)=>{
        interimText='';
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const res = ev.results[i];
          if(res.isFinal){ finalText += (finalText?' ':'') + (res[0].transcript||''); }
          else{ interimText += (res[0].transcript||''); }
        }
        pushLive();
        const sNow = wordScore(expected, finalText);
        if(sNow > bestScore){ bestScore=sNow; bestHeard=finalText; }
        if(Date.now() >= deadline && !ended){ ended=true; try{ rec.stop(); }catch{} }
      };
      rec.onerror = (e)=>{
        if(statusEl) statusEl.textContent = `Mic error: ${e.error||e}`;
        resolve({ score:bestScore, heard:bestHeard });
      };
      rec.onend = ()=>{
        if(ended){
          const heard = finalText || bestHeard || '';
          const score = wordScore(expected, heard);
          renderTranscript(expected, heard, score);
          return resolve({ score, heard });
        }
        if(Date.now() < deadline){ try{ rec.start(); }catch{} }
        else{
          const heard = finalText || bestHeard || '';
          const score = wordScore(expected, heard);
          renderTranscript(expected, heard, score);
          resolve({ score, heard });
        }
      };

      try{
        if(statusEl) statusEl.textContent='Listening…';
        rec.start();
        setTimeout(()=>{ if(!ended){ ended=true; try{ rec.stop(); }catch{} } }, windowMs||STEP_TIMEOUT_MS);
      }catch(err){
        if(statusEl) statusEl.textContent = `Mic start failed: ${err.message||err}`;
        resolve({ score:0, heard:'' });
      }
    });
  }

  // ===== Cloud logging =====
  async function logTrainingCloud({ empId, scenarioId, scenarioLabel, outcome='completed', score='', durationSec='' }){
    const statusEl = $('status');
    try{
      if(!empId || empId.trim().length<3){ statusEl.textContent='Cloud log blocked: Employee ID missing.'; return false; }
      const resp = await fetch('/api/logs-write', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-write-token': WRITE_TOKEN },
        body: JSON.stringify({ emp_id: empId, scenario_id: scenarioId||'', scenario_label: scenarioLabel||'', outcome, score, duration_sec: durationSec||null })
      });
      if(!resp.ok){
        const body=await resp.text().catch(()=> '');
        statusEl.textContent=`Cloud log failed • ${resp.status} ${resp.statusText} • ${body}`;
        return false;
      }
      statusEl.textContent='Logged to cloud ✓';
      return true;
    }catch(e){
      statusEl.textContent=`Cloud log error • ${e?.message||e}`;
      return false;
    }
  }

  // ===== Simulator =====
  async function playCaptainAndAwait(st){
    const audioSrc = st.audio || st.audioUrl || null;
    if(!audioSrc){ await wait(CAPTAIN_POST_DELAY_MS); return; }
    return new Promise((resolve)=>{
      const a=$('captainAudio');
      try{
        a.pause(); a.currentTime=0;
        a.src=(/^https?:\/\//i.test(audioSrc))? audioSrc : `/audio/${audioSrc}`;
        a.onended=()=> resolve();
        const p=a.play();
        setText($('status'),'Playing Captain line…');
        if(p&&p.catch) p.catch(()=> resolve());
      }catch{ resolve(); }
    });
  }

  async function runSimulator(){
    if(!current) return;
    const steps = current?.steps || [];
    if(!steps.length) return;

    stopFlag=false; startTs=Date.now();
    stepIndex=0; setScore(0); renderSteps();
    $('nextBtn').disabled = true; $('speakBtn').disabled = true; $('listenBtn').disabled = false; $('finishBtn').disabled = false;
    setText($('status'),'Simulator running…');

    let icemanCount=0, scoreSum=0;

    for(let i=0;i<steps.length && !stopFlag;i++){
      stepIndex=i; renderSteps();
      const st = steps[i];
      primeTranscriptForStep(st);

      if(st.role === 'Captain'){
        await playCaptainAndAwait(st);
        await wait(CAPTAIN_POST_DELAY_MS);
      }else{
        const { score } = await listenWindowStream(st, STEP_TIMEOUT_MS);
        icemanCount++; scoreSum += (isFinite(score)? score : 0);
      }
    }

    const finalScore = icemanCount ? Math.round(scoreSum / icemanCount) : 0;
    setScore(finalScore);
    setText($('status'), `Scenario complete • Final score: ${finalScore}%`);

    const duration = Math.round((Date.now() - startTs)/1000) || '';
    await logTrainingCloud({
      empId: getEmployeeId(),
      scenarioId: current.id || '',
      scenarioLabel: current.label || '',
      outcome: 'completed',
      score: String(finalScore),
      durationSec: duration
    });

    $('startBtn').disabled=false; $('finishBtn').disabled=true;
  }

  // ===== Wire UI =====
  function resetControlsToIdle(){
    $('startBtn').disabled = !current;
    $('nextBtn').disabled=true; $('finishBtn').disabled=true;
    $('speakBtn').disabled=true; $('listenBtn').disabled=true;
    setText($('status'),'Idle'); setScore(0); stopCaptainAudio();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    ensureEmpGate();
    loadScenarios();

    $('reloadScenarios').onclick = loadScenarios;

    $('scenarioSelect').onchange = (e)=>{
      const id=e.target.value;
      current = SCENARIOS.find(s=>s.id===id)||null;
      setText($('desc'), current?(current.desc||''):'Select a scenario to begin.');
      stepIndex=0; renderStepsAndPrime();
      resetControlsToIdle();
    };

    $('startBtn').onclick = ()=>{
      if(!current) return;
      runSimulator().catch(()=>{});
      $('speakBtn').disabled = false;  // allow manual Captain playback
      $('listenBtn').disabled = false; // manual mic if needed
      $('listenBtn').onclick = async ()=>{
        const st = current?.steps?.[stepIndex];
        if(!st || st.role !== 'Iceman'){ setText($('status'),'Not an Iceman step.'); return; }
        await listenWindowStream(st, STEP_TIMEOUT_MS);
      };
    };

    $('speakBtn').onclick=()=>{
      const st=current?.steps?.[stepIndex]; if(!st) return;
      const audioSrc = st.audio || st.audioUrl || null;
      if(audioSrc){ playCaptainAudio(audioSrc); setText($('status'),'Playing Captain line…'); }
      else { setText($('status'),'No audio file defined for this Captain line.'); }
    };

    $('nextBtn').onclick=()=>{ if(!current) return; const total=(current.steps||[]).length; if(total===0) return; stopCaptainAudio(); stepIndex=Math.min(stepIndex+1, total-1); renderStepsAndPrime(); setText($('status'),'Step '+(stepIndex+1)+' of '+total); };

    $('finishBtn').onclick=async()=>{ stopFlag=true; stopCaptainAudio(); if(!current) return;
      const duration = Math.round((Date.now()-startTs)/1000)||'';
      const score = parseInt(($('scorePct').textContent||'0'),10)||0;
      await logTrainingCloud({ empId:getEmployeeId(), scenarioId: current.id||'', scenarioLabel: current.label||'', outcome:'completed', score:String(score), durationSec:duration });
      $('nextBtn').disabled=true; $('finishBtn').disabled=true; $('speakBtn').disabled=true; $('listenBtn').disabled=true;
      setText($('status'),'Stopped.');
    };
  });
})();
