const MIN_LISTEN_MS = 1500;
const MAX_LISTEN_MS = 6000;
const SILENCE_MS    = 1200;

const throttle = (fn, ms) => { let t=0; return (...a)=>{ const n=Date.now(); if(n-t>=ms){ t=n; fn(...a); } }; };

export async function ensureMic(setStatus=()=>{}){
  try{
    if (navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'microphone' });
      if (p.state === 'denied') { setStatus('Microphone is blocked in browser settings.'); throw new Error('mic-denied'); }
    }
  } catch {}
  setStatus('Requesting microphone permission…');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:false } });
  stream.getTracks().forEach(t => t.stop());
  setStatus('Microphone ready.');
}

export function listenStep(setLive=()=>{}, setStatus=()=>{}, {minMs=MIN_LISTEN_MS, maxMs=MAX_LISTEN_MS, silenceMs=SILENCE_MS}={}){
  return new Promise(resolve=>{
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!R){ resolve({final:'', interim:'', ended:'nosr'}); return; }

    let finalText='', interimText='';
    let started=Date.now(), lastAct=started, stopped=false;

    const live = throttle((t)=> setLive(t || '(listening…)'), 70);

    const shouldStop = ()=>{
      const now=Date.now(), elapsed=now-started, idle=now-lastAct;
      if(elapsed < minMs) return false;
      if(idle >= silenceMs) return true;
      if(elapsed >= maxMs) return true;
      return false;
    };

    const hardEnd = (reason='end')=>{
      if(stopped) return;
      stopped = true;
      resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
    };

    const startOne = ()=>{
      if(stopped) return;
      const rec = new R();
      rec.lang='en-US'; rec.continuous=false; rec.interimResults=true; rec.maxAlternatives=1;

      rec.onstart = ()=>{ lastAct=Date.now(); setStatus('Listening…'); live('(listening…)'); };
      rec.onsoundstart = ()=>{ lastAct=Date.now(); };
      rec.onspeechstart = ()=>{ lastAct=Date.now(); };

      rec.onresult = (ev)=>{
        let interim='';
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const tr = ev.results[i][0]?.transcript || '';
          if (tr) lastAct = Date.now();
          if(ev.results[i].isFinal){ finalText += (finalText?' ':'') + tr; }
          else { interim += (interim?' ':'') + tr; }
        }
        interimText = interim;
        live(interimText || finalText);
      };

      rec.onerror = ()=>{ if(shouldStop()) hardEnd('error'); else restart(); };
      rec.onend   = ()=>{ if(shouldStop()) hardEnd('ended'); else restart(); };

      try { rec.start(); } catch { if(shouldStop()) hardEnd('start-failed'); else restart(); }
    };

    const restart = ()=> setTimeout(()=>{ if(!stopped) startOne(); }, 140);

    const guard = setInterval(()=>{
      if(stopped){ clearInterval(guard); return; }
      if(shouldStop()){ clearInterval(guard); hardEnd('ok'); }
    }, 120);

    startOne();
  });
}
