// public/js/sim/audio.js
import { setStatus } from './ui.js';

let audioUnlocked = false;

export async function unlockAudio(){
  if (audioUnlocked) return true;
  try {
    const a = document.getElementById('captainAudio');
    if (a) { a.muted = true; await a.play().catch(()=>{}); a.pause(); a.currentTime = 0; }
  } catch {}
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx(); await ctx.resume();
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      g.gain.value = 0; osc.connect(g).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+0.01);
    }
  } catch {}
  audioUnlocked = true; return true;
}

export function playCaptainAudio(src){
  const a = document.getElementById('captainAudio'); if(!a || !src) return Promise.resolve();
  const url = src.startsWith('http') ? src : `/audio/${src}`;
  return new Promise(resolve=>{
    let settled=false, to=null;
    const cleanup=()=>{ a.onended=a.onerror=a.oncanplay=a.onloadedmetadata=null; if(to) clearTimeout(to); };
    try{ a.pause(); a.currentTime=0; }catch{}
    a.src = url;
    a.onloadedmetadata = () => {
      const dur = isFinite(a.duration) && a.duration>0 ? a.duration*1000+800 : 10000;
      to = setTimeout(()=>{ cleanup(); if(!settled){ settled=true; resolve(); } }, Math.min(dur,12000));
    };
    a.oncanplay = () => {
      a.muted = false;
      const p = a.play();
      if (p && p.catch) p.catch(()=>{ cleanup(); if(!settled){ settled=true; resolve(); } });
      setStatus('Playing Captain line…');
    };
    a.onended = ()=>{ cleanup(); if(!settled){ settled=true; resolve(); } };
    a.onerror = ()=>{ cleanup(); if(!settled){ settled=true; resolve(); } };
  });
}
export function stopCaptainAudio(){ try{ document.getElementById('captainAudio')?.pause(); }catch{} }