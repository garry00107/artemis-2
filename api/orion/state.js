import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOEM, interpolate, getMoonECI } from '../lib/orbital.js';

let _cache = null;
function getData() {
  if (_cache) return _cache;
  // Vercel bundles includeFiles alongside the function
  const oemPath = join(process.cwd(), 'api', 'lib', 'ephemeris.asc');
  const oemText = readFileSync(oemPath, 'utf-8');
  _cache = parseOEM(oemText);
  return _cache;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate');

  try {
    const vectors = getData();
    const now = Date.now();
    const state = interpolate(vectors, now);
    if (!state) return res.status(503).json({ error: 'No data' });

    const dist = Math.sqrt(state.x ** 2 + state.y ** 2 + state.z ** 2);
    const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2 + state.vz ** 2);
    const moon = getMoonECI(now);
    const moonDist = Math.sqrt(
      (state.x - moon.x) ** 2 + (state.y - moon.y) ** 2 + (state.z - moon.z) ** 2
    );

    res.json({
      ...state,
      distanceFromEarth: Math.round(dist),
      distanceFromMoon: Math.round(moonDist),
      velocity: speed,
      time: new Date(now).toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
