import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { getMoonECI } from '../utils/astro-math';

// --- Scale: 1 unit = 1000 km ---
const SCALE = 1 / 1000;
const EARTH_RADIUS = 6.371; // units
const MOON_RADIUS = 1.737;

/* ================================================
   Earth — procedural with realistic coloring
   ================================================ */
function Earth() {
  const meshRef = useRef();
  const cloudRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.02;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.025;
  });

  return (
    <group>
      {/* Earth sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial
          color="#1565c0"
          emissive="#0a3060"
          emissiveIntensity={0.3}
          roughness={0.8}
        />
      </mesh>
      {/* Land masses suggestion — slightly raised darker patches */}
      <mesh ref={cloudRef} scale={1.005}>
        <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#2e7d32"
          emissive="#1b5e20"
          emissiveIntensity={0.1}
          roughness={1}
          transparent
          opacity={0.15}
        />
      </mesh>
      {/* Atmosphere inner glow */}
      <mesh scale={1.02}>
        <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color="#4fc3f7"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Atmosphere outer glow */}
      <mesh scale={1.06}>
        <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color="#00bcd4"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Equator ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[EARTH_RADIUS + 0.05, EARTH_RADIUS + 0.08, 64]} />
        <meshBasicMaterial color="#4fc3f7" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ================================================
   Moon — updates position every 60 seconds
   ================================================ */
function Moon({ moonECI }) {
  const moonPos = useMemo(() => {
    if (!moonECI) {
      const eci = getMoonECI(new Date());
      return [eci.x * SCALE, eci.z * SCALE, -eci.y * SCALE];
    }
    return [moonECI.x * SCALE, moonECI.z * SCALE, -moonECI.y * SCALE];
  }, [moonECI]);

  return (
    <group position={moonPos}>
      <mesh>
        <sphereGeometry args={[MOON_RADIUS * 3, 32, 32]} />
        <meshStandardMaterial
          color="#c0c0c0"
          emissive="#404040"
          emissiveIntensity={0.2}
          roughness={0.9}
        />
      </mesh>
      {/* Subtle glow */}
      <mesh scale={1.1}>
        <sphereGeometry args={[MOON_RADIUS * 3, 16, 16]} />
        <meshBasicMaterial color="#f5f5dc" transparent opacity={0.03} side={THREE.BackSide} />
      </mesh>
      <pointLight color="#f5f5dc" intensity={0.3} distance={30} />
    </group>
  );
}

/* ================================================
   Orion — Procedural spacecraft model
   Crew Module (cone) + Service Module (cylinder)
   + Solar Array wings
   ================================================ */
function Orion({ state }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const heatShieldRef = useRef();
  const crewModuleRef = useRef();

  const position = useMemo(() => {
    if (!state) return [0, 0, 10];
    return [state.x * SCALE, state.z * SCALE, -state.y * SCALE];
  }, [state]);

  // Point spacecraft in velocity direction
  const quaternion = useMemo(() => {
    if (!state || !state.vx) return new THREE.Quaternion();
    const vel = new THREE.Vector3(state.vx, state.vz, -state.vy).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel);
    return q;
  }, [state]);

  // Re-entry heat shield glow intensity (velocity > 10 km/s)
  const speed = useMemo(() => {
    if (!state) return 0;
    return state.velocity || Math.sqrt(state.vx ** 2 + state.vy ** 2 + state.vz ** 2);
  }, [state]);
  const isReentry = speed > 10;
  const heatIntensity = isReentry ? Math.min((speed - 10) / 3, 1) : 0;

  useFrame((st) => {
    if (glowRef.current) {
      const t = st.clock.getElapsedTime();
      glowRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
      glowRef.current.material.opacity = 0.1 + Math.sin(t * 2) * 0.05;
    }
    // Animate heat shield during re-entry
    if (heatShieldRef.current) {
      heatShieldRef.current.intensity = heatIntensity * 8;
    }
    if (crewModuleRef.current && isReentry) {
      crewModuleRef.current.emissiveIntensity = 0.3 + heatIntensity * 0.7;
    }
  });

  return (
    <group position={position} quaternion={quaternion}>
      <group ref={groupRef} scale={0.5}>
        {/* === Crew Module (cone/capsule top) === */}
        <mesh position={[0, 0.6, 0]}>
          <coneGeometry args={[0.45, 0.9, 8]} />
          <meshStandardMaterial
            ref={crewModuleRef}
            color={isReentry ? '#ffcc80' : '#e8e8e8'}
            emissive={isReentry ? '#ff6d00' : '#4fc3f7'}
            emissiveIntensity={isReentry ? 0.5 : 0.1}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Heat shield bottom */}
        <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.45, 8]} />
          <meshStandardMaterial
            color={isReentry ? '#ff8f00' : '#8d6e63'}
            emissive={isReentry ? '#ff6d00' : '#000000'}
            emissiveIntensity={heatIntensity * 0.8}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        {/* Heat shield glow light (only active during re-entry) */}
        <pointLight
          ref={heatShieldRef}
          position={[0, -0.1, 0]}
          color="#ff6d00"
          intensity={0}
          distance={20}
        />

        {/* === Service Module (cylinder) === */}
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.4, 0.45, 1.2, 8]} />
          <meshStandardMaterial
            color="#b0bec5"
            emissive="#37474f"
            emissiveIntensity={0.15}
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>
        {/* Service module nozzle */}
        <mesh position={[0, -1.3, 0]}>
          <coneGeometry args={[0.2, 0.3, 8]} />
          <meshStandardMaterial color="#616161" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* === Solar Array Wings (4 panels) === */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 1.4,
              -0.5,
              Math.sin(angle) * 1.4,
            ]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[1.6, 0.03, 0.5]} />
            <meshStandardMaterial
              color="#1a237e"
              emissive="#283593"
              emissiveIntensity={0.3}
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
        ))}
        {/* Solar panel struts */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh
            key={`strut-${i}`}
            position={[
              Math.cos(angle) * 0.7,
              -0.5,
              Math.sin(angle) * 0.7,
            ]}
            rotation={[0, -angle, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.015, 0.015, 0.6, 4]} />
            <meshStandardMaterial color="#78909c" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </group>

      {/* Glow effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial
          color={isReentry ? '#ff6d00' : '#4fc3f7'}
          transparent
          opacity={0.12}
        />
      </mesh>
      {/* Navigation lights */}
      <pointLight color="#4fc3f7" intensity={2} distance={40} />
      <pointLight color="#ffab40" intensity={0.5} distance={15} />
    </group>
  );
}

/* ================================================
   Trajectory Arc — past (bright) + future (faded)
   ================================================ */
function TrajectoryArc({ points, currentTime }) {
  const { pastGeom, futureGeom } = useMemo(() => {
    if (!points || points.length < 2) return { pastGeom: null, futureGeom: null };
    
    const now = Date.now();
    const toVec = (p) => new THREE.Vector3(p[0] * SCALE, p[2] * SCALE, -p[1] * SCALE);

    // Find split point closest to current time
    // Points are [x, y, z, time] — time is at index 3 if present, else use progress
    const missionStart = new Date('2026-04-02T03:07:49Z').getTime();
    const missionEnd = new Date('2026-04-10T23:53:12Z').getTime();
    const progress = Math.max(0, Math.min(1, (now - missionStart) / (missionEnd - missionStart)));
    const splitIndex = Math.floor(points.length * progress);
    
    const pastPoints = points.slice(0, Math.max(splitIndex, 2)).map(toVec);
    const futurePoints = points.slice(Math.max(splitIndex - 1, 0)).map(toVec);
    
    let pg = null, fg = null;
    
    if (pastPoints.length >= 2) {
      const pastCurve = new THREE.CatmullRomCurve3(pastPoints);
      pg = new THREE.TubeGeometry(pastCurve, pastPoints.length * 2, 0.15, 8, false);
    }
    
    if (futurePoints.length >= 2) {
      const futureCurve = new THREE.CatmullRomCurve3(futurePoints);
      fg = new THREE.TubeGeometry(futureCurve, futurePoints.length * 2, 0.1, 8, false);
    }
    
    return { pastGeom: pg, futureGeom: fg };
  }, [points, currentTime]);
  
  return (
    <group>
      {pastGeom && (
        <mesh geometry={pastGeom}>
          <meshBasicMaterial color="#4fc3f7" transparent opacity={0.6} />
        </mesh>
      )}
      {futureGeom && (
        <mesh geometry={futureGeom}>
          <meshBasicMaterial color="#b388ff" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
}

/* ================================================
   Van Allen Belts — enhanced visibility
   Inner: ~1,000-6,000 km altitude
   Outer: ~13,000-60,000 km altitude
   ================================================ */
function VanAllenBelts() {
  const innerRef = useRef();
  const outerRef = useRef();

  useFrame((st) => {
    const t = st.clock.getElapsedTime();
    if (innerRef.current) {
      innerRef.current.material.opacity = 0.06 + Math.sin(t * 0.5) * 0.02;
    }
    if (outerRef.current) {
      outerRef.current.material.opacity = 0.06 + Math.sin(t * 0.3 + 1) * 0.02;
    }
  });

  return (
    <group>
      {/* Inner belt: avg radius ~10 units (3,600 km altitude) */}
      <mesh ref={innerRef} rotation={[Math.PI * 0.05, 0, 0]}>
        <torusGeometry args={[9.8, 2.5, 16, 64]} />
        <meshBasicMaterial
          color="#ff9800"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Outer belt: avg radius ~26 units (20,000 km altitude) */}
      <mesh ref={outerRef} rotation={[Math.PI * 0.08, 0.1, 0]}>
        <torusGeometry args={[26, 7, 16, 64]} />
        <meshBasicMaterial
          color="#ff9800"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ================================================
   Camera Controller — state-based with smooth lerp
   ================================================ */
function CameraController({ viewMode, orionPosition, moonECI }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const targetPos = useRef(new THREE.Vector3(0, 20, 40));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);

  useEffect(() => {
    if (!controlsRef.current) return;
    isAnimating.current = true;

    switch (viewMode) {
      case 'earth':
        targetPos.current.set(0, 15, 30);
        targetLook.current.set(0, 0, 0);
        break;
      case 'follow':
        if (orionPosition) {
          const [ox, oy, oz] = orionPosition;
          targetPos.current.set(ox - 8, oy + 6, oz + 12);
          targetLook.current.set(ox, oy, oz);
        }
        break;
      case 'lunar': {
        // Compute Moon position in Three.js coords
        const eci = moonECI || getMoonECI(new Date());
        const mx = eci.x * SCALE;
        const mz = eci.z * SCALE;
        const my = -eci.y * SCALE;
        const moonVec = new THREE.Vector3(mx, mz, my);

        // Only target Moon when Orion is within 50,000 km of it
        if (orionPosition) {
          const orionVec = new THREE.Vector3(...orionPosition);
          const distToMoon = orionVec.distanceTo(moonVec);

          if (distToMoon < 50) { // 50 units = 50,000 km
            // Close to Moon — show both Orion and Moon
            const midpoint = orionVec.clone().add(moonVec).multiplyScalar(0.5);
            const offset = new THREE.Vector3(0, distToMoon * 0.4, distToMoon * 0.6);
            targetPos.current.copy(midpoint.clone().add(offset));
            targetLook.current.copy(midpoint);
          } else {
            // Too far — follow Orion but pull camera back to show trajectory toward Moon
            const [ox, oy, oz] = orionPosition;
            const dirToMoon = moonVec.clone().sub(orionVec).normalize();
            targetPos.current.set(
              ox - dirToMoon.x * 20 + 10,
              oy + 15,
              oz - dirToMoon.z * 20 + 10,
            );
            targetLook.current.set(ox, oy, oz);
          }
        } else {
          targetPos.current.set(mx + 15, mz + 10, my + 15);
          targetLook.current.set(mx, mz, my);
        }
        break;
      }
      default:
        break;
    }
  }, [viewMode, camera, orionPosition, moonECI]);

  useFrame(() => {
    if (!controlsRef.current || !isAnimating.current) return;

    camera.position.lerp(targetPos.current, 0.05);
    controlsRef.current.target.lerp(targetLook.current, 0.05);
    controlsRef.current.update();

    // Stop animation when close enough
    if (camera.position.distanceTo(targetPos.current) < 0.1) {
      isAnimating.current = false;
    }
  });

  // Keep following Orion in follow mode
  useEffect(() => {
    if (viewMode === 'follow' && orionPosition) {
      const [ox, oy, oz] = orionPosition;
      targetPos.current.set(ox - 8, oy + 6, oz + 12);
      targetLook.current.set(ox, oy, oz);
      isAnimating.current = true;
    }
  }, [orionPosition, viewMode]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={3}
      maxDistance={800}
      enablePan
    />
  );
}

/* ================================================
   Main Scene Export
   ================================================ */
export default function TrajectoryScene({ state, trajectory, moonECI }) {
  const [viewMode, setViewMode] = useState('earth');

  const orionPosition = useMemo(() => {
    if (!state) return null;
    return [state.x * SCALE, state.z * SCALE, -state.y * SCALE];
  }, [state]);

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <div className="panel-header">
        <span className="panel-title">
          <span className="dot"></span>
          3D Trajectory
        </span>
      </div>

      <Canvas
        camera={{ position: [0, 20, 40], fov: 50, near: 0.1, far: 2000 }}
        style={{ background: '#06080f' }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <directionalLight position={[50, 30, 20]} intensity={1.2} color="#fff5e6" />
        <pointLight position={[-30, -20, -10]} intensity={0.3} color="#4fc3f7" />

        {/* Starfield */}
        <Stars radius={500} depth={200} count={4000} factor={3} saturation={0.1} fade speed={0.3} />

        {/* Scene objects */}
        <Earth />
        <Moon moonECI={moonECI} />
        <Orion state={state} />
        <TrajectoryArc points={trajectory} currentTime={state?.time} />
        <VanAllenBelts />
        
        {/* Controls */}
        <CameraController viewMode={viewMode} orionPosition={orionPosition} moonECI={moonECI} />
      </Canvas>

      <div className="scene-controls">
        <button
          className={viewMode === 'earth' ? 'active' : ''}
          onClick={() => setViewMode('earth')}
        >
          🌍 Earth View
        </button>
        <button
          className={viewMode === 'follow' ? 'active' : ''}
          onClick={() => setViewMode('follow')}
        >
          🚀 Follow Orion
        </button>
        <button
          className={viewMode === 'lunar' ? 'active' : ''}
          onClick={() => setViewMode('lunar')}
        >
          🌕 Lunar Approach
        </button>
      </div>
    </div>
  );
}
