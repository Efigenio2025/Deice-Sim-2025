// lib/audio.js

const exts = ["mp3", "m4a"];
const ROOT = "/audio"; // served from /public/audio

// Mini event bus so UI can show audio status
const bus = new EventTarget();
export function onAudio(event, handler) {
  bus.addEventListener(event, handler);
  return () => bus.removeEventListener(event, handler);
}
function emit(type, detail) { bus.dispatchEvent(new CustomEvent(type, { detail })); }

// Shared <audio> element
let el;
function getEl() {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.setAttribute("playsinline", "true");
  }
  return el;
}

// iOS/Safari unlock: call after a user gesture (Prepare Mic)
export async function unlockAudio() {
  const a = getEl();

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!window.__ac) window.__ac = new Ctx();
      if (window.__ac.state === "suspended") await window.__ac.resume();
      const osc = window.__ac.createOscillator();
      const g = window.__ac.createGain();
      g.gain.value = 0; osc.connect(g).connect(window.__ac.destination);
      osc.start(); osc.stop(window.__ac.currentTime + 0.01);
    }
  } catch (e) { /* no-op */ }

  try {
    a.muted = true;
    await a.play().catch(() => {});
    a.pause(); a.currentTime = 0; a.muted = false;
  } catch (e) { /* no-op */ }

  emit("status", { who: "captain", status: "unlocked" });
}

function captainSrc(scnId, cue, ext = "mp3") {
  return `${ROOT}/${scnId}/captain_${cue}.${ext}`;
}

async function playFromCandidates(label, candidates) {
  const a = getEl();
  a.onended = a.onerror = a.oncanplay = a.onloadedmetadata = null;
  emit("status", { who: label, status: "loading" });

  let lastErr = null;
  for (const src of candidates) {
    try { a.pause(); a.currentTime = 0; } catch {}
    a.src = src;
    try { a.load(); } catch {}
    a.muted = false; a.volume = 1;

    const ok = await new Promise((resolve) => {
      let guard = null;

      a.onloadedmetadata = () => {
        const ms = isFinite(a.duration) && a.duration > 0 ? Math.min(15000, a.duration * 1000 + 1000) : 12000;
        guard = setTimeout(() => resolve(true), ms); // safety if onended never fires
      };

      a.oncanplay = async () => {
        try {
          await a.play();
          emit("status", { who: label, status: "playing", src });
        } catch (err) {
          lastErr = err;
          resolve(false);
        }
      };

      a.onended = () => { if (guard) clearTimeout(guard); emit("status", { who: label, status: "ended" }); resolve(true); };
      a.onerror = () => resolve(false);
    });

    if (ok) return true;
  }
  console.error(`[audio] failed for ${label}`, { lastErr, candidates });
  emit("status", { who: label, status: "error" });
  return false;
}

// Public API
export async function playCaptainCue(scnId, cue) {
  const candidates = exts.map(ext => captainSrc(scnId, cue, ext));
  return playFromCandidates("captain", candidates);
}

export function preloadCaptainCues(scnId, cues = []) {
  cues.forEach(cue => {
    const link = document.createElement("link");
    link.rel = "preload"; link.as = "audio";
    link.href = captainSrc(scnId, cue, "mp3");
    document.head.appendChild(link);
    const link2 = document.createElement("link");
    link2.rel = "preload"; link2.as = "audio";
    link2.href = captainSrc(scnId, cue, "m4a");
    document.head.appendChild(link2);
  });
}

export function stopAudio() {
  try { getEl().pause(); } catch {}
}
