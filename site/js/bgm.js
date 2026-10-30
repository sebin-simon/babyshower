/**
 * Sun or Shine: Background Lullaby (BGM).
 *
 * Plays a gentle, antique music-box rendition of Brahms' Lullaby (Wiegenlied)
 * synthesized in real-time via Web Audio API (0 KB download, 100% offline).
 *
 * Also supports an optional custom audio file (e.g. site/audio/lullaby.mp3):
 * if found, it streams that instead; otherwise falls back gracefully to the music box.
 */
import { CONFIG } from './config.js';

// Frequencies for Brahms' Lullaby notes (Hz)
const NOTE_FREQ = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
};

// Melody: [noteName, durationInBeats]
const MELODY = [
  // Pickup
  ['E4', 0.5], ['E4', 0.5],
  // Bar 1
  ['G4', 2.0], ['E4', 0.5], ['E4', 0.5],
  // Bar 2
  ['G4', 2.0], ['E4', 0.5], ['G4', 0.5],
  // Bar 3
  ['C5', 1.5], ['B4', 0.5], ['A4', 1.0],
  // Bar 4
  ['A4', 0.5], ['G4', 1.5], ['D4', 0.5], ['E4', 0.5],
  // Bar 5
  ['F4', 2.0], ['D4', 0.5], ['E4', 0.5],
  // Bar 6
  ['F4', 2.0], ['D4', 0.5], ['F4', 0.5],
  // Bar 7
  ['B4', 1.5], ['A4', 0.5], ['G4', 1.0],
  // Bar 8
  ['B4', 1.0], ['C5', 2.0],

  // Chorus / Second half
  // Pickup
  ['C4', 0.5], ['C4', 0.5],
  // Bar 9
  ['C5', 2.0], ['A4', 0.5], ['F4', 0.5],
  // Bar 10
  ['G4', 2.0], ['E4', 0.5], ['C4', 0.5],
  // Bar 11
  ['F4', 1.0], ['G4', 1.0], ['A4', 1.0],
  // Bar 12
  ['G4', 2.0], ['C4', 0.5], ['C4', 0.5],
  // Bar 13
  ['C5', 2.0], ['A4', 0.5], ['F4', 0.5],
  // Bar 14
  ['G4', 2.0], ['E4', 0.5], ['C4', 0.5],
  // Bar 15
  ['F4', 1.0], ['E4', 1.0], ['D4', 1.0],
  // Bar 16
  ['C4', 2.5], [null, 0.5],
];

// Bass root accompaniment on key downbeats: [beatPosition, noteName]
const BASS = [
  [1.0, 'C3'],
  [4.0, 'C3'],
  [7.0, 'F3'],
  [10.0, 'C3'],
  [13.0, 'G3'],
  [16.0, 'G3'],
  [19.0, 'G3'],
  [22.0, 'C3'],
  [26.0, 'F3'],
  [29.0, 'C3'],
  [32.0, 'F3'],
  [35.0, 'C3'],
  [39.0, 'F3'],
  [42.0, 'C3'],
  [45.0, 'G3'],
  [48.0, 'C3'],
];

const TEMPO_BPM = 54; // Gentle, sleepy music box tempo
const SEC_PER_BEAT = 60 / TEMPO_BPM;

let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let userWantedPlay = false;
let loopTimer = null;
let customAudio = null;
let hasCustomAudio = false;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Authentic music-box tine synthesis.
 * Uses exact physical cantilever beam overtones: 1.0f (fundamental),
 * 2.756f (first inharmonic mode), and 5.404f (second inharmonic mode).
 */
function playTine(ac, outNode, freq, time, duration = 1.8, volume = 0.14) {
  if (!freq) return;

  const osc1 = ac.createOscillator();
  const gain1 = ac.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, time);

  // Inharmonic 1st mode (cantilever steel tine ratio: 2.756)
  const osc2 = ac.createOscillator();
  const gain2 = ac.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2.756, time);

  // Inharmonic 2nd mode (ratio: 5.404)
  const osc3 = ac.createOscillator();
  const gain3 = ac.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(freq * 5.404, time);

  // Natural bell/music-box exponential envelope
  gain1.gain.setValueAtTime(volume, time);
  gain1.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  gain2.gain.setValueAtTime(volume * 0.22, time);
  gain2.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.35);

  gain3.gain.setValueAtTime(volume * 0.08, time);
  gain3.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.15);

  osc1.connect(gain1);
  osc2.connect(gain2);
  osc3.connect(gain3);

  gain1.connect(outNode);
  gain2.connect(outNode);
  gain3.connect(outNode);

  osc1.start(time);
  osc2.start(time);
  osc3.start(time);

  osc1.stop(time + duration + 0.05);
  osc2.stop(time + duration * 0.35 + 0.05);
  osc3.stop(time + duration * 0.15 + 0.05);
}

/** Schedules one complete loop of Brahms' Lullaby. */
function scheduleLullabyLoop(startTime) {
  const ac = getAudioContext();
  if (!ac || !masterGain || !isPlaying) return;

  let currentBeat = 0;

  // Schedule melody tines
  MELODY.forEach(([note, beats]) => {
    if (note && NOTE_FREQ[note]) {
      const noteTime = startTime + currentBeat * SEC_PER_BEAT;
      // Note duration affects decay: longer notes ring slightly longer
      const duration = Math.min(2.5, Math.max(1.4, beats * SEC_PER_BEAT * 1.3));
      playTine(ac, masterGain, NOTE_FREQ[note], noteTime, duration, 0.14);
    }
    currentBeat += beats;
  });

  // Schedule gentle bass tines on measure downbeats
  BASS.forEach(([beatPos, note]) => {
    if (note && NOTE_FREQ[note]) {
      const bassTime = startTime + beatPos * SEC_PER_BEAT;
      playTine(ac, masterGain, NOTE_FREQ[note], bassTime, 2.4, 0.09);
    }
  });

  const loopDuration = currentBeat * SEC_PER_BEAT;

  // Schedule the next loop slightly before the current one ends
  const nextLoopTime = startTime + loopDuration;
  const timeoutMs = Math.max(100, (nextLoopTime - ac.currentTime - 0.2) * 1000);

  clearTimeout(loopTimer);
  loopTimer = setTimeout(() => {
    if (isPlaying) {
      scheduleLullabyLoop(nextLoopTime);
    }
  }, timeoutMs);
}

/** Starts playing the lullaby with a smooth volume fade-in. */
export async function playLullaby() {
  if (isPlaying) return;
  isPlaying = true;
  userWantedPlay = true;

  // Check if custom MP3 audio exists and can play
  if (customAudio && hasCustomAudio) {
    try {
      customAudio.volume = 0;
      await customAudio.play();
      fadeAudio(customAudio, 0.28, 1200);
      updateBtnState(true);
      return;
    } catch {
      // Fallback to Web Audio music box
      hasCustomAudio = false;
    }
  }

  // Web Audio Music Box synthesizer
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value || 0.001, now);
  // Soft, polite background volume level
  masterGain.gain.linearRampToValueAtTime(0.7, now + 1.2);

  scheduleLullabyLoop(now + 0.05);
  updateBtnState(true);
}

/** Pauses the lullaby with a gentle fade-out. */
export function pauseLullaby() {
  if (!isPlaying) return;
  isPlaying = false;
  clearTimeout(loopTimer);

  if (customAudio && hasCustomAudio && !customAudio.paused) {
    fadeAudio(customAudio, 0, 600, () => customAudio.pause());
    updateBtnState(false);
    return;
  }

  if (audioCtx && masterGain) {
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
  }

  updateBtnState(false);
}

/** Toggle play / pause */
export function toggleLullaby() {
  if (isPlaying) {
    userWantedPlay = false;
    pauseLullaby();
  } else {
    playLullaby();
  }
}

/** Linear volume fade helper */
function fadeAudio(audio, targetVolume, durationMs, onDone) {
  const startVol = audio.volume;
  const startTime = performance.now();
  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    audio.volume = Math.max(0, Math.min(1, startVol + (targetVolume - startVol) * progress));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else if (onDone) {
      onDone();
    }
  };
  requestAnimationFrame(step);
}

function updateBtnState(playing) {
  const btn = document.getElementById('musicToggle');
  if (!btn) return;
  btn.classList.toggle('playing', playing);
  btn.setAttribute('aria-pressed', String(playing));
  btn.setAttribute('aria-label', playing ? 'Pause lullaby' : 'Play lullaby background music');
  btn.setAttribute('title', playing ? 'Pause lullaby' : 'Play lullaby');
}

/** Initialize BGM button & test for custom MP3 audio. */
export function initBgm() {
  const btn = document.getElementById('musicToggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    toggleLullaby();
  });

  // Check if custom audio file exists (optional config)
  const customSrc = CONFIG.lullabySrc || 'audio/lullaby.mp3';
  if (customSrc) {
    const a = new Audio();
    a.src = customSrc;
    a.loop = true;
    a.preload = 'metadata';
    a.addEventListener('canplaythrough', () => {
      customAudio = a;
      hasCustomAudio = true;
    }, { once: true });
    a.addEventListener('error', () => {
      hasCustomAudio = false;
    }, { once: true });
  }

  // Auto-pause when user leaves the browser tab; resume smoothly when returning
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isPlaying) {
        if (customAudio && hasCustomAudio) customAudio.pause();
        else if (audioCtx && masterGain) {
          masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        }
      }
    } else {
      if (userWantedPlay && isPlaying) {
        if (customAudio && hasCustomAudio) {
          customAudio.play().catch(() => {});
          fadeAudio(customAudio, 0.28, 800);
        } else if (audioCtx && masterGain) {
          const now = audioCtx.currentTime;
          masterGain.gain.setValueAtTime(0.0001, now);
          masterGain.gain.linearRampToValueAtTime(0.7, now + 1.0);
        }
      }
    }
  });
}

