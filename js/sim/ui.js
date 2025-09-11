// public/js/sim/ui.js
export const $ = id => document.getElementById(id);
export const setText = (el, t) => { if (el) el.textContent = t; };
export function setStatus(msg){ setText($('status'), msg); }

export function setScorePct(pct){
  const p = Math.max(0, Math.min(100, pct|0));
  setText($('scorePct'), p + '%');
  const bar = $('scoreBar'); if (bar) bar.style.width = p + '%';
}

export function renderActiveStep(stepIndex, step) {
  const card = $('stepsCard'), box = $('stepsBox');
  if (!step) { card?.classList.add('hidden'); return; }
  card?.classList.remove('hidden');
  const txt = (step._displayLine || step.text || '').replace(/</g, '&lt;');
  box.innerHTML = `
    <div style="padding:8px;border:1px solid #1f6feb;border-radius:10px;background:#0f1424">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <strong>Step ${stepIndex+1} • ${step.role||''}</strong>
        <span class="status">${step.prompt||''}</span>
      </div>
      <div style="margin-top:6px">${txt}</div>
    </div>`;
  $('expLine').textContent = step._displayLine || step.text || '';
  $('heardLine').textContent = '';
  setText($('wordStats'), '');
}

export function renderLive(text){ setText($('liveInline'), text || '(listening…)'); }

export function renderDiff(expToks, heardToks, statsText){
  const expEl = $('expLine'), heardEl = $('heardLine');
  expEl.innerHTML = expToks.map(t => `<span class="tok ${t.cls}">${t.w}</span>`).join(' ');
  heardEl.innerHTML = heardToks.length
    ? heardToks.map(t => `<span class="tok ${t.cls}">${t.w}</span>`).join(' ')
    : '<span class="tok miss">—</span>';
  setText($('wordStats'), statsText);
}

export function showResults(finalScore, perStep){
  const card=$('resultsCard'), list=$('resultsList'), total=$('finalScore');
  total.textContent = String(finalScore) + '%';
  list.innerHTML = perStep.map(s =>
    `<li><strong>Step ${s.i}</strong> • ${s.role||''} • <span class="status">${s.prompt||''}</span><br><span>${(s.heard||'—').replace(/</g,'&lt;')}</span> — <strong>${s.score}%</strong></li>`
  ).join('');
  card.classList.remove('hidden');
}