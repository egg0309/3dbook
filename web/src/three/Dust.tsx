import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createDustTexture } from './textures';

const COUNT = 150;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function Dust() {
  const points = useRef<THREE.Points>(null);
  const texture = useMemo(() => createDustTexture(), []);
  const data = useMemo(() => {
    const rand = seededRandom(1935);
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (rand() - 0.5) * 9;
      positions[i * 3 + 1] = rand() * 5.5 - 2.2;
      positions[i * 3 + 2] = (rand() - 0.5) * 5.5 - 0.5;
      speeds[i] = 0.018 + rand() * 0.055;
      phases[i] = rand() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, []);

  useFrame((state, delta) => {
    const attribute = points.current?.geometry.attributes
      .position as THREE.BufferAttribute | undefined;
    if (!attribute) return;
    const array = attribute.array as Float32Array;
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const yIndex = i * 3 + 1;
      array[yIndex] += data.speeds[i] * dt;
      array[i * 3] += Math.sin(time * 0.35 + data.phases[i]) * 0.0012;
      if (array[yIndex] > 3.3) {
        array[yIndex] = -2.2;
        array[i * 3] = (Math.random() - 0.5) * 9;
        array[i * 3 + 2] = (Math.random() - 0.5) * 5.5 - 0.5;
      }
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color="#f3d8b0"
        size={0.026}
        sizeAttenuation
        transparent
        opacity={0.48}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
