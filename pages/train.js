// /pages/train.js
import { useEffect, useRef, useState } from 'react';

// ---- minimal helpers (inline so no alias/import headaches) ----
const norm = (s='') => s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const tokenize = s => norm(s).split(' ').filter(Boolean);
function wordScore(expected, said){
  const e = new Set(tokenize(expected));
  const s = new Set(tokenize(said));
  if (!e.size) return 0;
  let hit = 0; e.forEach(w => s.has(w) && hit++);
  return Math.round((hit/e.size)*100);
}
function diffWords(exp, heard){
  const E = tokenize(exp), H = tokenize(heard);
  const setE = new Set(E), setH = new Set(H);
  const expToks = E.map(w => ({ w, cls: setH.has(w) ? 'ok' : 'miss' }));
  const extras  = H.filter(w => !setE.has(w)).map(w => ({ w, cls: 'extra' }));
  return { expToks, extras, expCount: E.length, hitCount: E.filter(w => setH.has(w)).length };
}

async function ensureMicPermission(setStatus=()=>{}){
  try{
    setStatus('Requesting microphone permission…');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:false }
    });
    stream.getTracks().forEach(t=>t.stop());
    setStatus('Microphone ready.');
    return true;
  }catch(e){
    setStatus('Microphone permission was not granted.');
    throw e;
  }
}

function listenOnce({
  minMs=1200, maxMs=6000, silenceMs=1000,
  onInterim=()=>{}, onStatus=()=>{}
}={}){
  return new Promise(resolve=>{
    const R = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if(!R){ resolve({final:'', interim:'', ended:'nosr'}); return; }

    let finalText='', interimText='';
    let started=Date.now(), lastAct=started, stopped=false;
    const shouldStop=()=>{
      const now=Date.now(), elapsed=now-started, idle=now-lastAct;
      if(elapsed < minMs) return false;
      if(idle   >= silenceMs) return true;
      if(elapsed >= maxMs)     return true;
      return false;
    };

    let rec;
    const endAll = (reason='end')=>{
      if(stopped) return;
      stopped=true;
      try{ rec && rec.abort && rec.abort(); }catch{}
      resolve({ final:finalText.trim(), interim:interimText.trim(), ended:reason });
    };
    const restart = ()=> setTimeout(()=>{ if(!stopped) startOne(); }, 140);

    const startOne = ()=>{
      if(stopped) return;
      rec = new R();
      rec.lang='en-US'; rec.continuous=false; rec.interimResults=true; rec.maxAlternatives=1;

      rec.onstart      = ()=>{ lastAct=Date.now(); onStatus('Listening…'); };
      rec.onsoundstart = ()=>{ lastAct=Date.now(); };
      rec.onspeechstart= ()=>{ lastAct=Date.now(); };

      rec.onresult = (ev)=>{
        let interim='';
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const tr = ev.results[i][0]?.transcript || '';
          if(tr) lastAct = Date.now();
          if(ev.results[i].isFinal) finalText += (finalText ? ' ' : '') + tr;
          else interim += (interim ? ' ' : '') + tr;
        }
        interimText = interim;
        onInterim((finalText + (interimText ? ' ' + interimText : '')).trim());
      };

      rec.onerror = ()=>{ if(shouldStop()) endAll('error'); else restart(); };
      rec.onend   = ()=>{ if(shouldStop()) endAll('ended'); else restart(); };

      try{ rec.start(); onStatus('Listening…'); }
      catch{ if(shouldStop()) endAll('start-failed'); else restart(); }
    };

    const guard = setInterval(()=>{
      if(stopped){ clearInterval(guard); return; }
      if(shouldStop()){ clearInterval(guard); endAll('ok'); }
    }, 120);

    onInterim('');
    onStatus('Preparing mic…');
    startOne();
  });
}

function useAudioUnlock(){
  const unlocked = useRef(false);
  return async function unlock(){
    if(unlocked.current) return true;
    try{
      const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if(Ctx){ const ctx=new Ctx(); await ctx.resume(); const o=ctx.createOscillator(); const g=ctx.createGain(); g.gain.value=0; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.01); }
    }catch{}
    unlocked.current = true;
    return true;
  };
}

// ---- Page component ----
export default function Train() {
  const [status, setStatus] = useState('Idle');
  const [live, setLive] = useState('(waiting…)');
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]);
  const audioRef = useRef(null);
  const unlockAudio = useAudioUnlock();

  // load scenarios.json
  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch('/scenarios.json?'+Date.now(), {cache:'no-store'});
        const data = await r.json();
        setScenarios(Array.isArray(data)?data:[]);
        if(data?.[0]) setCurrent(data[0]);
      }catch{
        setStatus('Could not load scenarios.json');
      }
    })();
  },[]);

  async function onStart(){
    try{
      await unlockAudio();
      await ensureMicPermission(setStatus);
      setStatus('Mic ready. Starting…');
      setLive('(listening…)');

      const { final, interim } = await listenOnce({
        onInterim: (t)=> setLive(t || '(listening…)'),
        onStatus : (s)=> setStatus(s),
      });

      const heard = (final || interim || '').trim();
      setStatus(heard ? `Heard: "${heard}"` : 'No speech detected.');

      // if you want scoring against first iceman step:
      const st = current?.steps?.[0] || null;
      const expected = st?.text || '';
      const s = wordScore(expected, heard);
      setScore(s);

      const { expToks, extras, expCount, hitCount } = diffWords(expected, heard);
      setResults([{ expToks, extras, stats: `${hitCount}/${expCount} words matched • ${s}%` }]);
    }catch{
      setStatus('Mic failed to start.');
    }
  }

  function onPause(){
    // single-listen sample has nothing persistent to stop;
    // in your multi-step loop you’d abort the recognizer here.
    setStatus('Paused');
  }

  // simple styles for tokens
  const tokenStyle = (cls) => ({
    display:'inline-block', padding:'0 4px', borderRadius:6, margin:'0 2px 4px 0',
    ...(cls==='ok'   ? {background:'#12291c', border:'1px solid #1f5d38'} :
      cls==='miss' ? {background:'#2a1616', border:'1px solid #8a2c2c', textDecoration:'underline'} :
                     {background:'#1a1d2a', border:'1px solid #2f375c', opacity:.9})
  });

  const steps = current?.steps || [];
  const active = (stepIndex>=0 && stepIndex<steps.length) ? steps[stepIndex] : null;

  return (
    <div className="wrap" style={{maxWidth:980, margin:'0 auto', padding:18}}>
      {/* top bar */}
      <div className="row" style={{display:'flex',justifyContent:'space-between'}}>
        <a className="btn ghost" href="/">← Home</a>
        <div className="row" style={{display:'flex',gap:8,alignItems:'center'}}>
          <span className="pill">ID: —</span>
          {/* your change ID flow can be wired later */}
        </div>
      </div>

      {/* controls */}
      <div className="row" style={{display:'flex',gap:10}}>
        <button className="btn" onClick={onStart}>Start Simulator</button>
        <button className="btn ghost" onClick={onPause}>Pause Simulator</button>
      </div>

      {/* scenario select */}
      <div className="card" style={{border:'1px solid #1e2230',borderRadius:16,padding:18,background:'#101218'}}>
        <h2>Trainer</h2>
        <div className="row" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <label style={{flex:'1 1 260px'}}>
            Select scenario
            <select
              value={current?.id || ''}
              onChange={e=>{
                const scn = (scenarios || []).find(s=>s.id===e.target.value);
                setCurrent(scn || null);
                setStepIndex(-1);
                setScore(0);
                setResults([]);
                setStatus('Idle');
                setLive('(waiting…)');
              }}
              style={{width:'100%',border:'1px solid #2b3147',background:'#0f1220',color:'#eaeaea',borderRadius:10,padding:10}}
            >
              {scenarios.length===0 && <option value="">— loading —</option>}
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.label||s.id}</option>)}
            </select>
          </label>
          <button
            className="btn ghost"
            onClick={async()=>{
              setStatus('Reloading scenarios…');
              try{
                const r=await fetch('/scenarios.json?'+Date.now(),{cache:'no-store'});
                const data=await r.json();
                setScenarios(data||[]);
                if(data?.length){ setCurrent(data[0]); setStatus('Scenarios loaded.'); }
              }catch{ setStatus('Reload failed'); }
            }}
          >Reload</button>
        </div>
        <div className="status" style={{marginTop:6}}>
          {current?.desc || 'Select a scenario to begin.'}
        </div>
      </div>

      {/* live line */}
      <div className="card" style={{border:'1px solid #1e2230',borderRadius:16,padding:18,background:'#101218'}}>
        <div className="row" style={{display:'flex',justifyContent:'space-between'}}>
          <strong>Live Input</strong>
          <span className="status">{status}</span>
        </div>
        <div style={{
          width:'100%',border:'1px solid #223259',borderRadius:10,padding:10,
          background:'#141822',color:'#b7c7ff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'
        }}>{live}</div>
      </div>

      {/* step (optional preview of active) */}
      {active && (
        <div className="card" style={{border:'1px solid #1e2230',borderRadius:16,padding:18,background:'#101218'}}>
          <h2>Step</h2>
          <div className="status" id="stepsBox">
            <div style={{padding:8,border:'1px solid #1f6feb',borderRadius:10,background:'#0f1424'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
                <strong>Step {stepIndex+1} • {active.role}</strong>
                <span className="status">{active.prompt || ''}</span>
              </div>
              <div style={{marginTop:6}}>{active.text}</div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
            <div className="status">Score: <span>{score}%</span></div>
            <div style={{flex:1}} />
            <div style={{height:12,background:'#1a2136',border:'1px solid #223259',borderRadius:999,overflow:'hidden',width:300}}>
              <div style={{height:'100%',width:`${score}%`,background:'linear-gradient(90deg,#e5534b,#f89c2c,#f6e05e,#a4e786,#19c37d)'}} />
            </div>
          </div>
        </div>
      )}

      {/* transcript */}
      <div className="card" style={{border:'1px solid #1e2230',borderRadius:16,padding:18,background:'#101218'}}>
        <h2>Transcript</h2>
        <div className="status">Expected</div>
        <div>
          {(results[0]?.expToks || []).map((t,i)=>
            <span key={i} style={tokenStyle(t.cls)}>{t.w}</span>
          )}
        </div>
        <div className="status" style={{marginTop:8}}>You said</div>
        <div>
          {(results[0]?.extras?.length ? results[0].extras : []).map((t,i)=>
            <span key={i} style={tokenStyle(t.cls)}>{t.w}</span>
          )}
        </div>
        <div className="status" style={{marginTop:6}}>{results[0]?.stats || ''}</div>
      </div>

      {/* hidden audio tag if you later play captain lines */}
      <audio ref={audioRef} id="captainAudio" preload="metadata" playsInline />
    </div>
  );
}
