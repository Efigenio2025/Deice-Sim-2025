// public/js/main-train.js
import { ensureEmpGate } from './sim/gate.js';
import { loadScenarios, prepareScenario } from './sim/data.js';
import { runSimulator, pauseSimulator, setScenario, resetProgress } from './sim/core.js';
import { unlockAudio } from './sim/audio.js';
import { setStatus } from './sim/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  ensureEmpGate();
  const sel = document.getElementById('scenarioSelect');
  const desc = document.getElementById('desc');

  // Load scenarios and auto-select first
  const scenarios = await loadScenarios();
  if (scenarios.length) {
    sel.innerHTML = '<option value="">— select —</option>' +
      scenarios.map(s => `<option value="${s.id}">${s.label||s.id}</option>`).join('');
    sel.value = scenarios[0].id;
    const scn = scenarios[0];
    prepareScenario(scn);
    setScenario(scn);
    desc.textContent = scn.desc || '';
  } else {
    sel.innerHTML = '<option value="">(load failed)</option>';
    setStatus('Error: scenarios.json not found');
  }

  sel.addEventListener('change', e => {
    const scn = scenarios.find(s => s.id === e.target.value) || null;
    if (!scn) return;
    prepareScenario(scn);
    setScenario(scn);
    resetProgress();
    desc.textContent = scn.desc || '';
  });

  document.getElementById('reloadScenarios').addEventListener('click', async () => {
    location.reload();
  });

  document.getElementById('startBtn').addEventListener('click', async () => {
    await unlockAudio();      // iOS Safari requirement
    runSimulator().catch(err => setStatus('Error: ' + (err?.message || err)));
  });

  document.getElementById('pauseBtn').addEventListener('click', () => {
    pauseSimulator();
  });
});