// public/js/sim/data.js
import { prepareExpectedForScenario } from './scoring.js';

export async function loadScenarios(){
  const res = await fetch('/scenarios.json?'+Date.now(), { cache:'no-store' });
  if (!res.ok) return [];
  try { return await res.json(); } catch { return []; }
}

export function prepareScenario(scn){
  prepareExpectedForScenario(scn);
}