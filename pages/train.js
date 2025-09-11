// pages/train.js
import { useEffect, useRef, useState } from 'react';

const MIN_LISTEN_MS = 1500;
const MAX_LISTEN_MS = 6000;
const SILENCE_MS    = 1200;
const CAPTAIN_DELAY_MS = 900;

const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
const toNatoTail = t => t.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');
const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const tokenize = s => norm(s).split(' ').filter(Boolean);

function useAudioUnlock(audioRef){
  const unlockedRef = useRef(false);
  const unlock = async () => {
    if (unlockedRef.current) return true;
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        await ctx.resume();
        const osc = ctx.createOscillator(), g = ctx.createGain();
        g.gain.value = 0; osc.connect(g).connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.02);
      }
    }catch{}
    try{
      const a = audioRef.current;
      if (a) {
        a.muted = true;
        await a.play().catch(()=>{});
        a.pause(); a.currentTime = 0;
      }
    }catch{}
    unlockedRef.current = true;
    return true;
  };
  return unlock;
}

export default function TrainPage(){
  const audioRef = useRef(null);
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [paused, setPaused]   = useState(false);

  const [status, setStatus]   = useState('Idle');
  const [live, setLive]       = useState('(waiting…)');
  const [score, setScore]     = useState(0);

  const [expTokens, setExpTokens]     = useState([]);
  const [heardTokens, setHeardTokens] = useState([]);
  const [wordStats, setWordStats]     = useState('');

  const unlockAudio = useAudioUnlock(audioRef);

  // ---- refs
const audioRef = useRef(null);

// ---- status helpers
const [status, setStatus] = useState('Idle');
const [running, setRunning] = useState(false);
const [paused, setPaused]   = useState(false);

// ---- audio unlock (Safari/Chrome)
async function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      await ctx.resume();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    }
  } catch {}
  try {
    const a = audioRef.current;
    if (a) {
      a.muted = true;
      await a.play().catch(() => {});
      a.pause();
      a.currentTime = 0;
    }
  } catch {}
  return true;
}

// ---- mic permission (prompt immediately on Start)
async function ensureMicPermission() {
  try {
    if (navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'microphone' });
      if (p.state === 'denied') {
        setStatus('Microphone is blocked. Allow it in site settings.');
        throw new Error('mic-denied');
      }
    }
  } catch {}
  setStatus('Requesting microphone permission…');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
  });
  stream.getTracks().forEach(t => t.stop());
  setStatus('Microphone ready.');
  return true;
}

// ---- start/pause handlers (bind these to the buttons)
async function onStart() {
  if (running) { setStatus('Already running…'); return; }
  try {
    await unlockAudio();
    await ensureMicPermission();
  } catch (e) {
    // permission refused or blocked
    return;
  }
  setPaused(false);
  setRunning(true);
  setStatus('Running…');

  // kick your simulator loop here (whatever function you already have):
  // await runSimulator();   // make sure runSimulator is defined in this component or imported
}

function onPause() {
  setPaused(true);
  setRunning(false);
  setStatus('Paused');
  try {
    const a = audioRef.current; a && a.pause();
  } catch {}
  // also abort recognition if you hold a reference to it
}

  // Load scenarios.json from /public
  useEffect(()=>{
    (async ()=>{
      try{
        const r = await fetch('/scenarios.json?'+Date.now(), { cache:'no-store' });
        if (!r.ok) throw new Error('HTTP '+r.status);
        const data = await r.json();
        setScenarios(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length){
          const scn = prepForGrading(data[0]);
          setCurrent(scn);
          setStepIndex(-1);
        }
      }catch(e){
        setStatus('Could not load scenarios.json');
      }
    })();
  },[]);

  function prepForGrading(scn){
    const copy = JSON.parse(JSON.stringify(scn));
    (copy.steps||[]).forEach(st=>{
      const base = String(st.text || st.phraseId || '');
      st._displayLine = base;
      st._expectedForGrade = (st.role === 'Iceman')
        ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
        : base;
    });
    return copy;
  }

  function wordScore(expected, said){
    const e = new Set(tokenize(expected));
    const s = new Set(tokenize(said));
    if (!e.size) return 0;
    let hit = 0; e.forEach(w=>{ if(s.has(w)) hit++; });
    return Math.round((hit/e.size)*100);
  }

  function diffWords(exp, heard){
    const E = tokenize(exp), H = tokenize(heard);
    const setE = new Set(E), setH = new Set(H);
    const expToks = E.map(w => ({ w, cls: setH.has(w) ? 'ok' : 'miss' }));
    const extras  = H.filter(w => !setE.has(w)).map(w => ({ w, cls:'extra' }));
    return { expToks, extras, expCount:E.length, hitCount:E.filter(w=>setH.has(w)).length };
  }

  async function playCaptainAudio(name){
    const a = audioRef.current;
    if (!a || !name) return;
    const url = `/audio/${name}`; // Next.js serves /public/audio/… at /audio/…
    return new Promise((resolve)=>{
      let to=null;
      const clean=()=>{ a.onended=a.onerror=a.oncanplay=a.onloadedmetadata=null; if(to) clearTimeout(to); };
      try { a.pause(); a.currentTime=0; }catch{}
      a.src = url;
      a.onloadedmetadata = ()=>{
        const dur = (isFinite(a.duration)&&a.duration>0) ? a.duration*1000+500 : 12000;
        to = setTimeout(()=>{ clean(); resolve(); }, Math.min(dur,15000));
      };
      a.oncanplay = async ()=>{
        try{
          a.muted = false;
          await a.play();
          setStatus('Playing Captain line…');
          setLive('(captain audio)');
        }catch{ clean(); resolve(); return; }
        a.onended = ()=>{ clean(); resolve(); };
      };
      a.onerror = ()=>{ clean(); resolve(); };
    });
  }

  async function ensureMicPermission(){
    try{
      if (navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name:'microphone' });
        if (p.state === 'denied') { setStatus('Microphone blocked. Enable it in site settings.'); throw new Error('mic-denied');}
      }
    }catch{}
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true }});
    stream.getTracks().forEach(t=>t.stop());
    setStatus('Microphone ready.');
  }

  async function listenStep(){
    return new Promise(resolve=>{
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R){ resolve({ final:'', interim:'', ended:'nosr' }); return; }

      let finalText='', interimText='';
      let started = Date.now(), lastAct = started, stopped=false;

      const shouldStop = ()=>{
        const now = Date.now(), elapsed = now-started, idle = now-lastAct;
        if (elapsed < MIN_LISTEN_MS) return false;
        if (idle >= SILENCE_MS) return true;
        if (elapsed >= MAX_LISTEN_MS) return true;
        return false;
      };

      const startOne = ()=>{
        if (stopped) return;
        const rec = new R();
        rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;

        rec.onstart = ()=>{ lastAct = Date.now(); setStatus('Listening…'); setLive('(listening…)'); };
        rec.onspeechstart = ()=>{ lastAct = Date.now(); };

        rec.onresult = (ev)=>{
          let interim = '';
          for (let i=ev.resultIndex; i<ev.results.length; i++){
            const tr = ev.results[i][0]?.transcript || '';
            if (tr) lastAct = Date.now();
            if (ev.results[i].isFinal) finalText = (finalText ? finalText+' ' : '') + tr;
            else interim = (interim ? interim+' ' : '') + tr;
          }
          interimText = interim;
          const combined = (finalText ? finalText+' ' : '') + interimText;
          setLive(combined || '(listening…)');
        };

        rec.onerror = ()=> { if (shouldStop()) endAll('error'); else restart(); };
        rec.onend   = ()=> { if (shouldStop()) endAll('ended'); else restart(); };

        try { rec.start(); } catch { if (shouldStop()) endAll('start-failed'); else restart(); }
      };

      const restart = ()=> setTimeout(()=>{ if(!stopped) startOne(); }, 140);

      const endAll = (reason='end')=>{
        stopped = true;
        resolve({ final:finalText.trim(), interim:interimText.trim(), ended:reason });
      };

      const guard = setInterval(()=>{
        if (stopped) { clearInterval(guard); return; }
        if (paused || !running) { clearInterval(guard); endAll('paused'); return; }
        if (shouldStop()) { clearInterval(guard); endAll('ok'); return; }
      }, 120);

      startOne();
    });
  }

  function renderTranscript(expectedDisplay, heard){
    const { expToks, extras, expCount, hitCount } = diffWords(expectedDisplay, heard);
    setExpTokens(expToks);
    setHeardTokens(extras.length ? extras : (heard ? [{w:heard, cls:'ok'}] : []));
    setWordStats(`${hitCount}/${expCount} expected words matched`);
  }

  async function runSimulator(){
    if (!current) { setStatus('Select a scenario first.'); return; }
    setRunning(true); setPaused(false); setStepIndex(0); setScore(0);
    setStatus('Running…'); setLive('(waiting…)');
    setExpTokens([]); setHeardTokens([]); setWordStats('');

    const steps = current.steps || [];
    const stepScores = [];

    for (let i=0; i<steps.length; i++){
      if (!running || paused) break;
      setStepIndex(i);
      const st = steps[i];

      if (st.role === 'Captain'){
        await playCaptainAudio(st.audio || '');
        if (!running || paused) break;
        await new Promise(r=>setTimeout(r, CAPTAIN_DELAY_MS));
      } else {
        const { final, interim } = await listenStep();
        const heard = (final || interim || '').trim();

        const expectedGrade = st._expectedForGrade || st.text || '';
        const expectedDisplay = st._displayLine || st.text || '';

        const s = wordScore(expectedGrade, heard);
        stepScores.push(s);
        const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
        setScore(avg);
        renderTranscript(expectedDisplay, heard);
        setStatus(heard ? `Heard: "${heard}"` : 'No speech detected.');
      }
    }

    if (running && !paused){
      setRunning(false);
      setStatus('Scenario complete.');
    }
  }

  const onStart = async ()=>{
    await unlockAudio();
    await ensureMicPermission();
    runSimulator();
  };
  const onPause = ()=>{
    if (!running) { setStatus('Idle'); return; }
    setPaused(true); setRunning(false);
    try { audioRef.current?.pause(); } catch {}
    setStatus('Paused');
  };

  return (
    <div className="wrap">
      {/* top bar */}
      <div className="row" style={{justifyContent:'space-between'}}>
        <a className="btn ghost" href="/">← Home</a>
        <div className="row" style={{gap:8,alignItems:'center'}}>
          <span className="pill">ID: —</span>
        </div>
      </div>

      {/* controls */}
      <div className="row">
  <button type="button" className="btn" onClick={onStart}>Start Simulator</button>
  <button type="button" className="btn ghost" onClick={onPause}>Pause Simulator</button>
</div>
      </div>

      {/* scenario select */}
      <div className="card">
        <h2>Trainer</h2>
        <div className="row">
          <label style={{flex:'1 1 260px'}}>Select scenario
            <select
              onChange={e=>{
                const found = scenarios.find(s=>s.id===e.target.value);
                if (found){ setCurrent(prepForGrading(found)); setStepIndex(-1); setScore(0); setStatus('Idle'); setLive('(waiting…)'); setExpTokens([]); setHeardTokens([]); setWordStats(''); }
              }}
              value={current?.id || (scenarios[0]?.id || '')}
            >
              {scenarios.length===0 && <option value="">— loading —</option>}
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
            </select>
          </label>
          <button className="btn ghost" onClick={async()=>{
            setStatus('Reloading scenarios…');
            try{
              const r=await fetch('/scenarios.json?'+Date.now(),{cache:'no-store'});
              const data=await r.json();
              setScenarios(data||[]);
              if(data?.length){ const scn = prepForGrading(data[0]); setCurrent(scn); setStatus('Scenarios loaded.'); }
            }catch{ setStatus('Reload failed'); }
          }}>Reload</button>
        </div>
        <div id="desc" className="status" style={{marginTop:6}}>
          {current?.desc || 'Select a scenario to begin.'}
        </div>
      </div>

      {/* live line */}
      <div className="card" aria-live="polite" aria-label="Live microphone input">
        <div className="row" style={{justifyContent:'space-between'}}>
          <strong>Live Input</strong>
          <span className="status">{status}</span>
        </div>
        <div className="live-inline">{live}</div>
      </div>

      {/* step */}
      {current && stepIndex >= 0 && stepIndex < (current.steps?.length||0) && (
        <div className="card">
          <h2>Step</h2>
          <div className="status" id="stepsBox">
            <div style={{padding:8, border:'1px solid #1f6feb', borderRadius:10, background:'#0f1424'}}>
              <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                <strong>Step {stepIndex+1} • {current.steps[stepIndex].role}</strong>
                <span className="status">{current.steps[stepIndex].prompt || ''}</span>
              </div>
              <div style={{marginTop:6}}>{current.steps[stepIndex]._displayLine || current.steps[stepIndex].text}</div>
            </div>
          </div>
          <div className="scoreline">
            <div className="status">Score: <span>{score}%</span></div>
            <div style={{flex:1}} />
            <div className="progress" style={{width:300}}><div className="bar" style={{width: `${score}%`}}/></div>
          </div>
        </div>
      )}

      {/* transcript */}
      <div className="card">
        <h2>Transcript</h2>
        <div className="status">Expected</div>
        <div>{expTokens.map((t,i)=><span key={i} className={`tok ${t.cls}`}>{t.w}</span>)}</div>
        <div className="status" style={{marginTop:8}}>You said</div>
        <div>{heardTokens.map((t,i)=><span key={i} className={`tok ${t.cls}`}>{t.w}</span>)}</div>
        <div className="status" style={{marginTop:6}}>{wordStats}</div>
      </div>

      {/* captain audio element */}
      <audio ref={audioRef} id="captainAudio" preload="metadata" playsInline muted />
    </div>
  );
}
