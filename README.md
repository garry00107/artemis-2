# Artemis II Mission Tracker

Real-time 3D tracker for NASA's Artemis II crewed lunar flyby mission — powered by real NASA OEM ephemeris data.

**[Live Demo](https://artemis-2-one.vercel.app)** · **Mission: April 1–10, 2026**

![tracker screenshot](https://raw.githubusercontent.com/garry00107/artemis-2/main/docs/screenshot.png)

---

## What it does

Tracks the Orion spacecraft's actual position in real time using NASA's official CCSDS OEM state vector file (3,212 samples, 4-minute intervals). Position between samples is linearly interpolated and served via serverless API at 2-second polling intervals.

Four panels:

- **3D trajectory scene** — Three.js Earth with Blue Marble texture, procedural Orion capsule (crew module + service module + solar arrays), Van Allen belt tori, free-return arc rendered from real ephemeris points, camera presets (Earth view / Follow Orion / Lunar approach)
- **Live telemetry** — distance from Earth, distance to Moon, velocity in km/s / km/h / Mach, mission elapsed time, phase label, milestone timeline, splashdown countdown
- **Spacecraft POV** — synthetic 3D view from Orion's position looking back at Earth; Moon mesh added for flyby visibility; falls back to NASA+ YouTube livestream
- **Mission chat** — live chat with automated milestone notifications at key distance thresholds (SOI, 50k, 20k, 10k km from Moon)

---

## Interesting engineering problem

Moon position was initially off by **154,213 km** — almost exactly the expected closest approach distance.

Root cause: `getMoonECI()` was returning ecliptic coordinates while the OEM data uses J2000 equatorial (EME2000). The missing obliquity rotation (23.44°) produced a Z-axis error of `384,000 × sin(23.44°) ≈ 152,600 km`.

Fix: added the ecliptic → equatorial rotation matrix plus 6 periodic correction terms from Meeus (evection, variation, annual equation) for sub-degree angular accuracy.

```
Before: 154,213 km   →   After: 8,091 km ✅
```

---

## Data source

NASA AROW (Artemis Real-time Orbit Website) publishes a CCSDS OEM file during the mission:
`https://nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/`

The file contains state vectors in J2000 ECI (Earth-centered inertial) frame:

```
2026-04-02T03:07:00.000  -3142.56  5821.90  2341.67  -0.891  4.123  1.654
# timestamp              X(km)     Y(km)    Z(km)    Vx      Vy     Vz  (km/s)
```

Coverage: Apr 2 03:07 UTC → Apr 10 23:53 UTC (full mission through entry interface).

---

## Tech stack

| | |
|---|---|
| Frontend | React 19 + Vite |
| 3D | Three.js (React Three Fiber + Drei) |
| Charts | Recharts |
| Deployment | Vercel (serverless functions + static build) |

Socket.io was dropped in production — Vercel doesn't support WebSockets. REST polling at 2s interval is used instead.

---

## Local development

```bash
# Clone
git clone https://github.com/garry00107/artemis-2
cd artemis-2

# Server
cd server && npm install && node index.js        # http://localhost:3001

# Client (new terminal)
cd client && npm install && npm run dev          # http://localhost:5173
```

Place the NASA OEM file at the project root:
```
artemis-2/
└── Artemis_II_OEM_2026_04_02_to_EI_v3.asc
```

## Deploy

```bash
npx vercel --prod
```

The OEM file is bundled as `/api/lib/ephemeris.asc` via Vercel's `includeFiles` config. No external data fetch needed at runtime.

---

## License

MIT
