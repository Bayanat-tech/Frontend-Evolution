let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;

export function playSupportRing() {
  if (typeof window === "undefined") return;
  if (isSupportRingMuted()) return;
  const now = Date.now();
  if (now - lastPlayedAt < 2500) return;
  lastPlayedAt = now;

  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    audioContext ||= new AudioContextCtor();
    const context = audioContext;
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const start = context.currentTime + 0.02;
    playTone(context, start, 880, 0.08, 0.035);
    playTone(context, start + 0.12, 1174, 0.1, 0.04);
  } catch {
    // Some browsers block audio until user interaction. The next admin click will unlock it.
  }
}

export function isSupportRingMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("bayanat_support_ring_muted") === "Y";
}

export function setSupportRingMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("bayanat_support_ring_muted", muted ? "Y" : "N");
  window.dispatchEvent(new CustomEvent("support:ring-muted-changed", { detail: { muted } }));
}

function playTone(context: AudioContext, start: number, frequency: number, duration: number, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
