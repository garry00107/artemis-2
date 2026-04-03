import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseOEM, interpolate, getTrajectoryPoints, getMoonECI } from './lib/orbital.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load and parse OEM data (cached across invocations in same instance)
let _cache = null;
function getData() {
  if (_cache) return _cache;
  const oemPath = join(__dirname, 'lib', 'ephemeris.asc');
  const oemText = readFileSync(oemPath, 'utf-8');
  const vectors = parseOEM(oemText);
  const trajectory = getTrajectoryPoints(vectors, 2);

  // Compute closest approach
  let minDist = Infinity, minTime = null;
  for (const v of vectors) {
    const moon = getMoonECI(v.time);
    const d = Math.sqrt((v.x - moon.x) ** 2 + (v.y - moon.y) ** 2 + (v.z - moon.z) ** 2);
    if (d < minDist) { minDist = d; minTime = v.time; }
  }

  _cache = { vectors, trajectory, closestApproach: { minDist: Math.round(minDist), minTime } };
  return _cache;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate');

  const { vectors, trajectory, closestApproach } = getData();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/orion', '');

  if (path === '/state' || path === '') {
    // Current interpolated state
    const now = Date.now();
    const state = interpolate(vectors, now);
    if (!state) return res.status(503).json({ error: 'No data' });

    const dist = Math.sqrt(state.x ** 2 + state.y ** 2 + state.z ** 2);
    const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2 + state.vz ** 2);
    const moon = getMoonECI(now);
    const moonDist = Math.sqrt(
      (state.x - moon.x) ** 2 + (state.y - moon.y) ** 2 + (state.z - moon.z) ** 2
    );

    return res.json({
      ...state,
      distanceFromEarth: Math.round(dist),
      distanceFromMoon: Math.round(moonDist),
      velocity: speed,
      time: new Date(now).toISOString(),
    });
  }

  if (path === '/trajectory') {
    return res.json({ points: trajectory, count: trajectory.length });
  }

  if (path === '/closest-approach') {
    return res.json({
      ...closestApproach,
      timestamp: new Date(closestApproach.minTime).toISOString(),
    });
  }

  res.status(404).json({ error: 'Not found' });
}
