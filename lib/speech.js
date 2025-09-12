// /lib/speech.js
export async function ensureMicPermission(setStatus = () => {}) {
  try {
    setStatus('Requesting microphone permission…');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: false 
      }
    });
    stream.getTracks().forEach(t => t.stop());
    setStatus('Microphone ready.');
    return true;
  } catch (e) {
    setStatus('Microphone permission was not granted.');
    throw e;
  }
}

// Detect iOS device
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function makeRecognizer() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return null;
  const rec = new R();
  rec.lang = 'en-US';
  
  // iOS-specific settings
  if (isIOS()) {
    rec.continuous = false; // iOS doesn't support continuous mode well
    rec.interimResults = false; // iOS has limited interim results support
  } else {
    rec.continuous = false;
    rec.interimResults = true;
  }
  
  rec.maxAlternatives = 1;
  return rec;
}

/**
 * Start a single mic capture with iOS compatibility
 * Returns a Promise<{final, interim, ended}>
 */
export function listenOnce({
  minMs = 1200,
  maxMs = 6000,
  silenceMs = 1000,
  onInterim = () => {},
  onStatus = () => {},
} = {}) {
  return new Promise(resolve => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { resolve({ final: '', interim: '', ended: 'nosr' }); return; }
    
    const iOS = isIOS();
    let finalText = '';
    let interimText = '';
    let started = Date.now();
    let lastActivity = started;
    let stopped = false;
    let rec = null;
    let restartCount = 0;
    const maxRestarts = iOS ? 2 : 5; // Fewer restarts on iOS
    
    // Adjust timeouts for iOS
    const actualMaxMs = iOS ? Math.min(maxMs, 4000) : maxMs; // iOS times out around 5s
    const actualSilenceMs = iOS ? Math.min(silenceMs, 2000) : silenceMs;
    
    const shouldStop = () => {
      const now = Date.now();
      const elapsed = now - started;
      const idle = now - lastActivity;
      if (elapsed < minMs) return false;
      if (idle >= actualSilenceMs) return true;
      if (elapsed >= actualMaxMs) return true;
      return false;
    };
    
    const endAll = (reason = 'end') => {
      if (stopped) return;
      stopped = true;
      try { 
        if (rec) {
          rec.onstart = null;
          rec.onend = null;
          rec.onerror = null;
          rec.onresult = null;
          rec.onsoundstart = null;
          rec.onspeechstart = null;
          if (rec.abort) rec.abort();
        }
      } catch {}
      resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
    };
    
    const startRecognizer = () => {
      if (stopped || restartCount >= maxRestarts) {
        if (restartCount >= maxRestarts) endAll('max-restarts');
        return;
      }
      
      restartCount++;
      rec = new R();
      rec.lang = 'en-US';
      
      // iOS-specific configuration
      if (iOS) {
        rec.continuous = false;
        rec.interimResults = false; // Disable interim on iOS for stability
      } else {
        rec.continuous = false;
        rec.interimResults = true;
      }
      
      rec.maxAlternatives = 1;
      
      rec.onstart = () => { 
        lastActivity = Date.now(); 
        onStatus('Listening…'); 
      };
      
      rec.onsoundstart = () => { 
        lastActivity = Date.now(); 
      };
      
      rec.onspeechstart = () => { 
        lastActivity = Date.now(); 
      };
      
      rec.onresult = (ev) => {
        let interim = '';
        let newFinalText = '';
        
        for (let i = 0; i < ev.results.length; i++) {
          const result = ev.results[i];
          const transcript = result[0]?.transcript || '';
          
          if (transcript) {
            lastActivity = Date.now();
            
            if (result.isFinal) {
              newFinalText += (newFinalText ? ' ' : '') + transcript;
            } else if (!iOS) {
              // Only use interim results on non-iOS devices
              interim += (interim ? ' ' : '') + transcript;
            }
          }
        }
        
        // Update final text (accumulate across restarts)
        if (newFinalText) {
          finalText += (finalText ? ' ' : '') + newFinalText;
        }
        
        // Update interim (reset each time)
        interimText = interim;
        
        // Provide feedback
        const fullText = (finalText + (interimText ? ' ' + interimText : '')).trim();
        onInterim(fullText);
        
        // On iOS, if we got final results, we're likely done
        if (iOS && newFinalText && shouldStop()) {
          setTimeout(() => endAll('ios-final'), 100);
        }
      };
      
      rec.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        
        // Handle iOS-specific errors
        if (iOS && event.error === 'not-allowed') {
          endAll('permission-denied');
          return;
        }
        
        if (shouldStop()) {
          endAll('error');
        } else {
          restart();
        }
      };
      
      rec.onend = () => {
        if (shouldStop()) {
          endAll('ended');
        } else {
          restart();
        }
      };
      
      try { 
        rec.start(); 
        onStatus('Listening…'); 
      } catch (err) {
        console.warn('Failed to start recognition:', err);
        if (shouldStop()) {
          endAll('start-failed');
        } else {
          restart();
        }
      }
    };
    
    const restart = () => {
      // Longer delay on iOS to avoid conflicts
      const delay = iOS ? 300 : 140;
      setTimeout(() => { 
        if (!stopped) startRecognizer(); 
      }, delay);
    };
    
    // Watchdog timer with iOS-friendly interval
    const guardInterval = iOS ? 200 : 120;
    const guard = setInterval(() => {
      if (stopped) { 
        clearInterval(guard); 
        return; 
      }
      if (shouldStop()) { 
        clearInterval(guard); 
        endAll('timeout'); 
      }
    }, guardInterval);
    
    // Begin
    onInterim(''); 
    onStatus('Preparing mic…');
    
    // Small delay before starting on iOS
    if (iOS) {
      setTimeout(startRecognizer, 100);
    } else {
      startRecognizer();
    }
  });
}

// Additional iOS-specific utility
export function getSpeechRecognitionSupport() {
  const hasAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const iOS = isIOS();
  
  return {
    supported: hasAPI,
    isIOS: iOS,
    limitations: iOS ? [
      'Limited session duration (~5 seconds)',
      'Interim results may not be available',
      'Requires user interaction to start',
      'May not work in all browsers'
    ] : []
  };
}
