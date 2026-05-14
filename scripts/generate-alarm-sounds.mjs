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

/** Soft piano-ish note: many decaying partials + fast attack (not a pure sine). */
function softPiano() {
  const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
  const samples = new Int16Array(n);
  const fundamental = 261.63; // C4
  const harmonics = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const weights = [1, 0.52, 0.34, 0.24, 0.17, 0.12, 0.09, 0.065, 0.05, 0.04, 0.032, 0.025];
  const attack = Math.floor(SAMPLE_RATE * 0.004);
  const decayTau = SAMPLE_RATE * 0.95;
  const dt = 1 / SAMPLE_RATE;

  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const attackEnv = i < attack ? i / attack : 1;
    const decayEnv = Math.exp(-i / decayTau);
    const env = attackEnv * decayEnv;

    let sum = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const k = harmonics[h];
      const inharm = 1 + 0.00012 * k * k;
      const f = fundamental * k * inharm;
      sum += weights[h] * Math.sin(2 * Math.PI * f * t);
    }
    const v = 0.2 * env * sum;
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
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [base, gen] of Object.entries(GENERATORS)) {
  const outPath = path.join(OUT_DIR, `${base}.wav`);
  fs.writeFileSync(outPath, gen());
  console.warn(`wrote ${path.relative(process.cwd(), outPath)}`);
}
