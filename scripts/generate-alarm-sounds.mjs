/**
 * Generates short PCM WAV assets for notification sounds (mono, 44100 Hz).
 * Run: node scripts/generate-alarm-sounds.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

const SAMPLE_RATE = 44100;
const DURATION_SEC = 2;

/** Simple sine + envelope; second harmonic for warmer tones */
function gentleTone(freq1, freq2Ratio = 2, amp = 0.35) {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const attack = Math.floor(SAMPLE_RATE * 0.08);
  const releaseStart = Math.floor(n * 0.85);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (i < attack) {
      env = i / attack;
    } else if (i > releaseStart) {
      env = (n - i) / (n - releaseStart);
    }
    const f2 = freq1 * freq2Ratio;
    const v =
      amp *
      env *
      (0.65 * Math.sin(2 * Math.PI * freq1 * t) + 0.35 * Math.sin(2 * Math.PI * f2 * t));
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

function bellMix() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const freqs = [523.25, 659.25, 783.99];
  const attack = Math.floor(SAMPLE_RATE * 0.02);
  const releaseStart = Math.floor(n * 0.55);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (i < attack) {
      env = i / attack;
    } else if (i > releaseStart) {
      env = Math.exp(-(i - releaseStart) / (SAMPLE_RATE * 0.4));
    }
    let sum = 0;
    for (const f of freqs) {
      sum += Math.sin(2 * Math.PI * f * t);
    }
    const v = 0.22 * env * (sum / freqs.length);
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

function digitalBeep() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const burst = Math.floor(SAMPLE_RATE * 0.08);
  const gap = Math.floor(SAMPLE_RATE * 0.06);
  const period = burst + gap;
  let phase = 0;
  const freq = 880;
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const cyclePos = i % period;
    let v = 0;
    if (cyclePos < burst) {
      phase += 2 * Math.PI * freq * dt;
      v = 0.45 * Math.sin(phase);
    }
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

function chirpBirds() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  let phase = 0;
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 1800 + 400 * Math.sin(2 * Math.PI * 2 * t);
    phase += 2 * Math.PI * f * dt;
    const env = 0.25 + 0.2 * Math.sin(2 * Math.PI * 5 * t);
    const v = 0.18 * env * Math.sin(phase);
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i], offset);
    offset += 2;
  }
  return buf;
}

/**
 * Soft piano: low register, few partials, high harmonics decay faster than the
 * fundamental (real piano strings lose brightness quickly — unlike a xylophone).
 */
function softPiano() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const dt = 1 / SAMPLE_RATE;
  const attack = Math.floor(SAMPLE_RATE * 0.003);
  const baseDecayTau = SAMPLE_RATE * 1.35;

  // Warm low partials only — strong rolloff above the 4th harmonic.
  const partials = [
    { ratio: 1, weight: 1, decayMult: 1 },
    { ratio: 2, weight: 0.38, decayMult: 1.6 },
    { ratio: 3, weight: 0.14, decayMult: 2.4 },
    { ratio: 4, weight: 0.05, decayMult: 3.5 },
  ];

  // Gentle two-note figure in a low register (G3 → B3).
  const notes = [
    { start: 0, freq: 196 }, // G3
    { start: Math.floor(SAMPLE_RATE * 0.72), freq: 246.94 }, // B3
  ];

  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const note of notes) {
      const rel = i - note.start;
      if (rel < 0) {
        continue;
      }
      const t = rel * dt;
      const attackEnv = rel < attack ? rel / attack : 1;
      const noteSustain = Math.exp(-rel / (SAMPLE_RATE * 2.1));

      let sum = 0;
      for (const p of partials) {
        const inharm = 1 + 0.00006 * p.ratio * p.ratio;
        const f = note.freq * p.ratio * inharm;
        const partialDecay = Math.exp(-rel / (baseDecayTau / p.decayMult));
        // Brief hammer brightness on upper partials only — fades in ~40 ms.
        const hammer =
          p.ratio >= 2 ? 1 + 0.55 * Math.exp(-rel / (SAMPLE_RATE * 0.035)) : 1;
        sum += p.weight * hammer * partialDecay * Math.sin(2 * Math.PI * f * t);
      }
      v += 0.17 * attackEnv * noteSustain * sum;
    }
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

/** Ascending four-note chime (C5 → C6). */
function sunriseChime() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const noteLen = Math.floor(SAMPLE_RATE * 0.35);
  const gap = Math.floor(SAMPLE_RATE * 0.08);
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const cycle = noteLen + gap;
    const pos = i % (cycle * notes.length);
    const noteIdx = Math.floor(pos / cycle);
    const notePos = pos % cycle;
    let v = 0;
    if (noteIdx < notes.length && notePos < noteLen) {
      const t = notePos * dt;
      const f = notes[noteIdx];
      const env = Math.exp(-notePos / (SAMPLE_RATE * 0.55));
      v = 0.32 * env * (0.7 * Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.76 * t));
    }
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

/** Bright single strike with long crystal decay, repeated once. */
function crystalDing() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const strikes = [0, Math.floor(SAMPLE_RATE * 1.05)];
  const freqs = [1318.5, 1567.98, 2093];
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const start of strikes) {
      const rel = i - start;
      if (rel < 0) continue;
      const t = rel * dt;
      const env = Math.exp(-rel / (SAMPLE_RATE * 0.85));
      let sum = 0;
      for (const f of freqs) {
        sum += Math.sin(2 * Math.PI * f * t);
      }
      v += 0.2 * env * (sum / freqs.length);
    }
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

/** Soft surf-like noise with slow swell. */
function oceanWaves() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  let lp = 0;
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.35 * t);
    const noise = Math.random() * 2 - 1;
    lp += 0.04 * (noise - lp);
    const v = 0.28 * swell * lp;
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

/** Detuned mid strings with slow vibrato. */
function warmStrings() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const base = 220;
  const detunes = [0, 0.003, -0.004, 0.006];
  const attack = Math.floor(SAMPLE_RATE * 0.25);
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const env = i < attack ? i / attack : 1;
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 4.5 * t);
    let sum = 0;
    for (const d of detunes) {
      const f = base * (1 + d) * vib;
      sum += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t);
    }
    const v = 0.14 * env * (sum / detunes.length);
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

/** Urgent low pulse — carrier with slow amplitude modulation. */
function alertPulse() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const carrier = 440;
  const pulseHz = 2.2;
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(2 * Math.PI * pulseHz * t));
    const v = 0.38 * pulse * Math.sin(2 * Math.PI * carrier * t);
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

/** Singing-bowl tone: low fundamental with beating partials. */
function zenBowl() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const fundamental = 146.83; // D3
  const partials = [
    [1, 1],
    [2.01, 0.42],
    [3.05, 0.22],
    [4.12, 0.12],
    [5.4, 0.07],
  ];
  const attack = Math.floor(SAMPLE_RATE * 0.06);
  const dt = 1 / SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const attackEnv = i < attack ? i / attack : 1;
    const decayEnv = Math.exp(-i / (SAMPLE_RATE * 1.6));
    let sum = 0;
    for (const [ratio, weight] of partials) {
      sum += weight * Math.sin(2 * Math.PI * fundamental * ratio * t);
    }
    const v = 0.26 * attackEnv * decayEnv * sum;
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return samples;
}

const GENERATORS = {
  gentle_rise: () => encodeWav(gentleTone(392, 2)),
  morning_glow: () => encodeWav(gentleTone(523.25, 3)),
  classic_bell: () => encodeWav(bellMix()),
  digital_beep: () => encodeWav(digitalBeep()),
  soft_piano: () => encodeWav(softPiano()),
  nature_birds: () => encodeWav(chirpBirds()),
  sunrise_chime: () => encodeWav(sunriseChime()),
  crystal_ding: () => encodeWav(crystalDing()),
  ocean_waves: () => encodeWav(oceanWaves()),
  warm_strings: () => encodeWav(warmStrings()),
  alert_pulse: () => encodeWav(alertPulse()),
  zen_bowl: () => encodeWav(zenBowl()),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [base, gen] of Object.entries(GENERATORS)) {
  const outPath = path.join(OUT_DIR, `${base}.wav`);
  fs.writeFileSync(outPath, gen());
  console.warn(`wrote ${path.relative(process.cwd(), outPath)}`);
}
