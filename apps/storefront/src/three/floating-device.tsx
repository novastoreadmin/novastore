"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  Environment,
  ContactShadows,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";

function Device() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y =
      Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    meshRef.current.rotation.x =
      Math.cos(state.clock.elapsedTime * 0.2) * 0.05;

    if (glowRef.current) {
      glowRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <group>
        {/* Main body — laptop-like device */}
        <mesh ref={meshRef} castShadow>
          <boxGeometry args={[3.2, 0.08, 2.2]} />
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={0.9}
            roughness={0.15}
            envMapIntensity={1.2}
          />
        </mesh>

        {/* Screen */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[3, 0.01, 1.9]} />
          <meshStandardMaterial
            color="#0d0d0d"
            metalness={0.5}
            roughness={0.3}
            emissive="#111111"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Screen content glow */}
        <mesh position={[0, 0.06, 0]}>
          <planeGeometry args={[2.8, 1.7]} />
          <meshBasicMaterial
            color="#141414"
            transparent
            opacity={0.8}
          />
        </mesh>

        {/* Edge accent line */}
        <mesh position={[0, 0.045, -1.1]}>
          <boxGeometry args={[2.5, 0.005, 0.005]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.3}
            metalness={1}
            roughness={0}
          />
        </mesh>

        {/* Keyboard base */}
        <mesh position={[0, -0.04, 1.2]} castShadow>
          <boxGeometry args={[3.2, 0.06, 2]} />
          <meshStandardMaterial
            color="#1e1e1e"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Trackpad */}
        <mesh position={[0, -0.005, 1.8]}>
          <boxGeometry args={[1.2, 0.005, 0.8]} />
          <meshStandardMaterial
            color="#252525"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>

        {/* Ambient glow ring */}
        <mesh ref={glowRef} position={[0, -0.1, 0.5]}>
          <ringGeometry args={[2.5, 3, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.015}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Float>
  );
}

export function FloatingDevice({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <PerspectiveCamera makeDefault position={[0, 2.5, 5]} fov={35} />

        <ambientLight intensity={0.15} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={0.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 2, -3]} intensity={0.2} color="#8a8d8f" />
        <spotLight
          position={[0, 8, 0]}
          intensity={0.3}
          angle={0.4}
          penumbra={1}
          color="#ffffff"
        />

        <Device />

        <ContactShadows
          position={[0, -1.2, 0.5]}
          opacity={0.25}
          scale={8}
          blur={2.5}
          far={4}
        />

        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
