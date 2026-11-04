import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Experience } from './Experience';

interface SceneProps {
  onReady: () => void;
}

export function Scene({ onReady }: SceneProps) {
  return (
    <div className="scene">
      <Canvas
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: 35,
          near: 0.1,
          far: 80,
          position: [0, 0.32, 5.4],
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.setClearColor(0x080605, 1);
        }}
      >
        <Suspense fallback={null}>
          <Experience onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}
