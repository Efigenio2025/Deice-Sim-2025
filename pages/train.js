import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareScenarioForGrading, scoreWords, diffWords } from '@/lib/scoring';
import { ensureMic, listenStep } from '@/lib/speech';
import { unlockAudio, playCaptainAudio, stopCaptainAudio } from '@/lib/audio';
import useEmpGate from '@/lib/useEmpGate';

export default function Train() {
  const [scenarios, setScenarios] = useState([]);
  const [current, setCurrent] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [live, setLive] = useState('(waiting…)');
  const [status, setStatus] = useState('Idle');
  const [expTokens, setExpTokens] = useState([]);
  const [heardTokens, setHeardTokens] = useState([]);
  const [wordStats, setWordStats] = useState('');
  const [results, setResults] = useState([]);

  // Employee ID
  const { badge, modal } = useEmpGate();

  // Audio element ref (Next renders after mount)
  const audioRef = useRef(null);
  useEffect(() => { audioRef.current = document.getElementById('captainAudio'); }, []);

  // Load scenarios.json
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/scenarios.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP '+r.status);
        const data = await r.json();
        setScenarios(data || []);
        if (Array.isArray(data) && data.length) {
          const scn = JSON.parse(JSON.stringify(data[0]));
          prepareScenarioForGrading(scn);
          setCurrent(scn);
        }
      } catch (e) {
        setStatus('Could not load scenarios.json');
        console.error(e);
      }
    })();
  }, []);

  const steps = useMemo(() => current?.steps ?? [], [current]);

  function renderExpectedLine(st) {
    const txt = (st?._displayLine || st?.text || '').trim();
    const toks = txt.toLowerCase().split(/\s+/).filter(Boolean).map(w => ({ w, cls:'ok' }));
    setExpTokens(toks);
  }

  async function onStart() {
    if (!current) { setStatus('Select a scenario first.'); return; }
    if (running) { setStatus('Already running…'); return; }

    setResults([]);
    setScore(0);
    setPaused(false);
    setRunning(true);
    setStatus('Preparing…');
    setLive('(waiting…)');

    // Safari unlock + mic permission
    await unlockAudio(audioRef.current);
    await ensureMic(setStatus);

    // run steps
    for (let i=0;i<steps.length;i++) {
      if (!running || paused) break;
      setStepIndex(i);
      const st = steps[i];
      renderExpectedLine(st);

      if (st.role === 'Captain') {
        setStatus('Playing Captain line…');
        await playCaptainAudio(audioRef.current, st.audio || '');
        await new Promise(r => setTimeout(r, 900));
      } else {
        setStatus('Listening…');
        const { final, interim } = await listenStep(setLive, setStatus);
        const heard = (final || interim || '').trim();

        const expectedGrade = st._expectedForGrade || (st.text || '');
        const expectedDisplay = st._displayLine || st.text || '';

        const stepScore = scoreWords(expectedGrade, heard);
        const { expTokens: eT, extraTokens: hT, hitCount, expCount } = diffWords(expectedDisplay, heard);
        setExpTokens(eT);
        setHeardTokens(hT.length ? hT : [{ w: heard || '—', cls: heard ? 'ok' : 'miss' }]);
        setWordStats(`${hitCount}/${expCount} expected words matched • Step score ${stepScore}%`);

        setResults(prev => [...prev, { i: i+1, role: st.role, prompt: st.prompt || '', heard, score: stepScore }]);
        // update running avg
        const nums = [...results.map(r=>r.score), stepScore];
        const avg = Math.round(nums.reduce((a,b)=>a+b,0)/nums.length);
        setScore(avg);
        setStatus(heard ? `Heard: "${heard}"` : 'No speech detected.');
        setLive(heard || '(listening done)');
      }
    }

    setRunning(false);
    stopCaptainAudio(audioRef.current);
    setStatus('Complete');
  }

  function onPause() {
    setPaused(true);
    setRunning(false);
    stopCaptainAudio(audioRef.current);
    setStatus('Paused');
  }

  return (
    <div className="wrap">
      {/* top bar */}
      <div className="row" style={{justifyContent:'space-between'}}>
        <a className="btn ghost" href="/">← Home</a>
        <div className="row" style={{gap:8,alignItems:'center'}}>
          <span className="pill" id="empIdBadge" ref={badge}>ID: —</span>
          <button id="changeIdBtn" className="btn ghost" onClick={()=>document.getElementById('empIdModal')?.classList.remove('hidden')}>Change ID</button>
        </div>
      </div>

      {/* controls */}
      <div className="row">
        <button className="btn" onClick={onStart}>Start Simulator</button>
        <button className="btn ghost" onClick={onPause}>Pause Simulator</button>
      </div>

      {/* scenario select */}
      <div className="card">
        <h2>Trainer</h2>
        <div className="row">
          <label style={{flex:'1 1 260px'}}>Select scenario
            <select
              onChange={e=>{
                const scn = JSON.parse(JSON.stringify(scenarios.find(s=>s.id===e.target.value)));
                if (scn) { prepareScenarioForGrading(scn); setCurrent(scn); setStepIndex(-1); setScore(0); setResults([]); setStatus('Idle'); setLive('(waiting…)'); }
              }}
              value={current?.id || ''}
            >
              {scenarios.length === 0 && <option value="">— loading —</option>}
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
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
                prepareScenarioForGrading(scn);
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
      {current && stepIndex >= 0 && stepIndex < steps.length && (
        <div className="card">
          <h2>Step</h2>
          <div className="status" id="stepsBox">
            <div style={{padding:8, border:'1px solid #1f6feb', borderRadius:10, background:'#0f1424'}}>
              <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                <strong>Step {stepIndex+1} • {steps[stepIndex].role}</strong>
                <span className="status">{steps[stepIndex].prompt || ''}</span>
              </div>
              <div style={{marginTop:6}}>{steps[stepIndex]._displayLine || steps[stepIndex].text}</div>
            </div>
          </div>
          <div className="scoreline">
            <div className="status">Score: <span id="scorePct">{score}%</span></div>
            <div style={{flex:1}} />
            <div className="progress" style={{width:300}}><div className="bar" style={{width: `${score}%`}}/></div>
          </div>
        </div>
      )}

      {/* transcript */}
      <div className="card">
        <h2>Transcript</h2>
        <div className="status">Expected</div>
        <div>
          {expTokens.map((t,i)=><span key={i} className={`tok ${t.cls}`}>{t.w}</span>)}
        </div>
        <div className="status" style={{marginTop:8}}>You said</div>
        <div>
          {heardTokens.map((t,i)=><span key={i} className={`tok ${t.cls}`}>{t.w}</span>)}
        </div>
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

      {/* employee modal & captain audio */}
      <EmpIdModal />
      <audio id="captainAudio" preload="metadata" playsInline muted />
    </div>
  );
}

/* ——— inline components to keep it single-file ——— */

function EmpIdModal(){
  return (
    <div id="empIdModal" className="hidden" style={{position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}}>
      <div className="card" style={{maxWidth:380, width:'92%'}}>
        <h2 style={{margin:'0 0 8px'}}>Enter Employee ID</h2>
        <p className="status" style={{margin:'0 0 10px'}}>Required to log trainings.</p>
        <input id="empIdInput" placeholder="e.g., 123456" />
        <div className="row" style={{justifyContent:'flex-end'}}>
          <button id="empIdCancel" className="btn ghost" type="button" onClick={()=>{
            document.getElementById('empIdMsg').textContent = 'Employee ID is required.';
          }}>Cancel</button>
          <button id="empIdSave" className="btn" type="button" onClick={()=>{
            const v = (document.getElementById('empIdInput').value || '').trim();
            if (!/^[A-Za-z0-9_-]{3,}$/.test(v)) {
              document.getElementById('empIdMsg').textContent = 'Enter a valid ID (min 3 chars).';
              return;
            }
            try { sessionStorage.setItem('trainer.employeeId', v); localStorage.setItem('trainer.employeeId', v);} catch {}
            document.getElementById('empIdBadge').textContent = 'ID: ' + v;
            document.getElementById('empIdMsg').textContent = '';
            document.getElementById('empIdModal').classList.add('hidden');
          }}>Continue</button>
        </div>
        <div id="empIdMsg" style={{marginTop:6, color:'#ffb4b4', fontSize:'.9rem', minHeight:'1.1em'}} />
      </div>
    </div>
  );
}
