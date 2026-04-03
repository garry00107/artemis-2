/**
 * Ephemeris Data Loader
 * Loads the real NASA Artemis II OEM file, falls back to generated sample data
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths to check for real OEM data (in order of priority)
const OEM_PATHS = [
  join(__dirname, '..', 'Artemis_II_OEM_2026_04_02_to_EI_v3.asc'),
  join(__dirname, 'data', 'Artemis_II_OEM_2026_04_02_to_EI_v3.asc'),
  join(__dirname, 'data', 'ephemeris.oem'),
];

function loadOEMData() {
  for (const path of OEM_PATHS) {
    if (existsSync(path)) {
      console.log(`✅ Loading real NASA ephemeris from: ${path}`);
      return readFileSync(path, 'utf-8');
    }
  }

  console.warn('⚠️  No real OEM file found, generating sample data...');
  return generateSampleOEM();
}

// ---- Sample OEM generator (fallback) ----

function generateSampleOEM() {
  const lines = [];
  lines.push('CCSDS_OEM_VERS = 2.0');
  lines.push('CREATION_DATE = 2026-04-02T00:00:00.000');
  lines.push('ORIGINATOR = NASA/JSC');
  lines.push('');
  lines.push('META_START');
  lines.push('OBJECT_NAME = ORION');
  lines.push('OBJECT_ID   = 2026-001A');
  lines.push('CENTER_NAME = EARTH');
  lines.push('REF_FRAME   = EME2000');
  lines.push('TIME_SYSTEM = UTC');
  lines.push('START_TIME  = 2026-04-01T22:49:00.000');
  lines.push('STOP_TIME   = 2026-04-10T16:00:00.000');
  lines.push('META_STOP');
  lines.push('');
  lines.push('DATA_START');

  const tliTime = new Date('2026-04-01T22:49:00.000Z').getTime();
  const splashTime = new Date('2026-04-10T16:00:00.000Z').getTime();
  const interval = 4 * 60 * 1000;

  for (let t = tliTime; t <= splashTime; t += interval) {
    const phase = (t - tliTime) / (splashTime - tliTime);
    const date = new Date(t);
    const timestamp = date.toISOString().replace('Z', '');
    // Simplified trajectory (just a placeholder)
    const angle = phase * Math.PI * 2;
    const r = 6571 + phase * 378000;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    const z = r * 0.05 * Math.sin(angle * 2);
    lines.push(`${timestamp} ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)} -1.000 1.000 0.100`);
  }

  lines.push('DATA_STOP');
  return lines.join('\n');
}

const oemData = loadOEMData();
export default oemData;
