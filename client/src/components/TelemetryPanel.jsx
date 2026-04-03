import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  distanceFromEarth,
  distanceFromMoon,
  velocity,
  getMissionPhase,
  getMoonECI,
  formatMET,
  formatCountdown,
  formatNumber,
  distanceComparator,
  LAUNCH_TIME,
  SPLASHDOWN_TIME,
} from '../utils/astro-math';

const MILESTONES = [
  { name: 'Launch', time: '2026-04-01T22:35:00Z', icon: '✅' },
  { name: 'TLI Burn', time: '2026-04-02T00:30:00Z', icon: '✅' },
  { name: 'Trans-Lunar Coast', time: '2026-04-02T00:30:00Z', icon: '🟡' },
  { name: 'Lunar Flyby', time: '2026-04-06T12:00:00Z', icon: '⬜' },
  { name: 'Trans-Earth Coast', time: '2026-04-07T00:00:00Z', icon: '⬜' },
  { name: 'Splashdown', time: '2026-04-10T16:00:00Z', icon: '⬜' },
];

export default function TelemetryPanel({ state, history }) {
  const [now, setNow] = useState(new Date());
  const [closestApproach, setClosestApproach] = useState(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch closest approach data once
  useEffect(() => {
    const base = window.location.hostname.includes('localhost') ? 'http://localhost:3001' : '';
    fetch(`${base}/api/orion/closest-approach`)
      .then(r => r.json())
      .then(data => setClosestApproach(data))
      .catch(() => {});
  }, []);

  const metrics = useMemo(() => {
    if (!state) return null;
    const dist = state.distanceFromEarth || distanceFromEarth(state);
    const speed = state.velocity || velocity(state);
    const moonDist = distanceFromMoon(state, now);
    return { dist, speed, moonDist };
  }, [state, now]);

  const met = formatMET(now.getTime() - LAUNCH_TIME.getTime());
  const splashdown = formatCountdown(SPLASHDOWN_TIME.getTime() - now.getTime());
  const phase = getMissionPhase(now);

  // Determine which milestones are complete / active
  const milestones = MILESTONES.map((m, i) => {
    const mTime = new Date(m.time).getTime();
    const isComplete = now.getTime() >= mTime;
    const isActive = isComplete && (i === MILESTONES.length - 1 || now.getTime() < new Date(MILESTONES[i + 1].time).getTime());
    let icon = '⬜';
    if (isComplete && !isActive) icon = '✅';
    if (isActive) icon = '🟡';
    return { ...m, icon, isComplete, isActive };
  });

  // Sparkline data from history
  const sparklineData = useMemo(() => {
    if (!history || history.length === 0) return [];
    // Downsample to max 50 points
    const step = Math.max(1, Math.floor(history.length / 50));
    return history.filter((_, i) => i % step === 0).map(h => ({
      d: h.distance,
      v: h.velocity,
    }));
  }, [history]);

  return (
    <div className="panel telemetry-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="dot"></span>
          Live Telemetry
        </span>
      </div>

      {/* Mission Elapsed Time */}
      <div className="metric-card primary">
        <div className="met-display">{met}</div>
        <div className="met-label">Mission Elapsed Time (DD:HH:MM:SS)</div>
      </div>

      {/* Phase indicator */}
      <div className="phase-indicator">
        <div className="phase-dot"></div>
        <span className="phase-name">{phase}</span>
      </div>

      {/* Lunar Flyby Countdown */}
      {closestApproach && closestApproach.minTime && (() => {
        const flybyMs = closestApproach.minTime - now.getTime();
        const isClose = flybyMs > 0 && flybyMs < 5 * 60 * 1000;
        const isPast = flybyMs <= 0;
        return (
          <div className="metric-card flyby-countdown">
            <div className="metric-label">
              {isPast ? '🌕 Lunar Flyby' : '🌕 Lunar Flyby Countdown'}
            </div>
            <div className={`metric-value ${isClose ? 'pulse-glow' : 'purple'}`}>
              {isPast
                ? 'COMPLETE'
                : isClose
                  ? 'CLOSEST APPROACH NOW'
                  : formatCountdown(flybyMs)}
            </div>
            <div className="distance-comparator">
              Closest approach: {formatNumber(closestApproach.minDist)} km from Moon
            </div>
          </div>
        );
      })()}

      {/* Primary metrics */}
      <div className="metric-row">
        <div className="metric-card">
          <div className="metric-label">Distance from Earth</div>
          <div className="metric-value blue">
            {metrics ? formatNumber(metrics.dist) : '---'}
            <span className="unit">km</span>
          </div>
          {metrics && (
            <div className="distance-comparator">
              {distanceComparator(metrics.dist)}
            </div>
          )}
          {sparklineData.length > 2 && (
            <div className="sparkline-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line type="monotone" dataKey="d" stroke="#4fc3f7" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-label">Distance to Moon</div>
          <div className="metric-value purple">
            {metrics ? formatNumber(metrics.moonDist) : '---'}
            <span className="unit">km</span>
          </div>
        </div>
      </div>

      {/* Velocity */}
      <div className="metric-card">
        <div className="metric-label">Current Velocity</div>
        <div className="metric-value cyan">
          {metrics ? metrics.speed.toFixed(3) : '---'}
          <span className="unit">km/s</span>
        </div>
        {metrics && (
          <div className="distance-comparator">
            {(metrics.speed * 3600).toFixed(0)} km/h · Mach {(metrics.speed / 0.343).toFixed(1)}
          </div>
        )}
        {sparklineData.length > 2 && (
          <div className="sparkline-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line type="monotone" dataKey="v" stroke="#00e5ff" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Milestone Timeline */}
      <div className="metric-card">
        <div className="metric-label">Mission Timeline</div>
        <div className="milestone-timeline">
          {milestones.map((m, i) => (
            <div
              key={i}
              className={`milestone-item ${m.isComplete && !m.isActive ? 'completed' : ''} ${m.isActive ? 'active' : ''}`}
            >
              <span className="milestone-icon">{m.icon}</span>
              <div className="milestone-content">
                <div className="milestone-name">{m.name}</div>
                <div className="milestone-time">
                  {m.isActive
                    ? '← NOW'
                    : new Date(m.time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short',
                      })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Splashdown Countdown */}
      <div className="splashdown-countdown">
        <div className="splashdown-label">🌊 Splashdown Countdown</div>
        <div className="splashdown-time">{splashdown}</div>
      </div>
    </div>
  );
}
