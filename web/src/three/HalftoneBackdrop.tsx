/* oxlint-disable react/immutability */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BACKDROP_TIMING } from '../config';
import { halftoneFragmentShader, halftoneVertexShader } from './halftoneShader';

const modules = import.meta.glob('../assets/backdrops/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const backdropUrls = Object.keys(modules)
  .sort((a, b) => a.localeCompare(b))
  .map((key) => modules[key]);

const DISTANCE = 10;
const CYCLE = BACKDROP_TIMING.hold + BACKDROP_TIMING.transition;

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function readAspect(texture: THREE.Texture) {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image?.height) return 16 / 9;
  return image.width / image.height;
}

function useBackdropTextures() {
  const [textures, setTextures] = useState<THREE.Texture[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    Promise.all(backdropUrls.map((url) => loader.loadAsync(url)))
      .then((loaded) => {
        if (cancelled) return;
        loaded.forEach((texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
        });
        setTextures(loaded);
      })
      .catch((error) => {
        console.error('[backdrop] 背景图加载失败', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return textures;
}

export function HalftoneBackdrop() {
  const textures = useBackdropTextures();
  if (!textures.length) return null;
  return <HalftoneBackdropScene textures={textures} />;
}

function HalftoneBackdropScene({ textures }: { textures: THREE.Texture[] }) {
  const cameraGroup = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Mesh>(null);
  const mouseTarget = useRef(new THREE.Vector2(0.5, 0.5));
  const mouseSmooth = useRef(new THREE.Vector2(0.5, 0.5));
  const mouseActiveTarget = useRef(0);
  const mouseActive = useRef(0);
  const { gl } = useThree();

  const aspects = useMemo(() => textures.map(readAspect), [textures]);

  const uniforms = useMemo(
    () => ({
      uTexA: { value: textures[0] },
      uTexB: { value: textures[1] ?? textures[0] },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseActive: { value: 0 },
      uCell: { value: 11.5 },
      uAngle: { value: THREE.MathUtils.degToRad(45) },
      uPaper: { value: new THREE.Color('#070504') },
      uInk: { value: new THREE.Color('#8f7c5c') },
      uAccent: { value: new THREE.Color('#8f2a20') },
      uAspA: { value: aspects[0] ?? 16 / 9 },
      uAspB: { value: aspects[1] ?? aspects[0] ?? 16 / 9 },
      uZoomA: { value: 1.04 },
      uZoomB: { value: 1.06 },
      uPanA: { value: new THREE.Vector2() },
      uPanB: { value: new THREE.Vector2() },
    }),
    [textures, aspects],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') mouseActiveTarget.current = 1;
    };
    const deactivate = () => {
      mouseActiveTarget.current = 0;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', deactivate);
    window.addEventListener('blur', deactivate);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', deactivate);
      window.removeEventListener('blur', deactivate);
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const elapsed = state.clock.elapsedTime;

    if (cameraGroup.current) {
      cameraGroup.current.position.copy(state.camera.position);
      cameraGroup.current.quaternion.copy(state.camera.quaternion);
    }

    if (plane.current) {
      const perspective = state.camera as THREE.PerspectiveCamera;
      const height =
        2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5)) * DISTANCE;
      const width = height * (state.size.width / Math.max(1, state.size.height));
      plane.current.scale.set(width * 1.02, height * 1.02, 1);
    }

    uniforms.uResolution.value.set(state.size.width, state.size.height);
    uniforms.uDpr.value = gl.getPixelRatio();
    uniforms.uTime.value = elapsed;

    const count = textures.length;
    if (count > 0) {
      const index = Math.floor(elapsed / CYCLE) % count;
      const local = elapsed % CYCLE;
      const raw =
        local <= BACKDROP_TIMING.hold
          ? 0
          : (local - BACKDROP_TIMING.hold) / BACKDROP_TIMING.transition;
      const progress = easeInOutCubic(Math.min(1, Math.max(0, raw)));
      const next = (index + 1) % count;

      uniforms.uTexA.value = textures[index];
      uniforms.uTexB.value = textures[next];
      uniforms.uAspA.value = aspects[index];
      uniforms.uAspB.value = aspects[next];
      uniforms.uProgress.value = progress;
      uniforms.uZoomA.value = 1.035 + Math.sin(elapsed * 0.055) * 0.012;
      uniforms.uZoomB.value = 1.055 + Math.sin(elapsed * 0.041 + 1.7) * 0.012;
      uniforms.uPanA.value.set(
        Math.sin(elapsed * 0.045) * 0.006,
        Math.cos(elapsed * 0.032) * 0.004,
      );
      uniforms.uPanB.value.set(
        Math.sin(elapsed * 0.037 + 2.1) * 0.006,
        Math.cos(elapsed * 0.051 + 0.6) * 0.004,
      );
    }

    mouseTarget.current.set(
      state.pointer.x * 0.5 + 0.5,
      state.pointer.y * 0.5 + 0.5,
    );
    mouseSmooth.current.lerp(mouseTarget.current, 1 - Math.exp(-dt * 7));
    mouseActive.current +=
      (mouseActiveTarget.current - mouseActive.current) *
      (1 - Math.exp(-dt * 4));

    uniforms.uMouse.value.copy(mouseSmooth.current);
    uniforms.uMouseActive.value = mouseActive.current;
  });

  return (
    <group ref={cameraGroup}>
      <mesh
        ref={plane}
        position={[0, 0, -DISTANCE]}
        renderOrder={-100}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={halftoneVertexShader}
          fragmentShader={halftoneFragmentShader}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
