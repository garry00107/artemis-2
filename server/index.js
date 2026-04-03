import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { parseOEM } from './oem-parser.js';
import { interpolate, getTrajectoryPoints } from './interpolator.js';
import sampleOEM from './ephemeris-fetcher.js';

// Moon ECI position using Meeus's algorithm + ecliptic→equatorial rotation
function getMoonECI(timeMs) {
  const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
  const T = (timeMs - J2000) / 86400000 / 36525;

  // Fundamental arguments (degrees)
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

  // Rotate ecliptic → equatorial (J2000 obliquity = 23.4393°)
  const eps = toRad(23.4393);
  return {
    x: xEcl,
    y: yEcl * Math.cos(eps) - zEcl * Math.sin(eps),
    z: yEcl * Math.sin(eps) + zEcl * Math.cos(eps),
  };
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// --- Data Pipeline ---
let stateVectors = [];
let trajectoryPoints = [];

let closestApproach = null;

function findClosestApproach(vectors) {
  let minDist = Infinity, minTime = null;
  for (const v of vectors) {
    const moon = getMoonECI(v.time);
    const d = Math.sqrt((v.x - moon.x) ** 2 + (v.y - moon.y) ** 2 + (v.z - moon.z) ** 2);
    if (d < minDist) { minDist = d; minTime = v.time; }
  }
  return { minDist: Math.round(minDist), minTime };
}

function loadEphemeris() {
  stateVectors = parseOEM(sampleOEM);
  trajectoryPoints = getTrajectoryPoints(stateVectors, 2);
  closestApproach = findClosestApproach(stateVectors);
  console.log(`Loaded ${stateVectors.length} state vectors`);
  console.log(`Generated ${trajectoryPoints.length} trajectory points`);
  console.log(`Closest lunar approach: ${closestApproach.minDist} km at ${new Date(closestApproach.minTime).toISOString()}`);
}

loadEphemeris();

// --- REST API ---
app.get('/api/orion/state', (req, res) => {
  const state = interpolate(stateVectors, Date.now());
  if (!state) return res.status(503).json({ error: 'No ephemeris data loaded' });
  
  const dist = Math.sqrt(state.x ** 2 + state.y ** 2 + state.z ** 2);
  const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2 + state.vz ** 2);
  
  res.json({
    ...state,
    distanceFromEarth: dist,
    velocity: speed,
    timestamp: new Date(state.time).toISOString(),
  });
});

app.get('/api/orion/trajectory', (req, res) => {
  res.json({ points: trajectoryPoints, count: trajectoryPoints.length });
});

app.get('/api/orion/closest-approach', (req, res) => {
  if (!closestApproach) return res.status(503).json({ error: 'Not computed yet' });
  res.json({
    ...closestApproach,
    timestamp: new Date(closestApproach.minTime).toISOString(),
  });
});

// --- Chat ---
const chatHistory = [];
const MAX_CHAT_HISTORY = 100;
let onlineCount = 0;
const userLastMessage = new Map();

// Milestone thresholds (km from Earth)
const milestones = [
  { distance: 50000,  label: '🚀 Orion has crossed 50,000 km from Earth!' },
  { distance: 100000, label: '🚀 Orion has crossed 100,000 km from Earth!' },
  { distance: 200000, label: '🌌 Orion has crossed 200,000 km — halfway to the Moon!' },
  { distance: 300000, label: '🌕 Orion is within 100,000 km of the Moon!' },
];

// Moon-distance milestones (checked separately)
const moonMilestones = [
  { distance: 66000, label: '🌕 Orion has entered the Moon\'s sphere of influence!' },
  { distance: 50000, label: '🌕 Orion is within 50,000 km of the Moon!' },
  { distance: 20000, label: '🌕 Orion is 20,000 km from the Moon — final approach!' },
  { distance: 10000, label: '🔥 Closest approach imminent — 10,000 km from the Moon!' },
];
const firedMoonMilestones = new Set();
const firedMilestones = new Set();

// --- Socket.io ---
io.on('connection', (socket) => {
  onlineCount++;
  io.emit('online-count', onlineCount);
  socket.emit('chat-history', chatHistory.slice(-50));

  // Push position updates every 2 seconds
  const posInterval = setInterval(() => {
    const state = interpolate(stateVectors, Date.now());
    if (state) {
      const dist = Math.sqrt(state.x ** 2 + state.y ** 2 + state.z ** 2);
      const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2 + state.vz ** 2);
      socket.emit('orion-state', {
        ...state,
        distanceFromEarth: dist,
        velocity: speed,
      });

      // Check Earth-distance milestones
      for (const m of milestones) {
        if (dist >= m.distance && !firedMilestones.has(m.distance)) {
          firedMilestones.add(m.distance);
          const msg = {
            username: 'MISSION CONTROL',
            text: m.label,
            time: new Date().toISOString(),
            isSystem: true,
          };
          chatHistory.push(msg);
          io.emit('chat-message', msg);
        }
      }

      // Check Moon-distance milestones
      const moon = getMoonECI(Date.now());
      const moonDist = Math.sqrt(
        (state.x - moon.x) ** 2 + (state.y - moon.y) ** 2 + (state.z - moon.z) ** 2
      );
      for (const m of moonMilestones) {
        if (moonDist <= m.distance && !firedMoonMilestones.has(m.distance)) {
          firedMoonMilestones.add(m.distance);
          const msg = {
            username: 'MISSION CONTROL',
            text: m.label,
            time: new Date().toISOString(),
            isSystem: true,
          };
          chatHistory.push(msg);
          io.emit('chat-message', msg);
        }
      }
    }
  }, 2000);

  // Chat messages
  socket.on('chat-message', ({ username, text }) => {
    if (!username || !text || text.length > 500) return;

    // Rate limiting: 1 message per 2 seconds
    const now = Date.now();
    const last = userLastMessage.get(username) || 0;
    if (now - last < 2000) return;
    userLastMessage.set(username, now);

    const msg = {
      username: username.slice(0, 20),
      text: text.slice(0, 500),
      time: new Date().toISOString(),
      isSystem: false,
    };
    chatHistory.push(msg);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
    io.emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    clearInterval(posInterval);
    io.emit('online-count', onlineCount);
  });
});

// --- Start ---
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Artemis II server listening on port ${PORT}`);
});
