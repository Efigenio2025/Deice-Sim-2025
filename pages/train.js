// pages/train.js
import { useEffect, useRef, useState, useCallback } from 'react';

const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};

const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const tokenize = s => norm(s).split(' ').filter(Boolean);
const toNatoTail = t => t.toUpperCase().split('').map(c => NATO[c] || c).join(' ');
function diffWords(exp, heard){
  const E=tokenize(exp), H=tokenize(heard);
  const setE=new Set(E), setH=new Set(H);
  return {
    expToks: E.map(w => ({w, cls:setH.has(w)?'ok':'miss'})),
    heardToks: H.map(w => ({w, cls:setE.has(w)?'ok':'extra'})),
    expCount: E.length,
    hitCount: E.filter(w=>setH.has(w)).length
  };
}
function wordScore(expected, said){
  const e=new Set(tokenize(expected)), s=new Set(tokenize(said));
  if(!e.size) return 0;
  let hit=0; e.forEach(w=>{ if(s.has(w)) hit++; });
  return Math.round((hit/e.size)*100);
}

export default function TrainPage(){
  // UI/state
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [status, setStatus] = useState('Idle');
  const [live, setLive] = useState('(waiting…)');
  const [score, setScore] = useState(0);
  const [results, setResults] = useState([]); // [{i, role, prompt, heard, score}]
  const [expTokens, setExpTokens] = useState([]);
  const [heardTokens, setHeardTokens] = useState([]);
  const [wordStats, setWordStats] = useState('');  
  const [running, setRunning] = useState(false);

  // Employee gate
  const [empId, setEmpId] = useState('');
  const inputEmpRef = useRef(null);

  // Audio + SR
  const audioRef = useRef(null);
  const pttRef = useRef({ rec: null, finalText:'', interimText:'' });

  // ---- Load scenarios from /public/scenarios.json ----
  useEffect(() => {
    (async () => {
      try{
        const r = await fetch(`/scenarios.json?${Date.now()}`, { cache: 'no-store' });
        const data = await r.json();
        setScenarios(data || []);
        if (data?.length) {
          const scn = JSON.parse(JSON.stringify(data[0]));
          // prepare expected-for-grade (Iceman tails → NATO)
          for (const st of scn.steps||[]) {
            const base = String(st.text || st.phraseId || '');
            st._displayLine = base;
            st._expectedForGrade = (st.role === 'Iceman')
              ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
              : base;
          }
          setCurrent(scn);
          setStepIndex(-1);
        }
      }catch(e){ setStatus('Could not load scenarios.json'); }
    })();
  }, []);

  // ---- Employee ID modal on first load ----
  const [showGate, setShowGate] = useState(false);
  useEffect(() => {
    const stored = (typeof window !== 'undefined') ? (sessionStorage.getItem('trainer.employeeId') || localStorage.getItem('trainer.employeeId') || '') : '';
    if (!stored) { setShowGate(true); }
    else setEmpId(stored);
  }, []);
  const saveEmpId = () => {
    const v = inputEmpRef.current?.value?.trim() || '';
    if (!/^[A-Za-z0-9_-]{3,}$/.test(v)) return;
    try { sessionStorage.setItem('trainer.employeeId', v); localStorage.setItem('trainer.employeeId', v); } catch {}
    setEmpId(v); setShowGate(false);
  };

  // ---- Safari audio unlock + mic permission ----
  const unlockAudio = useCallback(async()=>{
    try {
      if (audioRef.current) {
        audioRef.current.muted = true;
        await audioRef.current.play().catch(()=>{});
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
  }, []);

  const ensureMicPermission = useCallback(async()=>{
    setStatus('Requesting microphone permission…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:false } });
      stream.getTracks().forEach(t => t.stop());
      setStatus('Microphone ready.');
      return true;
    } catch (e) {
      setStatus('Microphone permission was not granted.');
      throw e;
    }
  }, []);

  // ---- Play captain MP3 from /public/audio ----
  const playCaptainAudio = useCallback((src) => {
    if (!audioRef.current || !src) return Promise.resolve();
    const a = audioRef.current;
    const url = `/audio/${src}`;
    return new Promise(resolve=>{
      const clean = () => { a.onended = a.onerror = a.oncanplay = a.onloadedmetadata = null; };
      a.onloadedmetadata = () => {};
      a.oncanplay = () => {
        a.muted = false;
        const p = a.play();
        if (p && p.catch) p.catch(()=>resolve());
      };
      a.onended = () => { clean(); resolve(); };
      a.onerror = () => { clean(); resolve(); };
      try { a.pause(); a.currentTime = 0; } catch {}
      a.src = url;
      setStatus('Playing Captain line…');
      setLive('(captain audio)');
    });
  }, []);

  // ---- Render “Step” panel tokens on step change ----
  useEffect(() => {
    if (!current || stepIndex < 0 || stepIndex >= (current.steps?.length||0)) {
      setExpTokens([]); setHeardTokens([]); setWordStats('');
      return;
    }
    const st = current.steps[stepIndex];
    const base = st._displayLine || st.text || '';
    setExpTokens(tokenize(base).map(w=>({w, cls:'ok'})));
    setHeardTokens([]);
    setWordStats('');
  }, [current, stepIndex]);

  // ---- Push-to-talk (hold to speak) ----
  const makeSR = () => {
    const R = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!R) return null;
    const r = new R();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    return r;
  };

  const startPTT = useCallback(() => {
    const st = current?.steps?.[stepIndex];
    if (!st || st.role !== 'Iceman') return;

    const rec = makeSR();
    if (!rec) { setStatus('SpeechRecognition unsupported'); return; }

    pttRef.current.finalText = '';
    pttRef.current.interimText = '';
    pttRef.current.rec = rec;

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const tr = ev.results[i][0]?.transcript || '';
        if (ev.results[i].isFinal) {
          pttRef.current.finalText += (pttRef.current.finalText ? ' ' : '') + tr;
        } else {
          interim += (interim ? ' ' : '') + tr;
        }
      }
      pttRef.current.interimText = interim;
      const combined = (pttRef.current.finalText + ' ' + pttRef.current.interimText).trim();
      setLive(combined || '(listening…)');
      // mirror into “You said”
      setHeardTokens(tokenize(combined).map(w => ({ w, cls:'ok' })));
    };

    rec.onerror = () => {};
    rec.onend   = () => {};

    try { rec.start(); setStatus('Listening (hold)…'); }
    catch { /* ignore */ }
  }, [current, stepIndex]);

  const stopPTT = useCallback(() => {
    const rec = pttRef.current.rec;
    if (rec) {
      try { rec.stop(); } catch {}
      try { rec.abort(); } catch {}
      pttRef.current.rec = null;
    }
    setStatus('Processing…');
  }, []);

  const awaitPTTRelease = useCallback(() => new Promise((resolve)=>{
    const tick = () => {
      if (!pttRef.current.rec) {
        const said = (pttRef.current.finalText + ' ' + pttRef.current.interimText).trim();
        resolve(said);
      } else {
        requestAnimationFrame(tick);
      }
    };
    tick();
  }), []);

  // ---- Run simulator (no auto listen; PTT only) ----
  const runSimulator = useCallback(async ()=>{
    if (!current) { setStatus('Select a scenario first.'); return; }
    setRunning(true);
    setResults([]); setScore(0); setLive('(waiting…)');
    setStatus('Running…');

    for (let i = 0; i < (current.steps||[]).length; i++) {
      if (!running) break;
      setStepIndex(i);
      const st = current.steps[i];

      if (st.role === 'Captain') {
        await playCaptainAudio(st.audio || '');
        await new Promise(r=>setTimeout(r, 900));
      } else {
        // Enable PTT UI hint
        setStatus('Hold the mic and speak…');
        setLive('(press and hold “Hold to Speak”)');
        // Wait for user PTT interaction to complete
        const heard = await awaitPTTRelease();

        const expectedGrade = st._expectedForGrade || st.text || '';
        const expectedDisplay = st._displayLine || st.text || '';
        const s = wordScore(expectedGrade, heard);
        const {expToks, heardToks, expCount, hitCount} = (()=> {
          const d = diffWords(expectedDisplay, heard);
          return { expToks: d.expToks, heardToks: d.heardToks, expCount: d.expCount, hitCount: d.hitCount };
        })();

        setExpTokens(expToks);
        setHeardTokens(heardToks);
        setWordStats(`${hitCount}/${expCount} expected words matched • Step score ${s}%`);
        setResults(prev => prev.concat({ i:i+1, role:st.role, prompt:st.prompt||'', heard, score:s }));
        setScore(prev => {
          const arr = [...(results.map(x=>x.score)), s];
          return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
        });
        setStatus(heard ? `Heard: "${heard}"` : 'No speech detected.');
      }
    }

    setRunning(false);
    setStatus('Scenario complete.');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, playCaptainAudio, awaitPTTRelease, running, results]);

  // ---- Button handlers ----
  const onStart = useCallback(async ()=>{
    await unlockAudio();
    await ensureMicPermission();
    setRunning(true);
    setStepIndex(0);
    runSimulator();
  }, [unlockAudio, ensureMicPermission, runSimulator]);

  const onPause = useCallback(()=>{
    setRunning(false);
    // stop any PTT in progress
    stopPTT();
    try { audioRef.current?.pause(); } catch {}
    setStatus('Paused');
  }, [stopPTT]);

  // ---- Render ----
  const steps = current?.steps || [];
  const active = (stepIndex>=0 && stepIndex<steps.length) ? steps[stepIndex] : null;
  const pttEnabled = !!active && active.role === 'Iceman';

  return (
    <div className="wrap">
      {/* top bar */}
      <div className="row" style={{justifyContent:'space-between'}}>
        <a className="btn ghost" href="/">← Home</a>
        <div className="row" style={{gap:8,alignItems:'center'}}>
          <span className="pill">ID: {empId || '—'}</span>
          <button className="btn ghost" onClick={()=>setShowGate(true)}>Change ID</button>
        </div>
      </div>

      {/* controls */}
      <div className="row">
        <button className="btn" onClick={onStart}>Start Simulator</button>
        <button className="btn ghost" onClick={onPause}>Pause Simulator</button>
        {/* Push-to-Talk */}
        <button
          id="pttBtn"
          className="btn ghost"
          disabled={!pttEnabled}
          aria-pressed="false"
          onMouseDown={(e)=>{e.preventDefault(); e.currentTarget.setAttribute('aria-pressed','true'); startPTT();}}
          onMouseUp={(e)=>{e.preventDefault(); e.currentTarget.setAttribute('aria-pressed','false'); stopPTT();}}
          onMouseLeave={(e)=>{e.preventDefault(); e.currentTarget.setAttribute('aria-pressed','false'); stopPTT();}}
          onTouchStart={(e)=>{e.preventDefault(); e.currentTarget.setAttribute('aria-pressed','true'); startPTT();}}
          onTouchEnd={(e)=>{e.preventDefault(); e.currentTarget.setAttribute('aria-pressed','false'); stopPTT();}}
          title={pttEnabled ? 'Hold to speak; release to stop' : 'PTT on Iceman steps'}
        >
          🎙️ Hold to Speak
        </button>
      </div>

      {/* scenario select */}
      <div className="card">
        <h2>Trainer</h2>
        <div className="row">
          <label style={{flex:'1 1 260px'}}>Select scenario
            <select
              value={current?.id || ''}
              onChange={e=>{
                const scn = JSON.parse(JSON.stringify(scenarios.find(s=>s.id===e.target.value)));
                if (scn) {
                  for (const st of scn.steps||[]) {
                    const base = String(st.text || st.phraseId || '');
                    st._displayLine = base;
                    st._expectedForGrade = (st.role === 'Iceman')
                      ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
                      : base;
                  }
                  setCurrent(scn); setStepIndex(-1); setScore(0); setResults([]); setStatus('Idle'); setLive('(waiting…)');
                }
              }}
            >
              {scenarios.length===0 && <option value="">— loading —</option>}
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.label||s.id}</option>)}
            </select>
          </label>
          <button className="btn ghost" onClick={async()=>{
            setStatus('Reloading scenarios…');
            try{
              const r=await fetch('/scenarios.json?'+Date.now(),{cache:'no-store'});
              const data=await r.json();
              setScenarios(data||[]);
              if(data?.length){
                const scn=JSON.parse(JSON.stringify(data[0]));
                for (const st of scn.steps||[]) {
                  const base = String(st.text || st.phraseId || '');
                  st._displayLine = base;
                  st._expectedForGrade = (st.role === 'Iceman')
                    ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
                    : base;
                }
                setCurrent(scn);
                setStatus('Scenarios loaded.');
              }
            }catch{ setStatus('Reload failed'); }
          }}>Reload</button>
        </div>
        <div id="desc" className="status" style={{marginTop:6}}>{current?.desc || 'Select a scenario to begin.'}</div>
      </div>

      {/* live line */}
      <div className="card" aria-live="polite" aria-label="Live microphone input">
        <div className="row" style={{justifyContent:'space-between'}}>
          <strong>Live Input</strong>
          <span className="status">{status}</span>
        </div>
        <div className="live-inline">{live}</div>
      </div>

      {/* current step */}
      {current && active && (
        <div className="card">
          <h2>Step</h2>
          <div className="status" id="stepsBox">
            <div style={{padding:8,border:'1px solid #1f6feb',borderRadius:10,background:'#0f1424'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
                <strong>Step {stepIndex+1} • {active.role}</strong>
                <span className="status">{active.prompt || ''}</span>
              </div>
              <div style={{marginTop:6}}>{active._displayLine || active.text}</div>
            </div>
          </div>
          <div className="scoreline">
            <div className="status">Score: <span id="scorePct">{score}%</span></div>
            <div style={{flex:1}} />
            <div className="progress" style={{width:300}}><div className="bar" style={{width:`${score}%`}} /></div>
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

      {/* results */}
      {results.length>0 && !running && (
        <div className="card">
          <h2>Results</h2>
          <p className="status">Final score: <strong>{score}%</strong></p>
          <ol style={{paddingLeft:18, margin:'8px 0 0'}}>
            {results.map(r=>(
              <li key={r.i}>
                <strong>Step {r.i}</strong> • {r.role} • <span className="status">{r.prompt}</span><br/>
                <span>{r.heard || '—'}</span> — <strong>{r.score}%</strong>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* employee modal */}
      {showGate && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div className="card" style={{maxWidth:380,width:'92%'}}>
            <h2 style={{margin:'0 0 8px'}}>Enter Employee ID</h2>
            <p className="status" style={{margin:'0 0 10px'}}>Required to log trainings.</p>
            <input ref={inputEmpRef} placeholder="e.g., 123456" />
            <div className="row" style={{justifyContent:'flex-end'}}>
              <button className="btn ghost" onClick={()=>{ /* gate is required */ }}>Cancel</button>
              <button className="btn" onClick={saveEmpId}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* captain audio */}
      <audio ref={audioRef} preload="metadata" playsInline muted />
    </div>
  );
}
