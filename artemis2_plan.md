# Artemis II Mission Tracker — Full Build Plan

---

## Vision

A cinematic, real-time web app showing Orion's live position in space across 4 panels — a 3D deep-space scene, live telemetry, spacecraft POV, and a community chat. Powered by NASA's official ephemeris data.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite | Fast dev, HMR, easy deployment |
| 3D Engine | Three.js (r152+) | Industry standard for WebGL scenes |
| Charts | Recharts | Lightweight, composable |
| Styling | Tailwind CSS | Rapid dark-mode UI |
| Real-time Chat | Socket.io | Simple, self-hosted |
| Backend | Node.js + Express | Proxy NASA data, serve chat |
| Deployment | Vercel (frontend) + Railway (backend) | Free tier both |

---

## Data Pipeline

### Source: NASA AROW Ephemeris (OEM format)

NASA publishes a downloadable ephemeris file at:
`https://nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/`

The file is plain text in CCSDS OEM format. It looks like this:

```
CCSDS_OEM_VERS = 2.0
COMMENT Orion Spacecraft State Vectors
...
DATA_START
2026-04-01T22:36:00.000 -1234.56 5678.90 2345.67 -0.123 4.567 1.234
2026-04-01T22:40:00.000 -1290.12 5820.34 2401.11 -0.118 4.521 1.219
...
DATA_STOP
```

Each line: `UTC_timestamp  X(km)  Y(km)  Z(km)  Vx(km/s)  Vy(km/s)  Vz(km/s)`

Coordinate frame: J2000 Earth-centered inertial (ECI).

### Backend Responsibilities

1. Download the OEM file from NASA on a cron (every 10 minutes)
2. Parse and store the state vectors in memory (or Redis)
3. Serve a clean JSON endpoint: `GET /api/orion/state`
4. Interpolate between 4-minute samples for smooth real-time position
5. Emit position updates over Socket.io every 2 seconds

### What you compute from state vectors

- **Distance from Earth** = `sqrt(X² + Y² + Z²)` in km
- **Velocity** = `sqrt(Vx² + Vy² + Vz²)` in km/s
- **Distance to Moon** = `|orion_pos - moon_pos|` (compute Moon's ECI position using VSOP87 or a simple lookup table — Moon moves slowly enough that hourly lookups work fine)
- **Mission elapsed time** = `now - launch_time`
- **Time to lunar flyby** = countdown to closest approach (~Apr 6)
- **Time to splashdown** = countdown to Apr 10

---

## Project Structure

```
artemis-tracker/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── TrajectoryScene.jsx   # Three.js main panel
│   │   │   ├── TelemetryPanel.jsx    # Live numbers
│   │   │   ├── SpacecraftView.jsx    # Orion POV camera
│   │   │   └── ChatPanel.jsx         # Socket.io chat
│   │   ├── hooks/
│   │   │   ├── useOrionState.js      # Polls /api/orion/state
│   │   │   └── useSocket.js          # Chat socket connection
│   │   ├── utils/
│   │   │   ├── oem-parser.js         # Parses OEM text format
│   │   │   └── astro-math.js         # ECI → lat/lon, moon pos
│   │   └── App.jsx                   # 4-panel layout
│   └── package.json
│
└── server/
    ├── index.js                 # Express + Socket.io server
    ├── ephemeris-fetcher.js     # Cron job to pull NASA OEM file
    ├── interpolator.js          # Linear interpolation between samples
    └── package.json
```

---

## Panel 1 — 3D Trajectory Scene (Three.js)

This is the hero panel. Full-screen capable, dark space background.

### What to render

**Earth**
- `SphereGeometry(6.371, 64, 64)` — radius in hundreds of km
- Apply NASA's Blue Marble texture (free, public domain): `8081_earthmap4k.jpg`
- Add a thin atmosphere glow using `MeshBasicMaterial` with transparency on a slightly larger sphere
- Slow axial rotation (one full rotation per 24 mission-seconds looks good)
- Night-side city lights texture as emissive map

**Moon**
- Compute Moon's ECI position (use a simplified formula or the `astronomy-engine` npm package)
- Scale Moon's distance proportionally — don't render at true scale (it's 384,400 km away and would be a tiny dot), use a logarithmic scale instead
- Apply a lunar texture map (also NASA public domain)

**Orion spacecraft**
- NASA provides a free 3D model: `nasa.gov/audience/forstudents/5-8/features/nasa-knows/what-is-the-orion-spacecraft-58.html`
- Load using `GLTFLoader`
- Animate subtle rotation (the real spacecraft rotates for thermal control)
- Add a small amber point light near it to make it pop against the black

**Free-return trajectory arc**
- Pre-bake the full trajectory as a `CatmullRomCurve3` from the OEM ephemeris points
- Render using `TubeGeometry` with a glowing blue-white material
- Orion's dot slides along this fixed arc in real time
- Show a faded "future path" section and a bright "past path" section

**Van Allen Belts** (bonus visual)
- Two toroidal `TorusGeometry` meshes around Earth
- Semi-transparent amber/orange material (`MeshBasicMaterial`, opacity ~0.08)
- Inner belt: ~3,000 km altitude. Outer belt: ~15,000–25,000 km
- Orion passes through these in the first few hours — add a glow pulse when crossing

**Camera controls**
- `OrbitControls` so users can drag/zoom freely
- "Follow Orion" button that locks the camera to trail 50,000 km behind Orion
- "Earth view" button that resets to a classic look-at-Earth angle
- "Lunar approach" button activates when within 100,000 km of Moon

### Scene scale
True solar-system scale is impractical in Three.js. Use:
- 1 Three.js unit = 1,000 km
- Earth radius ≈ 6.4 units
- Moon distance ≈ 384 units (manageable)
- Keep Orion visible by clamping its rendered size to at least 0.5 units

---

## Panel 2 — Live Telemetry Dashboard

Clean dark HUD. Update every 2 seconds via Socket.io.

### Primary metrics (large)
- Distance from Earth (km) — with a mini sparkline of the last 30 minutes
- Distance from Moon (km)
- Current velocity (km/s) — with a speed gauge arc visualization
- Mission elapsed time (DD:HH:MM:SS)

### Secondary metrics (smaller)
- Current phase label: "Trans-lunar coast", "Lunar flyby", "Trans-Earth injection", "Re-entry"
- Altitude above Earth (km) — relevant during early orbits
- G-force experienced (derived from velocity change)
- Van Allen belt status: "Clear", "Entering inner belt", etc.

### Milestone timeline
Vertical timeline component on the right side of this panel:

```
✅  Launch          — Apr 1, 18:35 EDT
✅  TLI Burn        — Apr 2, 19:49 EDT
🟡  Trans-lunar coast ← YOU ARE HERE
⬜  Lunar flyby     — Apr 6 (est.)
⬜  TEI Burn        — Apr 7 (est.)
⬜  Splashdown      — Apr 10 (est.)
```

Each milestone has a countdown when upcoming, or elapsed time when past.

### Splashdown countdown
Large prominent timer at the bottom. "Splashdown in: 7d 14h 22m 31s"

---

## Panel 3 — Spacecraft View

Two modes the user can toggle:

### Mode A — NASA Live Feed (default while available)
Embed the NASA+ YouTube livestream `iframe` directly. NASA is streaming 24/7 from cameras on Orion showing Earth receding. URL: `https://www.youtube.com/watch?v=[NASA_ARTEMIS2_STREAM]`

Overlay the stream with a subtle HUD frame — mission logo, MET clock, distance readout in the corner. Like an actual mission control feed.

### Mode B — Synthetic Spacecraft POV (Three.js)
When NASA feed is unavailable (or as a toggle):
- Lock the Three.js camera to Orion's position, pointing back toward Earth
- Earth appears as a receding blue marble — its apparent size decreases as Orion moves away
- Add subtle star field rotation
- Overlay: crosshair reticle, vector arrows showing trajectory, velocity vector

This mode is stunning when Orion is near the Moon — you'll see both Earth and Moon in frame.

### Orion interior view (bonus)
A pre-rendered still of the Orion crew cabin interior (NASA has published photos) with an animated overlay showing:
- Crew status indicators (fictional but fun: all crew "nominal")
- Cabin temperature, CO2 levels — pulled from NASA mission updates when available

---

## Panel 4 — Live Mission Chat

### Architecture
- Socket.io room: `artemis2-watch`
- No auth required — just pick a username on first join
- Messages stored in memory (last 100), cleared on server restart

### Features
- Username selection on first open (stored in localStorage)
- Message input + send button (Enter to send)
- Auto-scroll with "scroll to bottom" button when user scrolls up
- Emoji reactions on messages (thumbs up, rocket 🚀, moon 🌕)
- **Mission notifications** — auto-posted bot messages at key events:

```
🚀 SYSTEM: Orion has crossed 100,000 km from Earth
🌕 SYSTEM: Orion has entered the Moon's sphere of influence
⚡ SYSTEM: Lunar flyby in T-1 hour
```

- Online count: "127 watching now"
- Rate limiting: max 1 message per 2 seconds per user

---

## OEM Parser (JavaScript)

```javascript
// utils/oem-parser.js
export function parseOEM(text) {
  const lines = text.split('\n');
  const vectors = [];
  let inData = false;

  for (const line of lines) {
    if (line.trim() === 'DATA_START') { inData = true; continue; }
    if (line.trim() === 'DATA_STOP')  { inData = false; continue; }
    if (!inData || line.startsWith('COMMENT') || !line.trim()) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) continue;

    vectors.push({
      time: new Date(parts[0]),
      x: parseFloat(parts[1]),   // km, ECI J2000
      y: parseFloat(parts[2]),
      z: parseFloat(parts[3]),
      vx: parseFloat(parts[4]),  // km/s
      vy: parseFloat(parts[5]),
      vz: parseFloat(parts[6]),
    });
  }

  return vectors;
}

export function interpolate(vectors, targetTime) {
  const t = targetTime.getTime();

  for (let i = 0; i < vectors.length - 1; i++) {
    const t0 = vectors[i].time.getTime();
    const t1 = vectors[i+1].time.getTime();

    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);  // 0..1 fraction
      return {
        x:  vectors[i].x  + f * (vectors[i+1].x  - vectors[i].x),
        y:  vectors[i].y  + f * (vectors[i+1].y  - vectors[i].y),
        z:  vectors[i].z  + f * (vectors[i+1].z  - vectors[i].z),
        vx: vectors[i].vx + f * (vectors[i+1].vx - vectors[i].vx),
        vy: vectors[i].vy + f * (vectors[i+1].vy - vectors[i].vy),
        vz: vectors[i].vz + f * (vectors[i+1].vz - vectors[i].vz),
      };
    }
  }

  return vectors[vectors.length - 1];  // return last known if past end
}
```

---

## Derived Math

```javascript
// utils/astro-math.js

export function distanceFromEarth({ x, y, z }) {
  return Math.sqrt(x*x + y*y + z*z);  // km
}

export function velocity({ vx, vy, vz }) {
  return Math.sqrt(vx*vx + vy*vy + vz*vz);  // km/s
}

// Approximate Moon ECI position (good enough for visualization)
// Uses a simplified analytic model — accurate to ~1% for our purposes
export function getMoonECI(date) {
  const T = (date - new Date('2000-01-01T12:00:00Z')) / 86400000 / 36525;
  const L = (218.316 + 13.176396 * T * 36525) * Math.PI / 180;
  const M = (134.963 + 13.064993 * T * 36525) * Math.PI / 180;
  const F = (93.272 + 13.229350 * T * 36525) * Math.PI / 180;
  const lon = L + 6.289 * Math.sin(M) * Math.PI / 180;
  const lat = 5.128 * Math.sin(F) * Math.PI / 180;
  const dist = 385001 - 20905 * Math.cos(M);  // km
  return {
    x: dist * Math.cos(lat) * Math.cos(lon),
    y: dist * Math.cos(lat) * Math.sin(lon),
    z: dist * Math.sin(lat),
  };
}

export function distanceFromMoon(orion, moon) {
  const dx = orion.x - moon.x;
  const dy = orion.y - moon.y;
  const dz = orion.z - moon.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);  // km
}
```

---

## Backend Server Skeleton

```javascript
// server/index.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import { fetchEphemeris } from './ephemeris-fetcher.js';
import { parseOEM, interpolate } from '../client/src/utils/oem-parser.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

let stateVectors = [];
let chatHistory = [];
let onlineCount = 0;

// Refresh ephemeris every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  const oem = await fetchEphemeris();
  stateVectors = parseOEM(oem);
  console.log(`Updated: ${stateVectors.length} state vectors`);
});

app.get('/api/orion/state', (req, res) => {
  const state = interpolate(stateVectors, new Date());
  res.json(state);
});

io.on('connection', (socket) => {
  onlineCount++;
  io.emit('online-count', onlineCount);
  socket.emit('chat-history', chatHistory.slice(-50));

  // Push position updates every 2 seconds
  const interval = setInterval(() => {
    const state = interpolate(stateVectors, new Date());
    socket.emit('orion-state', state);
  }, 2000);

  socket.on('chat-message', ({ username, text }) => {
    const msg = { username, text, time: new Date().toISOString() };
    chatHistory.push(msg);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    onlineCount--;
    clearInterval(interval);
    io.emit('online-count', onlineCount);
  });
});

httpServer.listen(3001);
```

---

## Layout (App.jsx)

```jsx
// 2x2 grid, full viewport height
<div className="grid grid-cols-2 grid-rows-2 h-screen w-screen bg-black gap-1 p-1">
  <TrajectoryScene state={orionState} />   {/* col 1, row 1 — spans full height optionally */}
  <TelemetryPanel  state={orionState} />   {/* col 2, row 1 */}
  <SpacecraftView  state={orionState} />   {/* col 1, row 2 */}
  <ChatPanel       socket={socket}    />   {/* col 2, row 2 */}
</div>
```

Optional: make Panel 1 (3D scene) a `col-span-2` hero at top, with the other 3 below in a 3-column row. Gives the trajectory more visual space.

---

## Assets & Free Resources

| Asset | Source |
|---|---|
| Earth texture (8K) | `visibleearth.nasa.gov` — Blue Marble |
| Moon texture | `nasa.gov/moon` — LRO imagery |
| Earth night lights | NASA Black Marble dataset |
| Orion 3D model | NASA 3D Resources: `nasa3d.arc.nasa.gov` |
| Artemis II ephemeris | NASA AROW page (updated continuously) |
| Live video stream | NASA+ YouTube, embedded iframe |
| Mission sounds | NASA SoundCloud (launch audio, comm chatter) |

---

## Implementation Order

### Day 1 — Data pipeline
- [ ] Write OEM parser and test against a sample file
- [ ] Set up Node/Express server with ephemeris fetcher cron
- [ ] Build `/api/orion/state` endpoint
- [ ] Verify interpolation gives smooth position values

### Day 2 — 3D scene
- [ ] Three.js scene: starfield, Earth sphere with texture
- [ ] Add Moon at correct relative position using `getMoonECI()`
- [ ] Add Orion dot (simple sphere first, model later)
- [ ] Animate Orion position from API data
- [ ] Add trajectory arc from ephemeris point cloud

### Day 3 — Telemetry panel
- [ ] Distance from Earth / Moon cards
- [ ] Velocity gauge
- [ ] Mission elapsed time
- [ ] Milestone timeline component
- [ ] Splashdown countdown

### Day 4 — Spacecraft view
- [ ] Embed NASA+ livestream iframe
- [ ] Build fallback synthetic POV in Three.js
- [ ] Add HUD overlay (MET, distance, crosshair)

### Day 5 — Chat
- [ ] Socket.io server + client hook
- [ ] Chat UI component
- [ ] Username selection
- [ ] Online count
- [ ] Milestone auto-messages

### Day 6 — Polish
- [ ] Van Allen Belt torus meshes
- [ ] Camera presets (Follow Orion, Earth view, Lunar approach)
- [ ] Mobile responsive layout (stack panels vertically)
- [ ] Add mission sounds from NASA SoundCloud
- [ ] Deploy frontend to Vercel, backend to Railway

---

## Nice-to-Haves (Post-MVP)

- **Scale comparator** — "Orion is now 12× the distance to ISS"
- **Radiation meter** — animated gauge that spikes when crossing Van Allen belts
- **Augmented reality mode** — use device orientation API to show where Orion is in the sky (like the NASA app does)
- **Share card generator** — "I watched Orion cross 200,000 km" card image
- **Mission audio** — embed NASA comm audio loop, comm chatter samples
- **Twitter/X bot feed** — pull @NASA_Orion updates into chat as system messages

---

## Key URLs

- AROW tracker: `https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/`
- NASA 3D models: `https://nasa3d.arc.nasa.gov/models`
- Blue Marble texture: `https://visibleearth.nasa.gov/images/74117`
- Mission blog (milestone updates): `https://www.nasa.gov/blogs/missions/`
- Live stream: `https://www.nasa.gov/live`
