// lib/audio.js

const exts = ["mp3", "m4a"];
const ROOT = "/audio"; // served from /public/audio
const SPEECH_TIMEOUT_MS = 15000;

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

function canUseSpeechSynthesis() {
  if (typeof window === "undefined") return false;
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
}

async function speakText(label, text) {
  const line = String(text || "").trim();
  if (!line || !canUseSpeechSynthesis()) return false;

  return new Promise((resolve) => {
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      resolve(ok);
    };

    try {
      const synth = window.speechSynthesis;
      if (!synth) {
        finish(false);
        return;
      }

      emit("status", { who: label, status: "loading", mode: "synth" });

      const utterance = new window.SpeechSynthesisUtterance(line);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      let guard = null;
      utterance.onstart = () => emit("status", { who: label, status: "playing", src: "synth" });
      utterance.onend = () => {
        if (guard) clearTimeout(guard);
        emit("status", { who: label, status: "ended" });
        finish(true);
      };
      utterance.onerror = (event) => {
        if (guard) clearTimeout(guard);
        console.error(`[audio] speech synthesis failed for ${label}`, event);
        emit("status", { who: label, status: "error" });
        finish(false);
      };

      try {
        synth.cancel();
      } catch (err) {
        console.warn("[audio] speech synthesis cancel failed", err);
      }

      synth.speak(utterance);

      guard = setTimeout(() => {
        emit("status", { who: label, status: "ended" });
        finish(true);
      }, Math.min(SPEECH_TIMEOUT_MS, Math.max(4000, line.length * 80)));
    } catch (err) {
      console.error(`[audio] speech synthesis crashed for ${label}`, err);
      emit("status", { who: label, status: "error" });
      finish(false);
    }
  });
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
export async function playCaptainCue(scnId, cue, fallbackText = "") {
  const candidates = exts.map(ext => captainSrc(scnId, cue, ext));
  const ok = await playFromCandidates("captain", candidates);
  if (ok) return true;

  const fallbackLine = typeof fallbackText === "string" ? fallbackText.trim() : "";
  if (!fallbackLine) return false;

  const synthOk = await speakText("captain", fallbackLine);
  if (synthOk) {
    console.warn(`[audio] using speech synthesis fallback for ${cue}`);
    return true;
  }

  return false;
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
