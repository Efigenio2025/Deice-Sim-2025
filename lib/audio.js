export async function unlockAudio(audioEl){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      await ctx.resume();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      g.gain.value = 0; osc.connect(g).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.01);
    }
  }catch{}
  try{
    if (audioEl) {
      audioEl.muted = true;
      await audioEl.play().catch(()=>{});
      audioEl.pause(); audioEl.currentTime = 0;
    }
  }catch{}
}

export function playCaptainAudio(audioEl, src){
  if(!audioEl || !src) return Promise.resolve();
  const candidates=[`/audio/${src}`, `/${src}`];
  return new Promise(resolve=>{
    let settled=false, to=null;
    const clean=()=>{ audioEl.onended=audioEl.onerror=audioEl.oncanplay=audioEl.onloadedmetadata=null; if(to) clearTimeout(to); };
    const tryUrl=(i)=>{
      if(i>=candidates.length){ if(!settled){ settled=true; resolve(); } return; }
      clean();
      try{ audioEl.pause(); audioEl.currentTime=0; }catch{}
      audioEl.src=candidates[i];
      audioEl.onloadedmetadata=()=>{
        const dur=(isFinite(audioEl.duration)&&audioEl.duration>0)?audioEl.duration*1000+1000:12000;
        to=setTimeout(()=>{ clean(); if(!settled){ settled=true; resolve(); } }, Math.min(dur,15000));
      };
      audioEl.oncanplay=()=>{
        audioEl.muted=false;
        audioEl.onended=()=>{ clean(); if(!settled){ settled=true; resolve(); } };
        const p=audioEl.play();
        if(p&&p.catch){ p.catch(()=>{ clean(); if(!settled){ settled=true; resolve(); } }); }
      };
      audioEl.onerror=()=>tryUrl(i+1);
    };
    tryUrl(0);
  });
}

export function stopCaptainAudio(audioEl){
  try{ audioEl && audioEl.pause(); }catch{}
}
