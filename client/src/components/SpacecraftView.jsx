import { useState, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { formatMET, formatNumber, LAUNCH_TIME } from '../utils/astro-math';

const SCALE = 1 / 1000;
const EARTH_RADIUS = 6.371;
const MOON_RADIUS = 1.737;

// YouTube stream — real Artemis II broadcast
const YOUTUBE_STREAM_ID = 'Tf_UjBMIzNo';

/* ================================================
   POV Earth — positioned relative to Orion
   ================================================ */
function POVEarth({ orionState }) {
  const meshRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.015;
    }
  });

  const distance = useMemo(() => {
    if (!orionState) return 100;
    return Math.sqrt(orionState.x ** 2 + orionState.y ** 2 + orionState.z ** 2) * SCALE;
  }, [orionState]);

  return (
    <group position={[0, 0, -distance]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial
          color="#1565c0"
          emissive="#0a3060"
          emissiveIntensity={0.4}
          roughness={0.7}
        />
      </mesh>
      {/* Atmosphere */}
      <mesh scale={1.03}>
        <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
        <meshBasicMaterial color="#4fc3f7" transparent opacity={0.1} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ================================================
   POV Moon — positioned relative to Orion
   At flyby (~8,000 km), both Earth and Moon
   will be visible simultaneously
   ================================================ */
function POVMoon({ orionState, moonECI }) {
  const meshRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.005;
    }
  });

  const moonRelativePos = useMemo(() => {
    if (!orionState || !moonECI) return null;
    // Moon position relative to Orion in Three.js coords
    // ECI → Three.js: x=x, y=z, z=-y (Y-up conversion)
    const moonX = moonECI.x * SCALE;
    const moonY = moonECI.z * SCALE;
    const moonZ = -moonECI.y * SCALE;

    const orionX = orionState.x * SCALE;
    const orionY = orionState.z * SCALE;
    const orionZ = -orionState.y * SCALE;

    return [moonX - orionX, moonY - orionY, moonZ - orionZ];
  }, [orionState, moonECI]);

  if (!moonRelativePos) return null;

  return (
    <group position={moonRelativePos}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#c0c0c0"
          emissive="#505050"
          emissiveIntensity={0.2}
          roughness={0.9}
        />
      </mesh>
      {/* Subtle glow */}
      <mesh scale={1.08}>
        <sphereGeometry args={[MOON_RADIUS, 16, 16]} />
        <meshBasicMaterial color="#f5f5dc" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
      <pointLight color="#f5f5dc" intensity={0.4} distance={50} />
    </group>
  );
}

/* ================================================
   Camera — looks from Orion toward Earth
   ================================================ */
function POVCamera({ orionState }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!orionState) return;
    // Camera is at origin (Orion's position), looking back toward Earth
    const earthDir = new THREE.Vector3(
      -orionState.x * SCALE,
      -orionState.z * SCALE,
      orionState.y * SCALE,
    ).normalize();
    // Look toward Earth  
    camera.lookAt(earthDir.multiplyScalar(100));
  });

  return null;
}

/* ================================================
   Synthetic POV Scene
   ================================================ */
function SyntheticPOV({ state, moonECI }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 0], fov: 60, near: 0.01, far: 2000 }}
      style={{ background: '#020408' }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.1} />
      <directionalLight position={[0, 0, -100]} intensity={1.5} color="#fff8e1" />
      <Stars radius={400} depth={200} count={3000} factor={4} saturation={0} fade speed={0.2} />
      <POVEarth orionState={state} />
      <POVMoon orionState={state} moonECI={moonECI} />
      <POVCamera orionState={state} />
    </Canvas>
  );
}

/* ================================================
   Main Component
   ================================================ */
export default function SpacecraftView({ state, moonECI }) {
  const [mode, setMode] = useState('pov'); // 'pov' | 'stream'

  const now = new Date();
  const met = formatMET(now.getTime() - LAUNCH_TIME.getTime());
  const dist = state ? formatNumber(state.distanceFromEarth || 0) : '---';
  const speed = state ? (state.velocity || 0).toFixed(3) : '---';

  return (
    <div className="panel spacecraft-view">
      <div className="panel-header">
        <span className="panel-title">
          <span className="dot"></span>
          Spacecraft View
        </span>
      </div>

      {/* Mode toggle */}
      <div className="view-toggle">
        <button
          className={mode === 'pov' ? 'active' : ''}
          onClick={() => setMode('pov')}
        >
          3D POV
        </button>
        <button
          className={mode === 'stream' ? 'active' : ''}
          onClick={() => setMode('stream')}
        >
          NASA Live
        </button>
      </div>

      {/* Content */}
      {mode === 'pov' ? (
        <>
          <SyntheticPOV state={state} moonECI={moonECI} />
          <div className="crosshair"></div>
        </>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${YOUTUBE_STREAM_ID}?autoplay=1&mute=1&controls=0`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            marginTop: '36px',
          }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="NASA Artemis II Live Stream"
        />
      )}

      {/* HUD Overlay */}
      <div className="pov-hud">
        <div className="pov-hud-item">MET {met}</div>
        <div className="pov-hud-item">{dist} km</div>
        <div className="pov-hud-item">{speed} km/s</div>
      </div>
    </div>
  );
}
