/**
 * OEM Parser — CCSDS Orbital Ephemeris Message format
 * Handles NASA's format with auto-detection of data lines
 */
export function parseOEM(oemText) {
  const lines = oemText.split('\n');
  const vectors = [];
  let pastMeta = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'META_STOP') { pastMeta = true; continue; }
    if (!pastMeta || !line || line.startsWith('COMMENT') || line.includes('=')) continue;
    if (line === 'DATA_START' || line === 'DATA_STOP') continue;

    // Detect data lines: must start with a timestamp-like pattern
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 7) {
        const timestamp = parts[0].endsWith('Z') ? parts[0] : parts[0] + 'Z';
        vectors.push({
          time: new Date(timestamp).getTime(),
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
          vx: parseFloat(parts[4]),
          vy: parseFloat(parts[5]),
          vz: parseFloat(parts[6]),
        });
      }
    }
  }
  return vectors;
}

/**
 * Binary search interpolation for smooth real-time positions
 */
export function interpolate(vectors, targetTime) {
  if (!vectors.length) return null;
  if (targetTime <= vectors[0].time) return vectors[0];
  if (targetTime >= vectors[vectors.length - 1].time) return vectors[vectors.length - 1];

  let lo = 0, hi = vectors.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (vectors[mid].time <= targetTime) lo = mid;
    else hi = mid;
  }

  const a = vectors[lo], b = vectors[hi];
  const f = (targetTime - a.time) / (b.time - a.time);
  return {
    time: targetTime,
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    vx: a.vx + (b.vx - a.vx) * f,
    vy: a.vy + (b.vy - a.vy) * f,
    vz: a.vz + (b.vz - a.vz) * f,
  };
}

export function getTrajectoryPoints(vectors, step = 2) {
  return vectors.filter((_, i) => i % step === 0).map(v => [v.x, v.y, v.z]);
}

/**
 * Moon ECI position using Meeus's algorithm + ecliptic→equatorial rotation
 */
export function getMoonECI(timeMs) {
  const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
  const T = (timeMs - J2000) / 86400000 / 36525;

  const L0 = (218.3164477 + 481267.88123421 * T) % 360;
  const D  = (297.8501921 + 445267.1114034  * T) % 360;
  const M  = (357.5291092 + 35999.0502909   * T) % 360;
  const Mp = (134.9633964 + 477198.8675055  * T) % 360;
  const F  = (93.2720950  + 483202.0175233  * T) % 360;

  const toRad = (x) => x * Math.PI / 180;
  const Dr = toRad(D), Mr = toRad(M), Mpr = toRad(Mp), Fr = toRad(F);

  const lonCorr =
    6.289 * Math.sin(Mpr) + 1.274 * Math.sin(2*Dr - Mpr) +
    0.658 * Math.sin(2*Dr) + 0.214 * Math.sin(2*Mpr) -
    0.186 * Math.sin(Mr) - 0.114 * Math.sin(2*Fr);

  const latCorr =
    5.128 * Math.sin(Fr) + 0.281 * Math.sin(Mpr + Fr) +
    0.278 * Math.sin(Mpr - Fr) + 0.173 * Math.sin(2*Dr - Fr);

  const distCorr =
    -20905 * Math.cos(Mpr) - 3699 * Math.cos(2*Dr - Mpr) -
    2956 * Math.cos(2*Dr) - 570 * Math.cos(2*Mpr) +
    246 * Math.cos(2*Mpr - 2*Dr);

  const lon = toRad(L0 + lonCorr);
  const lat = toRad(latCorr);
  const dist = 385000.56 + distCorr;

  const xEcl = dist * Math.cos(lat) * Math.cos(lon);
  const yEcl = dist * Math.cos(lat) * Math.sin(lon);
  const zEcl = dist * Math.sin(lat);

  const eps = toRad(23.4393);
  return {
    x: xEcl,
    y: yEcl * Math.cos(eps) - zEcl * Math.sin(eps),
    z: yEcl * Math.sin(eps) + zEcl * Math.cos(eps),
  };
}
