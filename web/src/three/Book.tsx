/* oxlint-disable react/immutability */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BOOK_OPEN_DURATION } from '../config';
import {
  journeyProgress,
  markInteracted,
  setJourneyPhase,
  useResetToken,
  type JourneyPhase,
} from '../journey';
import { useBookTextures } from './useBookTextures';
import { createCornerGeometry, createStarGeometry } from './bookGeometry';
import type { BookTextures } from './textures';

const W = 1.7;
const H = 2.35;
const T = 0.34;
const COVER = 0.03;
const HALF_W = W / 2;
const HALF_H = H / 2;
const HALF_T = T / 2;
const FRONT_Z = HALF_T - COVER / 2;
const BACK_Z = -FRONT_Z;
const PAGE_T = T - COVER * 2 - 0.006;
const PAGE_W = W - 0.075;
const PAGE_H = H - 0.07;

const BASE_TILT_X = -0.34;
const BASE_TILT_Z = -0.055;
const OPEN_TILT_X = -0.11;
const OPEN_TILT_Z = 0.0;

function easeInOutQuart(value: number) {
  return value < 0.5
    ? 8 * value * value * value * value
    : 1 - Math.pow(-2 * value + 2, 4) / 2;
}

function smoothstep01(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function isUiTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('button, a, input, textarea, [data-ui]')
  );
}

interface FrameProps {
  centerX: number;
  material: THREE.Material;
}

function CoverFrame({ centerX, material }: FrameProps) {
  const inset = 0.085;
  const bar = 0.018;
  const z = COVER / 2 + 0.006;
  const lengthX = W - inset * 2;
  const lengthY = H - inset * 2;
  return (
    <>
      <RoundedBox
        args={[lengthX, bar, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX, H / 2 - inset, z]}
        material={material}
      />
      <RoundedBox
        args={[lengthX, bar, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX, -H / 2 + inset, z]}
        material={material}
      />
      <RoundedBox
        args={[bar, lengthY, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX - W / 2 + inset, 0, z]}
        material={material}
      />
      <RoundedBox
        args={[bar, lengthY, 0.012]}
        radius={0.0025}
        smoothness={2}
        position={[centerX + W / 2 - inset, 0, z]}
        material={material}
      />
    </>
  );
}

interface CornerProps {
  centerX: number;
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
}

function CornerProtectors({ centerX, material, geometry }: CornerProps) {
  const corners = [
    { x: centerX - HALF_W + 0.018, y: HALF_H - 0.018, rotation: 0 },
    { x: centerX + HALF_W - 0.018, y: HALF_H - 0.018, rotation: -Math.PI / 2 },
    { x: centerX + HALF_W - 0.018, y: -HALF_H + 0.018, rotation: Math.PI },
    { x: centerX - HALF_W + 0.018, y: -HALF_H + 0.018, rotation: Math.PI / 2 },
  ];
  return (
    <>
      {corners.map((corner) => (
        <mesh
          key={`${corner.x}-${corner.y}`}
          geometry={geometry}
          material={material}
          position={[corner.x, corner.y, COVER / 2 + 0.002]}
          rotation={[0, 0, corner.rotation]}
        />
      ))}
    </>
  );
}

interface EmblemProps {
  centerX: number;
  gold: THREE.Material;
  red: THREE.Material;
  starGeometry: THREE.BufferGeometry;
  back?: boolean;
}

function Emblem({ centerX, gold, red, starGeometry, back = false }: EmblemProps) {
  return (
    <group position={[centerX, back ? 0.1 : 0.78, 0]}>
      <mesh position={[0, 0, COVER / 2 + 0.0075]} material={gold}>
        <torusGeometry args={[back ? 0.335 : 0.315, 0.006, 8, 64]} />
      </mesh>
      <mesh
        position={[0, 0, COVER / 2 + 0.0045]}
        scale={[back ? 0.315 : 0.3, back ? 0.315 : 0.3, 0.32]}
        geometry={starGeometry}
        material={gold}
      />
      {!back && (
        <mesh
          position={[0, 0, COVER / 2 + 0.0095]}
          scale={[0.265, 0.265, 0.3]}
          geometry={starGeometry}
          material={red}
        />
      )}
    </group>
  );
}

interface BookModelProps {
  textures: BookTextures;
  coverHingeRef: RefObject<THREE.Group | null>;
}

function BookModel({ textures, coverHingeRef }: BookModelProps) {
  const starGeometry = useMemo(() => createStarGeometry(1, 0.42, 0.06), []);
  const cornerGeometry = useMemo(
    () => createCornerGeometry(0.165, 0.038, 0.012),
    [],
  );
  const ribbonCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.5, -HALF_H + 0.02, 0.03),
        new THREE.Vector3(-0.55, -HALF_H - 0.14, 0.06),
        new THREE.Vector3(-0.63, -HALF_H - 0.32, 0.11),
        new THREE.Vector3(-0.8, -HALF_H - 0.28, 0.16),
      ]),
    [],
  );

  const materials = useMemo(() => {
    const cloth = new THREE.MeshPhysicalMaterial({
      map: textures.clothMap,
      bumpMap: textures.clothBump,
      bumpScale: 0.014,
      roughness: 0.84,
      metalness: 0.03,
      sheen: 0.26,
      sheenColor: new THREE.Color('#8d3b2e'),
      sheenRoughness: 0.78,
      envMapIntensity: 0.38,
      side: THREE.DoubleSide,
    });

    const pageEdge = new THREE.MeshStandardMaterial({
      map: textures.pageEdge,
      bumpMap: textures.pageEdge,
      bumpScale: 0.004,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.3,
    });

    const paper = new THREE.MeshStandardMaterial({
      map: textures.paper,
      bumpMap: textures.paper,
      bumpScale: 0.002,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.32,
    });

    const firstPage = new THREE.MeshStandardMaterial({
      map: textures.firstPage,
      bumpMap: textures.paper,
      bumpScale: 0.0018,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.3,
    });

    const endpaper = new THREE.MeshStandardMaterial({
      map: textures.endpaper,
      bumpMap: textures.endpaper,
      bumpScale: 0.0025,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.35,
    });

    const coverArt = new THREE.MeshStandardMaterial({
      map: textures.coverArt,
      bumpMap: textures.coverArt,
      bumpScale: 0.004,
      roughness: 0.52,
      metalness: 0.28,
      envMapIntensity: 0.9,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const backArt = new THREE.MeshStandardMaterial({
      map: textures.backCoverArt,
      bumpMap: textures.backCoverArt,
      bumpScale: 0.003,
      roughness: 0.58,
      metalness: 0.2,
      envMapIntensity: 0.8,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const coverBase = textures.coverBase
      ? new THREE.MeshStandardMaterial({
          map: textures.coverBase,
          roughness: 0.72,
          metalness: 0.06,
          envMapIntensity: 0.5,
        })
      : null;

    const backCoverBase = textures.backCoverBase
      ? new THREE.MeshStandardMaterial({
          map: textures.backCoverBase,
          roughness: 0.74,
          metalness: 0.05,
          envMapIntensity: 0.45,
        })
      : null;

    const gold = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c9a25a'),
      metalness: 0.94,
      roughness: 0.3,
      clearcoat: 0.35,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.25,
    });

    const red = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#4c0a06'),
      metalness: 0.01,
      roughness: 0.64,
      clearcoat: 0.04,
      clearcoatRoughness: 0.45,
      emissive: new THREE.Color('#0b0201'),
      emissiveIntensity: 0.18,
      envMapIntensity: 0.16,
    });

    const ribbon = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7a1c16'),
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    const pageMaterials: THREE.Material[] = [
      pageEdge,
      cloth,
      pageEdge,
      pageEdge,
      paper,
      paper,
    ];

    return {
      cloth,
      pageEdge,
      paper,
      firstPage,
      endpaper,
      coverArt,
      backArt,
      coverBase,
      backCoverBase,
      gold,
      red,
      ribbon,
      pageMaterials,
    };
  }, [textures]);

  return (
    <group>
      <RoundedBox
        args={[W, H, COVER]}
        radius={0.012}
        smoothness={4}
        position={[0, 0, BACK_Z]}
        material={materials.cloth}
      />

      <mesh position={[-HALF_W, 0, 0]} material={materials.cloth}>
        <cylinderGeometry
          args={[HALF_T, HALF_T, H, 48, 1, true, Math.PI, Math.PI]}
        />
      </mesh>
      <mesh
        position={[-HALF_W, HALF_H - 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.cloth}
      >
        <circleGeometry args={[HALF_T, 48, Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh
        position={[-HALF_W, -HALF_H + 0.002, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.cloth}
      >
        <circleGeometry args={[HALF_T, 48, Math.PI / 2, Math.PI]} />
      </mesh>

      {[-0.68, 0, 0.68].map((y) => (
        <mesh
          key={y}
          position={[-HALF_W, y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.cloth}
        >
          <torusGeometry args={[HALF_T + 0.003, 0.007, 8, 40]} />
        </mesh>
      ))}

      <mesh material={materials.pageMaterials}>
        <boxGeometry args={[PAGE_W, PAGE_H, PAGE_T]} />
      </mesh>
      <mesh
        position={[0, 0, PAGE_T / 2 + 0.0012]}
        material={materials.firstPage}
      >
        <planeGeometry args={[PAGE_W - 0.004, PAGE_H - 0.004]} />
      </mesh>

      <mesh scale={[1, 1, 0.32]} material={materials.ribbon}>
        <tubeGeometry args={[ribbonCurve, 48, 0.019, 6, false]} />
      </mesh>

      <group position={[0, 0, BACK_Z]} rotation={[0, Math.PI, 0]}>
        {textures.backCoverBase && materials.backCoverBase && (
          <mesh
            position={[0, 0, COVER / 2 + 0.0008]}
            material={materials.backCoverBase}
          >
            <planeGeometry args={[W - 0.004, H - 0.004]} />
          </mesh>
        )}
        <mesh
          position={[0, 0, COVER / 2 + 0.0015]}
          material={materials.backArt}
        >
          <planeGeometry args={[W - 0.02, H - 0.02]} />
        </mesh>
        <CoverFrame centerX={0} material={materials.gold} />
        <CornerProtectors
          centerX={0}
          material={materials.gold}
          geometry={cornerGeometry}
        />
        <Emblem
          centerX={0}
          gold={materials.gold}
          red={materials.red}
          starGeometry={starGeometry}
          back
        />
      </group>

      <group
        ref={coverHingeRef}
        position={[-HALF_W, 0, FRONT_Z]}
      >
        <RoundedBox
          args={[W, H, COVER]}
          radius={0.012}
          smoothness={4}
          position={[HALF_W, 0, 0]}
          material={materials.cloth}
        />
        {textures.coverBase && materials.coverBase && (
          <mesh
            position={[HALF_W, 0, COVER / 2 + 0.0008]}
            material={materials.coverBase}
          >
            <planeGeometry args={[W - 0.004, H - 0.004]} />
          </mesh>
        )}
        <mesh
          position={[HALF_W, 0, COVER / 2 + 0.0015]}
          material={materials.coverArt}
        >
          <planeGeometry args={[W - 0.02, H - 0.02]} />
        </mesh>
        <mesh
          position={[HALF_W, 0, -COVER / 2 - 0.0015]}
          rotation={[0, Math.PI, 0]}
          material={materials.endpaper}
        >
          <planeGeometry args={[W - 0.05, H - 0.05]} />
        </mesh>
        <CoverFrame centerX={HALF_W} material={materials.gold} />
        <CornerProtectors
          centerX={HALF_W}
          material={materials.gold}
          geometry={cornerGeometry}
        />
        <Emblem
          centerX={HALF_W}
          gold={materials.gold}
          red={materials.red}
          starGeometry={starGeometry}
        />
      </group>
    </group>
  );
}

export function Book() {
  const textures = useBookTextures();
  const camera = useThree((state) => state.camera);
  const coverHingeRef = useRef<THREE.Group>(null);
  const parallaxRef = useRef<THREE.Group>(null);
  const floatRef = useRef<THREE.Group>(null);
  const scaleRef = useRef<THREE.Group>(null);
  const spinFrameRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const innerLightRef = useRef<THREE.PointLight>(null);

  const phaseRef = useRef<JourneyPhase>('idle');
  const targetSpin = useRef(0);
  const spin = useRef(0);
  const open = useRef(0);
  const openStartTime = useRef<number | null>(null);
  const lastCss = useRef(-1);
  const resetToken = useResetToken();

  const setPhase = useCallback((next: JourneyPhase) => {
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setJourneyPhase(next);
  }, []);

  const advance = useCallback(
    (amount: number) => {
      if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
      const next = THREE.MathUtils.clamp(targetSpin.current + amount, 0, 1);
      if (next === targetSpin.current) return;
      targetSpin.current = next;
      markInteracted();
      setPhase('spinning');
    },
    [setPhase],
  );

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1;
      const delta = event.deltaY * unit;
      advance(THREE.MathUtils.clamp(delta * 0.00085, -0.18, 0.18));
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [advance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isUiTarget(event.target)) return;
      let amount = 0;
      if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        amount = 0.075;
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        amount = -0.075;
      } else {
        return;
      }
      event.preventDefault();
      advance(amount);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance]);

  useEffect(() => {
    let dragging = false;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || isUiTarget(event.target)) return;
      if (phaseRef.current === 'opening' || phaseRef.current === 'open') return;
      dragging = true;
      lastY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = lastY - event.clientY;
      lastY = event.clientY;
      if (Math.abs(delta) < 0.5) return;
      advance(THREE.MathUtils.clamp(delta * 0.0032, -0.14, 0.14));
    };

    const onPointerUp = () => {
      dragging = false;
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [advance]);

  useEffect(() => {
    targetSpin.current = 0;
    spin.current = 0;
    open.current = 0;
    openStartTime.current = null;
    phaseRef.current = 'idle';
    lastCss.current = -1;
    journeyProgress.spin = 0;
    journeyProgress.open = 0;
    journeyProgress.total = 0;
    coverHingeRef.current?.rotation.set(0, 0, 0);
    if (innerLightRef.current) innerLightRef.current.intensity = 0;
    floatRef.current?.position.set(0, 0, 0);
    spinFrameRef.current?.rotation.set(BASE_TILT_X, 0, BASE_TILT_Z);
    scaleRef.current?.scale.setScalar(1);
    camera.position.set(0, 0.32, 5.4);
    camera.lookAt(0, 0.02, 0);
    document.documentElement.style.setProperty('--journey', '0');
    document.documentElement.style.setProperty('--book-open', '0');
  }, [resetToken, camera]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;

    spin.current +=
      (targetSpin.current - spin.current) * (1 - Math.exp(-dt * 6.5));
    if (spin.current > 0.998) spin.current = 1;

    if (
      targetSpin.current >= 1 &&
      spin.current >= 0.985 &&
      openStartTime.current === null &&
      phaseRef.current !== 'open'
    ) {
      openStartTime.current = elapsed;
      setPhase('opening');
    }

    if (openStartTime.current !== null) {
      const progress = THREE.MathUtils.clamp(
        (elapsed - openStartTime.current) / BOOK_OPEN_DURATION,
        0,
        1,
      );
      open.current = progress >= 0.999 ? 1 : easeInOutQuart(progress);
      if (progress >= 0.999 && phaseRef.current !== 'open') setPhase('open');
    }

    const openEase = open.current;
    const portrait = state.size.width < state.size.height;
    const baseScale = portrait ? 0.8 : 1;
    const openScale = portrait ? 0.52 : 1;
    const bookScale = THREE.MathUtils.lerp(baseScale, openScale, openEase);

    if (spinRef.current) {
      spinRef.current.rotation.y = smoothstep01(spin.current) * Math.PI * 2;
    }
    if (spinFrameRef.current) {
      spinFrameRef.current.rotation.x = THREE.MathUtils.lerp(
        BASE_TILT_X,
        OPEN_TILT_X,
        openEase,
      );
      spinFrameRef.current.rotation.z = THREE.MathUtils.lerp(
        BASE_TILT_Z,
        OPEN_TILT_Z,
        openEase,
      );
    }
    if (scaleRef.current) {
      scaleRef.current.scale.setScalar(bookScale);
    }
    if (floatRef.current) {
      floatRef.current.position.y =
        Math.sin(elapsed * 0.8) * 0.03 * (1 - openEase);
    }
    if (coverHingeRef.current) {
      coverHingeRef.current.rotation.y = -Math.PI * openEase;
    }
    if (innerLightRef.current) {
      innerLightRef.current.intensity = openEase * 0.85;
    }
    if (parallaxRef.current) {
      const damping = 1 - Math.exp(-dt * 3);
      const pointer = state.pointer;
      parallaxRef.current.rotation.x +=
        (pointer.y * 0.045 * (1 - openEase * 0.65) -
          parallaxRef.current.rotation.x) *
        damping;
      parallaxRef.current.rotation.z +=
        (-pointer.x * 0.03 * (1 - openEase * 0.65) -
          parallaxRef.current.rotation.z) *
        damping;
    }

    // 全书打开后从左侧封面外缘（-HALF_W - W）延伸到右侧页块外缘（PAGE_W / 2）
    const spreadCenter = ((HALF_W + W - PAGE_W / 2) / 2) * bookScale;
    const baseZ = portrait ? 5.8 : 5.0;
    const openZ = portrait ? 6.8 : 4.75;
    const targetZ = THREE.MathUtils.lerp(baseZ, openZ, openEase);
    const targetX = -spreadCenter * openEase;
    const targetY = THREE.MathUtils.lerp(0.32, 0.42, openEase);
    const damp = 1 - Math.exp(-dt * 2.6);

    camera.position.x += (targetX - camera.position.x) * damp;
    camera.position.y += (targetY - camera.position.y) * damp;
    camera.position.z += (targetZ - camera.position.z) * damp;
    camera.lookAt(camera.position.x, 0.02, 0);

    journeyProgress.spin = spin.current;
    journeyProgress.open = open.current;
    const total = spin.current * 0.62 + open.current * 0.38;
    journeyProgress.total = total;

    if (Math.abs(total - lastCss.current) > 0.0006) {
      lastCss.current = total;
      document.documentElement.style.setProperty(
        '--journey',
        total.toFixed(4),
      );
      document.documentElement.style.setProperty(
        '--book-open',
        open.current.toFixed(4),
      );
    }
  });

  return (
    <group ref={parallaxRef}>
      <group ref={floatRef}>
        <group ref={scaleRef}>
          <group
            ref={spinFrameRef}
            rotation={[BASE_TILT_X, 0, BASE_TILT_Z]}
          >
            <group ref={spinRef}>
              <BookModel
                textures={textures}
                coverHingeRef={coverHingeRef}
              />
              <pointLight
                ref={innerLightRef}
                position={[0, 0.4, 1.05]}
                color="#ffc98f"
                intensity={0}
                distance={4.5}
                decay={2}
              />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
