// ================= De-Ice Trainer — Simulator Logic =================
(function () {
  const EMP_ID_KEY = 'trainer.employeeId';
  const MIN_LISTEN_MS = 1500, MAX_LISTEN_MS = 6000, SILENCE_MS = 1200, CAPTAIN_DELAY_MS = 1000;

  const $ = id => document.getElementById(id);
  const setText = (el,t)=>{ if(el) el.textContent=t; };
  const wait = ms => new Promise(r=>setTimeout(r,ms));
  const norm = s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();

  // scoring
  function wordScore(expected, said){
    const e=new Set(norm(expected).split(' ').filter(Boolean));
    const s=new Set(norm(said).split(' ').filter(Boolean));
    if(!e.size) return 0;
    let hit=0; e.forEach(w=>{if(s.has(w)) hit++;});
    return Math.round((hit/e.size)*100);
  }
  function setScorePct(p){ p=Math.max(0,Math.min(100,p|0)); setText($('scorePct'),p+'%'); $('scoreBar').style.width=p+'%'; }

  // word diff
  const tokenize = s=>norm(s).split(' ').filter(Boolean);
  function diffWords(exp, heard){
    const E=tokenize(exp), H=tokenize(heard);
    const setE=new Set(E), setH=new Set(H);
    const expToks=E.map(w=>({w,cls:setH.has(w)?'ok':'miss'}));
    const extraToks=H.filter(w=>!setE.has(w)).map(w=>({w,cls:'extra'}));
    return {expToks,extraToks,expCount:E.length,hitCount:E.filter(w=>setH.has(w)).length};
  }
  function renderToks(el,toks){ el.innerHTML=toks.map(t=>`<span class="tok ${t.cls}">${t.w}</span>`).join(' '); }

  // Employee ID
  function getEmployeeId(){ return localStorage.getItem(EMP_ID_KEY)||''; }
  function setEmployeeId(id){ localStorage.setItem(EMP_ID_KEY,id); }
  function openEmp(){ $('empIdModal').classList.remove('hidden'); }
  function closeEmp(){ $('empIdModal').classList.add('hidden'); }
  function ensureEmpGate(){
    const badge=$('empIdBadge'), input=$('empIdInput'), save=$('empIdSave'), cancel=$('empIdCancel');
    const have=getEmployeeId();
    if(!have){ openEmp(); } else { closeEmp(); setText(badge,'ID: '+have); }
    save.onclick=()=>{const v=input.value.trim(); if(v.length<3){setText($('empIdMsg'),'Enter valid ID'); return;}
      setEmployeeId(v); setText(badge,'ID: '+v); closeEmp();};
    cancel.onclick=()=>setText($('empIdMsg'),'Employee ID is required.');
    $('changeIdBtn').onclick=openEmp;
  }

  // scenarios
  let SCENARIOS=[], current=null, stepIndex=-1, running=false;
  async function loadScenarios(){
    const sel=$('scenarioSelect'), desc=$('desc');
    try{
      const r=await fetch('scenarios.json?'+Date.now(),{cache:'no-store'});
      const data=await r.json();
      SCENARIOS=data;
      sel.innerHTML='<option value="">— select —</option>'+data.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
      desc.textContent='Select a scenario to begin.';
    }catch{ sel.innerHTML='<option value="">(failed)</option>'; desc.textContent='Failed to load scenarios.json'; }
  }

  function renderActiveStep(){
    const card=$('stepsCard'), box=$('stepsBox');
    if(!current||stepIndex<0||stepIndex>=current.steps.length){ card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const st=current.steps[stepIndex];
    box.innerHTML=`<div><strong>${st.role}</strong><br>${st.text}</div>`;
    $('expLine').textContent=st.text||''; $('heardLine').textContent=''; $('wordStats').textContent='';
  }

  // audio unlock + play
  let audioUnlocked=false;
  async function unlockAudio(){ if(audioUnlocked) return;
    try{ const a=$('captainAudio'); a.muted=true; await a.play().catch(()=>{}); a.pause(); a.currentTime=0; }catch{} audioUnlocked=true; }
  function playCaptainAudio(src){
    const a=$('captainAudio'); if(!a||!src) return Promise.resolve();
    return new Promise(res=>{ a.onended=()=>res(); a.onerror=()=>res(); a.src='audio/'+src; a.muted=false; a.play().catch(()=>res()); });
  }

  // listen
  async function listenStep(){
    return new Promise(resolve=>{
      const R=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!R){ resolve({final:'',interim:''}); return; }
      const rec=new R(); rec.lang='en-US'; rec.continuous=false; rec.interimResults=true;
      let final='', interim='';
      rec.onresult=ev=>{for(let i=ev.resultIndex;i<ev.results.length;i++){const tr=ev.results[i][0].transcript;
        if(ev.results[i].isFinal) final+=' '+tr; else interim+=' '+tr;}
        $('liveInline').textContent=(final+' '+interim).trim();}
      rec.onend=()=>resolve({final:final.trim(),interim:interim.trim()});
      rec.start();
    });
  }

  // simulator
  async function runSimulator(){
    if(!current){ setText($('status'),'Select scenario'); return; }
    running=true; stepIndex=0; setScorePct(0);
    for(const st of current.steps){
      if(!running) break;
      renderActiveStep();
      if(st.role==='Captain'){ await playCaptainAudio(st.audio); await wait(CAPTAIN_DELAY_MS); }
      else{
        const {final,interim}=await listenStep(); const heard=(final||interim);
        const score=wordScore(st.text,heard); setScorePct(score);
        const {expToks,extraToks,expCount,hitCount}=diffWords(st.text,heard);
        renderToks($('expLine'),expToks); renderToks($('heardLine'),extraToks.length?extraToks:[{w:heard||'—',cls:heard?'ok':'miss'}]);
        setText($('wordStats'),`${hitCount}/${expCount} words matched — Step score ${score}%`);
      }
      stepIndex++;
    }
    running=false;
  }
  function pauseSimulator(){ running=false; $('status').textContent='Paused'; $('captainAudio').pause(); }

  document.addEventListener('DOMContentLoaded',()=>{
    ensureEmpGate(); loadScenarios();
    $('scenarioSelect').onchange=e=>{current=SCENARIOS.find(s=>s.id===e.target.value); stepIndex=-1; renderActiveStep();};
    $('startBtn').onclick=async()=>{ await unlockAudio(); runSimulator(); };
    $('pauseBtn').onclick=pauseSimulator;
    $('reloadScenarios').onclick=loadScenarios;
  });
})();