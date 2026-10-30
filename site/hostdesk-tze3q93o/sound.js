/**
 * Procedural Web Audio engine for the gender reveal show and lucky draw.
 * 100% self-contained synthesized sounds — no external MP3s, no network requests.
 * Uses Web Audio API (oscillators, biquad filters, gain envelopes).
 */

let ctx = null;
let enabled = true;

/** Safely get or resume the AudioContext on user interaction. */
function getCtx() {
  if (!enabled) return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(val) {
  enabled = !!val;
  if (!enabled && ctx && ctx.state === 'running') {
    ctx.suspend().catch(() => {});
  } else if (enabled && ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return enabled;
}

export function toggleSound() {
  return setSoundEnabled(!enabled);
}

/** Pre-warm audio on initial user touch or click. */
export function unlockAudio() {
  getCtx();
}

/**
 * 1. LUCKY DRAW: REEL TICK
 * Crisp wooden / ratchet click that sounds as each name ticks past.
 * Pitch subtly drops as the wheel slows down (delay increases).
 */
export function playTick(delay = 50) {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Base frequency drops slightly as the wheel decelerates (from ~1050 Hz down to ~720 Hz)
  const norm = Math.min(1, Math.max(0, (delay - 40) / 360));
  const freq = 1050 - norm * 330;

  // Percussive tone click
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.035);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq * 1.2, now);
  filter.Q.setValueAtTime(3.5, now);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.04);

  // Micro wooden tap noise
  try {
    const bufferSize = Math.floor(ac.sampleRate * 0.012);
    const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1400, now);
    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ac.destination);
    noise.start(now);
  } catch {
    /* fallback if buffer creation fails */
  }
}

/**
 * 2. LUCKY DRAW: WINNER CELEBRATION CHIMES
 * Joyful ascending arpeggio and ringing chime chords when a winner lands.
 */
export function playWin() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Notes: C5, E5, G5, B5, C6, E6
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
  notes.forEach((freq, idx) => {
    const start = now + idx * 0.065;
    playChime(ac, freq, start, 1.3, 0.16);
  });

  // Warm chord ring sustained underneath
  setTimeout(() => {
    const a = getCtx();
    if (!a) return;
    const t = a.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
      playChime(a, freq, t, 2.2, 0.12);
    });
  }, 400);
}

/** Helper to synthesize a sweet chime / celesta bell. */
function playChime(ac, freq, time, duration = 1.2, volume = 0.15) {
  // Fundamental sine
  const osc1 = ac.createOscillator();
  const gain1 = ac.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, time);

  // Subtle 2nd harmonic for bell warmth
  const osc2 = ac.createOscillator();
  const gain2 = ac.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, time);

  gain1.gain.setValueAtTime(volume, time);
  gain1.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  gain2.gain.setValueAtTime(volume * 0.35, time);
  gain2.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.65);

  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(ac.destination);
  gain2.connect(ac.destination);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + duration);
  osc2.stop(time + duration);
}

/**
 * 3. REVEAL SUSPENSE: HEARTBEAT DRUMROLL
 * Deep visceral low-frequency heartbeat thump before the reveal.
 * Level 1, 2, 3 increase in depth and resonance.
 */
export function playHeartbeat(level = 1) {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const vol = 0.35 + level * 0.15;

  // Pulse 1 (lub)
  thump(ac, 95 + level * 8, 42, now, 0.13, vol * 0.75);
  // Pulse 2 (dub - slightly louder)
  thump(ac, 110 + level * 10, 38, now + 0.13, 0.20, vol);
}

function thump(ac, startFreq, endFreq, time, duration, volume) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, time);
  osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(170, time);

  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/**
 * 4. REVEAL BOOM: TRIUMPHANT FANFARE
 * Dramatic burst whoosh + celebratory fanfare chord at the explosion!
 */
export function playReveal(team = 'sun') {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Whoosh / fireworks explosion swell
  try {
    const bufferSize = Math.floor(ac.sampleRate * 0.85);
    const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      out[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.6);
    }
    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.8);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    noise.start(now);
  } catch {
    /* */
  }

  // Triumphant fanfare chords:
  // Team Sun: D major fanfare (warm, golden, sunny)
  // Team Shine: E major fanfare (shimmering, bright, magical)
  const freqs = team === 'sun'
    ? [293.66, 369.99, 440.00, 587.33, 739.99, 880.00, 1174.66]
    : [329.63, 415.30, 493.88, 659.25, 830.61, 987.77, 1318.51];

  freqs.forEach((f, idx) => {
    const t = now + 0.05 + idx * 0.04;
    playChime(ac, f, t, 2.5, 0.16);
  });

  // Secondary sparkling shimmer cascade
  for (let s = 0; s < 8; s++) {
    const f = 1500 + Math.random() * 1200;
    playChime(ac, f, now + 0.4 + s * 0.12, 0.6, 0.07);
  }
}

