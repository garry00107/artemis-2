# 🚀 Artemis II Mission Tracker

Real-time tracking of NASA's Artemis II crewed lunar flyby mission, using real NASA JPL ephemeris data.

## Live Features

- **3D Trajectory Visualization** — Three.js scene with Earth, Moon, Van Allen belts, and procedural Orion spacecraft
- **Real-Time Telemetry** — Distance from Earth, distance to Moon, velocity (km/s, km/h, Mach)
- **Lunar Flyby Countdown** — Computed from 3,212 real state vectors (closest approach: ~8,091 km from Moon)
- **Spacecraft POV** — Synthetic 3D view from Orion's perspective + NASA Live stream embed
- **Mission Chat** — Live chat with automated milestone notifications
- **Re-Entry Heat Shield** — Dynamic orange glow effect when velocity exceeds 10 km/s

## Data Source

Real NASA CCSDS OEM (Orbital Ephemeris Message) file from the Artemis Real-time Orbit Website (AROW). The OEM file contains state vectors (position + velocity) from April 2–10, 2026, covering:

- **Trans-Lunar Injection** → **Trans-Lunar Coast** → **Lunar Flyby** (Apr 6) → **Trans-Earth Coast** → **Entry Interface**

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite |
| 3D | Three.js (React Three Fiber + Drei) |
| Charts | Recharts |
| Server | Node.js + Express + Socket.io |
| Deployment | Vercel (serverless API + static frontend) |

## Local Development

```bash
# Server (port 3001)
cd server && npm install && node index.js

# Client (port 5173)
cd client && npm install && npm run dev
```

Place the NASA OEM file as `Artemis_II_OEM_2026_04_02_to_EI_v3.asc` in the project root.

## Deploy to Vercel

```bash
npx vercel --prod
```

The OEM file is bundled in `/api/lib/ephemeris.asc` for serverless deployment.

## License

MIT
