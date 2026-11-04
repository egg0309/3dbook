import { useMemo } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { createGlowTexture, createShadowTexture } from './textures';

export function Atmosphere() {
  const glow = useMemo(() => createGlowTexture(), []);
  const shadow = useMemo(() => createShadowTexture(), []);

  return (
    <>
      <ambientLight intensity={0.26} color="#ffd9b8" />
      <directionalLight
        position={[4.2, 5.2, 6]}
        intensity={2.7}
        color="#ffe4c4"
      />
      <spotLight
        position={[-4.2, 1.6, -1.8]}
        angle={0.75}
        penumbra={1}
        intensity={50}
        distance={16}
        decay={2}
        color="#a62b22"
      />
      <pointLight
        position={[0.4, -1.4, 2.6]}
        intensity={7}
        distance={9}
        decay={2}
        color="#8ea3b7"
      />

      <Environment resolution={256} frames={1} background={false}>
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#ffd7b0"
          position={[0, 3.2, 4]}
          scale={[6, 3.4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#a62b22"
          position={[-4.5, 0.8, 1.8]}
          scale={[3.2, 3.8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#72869a"
          position={[4.2, -0.6, 1.2]}
          scale={[3, 2.6, 1]}
        />
      </Environment>

      <sprite position={[0, 0.05, -1.9]} scale={[7.4, 5.4, 1]}>
        <spriteMaterial
          map={glow}
          color="#b84a32"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite position={[0, 0.3, -0.8]} scale={[3.4, 2.6, 1]}>
        <spriteMaterial
          map={glow}
          color="#e3a268"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      <mesh
        position={[0, -1.33, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[3.4, 1.55, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={shadow}
          transparent
          opacity={0.62}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
