// ================= De-Ice Trainer — main-train.js (modules orchestrator) =================
import { prepareExpectedForScenario, wordScore, diffWords } from './sim/scoring.js';
import { listenStep } from './sim/speech.js';
import { $, setText, setStatus, setScorePct, renderActiveStep, renderLive, renderDiff, showResults } from './sim/ui.js';

// ---- constants / state ----
const EMP_ID_KEY = 'trainer.employeeId';
const CAPTAIN_DELAY_MS = 900;

let SCENARIOS = [];
let current = null;
let stepIndex = -1;
let running = false;
let paused  = false;
let stepScores = [];
let resultsByStep = [];
let recActive = null;

// ---- employee ID gate ----
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

// ---- safari audio unlock + mic permission (prompt immediately on Start) ----
let audioUnlocked=false;
async function unlockAudio(){
  if(audioUnlocked) return true;
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx){ const ctx=new Ctx(); await ctx.resume(); const osc=ctx.createOscillator(), g=ctx.createGain(); g.gain.value=0; osc.connect(g).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+0.01); }
  }catch{}
  try{ const a=$('captainAudio'); if(a){ a.muted=true; await a.play().catch(()=>{}); a.pause(); a.currentTime=0; } }catch{}
  audioUnlocked=true; return true;
}

async function ensureMicPermission(){
  try {
    if (navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'microphone' });
      if (p.state === 'denied') { setStatus('Microphone blocked. Enable in Settings for this site.'); throw new Error('mic-denied'); }
    }
  } catch {}
  try{
    setStatus('Requesting microphone permission…');
    const stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:false } });
    // close stream; SR uses a different pipeline
    stream.getTracks().forEach(t=>t.stop());
    setStatus('Microphone ready.');
    return true;
  }catch(e){
    setStatus('Microphone permission was not granted.');
    throw e;
  }
}

// ---- Captain audio helpers ----
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
      a.oncanplay=()=>{ a.muted=false; a.onended=()=>{ clean(); if(!settled){ settled=true; resolve(); } }; const p=a.play(); if(p&&p.catch){ p.catch(()=>{ clean(); if(!settled){ settled=true; resolve(); } }); } setText($('liveInline'),'(captain audio)'); setStatus('Playing Captain line…'); };
      a.onerror=()=>tryUrl(i+1);
    };
    tryUrl(0);
  });
}
function stopCaptainAudio(){ try{ $('captainAudio')?.pause(); }catch{} }

// ---- scenarios ----
async function loadScenarios(){
  const sel=$('scenarioSelect'), desc=$('desc');
  sel.innerHTML='<option value="">— loading —</option>';
  try{
    const r = await fetch(`/scenarios.json?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const data = await r.json();
    if(!Array.isArray(data)) throw new Error('bad schema');
    SCENARIOS=data;
    sel.innerHTML = data.map(s=>`<option value="${s.id}">${s.label||s.id}</option>`).join('');
    if(data.length){
      sel.value=data[0].id;
      sel.dispatchEvent(new Event('change'));
    }
    setText(desc,'Select a scenario to begin.');
  }catch(e){
    sel.innerHTML='<option value="">(load failed)</option>';
    setText(desc,'Could not load scenarios.json');
    console.error('scenarios.json load error:', e);
  }
}

// ---- render one active step ----
function showActive(){
  if(!current || stepIndex<0 || stepIndex>=(current.steps?.length||0)){
    renderActiveStep(0, null); return;
  }
  const st=current.steps[stepIndex];
  renderActiveStep(stepIndex, st);
}

// ---- main simulator (final scoring; no mid-step gating) ----
async function runSimulator(){
  if(!current){ setStatus('Select a scenario first.'); return; }
  try{ speechSynthesis.cancel(); }catch{}

  running=true; paused=false; stepIndex=0; stepScores=[]; resultsByStep=[];
  setScorePct(0); setStatus('Running…'); renderLive('(waiting…)');
  $('resultsCard')?.classList.add('hidden');

  const steps=current.steps||[];
  for(let i=0;i<steps.length;i++){
    if(!running || paused) break;
    stepIndex=i; showActive();
    const st = steps[i];

    if(st.role==='Captain'){
      await playCaptainAudio(st.audio||'');
      if(!running || paused) break;
      await new Promise(r=>setTimeout(r, CAPTAIN_DELAY_MS));
    }else{
      const { final, interim } = await listenStep(); // from speech.js
      const heard = (final || interim || '').trim();

      const expectedGrade  = st._expectedForGrade || (st.text||''); // NATO for Iceman (prepareExpectedForScenario)
      const expectedDisplay= st._displayLine || st.text || '';

      const score = wordScore(expectedGrade, heard); // from scoring.js
      stepScores.push(score);
      resultsByStep.push({ i:i+1, role:st.role, prompt:st.prompt||'', heard, score });

      const { expToks, extraToks, expCount, hitCount } = diffWords(expectedDisplay, heard); // from scoring.js
      renderDiff(expToks, extraToks, `${hitCount}/${expCount} expected words matched • Step score ${score}%`); // from ui.js

      const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
      setScorePct(avg);
      setStatus(heard ? `Heard: "${heard}"` : 'No speech detected.');
      renderLive(heard || '(listening done)');
    }
  }

  if(running && !paused){
    const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
    setScorePct(finalScore);
    showResults(finalScore, resultsByStep); // from ui.js
    setStatus(`Scenario complete. Final score: ${finalScore}%`);
    running=false;
  }
}

function pauseSimulator(){
  if(!running){ setStatus('Idle'); return; }
  paused=true; running=false;
  try{ recActive && recActive.abort && recActive.abort(); }catch{}
  stopCaptainAudio();
  setStatus('Paused');
}

// ---- UI wiring ----
function mountUI(){
  $('scenarioSelect')?.addEventListener('change', (e)=>{
    const id = e.target.value;
    current = SCENARIOS.find(s=>s.id===id) || null;
    if(current) prepareExpectedForScenario(current); // sets _displayLine + _expectedForGrade  ⟶ scoring.js
    stepIndex=-1; showActive();
    setText($('desc'), current ? (current.desc||'') : 'Select a scenario to begin.');
    setStatus('Idle'); renderLive('(waiting…)'); setScorePct(0);
    $('resultsCard')?.classList.add('hidden');
  });

  $('reloadScenarios')?.addEventListener('click', loadScenarios);

  // buttons (and also expose for inline onclick in your HTML)
  window.__pause = pauseSimulator;
  window.__start = async ()=>{
    try{
      await unlockAudio();
      await ensureMicPermission();
      await runSimulator();
    }catch(err){
      setStatus('Start failed: ' + (err?.message || err));
      console.error(err);
    }
  };
  $('startBtn')?.addEventListener('click', window.__start);
  $('pauseBtn')?.addEventListener('click', window.__pause);
}

// ---- boot ----
document.addEventListener('DOMContentLoaded', async ()=>{
  mountGate();
  mountUI();
  await loadScenarios();
});