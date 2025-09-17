// /lib/speech.js
export async function ensureMicPermission(setStatus = () => {}) {
  try {
    setStatus('Requesting microphone permission…');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
    });
    stream.getTracks().forEach(t => t.stop());
    setStatus('Microphone ready.');
    return true;
  } catch (e) {
    setStatus('Microphone permission was not granted.');
    throw e;
  }
}
export function makeRecognizer() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return null;
  const rec = new R();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}
/**
 * Start a single mic capture with interim updates and graceful restarts.
 * Returns a Promise<{final, interim, ended}>
 */
export function listenOnce({
  minMs = 1200,
  maxMs = 20000,
  silenceMs = 2500,
  onInterim = () => {},
  onStatus = () => {},
} = {}) {
  return new Promise(resolve => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { resolve({ final: '', interim: '', ended: 'nosr' }); return; }
    let finalText = '';
    let interimText = '';
    let started = Date.now();
    let lastActivity = started;
    let stopped = false;
    let rec = null;
    const shouldStop = () => {
      const now = Date.now();
      const elapsed = now - started;
      const idle = now - lastActivity;
      if (elapsed < minMs) return false;
      if (idle >= silenceMs) return true;
      if (elapsed >= maxMs) return true;
      return false;
    };
    const endAll = (reason = 'end') => {
      if (stopped) return;
      stopped = true;
      try { rec && rec.abort && rec.abort(); } catch {}
      resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
    };
    const startRecognizer = () => {
      if (stopped) return;
      rec = new R();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = () => { lastActivity = Date.now(); onStatus('Listening…'); };
      rec.onsoundstart = () => { lastActivity = Date.now(); };
      rec.onspeechstart = () => { lastActivity = Date.now(); };
      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const tr = ev.results[i][0]?.transcript || '';
          if (tr) lastActivity = Date.now();
          if (ev.results[i].isFinal) finalText += (finalText ? ' ' : '') + tr;
          else interim += (interim ? ' ' : '') + tr;
        }
        interimText = interim;
        onInterim((finalText + (interimText ? ' ' + interimText : '')).trim());
      };
      rec.onerror = () => { if (shouldStop()) endAll('error'); else restart(); };
      rec.onend   = () => { if (shouldStop()) endAll('ended'); else restart(); };
      try { rec.start(); onStatus('Listening…'); }
      catch { if (shouldStop()) endAll('start-failed'); else restart(); }
    };
    const restart = () => setTimeout(() => { if (!stopped) startRecognizer(); }, 140);
    // watchdog to end on pause/stop/idle/timeout
    const guard = setInterval(() => {
      if (stopped) { clearInterval(guard); return; }
      if (shouldStop()) { clearInterval(guard); endAll('ok'); }
    }, 120);
    // Begin
    onInterim(''); onStatus('Preparing mic…');
    startRecognizer();
  });
}
