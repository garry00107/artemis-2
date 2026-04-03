import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOEM, getMoonECI } from '../lib/orbital.js';

let _cache = null;
function getData() {
  if (_cache) return _cache;
  const oemPath = join(process.cwd(), 'api', 'lib', 'ephemeris.asc');
  const oemText = readFileSync(oemPath, 'utf-8');
  const vectors = parseOEM(oemText);

  let minDist = Infinity, minTime = null;
  for (const v of vectors) {
    const moon = getMoonECI(v.time);
    const d = Math.sqrt((v.x - moon.x) ** 2 + (v.y - moon.y) ** 2 + (v.z - moon.z) ** 2);
    if (d < minDist) { minDist = d; minTime = v.time; }
  }

  _cache = { minDist: Math.round(minDist), minTime };
  return _cache;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  try {
    const data = getData();
    res.json({ ...data, timestamp: new Date(data.minTime).toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
