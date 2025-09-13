// lib/audio.js
// Robust, Next.js-friendly audio utilities for your trainer UI.

const exts = ["mp3", "m4a"]; // try in order
const CAPTAIN_PREFIX = "/audio"; // files live under /public/audio/

// --- Lightweight event bus so UI can subscribe to audio state
const bus = new EventTarget();
export function onAudio(event, handler) { bus.addEventListener(event, handler); return () => bus.removeEventListener(event, handler); }
function emit(type, detail) { bus.dispatchEvent(new CustomEvent(type, { detail })); }

// --- Shared <audio> element (one instance avoids overlapping)
let sharedAudio = null;
function ensureElement() {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
    sharedAudio.crossOrigin = "anonymous";
    sharedAudio.setAttribute("playsinline", "true");
  }
  return sharedAudio;
}

// --- Unlock for iOS/Safari: call after a user gesture (Prepare Mic / Start)
export async function unlockAudio(audioEl) {
  const el = audioEl || ensureElement();

  // Try AudioContext resume + silent blip
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
    // no-op: some browsers won’t allow this before gesture, that’s okay
    console.warn("[audio] unlock AudioContext failed:", e);
  }

  // Try element prime
  try {
    el.muted = true;
    await el.play().catch(() => {});
    el.pause();
    el.currentTime = 0;
    el.muted = false;
  } catch (e) {
    console.warn("[audio] unlock element failed:", e);
  }

  emit("unlocked", {});
  return el;
}

// --- Build src from scenario + cue (e.g., scn1 + "init" => /audio/scn1_captain_init.mp3)
function captainSrcFromCue(scnId, cue, ext = "mp3") {
  return `${CAPTAIN_PREFIX}/${scnId}_captain_${cue}.${ext}`;
}

// --- Low-level play by absolute/relative path inside /public
async function playFromPath(pathOrFileBase, label = "captain") {
  const el = ensureElement();
  emit("status", { who: label, status: "loading", src: pathOrFileBase });

  // Clean old handlers
  el.onended = el.onerror = el.oncanplay = el.onloadedmetadata = null;

  // Build candidate URLs:
  // - If caller passed "scn1_captain_init.mp3", try /audio/<file>
  // - If caller passed a bare base "scn1_captain_init", try with .mp3 then .m4a
  const looksLikeFile = /\.\w{2,4}$/i.test(pathOrFileBase);
  const candidates = looksLikeFile
    ? [`${CAPTAIN_PREFIX}/${pathOrFileBase}`, `/${pathOrFileBase}`]
    : exts.map(ext => `${CAPTAIN_PREFIX}/${pathOrFileBase}.${ext}`);

  let lastErr = null;

  for (const src of candidates) {
    try {
      el.pause(); el.currentTime = 0;
    } catch {}
    el.src = src;
    el.muted = false; el.volume = 1;

    const ok = await new Promise((resolve) => {
      let guard = null;

      el.onloadedmetadata = () => {
        const ms = isFinite(el.duration) && el.duration > 0 ? Math.min(15000, el.duration * 1000 + 1000) : 12000;
        guard = setTimeout(() => resolve(true), ms); // if onended never fires, resolve anyway
      };

      el.oncanplay = async () => {
        try {
          await el.play();
          emit("status", { who: label, status: "playing", src });
        } catch (err) {
          lastErr = err;
          resolve(false);
        }
      };

      el.onended = () => {
        if (guard) clearTimeout(guard);
        emit("status", { who: label, status: "ended", src });
        resolve(true);
      };

      el.onerror = () => {
        resolve(false);
      };
    });

    if (ok) return true;
  }

  console.error(`[audio] failed to play ${label}`, { base: pathOrFileBase, lastErr });
  emit("status", { who: label, status: "error", src: pathOrFileBase, error: lastErr?.message || "error" });
  return false;
}

// --- Public API: play Captain by cue or by filename
/**
 * Play by cue: playCaptainCue('scn1','init')
 * Play by filename: playCaptainFile('scn1_captain_init.mp3')
 */
export async function playCaptainCue(scnId, cue) {
  for (const ext of exts) {
    const path = captainSrcFromCue(scnId, cue, ext);
    const ok = await playFromPath(path, "captain");
    if (ok) return true;
  }
  return false;
}
export function playCaptainFile(fileNameOrBase) {
  // Accept "scn1_captain_init.mp3" or "scn1_captain_init"
  return playFromPath(fileNameOrBase, "captain");
}

// --- Preload a set of cues for faster first play
export function preloadCaptainCues(scnId, cues = ["init", "ready", "hail", "ack_update", "final"]) {
  cues.forEach(cue => {
    exts.forEach(ext => {
      const href = captainSrcFromCue(scnId, cue, ext);
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "audio";
      link.href = href;
      document.head.appendChild(link);
    });
  });
}

// --- Stop everything
export function stopAudio() {
  try { ensureElement().pause(); } catch {}
}
