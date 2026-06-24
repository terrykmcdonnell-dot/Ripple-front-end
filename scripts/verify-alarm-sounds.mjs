/**
 * Ensures alarm sound IDs, WAV assets, and notification mappings stay in sync.
 * Run: node scripts/verify-alarm-sounds.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOUNDS_DIR = path.join(ROOT, 'assets', 'sounds');

const ALL_IDS = [
  'gentle-rise',
  'morning-glow',
  'classic-bell',
  'digital-beep',
  'soft-piano',
  'nature-birds',
  'sunrise-chime',
  'crystal-ding',
  'ocean-waves',
  'warm-strings',
  'alert-pulse',
  'zen-bowl',
];

const FREE_IDS = ALL_IDS.slice(0, 6);
const PRO_IDS = ALL_IDS.slice(6);

function idToFilename(id) {
  return `${id.replace(/-/g, '_')}.wav`;
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function extractRequireSources(tsText) {
  const map = {};
  const re = /'([^']+)':\s*require\('\.\.\/assets\/sounds\/([^']+)'\)/g;
  let m;
  while ((m = re.exec(tsText)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

function extractNotificationFiles(tsText) {
  const map = {};
  const re = /'([^']+)':\s*'([^']+\.wav)'/g;
  let m;
  while ((m = re.exec(tsText)) !== null) {
    if (m[1].includes('-')) {
      map[m[1]] = m[2];
    }
  }
  return map;
}

function extractAppJsonSounds(appJson) {
  return appJson.expo.plugins
    .flatMap((p) => (Array.isArray(p) && p[0] === 'expo-notifications' ? p[1]?.sounds ?? [] : []))
    .map((p) => path.basename(p));
}

function fail(msg) {
  console.error(`verify-alarm-sounds: ${msg}`);
  process.exit(1);
}

const wavFiles = fs.existsSync(SOUNDS_DIR)
  ? fs.readdirSync(SOUNDS_DIR).filter((f) => f.endsWith('.wav')).sort()
  : [];

const expectedWavs = ALL_IDS.map(idToFilename).sort();
for (const wav of expectedWavs) {
  if (!wavFiles.includes(wav)) {
    fail(`missing WAV asset: assets/sounds/${wav}`);
  }
}

const prefsText = readText('lib/settings-preferences.ts');
for (const id of ALL_IDS) {
  if (!prefsText.includes(`id: '${id}'`)) {
    fail(`settings-preferences missing option id: ${id}`);
  }
}

const accessText = readText('lib/alarm-sound-access.ts');
for (const id of FREE_IDS) {
  if (!accessText.includes(`'${id}'`)) {
    fail(`alarm-sound-access missing free id: ${id}`);
  }
}
for (const id of PRO_IDS) {
  if (!accessText.includes(`'${id}'`)) {
    fail(`alarm-sound-access missing pro id: ${id}`);
  }
}

const previewMap = extractRequireSources(readText('lib/preview-alarm-sound.ts'));
const ringMap = extractRequireSources(readText('lib/ring-alarm-sound.ts'));
const notifMap = extractNotificationFiles(readText('lib/alarm-sound-files.ts'));
const appJson = JSON.parse(readText('app.json'));
const appSounds = extractAppJsonSounds(appJson).sort();

for (const id of ALL_IDS) {
  const expected = idToFilename(id);
  if (previewMap[id] !== expected) fail(`preview-alarm-sound mismatch for ${id}`);
  if (ringMap[id] !== expected) fail(`ring-alarm-sound mismatch for ${id}`);
  if (notifMap[id] !== expected) fail(`alarm-sound-files mismatch for ${id}`);
  if (!appSounds.includes(expected)) fail(`app.json expo-notifications missing ${expected}`);
}

const genText = readText('scripts/generate-alarm-sounds.mjs');
for (const id of ALL_IDS) {
  const base = id.replace(/-/g, '_');
  if (!genText.includes(`${base}:`)) {
    fail(`generate-alarm-sounds.mjs missing generator: ${base}`);
  }
}

console.warn(`verify-alarm-sounds: OK (${ALL_IDS.length} sounds, ${FREE_IDS.length} free, ${PRO_IDS.length} pro)`);
