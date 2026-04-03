/**
 * Astronomy Math Utilities
 * ECI position calculations, Moon position, distance metrics
 */

export function distanceFromEarth({ x, y, z }) {
  return Math.sqrt(x * x + y * y + z * z);
}

export function velocity({ vx, vy, vz }) {
  return Math.sqrt(vx * vx + vy * vy + vz * vz);
}

/**
 * Accurate Moon ECI position using Meeus's algorithm
 * with ecliptic→equatorial (J2000) rotation
 * 
 * Key fix: OEM data is in EME2000 (equatorial), so we must rotate
 * from ecliptic to equatorial using Earth's obliquity (23.44°)
 */
export function getMoonECI(date) {
  const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
  const d = (date instanceof Date ? date.getTime() : date);
  const T = (d - J2000) / 86400000 / 36525; // Julian centuries
  const days = T * 36525;

  // Fundamental arguments (degrees)
  const L0 = (218.3164477 + 481267.88123421 * T) % 360;  // Mean longitude
  const D  = (297.8501921 + 445267.1114034  * T) % 360;  // Mean elongation
  const M  = (357.5291092 + 35999.0502909   * T) % 360;  // Sun mean anomaly
  const Mp = (134.9633964 + 477198.8675055  * T) % 360;  // Moon mean anomaly
  const F  = (93.2720950  + 483202.0175233  * T) % 360;  // Argument of latitude

  const toRad = (x) => x * Math.PI / 180;
  const Dr = toRad(D), Mr = toRad(M), Mpr = toRad(Mp), Fr = toRad(F);

  // Longitude corrections (degrees)
  const lonCorr =
    6.289 * Math.sin(Mpr) +                    // Equation of center
    1.274 * Math.sin(2 * Dr - Mpr) +           // Evection
    0.658 * Math.sin(2 * Dr) +                 // Variation
    0.214 * Math.sin(2 * Mpr) -
    0.186 * Math.sin(Mr) -                     // Annual equation
    0.114 * Math.sin(2 * Fr);                  // Reduction to ecliptic

  // Latitude corrections (degrees)
  const latCorr =
    5.128 * Math.sin(Fr) +
    0.281 * Math.sin(Mpr + Fr) +
    0.278 * Math.sin(Mpr - Fr) +
    0.173 * Math.sin(2 * Dr - Fr);

  // Distance corrections (km)
  const distCorr =
    -20905 * Math.cos(Mpr) +
    -3699  * Math.cos(2 * Dr - Mpr) +
    -2956  * Math.cos(2 * Dr) +
    -570   * Math.cos(2 * Mpr) +
     246   * Math.cos(2 * Mpr - 2 * Dr);

  const lon = toRad(L0 + lonCorr);
  const lat = toRad(latCorr);
  const dist = 385000.56 + distCorr;

  // Ecliptic cartesian
  const xEcl = dist * Math.cos(lat) * Math.cos(lon);
  const yEcl = dist * Math.cos(lat) * Math.sin(lon);
  const zEcl = dist * Math.sin(lat);

  // Rotate ecliptic → equatorial (J2000 obliquity = 23.4393°)
  const eps = toRad(23.4393);
  return {
    x: xEcl,
    y: yEcl * Math.cos(eps) - zEcl * Math.sin(eps),
    z: yEcl * Math.sin(eps) + zEcl * Math.cos(eps),
  };
}

export function distanceFromMoon(orion, date) {
  const moon = getMoonECI(date);
  const dx = orion.x - moon.x;
  const dy = orion.y - moon.y;
  const dz = orion.z - moon.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Mission phase calculator
 */
const MISSION_PHASES = [
  { name: 'Launch',              start: '2026-04-01T22:35:00Z', end: '2026-04-01T22:49:00Z' },
  { name: 'TLI Burn',           start: '2026-04-01T22:49:00Z', end: '2026-04-02T00:30:00Z' },
  { name: 'Trans-Lunar Coast',  start: '2026-04-02T00:30:00Z', end: '2026-04-06T06:00:00Z' },
  { name: 'Lunar Flyby',        start: '2026-04-06T06:00:00Z', end: '2026-04-07T00:00:00Z' },
  { name: 'Trans-Earth Coast',  start: '2026-04-07T00:00:00Z', end: '2026-04-10T12:00:00Z' },
  { name: 'Re-entry',           start: '2026-04-10T12:00:00Z', end: '2026-04-10T16:00:00Z' },
];

export function getMissionPhase(date) {
  const t = date.getTime();
  for (const phase of MISSION_PHASES) {
    if (t >= new Date(phase.start).getTime() && t < new Date(phase.end).getTime()) {
      return phase.name;
    }
  }
  if (t < new Date(MISSION_PHASES[0].start).getTime()) return 'Pre-Launch';
  return 'Mission Complete';
}

export const LAUNCH_TIME = new Date('2026-04-01T22:35:00Z');
export const SPLASHDOWN_TIME = new Date('2026-04-10T16:00:00Z');

/**
 * Format mission elapsed time
 */
export function formatMET(ms) {
  if (ms < 0) return '00:00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format countdown
 */
export function formatCountdown(ms) {
  if (ms <= 0) return 'COMPLETE';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Distance comparator — fun scale reference
 */
export function distanceComparator(km) {
  const earthCircumference = 40075;
  const earthToISS = 408;
  const earthDiameter = 12742;
  
  if (km < 1000) return `${(km / earthToISS).toFixed(1)}× ISS altitude`;
  if (km < 50000) return `${(km / earthDiameter).toFixed(1)}× Earth's diameter`;
  if (km < 200000) return `${(km / earthCircumference).toFixed(1)}× around Earth`;
  return `${((km / 384400) * 100).toFixed(1)}% of the way to the Moon`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(n, decimals = 0) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
