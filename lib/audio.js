export async function unlockAudio(audioEl) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!window.__ac) window.__ac = new Ctx();
      if (window.__ac.state === "suspended") await window.__ac.resume();
      const osc = window.__ac.createOscillator();
      const g = window.__ac.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(window.__ac.destination);
      osc.start();
      osc.stop(window.__ac.currentTime + 0.01);
    }
  } catch (e) {
    console.warn("unlockAudio(AudioContext) failed:", e);
  }

  try {
    if (audioEl) {
      audioEl.preload = "auto";
      audioEl.crossOrigin = "anonymous";
      audioEl.setAttribute("playsinline", "true");
      audioEl.muted = true;
      await audioEl.play().catch(() => {});
      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.muted = false;
    }
  } catch (e) {
    console.warn("unlockAudio(<audio>) failed:", e);
  }
}

/**
 * Play captain audio from /public/audio/<file>.mp3
 * @param {HTMLAudioElement} audioEl
 * @param {string} fileName e.g. "scn1_captain_init.mp3"
 * @returns {Promise<boolean>} resolves true if playback started and ended, false on failure
 */
export function playCaptainAudio(audioEl, fileName) {
  if (!audioEl || !fileName) return Promise.resolve(false);

  const candidates = [
    `/audio/${fileName}`, // recommended (public/ audio/)
    `/${fileName}`        // fallback if caller passed a subfolder already
  ];

  return new Promise((resolve) => {
    let settled = false;
    let to = null;
    let lastErr = null;

    const clean = () => {
      audioEl.onended = audioEl.onerror = audioEl.oncanplay = audioEl.onloadedmetadata = null;
      if (to) { clearTimeout(to); to = null; }
    };

    const done = (ok) => {
      if (settled) return;
      settled = true;
      clean();
      resolve(!!ok);
    };

    const tryUrl = (i) => {
      if (i >= candidates.length) {
        if (lastErr) console.error("Captain audio failed:", lastErr);
        return done(false);
      }

      clean();
      try { audioEl.pause(); audioEl.currentTime = 0; } catch {}

      const src = candidates[i];
      audioEl.preload = "auto";
      audioEl.crossOrigin = "anonymous";
      audioEl.setAttribute("playsinline", "true");
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.src = src;

      audioEl.onloadedmetadata = () => {
        // Set a watchdog so we don't hang if onended never fires
        const ms = isFinite(audioEl.duration) && audioEl.duration > 0
          ? Math.min(15000, audioEl.duration * 1000 + 1000)
          : 12000;
        to = setTimeout(() => done(true), ms);
      };

      audioEl.oncanplay = () => {
        const p = audioEl.play();
        if (p && p.catch) {
          p.catch((err) => {
            lastErr = err;
            // Try next candidate
            tryUrl(i + 1);
          });
        }
      };

      audioEl.onended = () => done(true);
      audioEl.onerror = (e) => {
        lastErr = new Error(`audio error for ${src} (network=${audioEl.networkState}, ready=${audioEl.readyState})`);
        tryUrl(i + 1);
      };
    };

    tryUrl(0);
  });
}

export function stopCaptainAudio(audioEl) {
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch {}
}
