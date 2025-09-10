// public/js/sim/core.js
import { setStatus, setScorePct, renderActiveStep, renderDiff, showResults } from './ui.js';
import { playCaptainAudio, stopCaptainAudio } from './audio.js';
import { listenStep } from './speech.js';
import { wordScore, diffWords } from './scoring.js';

let current = null, stepIndex = -1, running = false, stepScores = [], perStep = [];

export function setScenario(scn){
  current = scn; stepIndex = -1; stepScores = []; perStep = [];
  setScorePct(0); setStatus('Scenario loaded.');
  renderActiveStep(-1, null);
}

export function resetProgress(){
  stepIndex = -1; stepScores = []; perStep = []; setScorePct(0);
}

export async function runSimulator(){
  if(!current){ setStatus('Select a scenario first.'); return; }
  running = true; stepIndex = 0; stepScores=[]; perStep=[];
  setScorePct(0); setStatus('Running…');

  const steps = current.steps || [];
  for (let i=0; i<steps.length; i++){
    if(!running) break;
    stepIndex = i;
    const st = steps[i];
    renderActiveStep(stepIndex, st);

    if (st.role === 'Captain'){
      await playCaptainAudio(st.audio || st.audioUrl || '');
      if(!running) break;
      await new Promise(r=>setTimeout(r, 900)); // settle
    } else {
      const { final, interim } = await listenStep();
      const heard = (final || interim || '').trim();
      const expectedGrade = st._expectedForGrade || (st.text||'');
      const expectedShow  = st._displayLine || (st.text||'');
      const score = wordScore(expectedGrade, heard);
      stepScores.push(score);
      perStep.push({ i:i+1, role:st.role, prompt:st.prompt||'', heard, score });

      const { expToks, extraToks, expCount, hitCount } = diffWords(expectedShow, heard);
      renderDiff(expToks, extraToks.length ? extraToks : [{w: heard || '—', cls: heard ? 'ok' : 'miss'}],
        `${hitCount}/${expCount} expected words matched • Step score ${score}%`);

      const avg = Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length);
      setScorePct(avg);
      setStatus(heard ? `Heard: "${heard}"` : 'No speech detected.');
    }
  }

  if (running){
    const finalScore = stepScores.length ? Math.round(stepScores.reduce((a,b)=>a+b,0)/stepScores.length) : 0;
    setScorePct(finalScore);
    showResults(finalScore, perStep);
    setStatus(`Scenario complete. Final score: ${finalScore}%`);
    running = false;
  }
}

export function pauseSimulator(){
  if(!running){ setStatus('Idle'); return; }
  running = false; try{ stopCaptainAudio(); }catch{}
  setStatus('Paused');
}