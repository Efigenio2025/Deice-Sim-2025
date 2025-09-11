// public/js/sim/speech.js
import { setStatus, renderLive } from './ui.js';

export async function listenStep({ minMs=1500, maxMs=6000, silenceMs=1200 }={}){
  return new Promise(resolve=>{
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!R){ setStatus('Error: SpeechRecognition unavailable'); resolve({final:'',interim:'',ended:'nosr'}); return; }

    let finalText='', interimText='', started=Date.now(), lastAct=started, stopped=false;

    const shouldStop=()=>{ const now=Date.now(), elapsed=now-started, idle=now-lastAct;
      if(elapsed<minMs) return false; if(idle>=silenceMs) return true; if(elapsed>=maxMs) return true; return false; };

    const startOne=()=>{
      if(stopped) return;
      const rec=new R(); rec.lang='en-US'; rec.continuous=false; rec.interimResults=true; rec.maxAlternatives=1;
      rec.onresult=ev=>{
        let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const tr=ev.results[i][0]?.transcript||''; 
          if(ev.results[i].isFinal){ finalText+=' '+tr; lastAct=Date.now(); } else { interim+=' '+tr; } }
        interimText = interim.trim();
        renderLive((finalText + ' ' + interimText).trim());
        const heardEl=document.getElementById('heardLine'); if (heardEl) heardEl.textContent=(finalText + ' ' + interimText).trim();
      };
      rec.onerror=()=>{ if(shouldStop()) endAll('error'); else restart(); };
      rec.onend  =()=>{ if(shouldStop()) endAll('end');   else restart(); };
      try{ rec.start(); setStatus('Listening…'); renderLive('(listening…)'); }catch{ if(shouldStop()) endAll('startfail'); else restart(); }
      window.__rec = rec; // for debugging if needed
    };
    const restart=()=> setTimeout(()=>{ if(!stopped) startOne(); }, 120);
    const endAll =(reason)=>{ stopped=true; try{ window.__rec && window.__rec.abort && window.__rec.abort(); }catch{}; resolve({final:finalText.trim(),interim:interimText.trim(),ended:reason}); };

    const guard=setInterval(()=>{ if(stopped){ clearInterval(guard); return; }
      if(shouldStop()){ clearInterval(guard); endAll('ok'); }
    }, 100);

    startOne();
  });
}