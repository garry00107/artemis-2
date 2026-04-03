/**
 * State Vector Interpolator
 * Linear interpolation between OEM samples for smooth real-time position
 */

export function interpolate(vectors, targetTime) {
  if (!vectors || vectors.length === 0) return null;

  const t = typeof targetTime === 'number' ? targetTime : targetTime.getTime();

  // Before first sample
  if (t <= vectors[0].time) return { ...vectors[0] };
  // After last sample
  if (t >= vectors[vectors.length - 1].time) return { ...vectors[vectors.length - 1] };

  // Binary search for the bracketing interval
  let lo = 0, hi = vectors.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (vectors[mid].time <= t) lo = mid;
    else hi = mid;
  }

  const v0 = vectors[lo];
  const v1 = vectors[hi];
  const f = (t - v0.time) / (v1.time - v0.time);

  return {
    time: t,
    x:  v0.x  + f * (v1.x  - v0.x),
    y:  v0.y  + f * (v1.y  - v0.y),
    z:  v0.z  + f * (v1.z  - v0.z),
    vx: v0.vx + f * (v1.vx - v0.vx),
    vy: v0.vy + f * (v1.vy - v0.vy),
    vz: v0.vz + f * (v1.vz - v0.vz),
  };
}

/**
 * Get trajectory points for 3D rendering
 * Returns a downsampled array of [x, y, z] positions for the full path
 */
export function getTrajectoryPoints(vectors, step = 3) {
  const points = [];
  for (let i = 0; i < vectors.length; i += step) {
    points.push([vectors[i].x, vectors[i].y, vectors[i].z]);
  }
  return points;
}
