import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOEM, getTrajectoryPoints } from '../lib/orbital.js';

let _cache = null;
function getData() {
  if (_cache) return _cache;
  const oemPath = join(process.cwd(), 'api', 'lib', 'ephemeris.asc');
  const oemText = readFileSync(oemPath, 'utf-8');
  const vectors = parseOEM(oemText);
  _cache = getTrajectoryPoints(vectors, 2);
  return _cache;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  try {
    const points = getData();
    res.json({ points, count: points.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
